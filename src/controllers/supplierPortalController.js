const supplierPortalService = require('../services/supplierPortalService');
const vmiService = require('../services/vmiService');
const punchoutService = require('../services/punchoutService');

// --- Staff-side (uses normal staff auth — inviting a supplier to the portal) ---
async function invite(req, res) {
  try {
    const result = await supplierPortalService.invite({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    // Delivery of the invite (email/SMS/copy-link) is out of scope here,
    // same as portalController.invite — returned directly to the caller.
    res.status(201).json({ supplierPortalUserId: result.supplierPortalUserId, inviteToken: result.inviteToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Portal-side (supplier's own session) ---
function deviceContext(req) {
  return { ipAddress: req.ip, userAgent: req.get('User-Agent') || null };
}

async function activateInvite(req, res) {
  try {
    await supplierPortalService.activateInvite(req.body.inviteToken, req.body.password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const result = await supplierPortalService.login({ email: req.body.email, password: req.body.password, deviceContext: deviceContext(req) });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function refresh(req, res) {
  try { res.json(await supplierPortalService.refresh(req.body.refreshToken)); }
  catch (err) { res.status(401).json({ error: err.message }); }
}

async function dashboard(req, res) {
  res.json(await supplierPortalService.dashboard(req.supplierPortalAuth.supplierId));
}

async function myPurchaseOrders(req, res) {
  res.json(await supplierPortalService.myPurchaseOrders(req.supplierPortalAuth.supplierId, req.query));
}

async function getPurchaseOrder(req, res) {
  try { res.json(await supplierPortalService.getPurchaseOrder(req.supplierPortalAuth.supplierId, req.params.poId)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}

async function myPayments(req, res) {
  res.json(await supplierPortalService.myPayments(req.supplierPortalAuth.supplierId));
}

// --- VMI (Vendor-Managed Inventory) — supplier-portal-side ---
async function vmiVisibility(req, res) {
  try { res.json(await vmiService.getSupplierVisibility(req.supplierPortalAuth.companyId, req.supplierPortalAuth.supplierId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function vmiPropose(req, res) {
  try {
    const proposal = await vmiService.proposeReplenishment(req.supplierPortalAuth.companyId, req.params.agreementId, {
      proposedQty: req.body?.proposedQty, supplierId: req.supplierPortalAuth.supplierId,
    });
    res.json(proposal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function vmiMyProposals(req, res) {
  try { res.json(await vmiService.listProposals(req.supplierPortalAuth.companyId, { supplierId: req.supplierPortalAuth.supplierId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

// --- Punchout-style catalog — supplier-portal-side ---
async function catalogUpsert(req, res) {
  try {
    const catalog = await punchoutService.upsertCatalogItem(req.supplierPortalAuth.companyId, req.supplierPortalAuth.supplierId, req.body);
    res.json(catalog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function catalogList(req, res) {
  try { res.json(await punchoutService.listMyCatalog(req.supplierPortalAuth.companyId, req.supplierPortalAuth.supplierId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function catalogRemove(req, res) {
  try {
    await punchoutService.removeCatalogItem(req.supplierPortalAuth.companyId, req.supplierPortalAuth.supplierId, req.params.itemId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  invite, activateInvite, login, refresh, dashboard, myPurchaseOrders, getPurchaseOrder, myPayments,
  vmiVisibility, vmiPropose, vmiMyProposals,
  catalogUpsert, catalogList, catalogRemove,
};
