/**
 * FabricRollService — continuous-length roll tracking with automatic
 * remnant reclassification. cutFromRoll() is where the genuinely new
 * behavior lives: cutting fabric doesn't just reduce a number, it can
 * autonomously flip the roll's own status the moment its remaining length
 * crosses below remnantThreshold — no separate "check for remnants" step
 * anyone has to remember to run, the transition happens as a direct,
 * inescapable consequence of the cut itself.
 */
const mongoose = require('mongoose');
const FabricRoll = require('../models/FabricRoll');
const inventoryService = require('../../../services/inventoryService');

async function receiveRoll(input) {
  const { companyId, productId, variantId, warehouseId, rollNumber, unitOfMeasure, length, unitCost, remnantThreshold, userId } = input;
  if (!length || length <= 0) throw new Error('length must be greater than zero.');

  const session = await mongoose.startSession();
  try {
    let roll;
    await session.withTransaction(async () => {
      [roll] = await FabricRoll.create(
        [{ companyId, productId, variantId, warehouseId, rollNumber, unitOfMeasure: unitOfMeasure || 'meters', originalLength: length, remainingLength: length, remnantThreshold: remnantThreshold ?? 5 }],
        { session }
      );

      await inventoryService.recordMovement({
        companyId, warehouseId, productId, variantId,
        type: 'adjustment', quantity: length, unitCost: unitCost || 0,
        referenceType: 'FabricRoll', referenceId: roll._id, userId,
        note: `Received roll ${rollNumber} — ${length} ${roll.unitOfMeasure}`,
      }, session);
    });
    return roll;
  } finally {
    session.endSession();
  }
}

function listRolls(companyId, { status, productId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (productId) filter.productId = productId;
  return FabricRoll.find(filter).populate('productId', 'name').sort({ rollNumber: 1 });
}

/**
 * Cuts a length from a roll — reduces remainingLength, deducts the same
 * amount from real stock (the same unit that tracks "quantity" for any
 * other product), and automatically transitions status:
 * remainingLength === 0 -> 'exhausted'; below remnantThreshold (but > 0)
 * -> 'remnant'; otherwise stays 'active'. This is the one place in the
 * whole app where a quantity depleting on its own crosses a threshold and
 * reclassifies the resource, rather than a person deciding to mark it that way.
 */
async function cutFromRoll(rollId, { lengthToCut, userId }) {
  const session = await mongoose.startSession();
  try {
    let roll;
    await session.withTransaction(async () => {
      roll = await FabricRoll.findById(rollId).session(session);
      if (!roll) throw new Error('Roll not found.');
      if (roll.status === 'exhausted') throw new Error('This roll is exhausted — nothing left to cut.');
      if (!lengthToCut || lengthToCut <= 0) throw new Error('lengthToCut must be greater than zero.');
      if (lengthToCut > roll.remainingLength) throw new Error(`Cannot cut ${lengthToCut} ${roll.unitOfMeasure} — only ${roll.remainingLength} remain on this roll.`);

      await inventoryService.recordMovement({
        companyId: roll.companyId, warehouseId: roll.warehouseId,
        productId: roll.productId, variantId: roll.variantId,
        type: 'adjustment', quantity: -lengthToCut,
        referenceType: 'FabricRoll', referenceId: roll._id, userId,
        note: `Cut ${lengthToCut} ${roll.unitOfMeasure} from roll ${roll.rollNumber}`,
      }, session);

      roll.remainingLength = Math.round((roll.remainingLength - lengthToCut) * 100) / 100;

      if (roll.remainingLength <= 0) {
        roll.status = 'exhausted';
      } else if (roll.remainingLength < roll.remnantThreshold) {
        roll.status = 'remnant';
      }
      // else: stays whatever it already was (active) — cutting from an
      // already-active roll that's still above threshold changes nothing
      // about its status, only its remaining length.

      await roll.save({ session });
    });
    return roll;
  } finally {
    session.endSession();
  }
}

module.exports = { receiveRoll, listRolls, cutFromRoll };
