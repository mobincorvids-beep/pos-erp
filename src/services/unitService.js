/**
 * UnitService — real CRUD over the Unit model, which had conversion math
 * (unitConversionService) and a schema built around it, but no actual way
 * for a company to create or list its own units at all — a genuine gap,
 * confirmed by checking for a route before assuming one existed.
 */
const Unit = require('../models/Unit');

function createUnit(input) {
  const { companyId, name, shortCode, baseUnitId, conversionFactor } = input;
  if (baseUnitId && (!conversionFactor || conversionFactor <= 0)) {
    throw new Error('conversionFactor must be greater than zero when baseUnitId is set.');
  }
  return Unit.create({ companyId, name, shortCode, baseUnitId: baseUnitId || null, conversionFactor: baseUnitId ? conversionFactor : 1 });
}

function listUnits(companyId) {
  return Unit.find({ companyId }).populate('baseUnitId', 'name shortCode').sort({ name: 1 });
}

/** Was missing, a wrong conversion factor or renamed unit had no way to be fixed. */
function updateUnit(companyId, id, updates) {
  const { name, shortCode, baseUnitId, conversionFactor } = updates;
  if (baseUnitId !== undefined && baseUnitId && (!conversionFactor || conversionFactor <= 0)) {
    throw new Error('conversionFactor must be greater than zero when baseUnitId is set.');
  }
  const set = {};
  if (name !== undefined) set.name = name;
  if (shortCode !== undefined) set.shortCode = shortCode;
  if (baseUnitId !== undefined) set.baseUnitId = baseUnitId || null;
  if (conversionFactor !== undefined) set.conversionFactor = conversionFactor;
  return Unit.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Was missing, no way to remove a unit created by mistake. Products reference units by id
 * and simply keep the stale reference if this is ever removed while in use, same as every
 * other reference field in this codebase. */
function deleteUnit(companyId, id) {
  return Unit.findOneAndDelete({ _id: id, companyId });
}

module.exports = { createUnit, listUnits, updateUnit, deleteUnit };
