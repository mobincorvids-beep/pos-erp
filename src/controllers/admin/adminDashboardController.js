const Company = require('../../models/Company');
const User = require('../../models/User');
const Sale = require('../../models/Sale');

/** Platform-wide overview: total tenants, active vs suspended, users, and sales volume across ALL companies in the window. This is the one place in the whole app that legitimately queries across companyId boundaries. */
async function overview(req, res) {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const [totalCompanies, activeCompanies, totalUsers, salesTotals, byIndustry] = await Promise.all([
    Company.countDocuments({}),
    Company.countDocuments({ isActive: true }),
    User.countDocuments({}),
    Sale.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, netSales: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
    ]),
    Company.aggregate([{ $group: { _id: '$industryType', count: { $sum: 1 } } }]),
  ]);

  res.json({
    from, to,
    totalCompanies, activeCompanies, suspendedCompanies: totalCompanies - activeCompanies,
    totalUsers,
    platformNetSales: salesTotals[0]?.netSales || 0,
    platformInvoiceCount: salesTotals[0]?.invoiceCount || 0,
    byIndustry: byIndustry.map((r) => ({ industryType: r._id, count: r.count })),
  });
}

module.exports = { overview };
