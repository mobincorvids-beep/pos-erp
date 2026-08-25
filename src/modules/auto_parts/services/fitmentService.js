/**
 * FitmentService — vehicle-parts compatibility. Two lookup directions on
 * the same underlying data: "what fits my car" (the counter-staff
 * question) and "what does this part fit" (the product-page question).
 * Deliberately read-only against core Product — this module never touches
 * checkout, inventory, or accounting at all; a part found here is still
 * sold through the ordinary POS exactly like anything else, this only
 * helps a customer/staff member find the right one first.
 */
const Product = require('../../../models/Product');
const VehicleFitment = require('../models/VehicleFitment');

function addFitment(input) {
  const { companyId, productId, variantId, make, model: modelName, yearFrom, yearTo } = input;
  if (!make || !modelName) throw new Error('make and model are required.');
  if (yearFrom > yearTo) throw new Error('yearFrom cannot be after yearTo.');
  return VehicleFitment.create({ companyId, productId, variantId: variantId || null, make, model: modelName, yearFrom, yearTo });
}

function removeFitment(fitmentId) {
  return VehicleFitment.findByIdAndDelete(fitmentId);
}

/**
 * "What fits my car" — a year falls inside a fitment record's range if
 * yearFrom <= year <= yearTo (inclusive on both ends, the boundary years
 * themselves ARE compatible, not excluded).
 */
async function findPartsForVehicle(companyId, { make, model: modelName, year }) {
  const filter = { companyId, yearFrom: { $lte: year }, yearTo: { $gte: year } };
  if (make) filter.make = new RegExp(`^${make}$`, 'i');
  if (modelName) filter.model = new RegExp(`^${modelName}$`, 'i');

  const fitments = await VehicleFitment.find(filter).populate('productId', 'name sku sellingPrice');
  return fitments.map((f) => ({
    fitmentId: f._id, productId: f.productId?._id, productName: f.productId?.name,
    sku: f.productId?.sku, sellingPrice: f.productId?.sellingPrice, variantId: f.variantId,
    make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo,
  }));
}

/** The reverse direction — "what vehicles does this part fit," for a product detail page. */
function listFitmentsForProduct(companyId, productId) {
  return VehicleFitment.find({ companyId, productId }).sort({ make: 1, model: 1, yearFrom: 1 });
}

/** Corrects a fitment record's vehicle range/product mapping — pure lookup data, nothing downstream references a fitment record's own id, so a plain field update is safe. */
async function updateFitment(fitmentId, { make, model, yearFrom, yearTo, variantId }) {
  const fitment = await VehicleFitment.findById(fitmentId);
  if (!fitment) throw new Error('Fitment record not found.');
  if (make !== undefined) fitment.make = make;
  if (model !== undefined) fitment.model = model;
  if (yearFrom !== undefined) fitment.yearFrom = yearFrom;
  if (yearTo !== undefined) fitment.yearTo = yearTo;
  if (variantId !== undefined) fitment.variantId = variantId || null;
  if (fitment.yearFrom > fitment.yearTo) throw new Error('yearFrom cannot be after yearTo.');
  await fitment.save();
  return fitment;
}

module.exports = { addFitment, removeFitment, updateFitment, findPartsForVehicle, listFitmentsForProduct };
