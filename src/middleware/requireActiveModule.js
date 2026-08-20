const Company = require('../models/Company');

/**
 * Gates an industry module's routes behind Company.activeModules — the
 * SAME check was previously copy-pasted into all 8 industry module route
 * files (Restaurant, Pharmacy, Salon, Jewelry, Hotel, School, Distribution,
 * Banquet), which meant fixing a bug or changing the error message in this
 * logic required editing eight files identically and hoping none drifted.
 * One shared middleware factory, one place to fix.
 *
 * Usage: router.use(requireActiveModule('salon'))
 */
function requireActiveModule(moduleKey) {
  return async (req, res, next) => {
    const company = await Company.findById(req.companyId);
    if (!company?.activeModules?.includes(moduleKey)) {
      return res.status(403).json({ error: `${moduleKey[0].toUpperCase()}${moduleKey.slice(1)} module is not enabled for this company.` });
    }
    next();
  };
}

module.exports = { requireActiveModule };
