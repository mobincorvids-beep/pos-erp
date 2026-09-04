/**
 * RouteOptimizationService — multi-stop delivery sequencing for a fleet
 * trip. Deliberately a transparent, dependency-free heuristic (nearest-
 * neighbor construction + 2-opt improvement over straight-line/haversine
 * distance) rather than calling out to a paid routing API — this gets a
 * real, usually-close-to-optimal stop order using only data already in
 * this codebase (CoreShipment.destination.lat/lng, or a Customer's saved
 * lat/lng), with zero new external dependency or per-call cost. It does
 * NOT account for real road networks, one-way streets, or traffic — it
 * optimizes straight-line stop order, which is still a large practical
 * improvement over "whatever order the deliveries happened to be entered
 * in" for a driver doing 10+ drops a day. That limitation is documented
 * here rather than overclaiming turn-by-turn routing.
 */
const CoreShipment = require('../models/CoreShipment');

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function routeDistance(depot, stops, order) {
  let total = 0;
  let prev = depot;
  for (const idx of order) {
    total += haversineKm(prev, stops[idx]);
    prev = stops[idx];
  }
  return total;
}

/** Nearest-neighbor construction: from the depot, always go to whichever remaining stop is closest. */
function nearestNeighborOrder(depot, stops) {
  const remaining = stops.map((_, i) => i);
  const order = [];
  let current = depot;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, stops[remaining[i]]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    order.push(chosen);
    current = stops[chosen];
  }
  return order;
}

/** 2-opt local search: repeatedly reverses a segment of the route if doing so shortens total distance, until no single reversal helps. Standard, cheap improvement over a pure nearest-neighbor route (which is prone to "crossing its own path"). */
function twoOptImprove(depot, stops, order) {
  let improved = true;
  let best = order.slice();
  let bestDist = routeDistance(depot, stops, best);

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const candidateDist = routeDistance(depot, stops, candidate);
        if (candidateDist < bestDist - 1e-9) {
          best = candidate;
          bestDist = candidateDist;
          improved = true;
        }
      }
    }
  }
  return { order: best, distanceKm: Math.round(bestDist * 100) / 100 };
}

/**
 * Sequences a set of stops (each {lat, lng, ...}) starting from a depot
 * location. Returns the visiting order (as indices into the input stops
 * array), the optimized total distance, and — for comparison — the
 * distance of the naive input order, so the improvement is visible.
 */
function optimizeStopOrder(depot, stops) {
  if (!depot || depot.lat == null || depot.lng == null) {
    throw new Error('A depot with lat/lng is required.');
  }
  const usable = stops.filter((s) => s.lat != null && s.lng != null);
  if (usable.length === 0) return { order: [], distanceKm: 0, skippedStops: stops.length };

  const naiveOrder = usable.map((_, i) => i);
  const naiveDistance = Math.round(routeDistance(depot, usable, naiveOrder) * 100) / 100;

  const nn = nearestNeighborOrder(depot, usable);
  const { order, distanceKm } = twoOptImprove(depot, usable, nn);

  return {
    order: order.map((idx) => usable[idx]),
    distanceKm,
    naiveDistanceKm: naiveDistance,
    improvementKm: Math.round((naiveDistance - distanceKm) * 100) / 100,
    skippedStops: stops.length - usable.length,
  };
}

/**
 * Pulls every not-yet-delivered CoreShipment assigned to one vehicle,
 * sequences them from the given depot, and — unless dryRun is set —
 * writes the resulting position back onto each shipment's stopSequence
 * so a driver's app (or the existing shipment list) can just sort by it.
 */
async function optimizeVehicleRoute(companyId, vehicleId, depot, { date, dryRun = false } = {}) {
  const filter = {
    companyId, assignedVehicleId: vehicleId,
    status: { $nin: ['delivered', 'cancelled', 'failed', 'returned'] },
  };
  if (date) {
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: dayStart, $lte: dayEnd };
  }

  const shipments = await CoreShipment.find(filter);

  const stops = shipments.map((s) => ({
    shipmentId: s._id, lat: s.destination?.lat, lng: s.destination?.lng,
    name: s.destination?.name, city: s.destination?.city,
  }));

  const result = optimizeStopOrder(depot, stops);
  const orderedStops = result.order.map((stop, i) => ({ stopNumber: i + 1, ...stop }));

  if (!dryRun) {
    for (const stop of orderedStops) {
      await CoreShipment.findByIdAndUpdate(stop.shipmentId, { stopSequence: stop.stopNumber });
    }
  }

  return { vehicleId, ...result, order: orderedStops };
}

module.exports = { haversineKm, optimizeStopOrder, optimizeVehicleRoute };
