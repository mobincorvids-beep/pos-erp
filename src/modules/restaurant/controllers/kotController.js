const KitchenOrderTicket = require('../models/KitchenOrderTicket');
const Table = require('../models/Table');

/** Was missing entirely — the KitchenOrderTicket model existed but had no
 * controller or routes, so there was no way to open an order against a
 * table, send items to the kitchen, or track per-item prep status. Tables
 * could be created and marked occupied, but nothing actually recorded what
 * was ordered. */

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.tableId) filter.tableId = req.query.tableId;
  if (req.query.status) filter.status = req.query.status;
  const kots = await KitchenOrderTicket.find(filter).sort({ createdAt: -1 }).populate('items.productId', 'name');
  res.json(kots);
}

async function get(req, res) {
  const kot = await KitchenOrderTicket.findOne({ _id: req.params.id, companyId: req.companyId }).populate('items.productId', 'name');
  if (!kot) return res.status(404).json({ error: 'Order ticket not found.' });
  res.json(kot);
}

/** Opens a new order against a table (marks it occupied) with its first round of items. */
async function create(req, res) {
  try {
    const { tableId, branchId, items } = req.body;
    if (!tableId || !branchId) throw new Error('tableId and branchId are required.');
    if (!items || items.length === 0) throw new Error('At least one item is required to open an order.');

    const table = await Table.findOne({ _id: tableId, companyId: req.companyId });
    if (!table) throw new Error('Table not found.');

    const kot = await KitchenOrderTicket.create({
      companyId: req.companyId, branchId, tableId,
      items: items.map((i) => ({ ...i, status: 'pending' })),
      status: 'sent_to_kitchen', userId: req.auth.userId,
    });

    table.status = 'occupied';
    await table.save();

    res.status(201).json(kot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Adds another round of items to an already-open order (e.g. the table orders dessert later). */
async function addItems(req, res) {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) throw new Error('At least one item is required.');

    const kot = await KitchenOrderTicket.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!kot) return res.status(404).json({ error: 'Order ticket not found.' });
    if (kot.status === 'closed') throw new Error('Cannot add items to a closed order.');

    kot.items.push(...items.map((i) => ({ ...i, status: 'pending' })));
    kot.status = 'sent_to_kitchen';
    await kot.save();
    res.json(kot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Updates one line's kitchen status (pending -> preparing -> ready -> served). */
async function updateItemStatus(req, res) {
  const { status } = req.body;
  const kot = await KitchenOrderTicket.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!kot) return res.status(404).json({ error: 'Order ticket not found.' });

  const item = kot.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Order item not found.' });
  item.status = status;
  await kot.save();
  res.json(kot);
}

/** Closes the order once it's been billed through POS checkout (pass the resulting saleId)
 * and frees the table back to 'free'. Billing itself stays in posSaleService/PosPage —
 * this only records which sale paid for this ticket and closes the loop. */
async function close(req, res) {
  const kot = await KitchenOrderTicket.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!kot) return res.status(404).json({ error: 'Order ticket not found.' });

  kot.status = 'closed';
  if (req.body.saleId) kot.saleId = req.body.saleId;
  await kot.save();

  await Table.findOneAndUpdate({ _id: kot.tableId, companyId: req.companyId }, { status: 'free' });
  res.json(kot);
}

/** Cancels an open order without billing it (e.g. a walk-in that leaves) — frees the table. */
async function cancel(req, res) {
  const kot = await KitchenOrderTicket.findOneAndDelete({ _id: req.params.id, companyId: req.companyId, status: { $ne: 'closed' } });
  if (!kot) return res.status(404).json({ error: 'Order ticket not found, or it has already been closed/billed.' });
  await Table.findOneAndUpdate({ _id: kot.tableId, companyId: req.companyId }, { status: 'free' });
  res.json({ ok: true });
}

module.exports = { list, get, create, addItems, updateItemStatus, close, cancel };
