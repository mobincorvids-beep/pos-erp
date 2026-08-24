/**
 * GiftRegistryService — a shared want-list multiple UNRELATED customers
 * buy against independently. The genuinely hard part, different from
 * every prior quota check in this app: Layaway's payment threshold and
 * Cafe's daily cap both belong to ONE customer acting alone, so a simple
 * "read, check, write" is safe — nobody else is racing them. A registry's
 * purchasedQuantity is touched by MANY different purchasers in MANY
 * separate, uncoordinated transactions, which means a naive read-then-
 * write has a real race window: two relatives buying the "same" gift
 * within milliseconds of each other could both pass a check that read a
 * stale value, together exceeding desiredQuantity. purchaseFromRegistry()
 * uses a single ATOMIC MongoDB update (arrayFilters + $expr) that only
 * succeeds if the increment still fits — the database itself enforces the
 * cap, not application code racing against another request.
 */
const mongoose = require('mongoose');
const GiftRegistry = require('../models/GiftRegistry');
const Product = require('../../../models/Product');
const posSaleService = require('../../../services/posSaleService');

function createRegistry(input) {
  const { companyId, branchId, ownerCustomerId, occasion, items } = input;
  if (!items || items.length === 0) throw new Error('At least one registry item is required.');
  return GiftRegistry.create({
    companyId, branchId, ownerCustomerId, occasion,
    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, desiredQuantity: i.desiredQuantity })),
  });
}

function getRegistry(registryId) {
  return GiftRegistry.findById(registryId).populate('ownerCustomerId', 'name').populate('items.productId', 'name sellingPrice');
}

function listRegistries(companyId, { ownerCustomerId, status } = {}) {
  const filter = { companyId };
  if (ownerCustomerId) filter.ownerCustomerId = ownerCustomerId;
  if (status) filter.status = status;
  return GiftRegistry.find(filter).populate('ownerCustomerId', 'name').sort({ createdAt: -1 });
}

/**
 * Atomically reserves `quantity` against one registry item — the update
 * only applies if purchasedQuantity + quantity still fits within
 * desiredQuantity, checked and applied in the SAME database operation via
 * an aggregation-pipeline update ($map/$cond over the items array), so
 * there's no window between reading the current total and writing the new
 * one for a second, concurrent purchase to slip through. MongoDB does NOT
 * allow $expr inside arrayFilters at all (a hard server-side restriction,
 * confirmed via a real "QueryFeatureNotAllowed" error) — a pipeline
 * update is the correct atomic mechanism for a conditional array-element
 * increment like this. Returns null (not a partial/incorrect update) if
 * the registry/item doesn't exist or the increment doesn't fit.
 */
async function reserveRegistryQuantity(registryId, itemId, quantity) {
  const itemObjId = new mongoose.Types.ObjectId(itemId);

  // Bypassing the Mongoose model method for this one call: pipeline-style
  // updates (an array as the update argument) go through the raw driver
  // cleanly, whereas Mongoose's update casting has known issues with
  // aggregation expressions inside array updates. The result is hydrated
  // back into a real Mongoose document so callers see the same shape as
  // before.
  const raw = await GiftRegistry.collection.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(registryId), status: 'active', 'items._id': itemObjId },
    [
      {
        $set: {
          items: {
            $map: {
              input: '$items',
              as: 'it',
              in: {
                $cond: [
                  { $eq: ['$$it._id', itemObjId] },
                  // Only the target item is touched. __reserveResult is
                  // ALWAYS explicitly set true or false here, every single
                  // call — never left as-is — so a later call can never
                  // inherit a stale "true" persisted by an earlier,
                  // unrelated successful call on this same item. That
                  // stale-marker bug is exactly what let two concurrent
                  // purchases both report success in testing: only the
                  // marker looked reserved, the second increment never
                  // actually applied.
                  {
                    $cond: [
                      { $lte: [{ $add: ['$$it.purchasedQuantity', quantity] }, '$$it.desiredQuantity'] },
                      {
                        $mergeObjects: [
                          '$$it',
                          { purchasedQuantity: { $add: ['$$it.purchasedQuantity', quantity] }, __reserveResult: true },
                        ],
                      },
                      { $mergeObjects: ['$$it', { __reserveResult: false }] },
                    ],
                  },
                  '$$it', // untouched — not the item this call is reserving against
                ],
              },
            },
          },
        },
      },
    ],
    { returnDocument: 'after' }
  );

  const doc = raw?.value ?? raw; // driver version differences: some return {value}, some return the doc directly
  if (!doc) return null; // registry not found, not active, or item doesn't exist at all

  const updatedItem = doc.items.find((it) => String(it._id) === String(itemId));
  const succeeded = updatedItem?.__reserveResult === true;
  // __reserveResult is a transient scratch field, not part of the schema —
  // Mongoose would silently ignore it on normal reads anyway, but strip it
  // here too so the object handed back to the caller is clean.
  doc.items.forEach((it) => { delete it.__reserveResult; });

  return succeeded ? GiftRegistry.hydrate(doc) : null;
}

