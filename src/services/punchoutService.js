/**
 * PunchoutService — the internal-facing half of "procurement punchout".
 * Real punchout (cXML/OCI, the protocol Amazon Business/Staples-style
 * supplier catalogs use) needs a specific supplier's live punchout
 * endpoint URL and credentials — there is no generic version of that to
 * build without a supplier on the other end. What this DOES give you,
 * fully working today with no external party involved: each supplier
 * maintains their own price/SKU catalog through the supplier portal
 * (supplierPortalController.catalogUpsert/List/Remove), staff "shop" that
 * catalog inside this app (browseCatalog/search here), and selected items
 * flow straight into a real PurchaseRequisition — same end-to-end user
 * experience as punchout, just without the live redirect-to-supplier-site
 * step. If a genuine cXML/OCI integration is added later for a specific
 * supplier, it can populate/refresh these same SupplierCatalogItem rows
 * instead of the supplier maintaining them by hand.
 */
const SupplierCatalogItem = require('../models/SupplierCatalogItem');
const requisitionService = require('./requisitionService');

async function upsertCatalogItem(companyId, supplierId, { supplierSku, name, description, unitCost, moq, leadTimeDays, productId, itemId }) {
  if (!supplierSku || !name) throw new Error('supplierSku and name are required.');
  if (unitCost == null || unitCost < 0) throw new Error('unitCost must be a non-negative number.');

  if (itemId) {
    const item = await SupplierCatalogItem.findOneAndUpdate(
      { _id: itemId, companyId, supplierId },
      { name, description, unitCost, moq: moq || 1, leadTimeDays: leadTimeDays ?? null, productId: productId || null, isActive: true },
      { new: true }
    );
    if (!item) throw new Error('Catalog item not found.');
    return item;
  }

  return SupplierCatalogItem.findOneAndUpdate(
    { companyId, supplierId, supplierSku },
    { name, description, unitCost, moq: moq || 1, leadTimeDays: leadTimeDays ?? null, productId: productId || null, isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function listMyCatalog(companyId, supplierId) {
  return SupplierCatalogItem.find({ companyId, supplierId }).sort({ name: 1 });
}

async function removeCatalogItem(companyId, supplierId, itemId) {
  const result = await SupplierCatalogItem.findOneAndUpdate({ _id: itemId, companyId, supplierId }, { isActive: false });
  if (!result) throw new Error('Catalog item not found.');
  return result;
}

/** Staff-side: browse/search every active supplier's catalog, or one supplier's. */
async function browseCatalog(companyId, { supplierId, search } = {}) {
  const filter = { companyId, isActive: true };
  if (supplierId) filter.supplierId = supplierId;
  if (search) filter.$text = { $search: search };
  return SupplierCatalogItem.find(filter).populate('supplierId', 'name').sort(search ? { score: { $meta: 'textScore' } } : { name: 1 });
}

/**
 * Turns a staff-picked cart of catalog items into a real
 * PurchaseRequisition — the "checkout" step of the internal punchout flow.
 * Every cart line's item must already be linked to an internal Product
 * (SupplierCatalogItem.productId) since a requisition line needs a real
 * productId/variantId to become stock later; an unlinked catalog item is
 * still browsable/quotable, just needs linking (via upsertCatalogItem's
 * productId) before it can be requisitioned this way.
 */
async function createRequisitionFromCart(companyId, { branchId, cart, requestedBy, note }) {
  if (!cart || !cart.length) throw new Error('Cart is empty.');

  const items = [];
  for (const line of cart) {
    const catalogItem = await SupplierCatalogItem.findOne({ _id: line.itemId, companyId, isActive: true });
    if (!catalogItem) throw new Error(`Catalog item ${line.itemId} not found.`);
    if (!catalogItem.productId) {
      throw new Error(`"${catalogItem.name}" isn't linked to an internal product yet — link it (via the catalog item's productId) before requisitioning it.`);
    }
    const quantity = line.quantity || catalogItem.moq;
    if (quantity < catalogItem.moq) {
      throw new Error(`"${catalogItem.name}" has a minimum order quantity of ${catalogItem.moq}.`);
    }
    items.push({
      productId: catalogItem.productId,
      variantId: catalogItem.productId, // no separate variant selection in this flow — same "product id doubles as its own default variant" convention consumptionService/vmiService use elsewhere
      quantityRequested: quantity,
      note: `From ${catalogItem.name} (SKU ${catalogItem.supplierSku}) @ ${catalogItem.unitCost}/unit`,
    });
  }

  return requisitionService.create({ companyId, branchId, items, requestedBy, note });
}

module.exports = { upsertCatalogItem, listMyCatalog, removeCatalogItem, browseCatalog, createRequisitionFromCart };
