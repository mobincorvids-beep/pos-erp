/**
 * WarehouseService — DC/branch hierarchy plumbing (Warehouse.warehouseType +
 * Warehouse.parentWarehouseId). Foundational only: no push/pull DRP
 * (replenishment) logic here, just a read of a warehouse's place in the
 * hierarchy — its parent DC (if any) and its child branches (if any).
 */
const Warehouse = require('../models/Warehouse');

/**
 * Resolves one warehouse's hierarchy: itself, its parent (typically a
 * distribution_center), and any children that point back at it via
 * parentWarehouseId. A standalone warehouse with no parent/children still
 * returns cleanly (parent: null, children: []) — nothing about existing
 * single-warehouse companies breaks.
 */
async function getHierarchy(companyId, warehouseId) {
  const warehouse = await Warehouse.findOne({ _id: warehouseId, companyId });
  if (!warehouse) throw new Error('Warehouse not found.');

  const [parent, children] = await Promise.all([
    warehouse.parentWarehouseId
      ? Warehouse.findOne({ _id: warehouse.parentWarehouseId, companyId })
      : null,
    Warehouse.find({ companyId, parentWarehouseId: warehouse._id }),
  ]);

  return { warehouse, parent, children };
}

module.exports = { getHierarchy };
