const audienceSegmentService = require('../services/audienceSegmentService');
const marketingJourneyService = require('../services/marketingJourneyService');

// --- Segments -------------------------------------------------------------

async function createSegment(req, res) {
  try {
    const segment = await audienceSegmentService.createSegment({ ...req.body, companyId: req.companyId });
    res.status(201).json(segment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listSegments(req, res) {
  res.json(await audienceSegmentService.listSegments(req.companyId));
}

async function getSegment(req, res) {
  const segment = await audienceSegmentService.getSegment(req.params.id, req.companyId);
  if (!segment) return res.status(404).json({ error: 'Segment not found.' });
  res.json(segment);
}

async function updateSegment(req, res) {
  try {
    res.json(await audienceSegmentService.updateSegment(req.params.id, req.companyId, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteSegment(req, res) {
  try {
    res.json(await audienceSegmentService.deleteSegment(req.params.id, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function previewSegment(req, res) {
  try {
    res.json(await audienceSegmentService.previewSegment(req.params.id, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Journeys ---------------------------------------------------------

async function createJourney(req, res) {
  try {
    const journey = await marketingJourneyService.createJourney({ ...req.body, companyId: req.companyId, userId: req.auth?.userId });
    res.status(201).json(journey);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listJourneys(req, res) {
  res.json(await marketingJourneyService.listJourneys(req.companyId));
}

async function getJourney(req, res) {
  const journey = await marketingJourneyService.getJourney(req.params.id, req.companyId);
  if (!journey) return res.status(404).json({ error: 'Journey not found.' });
  res.json(journey);
}

async function updateJourney(req, res) {
  try {
    res.json(await marketingJourneyService.updateJourney(req.params.id, req.companyId, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteJourney(req, res) {
  try {
    res.json(await marketingJourneyService.deleteJourney(req.params.id, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function startJourney(req, res) {
  try {
    const journey = await marketingJourneyService.setJourneyStatus(req.params.id, req.companyId, 'active');
    // If this is a segment_entry-trigger journey, enroll its current
    // members right away — future entrants require a re-scan job (not
    // built, see marketingJourneyService header comment), but manual
    // re-enrollment (POST /:id/enroll) works at any time regardless of
    // trigger type.
    let enrollResult = null;
    if (journey.trigger?.type === 'segment_entry' && journey.trigger.segmentId) {
      enrollResult = await marketingJourneyService.enrollSegmentMembers(journey._id, journey.trigger.segmentId, req.companyId);
    }
    res.json({ journey, enrollResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function pauseJourney(req, res) {
  try {
    res.json(await marketingJourneyService.setJourneyStatus(req.params.id, req.companyId, 'paused'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function enrollSegment(req, res) {
  try {
    const { segmentId } = req.body;
    if (!segmentId) return res.status(400).json({ error: 'segmentId is required.' });
    res.json(await marketingJourneyService.enrollSegmentMembers(req.params.id, segmentId, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function enrollCustomer(req, res) {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId is required.' });
    res.json(await marketingJourneyService.enrollCustomer(req.params.id, customerId, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function journeyStats(req, res) {
  try {
    res.json(await marketingJourneyService.journeyStats(req.params.id, req.companyId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createSegment, listSegments, getSegment, updateSegment, deleteSegment, previewSegment,
  createJourney, listJourneys, getJourney, updateJourney, deleteJourney,
  startJourney, pauseJourney, enrollSegment, enrollCustomer, journeyStats,
};
