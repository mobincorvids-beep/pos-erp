const creditNoteService = require('../services/creditNoteService');

async function issueCreditNote(req, res) {
  try { res.status(201).json(await creditNoteService.issueCreditNote({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCreditNotes(req, res) { res.json(await creditNoteService.listCreditNotes(req.companyId, req.query)); }
async function applyCreditNote(req, res) {
  try { res.json(await creditNoteService.applyCreditNote(req.params.id, { ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function voidCreditNote(req, res) {
  try { res.json(await creditNoteService.voidCreditNote(req.params.id, { ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { issueCreditNote, listCreditNotes, applyCreditNote, voidCreditNote };
