const { Schema, model } = require('mongoose');

/**
 * SupplierCatalogItem — one line of a supplier-maintained price/SKU
 * catalog, browsed by staff inside this app ("shop the supplier's
 * catalog") and turned directly into a PurchaseRequisition/PurchaseOrder
 * line. This is the internal-facing half of "punchout": same end result
 * for the buyer (pick items from the supplier's own catalog, they flow
 * into procurement) as real cXML/OCI punchout, but without the live
 * redirect-to-supplier-website round trip, since that protocol needs a
 * specific supplier's punchout endpoint URL/credentials this app has no
 * way to obtain generically. If a real punchout integration is added
 * later for a specific supplier, it can populate/refresh these same rows
 * instead of (or alongside) the supplier maintaining them by hand here.
 */
const supplierCatalogItemSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  // Optional link to an existing internal Product — lets a "shopped" item
  // convert straight to a PO line with the right internal productId
  // already resolved. Null means this is a catalog-only item with no
  // internal product match yet (still requisitionable — see
  // punchoutService.createRequisitionFromCart — just without stock/product
  // reporting tying back to it).
  productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  supplierSku: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  unitCost: { type: Number, required: true, min: 0 },
  moq: { type: Number, default: 1, min: 1 }, // minimum order quantity
  leadTimeDays: { type: Number, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

supplierCatalogItemSchema.index({ companyId: 1, supplierId: 1, supplierSku: 1 }, { unique: true });
supplierCatalogItemSchema.index({ companyId: 1, name: 'text', description: 'text' });

module.exports = model('SupplierCatalogItem', supplierCatalogItemSchema);
