const debitNoteService = require('../services/debitNoteService');

async function issueDebitNote(req, res) {
  try { res.status(201).json(await debitNoteService.issueDebitNote({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listDebitNotes(req, res) { res.json(await debitNoteService.listDebitNotes(req.companyId, req.query)); }
async function voidDebitNote(req, res) {
  try { res.json(await debitNoteService.voidDebitNote(req.params.id, { ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { issueDebitNote, listDebitNotes, voidDebitNote };