/**
 * A different, unrelated customer buys `quantity` of one registry item —
 * bills THEM (not the registry owner), through the ordinary checkout. The
 * registry's shared counter is reserved atomically FIRST (cheap, and the
 * real gate against overselling the registry itself); if the actual
 * checkout then fails for any reason, the atomic reservation is rolled
 * back explicitly rather than left as a false "purchased" count with no
 * real sale behind it.
 */
async function purchaseFromRegistry(registryId, itemId, { quantity, purchasingCustomerId, branchId, warehouseId, paymentAccountId, posTerminalId, userId }) {
  if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');

  const reserved = await reserveRegistryQuantity(registryId, itemId, quantity);
  if (!reserved) {
    // Could be: registry doesn't exist, isn't active, item doesn't exist,
    // OR — the actual point of this whole function — someone else already
    // bought enough that this quantity no longer fits. Distinguish which,
    // for a genuinely useful error rather than one generic message.
    const registry = await GiftRegistry.findById(registryId);
    if (!registry) throw new Error('Registry not found.');
    if (registry.status !== 'active') throw new Error(`This registry is ${registry.status}.`);
    const item = registry.items.id(itemId);
    if (!item) throw new Error('Registry item not found.');
    const stillAvailable = item.desiredQuantity - item.purchasedQuantity;
    throw new Error(`Only ${stillAvailable} of this item remain unclaimed on the registry — someone else may have already purchased the rest.`);
  }

  const item = reserved.items.id(itemId);
  const product = await Product.findById(item.productId);
  const variant = product?.variants?.id(item.variantId);
  const unitPrice = variant?.sellingPrice ?? product?.sellingPrice ?? 0;
  const totalPrice = Math.round(unitPrice * quantity * 100) / 100;

  try {
    const sale = await posSaleService.checkout({
      companyId: reserved.companyId, branchId: branchId || reserved.branchId, warehouseId,
      customerId: purchasingCustomerId, posTerminalId, userId,
      items: [{ productId: item.productId, variantId: item.variantId, quantity, unitPrice }],
      payments: [{ paymentAccountId, method: 'cash', amount: totalPrice }],
    });
    return { registry: reserved, sale };
  } catch (err) {
    // The checkout failed AFTER the registry's shared counter was already
    // reserved — that reservation would now be a lie (nothing was
    // actually purchased), so it has to be rolled back explicitly, not
    // left to quietly overcount the registry forever.
    await GiftRegistry.updateOne(
      { _id: registryId, 'items._id': itemId },
      { $inc: { 'items.$.purchasedQuantity': -quantity } }
    );
    throw err;
  }
}

module.exports = { createRegistry, getRegistry, listRegistries, purchaseFromRegistry };
