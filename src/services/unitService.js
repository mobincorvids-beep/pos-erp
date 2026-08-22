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

module.exports = { createUnit, listUnits };
