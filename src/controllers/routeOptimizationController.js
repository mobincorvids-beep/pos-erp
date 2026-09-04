const routeOptimizationService = require('../services/routeOptimizationService');

async function optimizeVehicleRoute(req, res) {
  try {
    const { vehicleId } = req.params;
    const { depotLat, depotLng, date, dryRun } = req.body || {};
    if (depotLat == null || depotLng == null) {
      return res.status(400).json({ error: 'depotLat and depotLng are required.' });
    }
    const result = await routeOptimizationService.optimizeVehicleRoute(
      req.companyId, vehicleId, { lat: Number(depotLat), lng: Number(depotLng) },
      { date, dryRun: !!dryRun }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { optimizeVehicleRoute };
