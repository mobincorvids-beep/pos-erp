/**
 * ConsolidatedReportService — combined reporting across a company group
 * (a holding business's several registered companies). Security matters
 * here more than almost anywhere else in the app: this is the one place a
 * single request legitimately spans more than one Company document, so
 * every function takes the REQUESTING company's ID and derives the group
 * from it — a tenant can never ask for an arbitrary list of companyIds and
 * get back data for companies they have no relationship to.
 */
const Company = require('../models/Company');
const reportingService = require('./reportingService');

/**
 * The group a company belongs to: its parent (if it has one) plus every
 * other company pointing at that same parent — or, if the company itself
 * has no parent but other companies point AT it, itself plus its children.
 * A company with no parent and no children is a "group of one".
 */
async function getCompanyGroup(companyId) {
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found.');

  const rootId = company.parentCompanyId || company._id;
  const group = await Company.find({
    $or: [{ _id: rootId }, { parentCompanyId: rootId }],
  });

  // Defensive: if for some reason the root itself isn't in the result
  // (e.g. it was deleted but children still point at it), don't silently
  // drop it from consideration — group membership should never be ambiguous.
  if (!group.some((c) => String(c._id) === String(rootId))) {
    const root = await Company.findById(rootId);
    if (root) group.push(root);
  }

  return group;
}

/** Confirms requestingCompanyId and targetCompanyId are in the same group before letting a consolidated call touch targetCompanyId's data. */
async function assertSameGroup(requestingCompanyId, targetCompanyId) {
  const group = await getCompanyGroup(requestingCompanyId);
  if (!group.some((c) => String(c._id) === String(targetCompanyId))) {
    throw new Error('That company is not in your company group.');
  }
}

/** Combined sales summary across every company in the requester's group, broken down per-company and totaled. */
async function consolidatedSalesSummary(requestingCompanyId, from, to) {
  const group = await getCompanyGroup(requestingCompanyId);

  const perCompany = await Promise.all(group.map(async (company) => {
    const summary = await reportingService.salesSummary(company._id, from, to);
    return { companyId: company._id, companyName: company.name, ...summary.summary };
  }));

  const totals = perCompany.reduce((acc, c) => ({
    netSales: acc.netSales + c.netSales,
    grossSales: acc.grossSales + c.grossSales,
    totalDiscount: acc.totalDiscount + c.totalDiscount,
    totalTax: acc.totalTax + c.totalTax,
    totalDue: acc.totalDue + c.totalDue,
    invoiceCount: acc.invoiceCount + c.invoiceCount,
  }), { netSales: 0, grossSales: 0, totalDiscount: 0, totalTax: 0, totalDue: 0, invoiceCount: 0 });

  return {
    from, to,
    companies: perCompany.map((c) => ({ ...c, netSales: Math.round(c.netSales * 100) / 100 })),
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, typeof v === 'number' && k !== 'invoiceCount' ? Math.round(v * 100) / 100 : v])),
  };
}

/** Combined trial balance across the group — each company's accounts stay separate (a group doesn't share a chart of accounts), just listed together with a grand total debit/credit for a sanity check across the whole group. */
async function consolidatedTrialBalance(requestingCompanyId, asOfDate) {
  const group = await getCompanyGroup(requestingCompanyId);

  const perCompany = await Promise.all(group.map(async (company) => {
    const tb = await reportingService.trialBalance(company._id, asOfDate);
    return { companyId: company._id, companyName: company.name, totalDebit: tb.totalDebit, totalCredit: tb.totalCredit, balanced: tb.balanced };
  }));

  const totalDebit = Math.round(perCompany.reduce((s, c) => s + c.totalDebit, 0) * 100) / 100;
  const totalCredit = Math.round(perCompany.reduce((s, c) => s + c.totalCredit, 0) * 100) / 100;

  return { asOfDate, companies: perCompany, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

module.exports = { getCompanyGroup, assertSameGroup, consolidatedSalesSummary, consolidatedTrialBalance };
