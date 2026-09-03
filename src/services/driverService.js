/**
 * DriverService — CRUD for fleet Driver profiles (license/document
 * tracking) plus the expiry sweep. getExpiringDriverDocuments() feeds INTO
 * the same real notification mechanism documentService.checkExpiringDocuments()
 * already uses (notificationService.notify, targeted at whichever role has
 * roles.manage — the same "whoever's actually responsible" escape hatch),
 * rather than duplicating a second expiry-alert engine: Driver license/doc
 * expiry just wasn't a shape documentService's generic Document collection
 * already covered (Document is keyed one-file-per-entity-version; a driver
 * needs a license expiry PLUS an arbitrary list of other documents each
 * with their own expiry, native fields on Driver itself per the gap spec).
 */
const Driver = require('../modules/logistics/models/Driver');
const notificationService = require('./notificationService');
const Role = require('../models/Role');

function listDrivers(companyId, { status, branchId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (branchId) filter.branchId = branchId;
  return Driver.find(filter).populate('userId', 'name').sort({ name: 1 });
}

async function getDriver(companyId, driverId) {
  const driver = await Driver.findOne({ _id: driverId, companyId }).populate('userId', 'name');
  if (!driver) throw new Error('Driver not found.');
  return driver;
}

function createDriver({ companyId, branchId, userId, name, phone, licenseNumber, licenseExpiry, otherDocuments, notes }) {
  if (!name || !name.trim()) throw new Error('name is required.');
  return Driver.create({
    companyId, branchId: branchId || null, userId: userId || null, name: name.trim(),
    phone: phone || '', licenseNumber: licenseNumber || '',
    licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
    otherDocuments: otherDocuments || [], notes: notes || '',
  });
}

async function updateDriver(companyId, driverId, patch) {
  const driver = await Driver.findOne({ _id: driverId, companyId });
  if (!driver) throw new Error('Driver not found.');
  ['branchId', 'userId', 'name', 'phone', 'licenseNumber', 'status', 'notes'].forEach((field) => {
    if (patch[field] !== undefined) driver[field] = patch[field];
  });
  if (patch.licenseExpiry !== undefined) {
    driver.licenseExpiry = patch.licenseExpiry ? new Date(patch.licenseExpiry) : null;
    driver.licenseExpiryNotified = false; // license was renewed/changed — re-arm the expiry alert
  }
  await driver.save();
  return driver;
}

/** Appends one other tracked document (medical cert, PSV badge, etc.) to a driver. */
async function addDriverDocument(companyId, driverId, { label, documentNumber, expiryDate, attachment }) {
  if (!label || !label.trim()) throw new Error('label is required.');
  const driver = await Driver.findOne({ _id: driverId, companyId });
  if (!driver) throw new Error('Driver not found.');
  driver.otherDocuments.push({
    label: label.trim(), documentNumber: documentNumber || '',
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    attachment: attachment || null, expiryNotified: false,
  });
  await driver.save();
  return driver;
}

/**
 * Finds every driver whose license and/or other tracked document expires
 * within `withinDays`, fires a real notification per expiring item (same
 * shape/target-audience documentService.checkExpiringDocuments uses), and
 * flags each notified item so a daily sweep doesn't re-alert on the same
 * expiry every run. Returns a count, same contract as
 * documentService.checkExpiringDocuments({ notifiedCount }).
 */
async function getExpiringDriverDocuments(companyId, withinDays = 30) {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const drivers = await Driver.find({
    companyId,
    $or: [
      { licenseExpiry: { $ne: null, $lte: cutoff, $gte: now }, licenseExpiryNotified: false },
      { 'otherDocuments.expiryDate': { $ne: null, $lte: cutoff, $gte: now }, 'otherDocuments.expiryNotified': false },
    ],
  });

  if (drivers.length === 0) return { notifiedCount: 0, items: [] };

  const roles = await Role.find({ companyId, permissions: { $in: ['roles.manage', '*'] } });
  let notifiedCount = 0;
  const items = [];

  for (const driver of drivers) {
    if (driver.licenseExpiry && !driver.licenseExpiryNotified && driver.licenseExpiry <= cutoff && driver.licenseExpiry >= now) {
      const daysRemaining = Math.ceil((driver.licenseExpiry - now) / (1000 * 60 * 60 * 24));
      for (const role of roles) {
        await notificationService.notify({
          companyId, roleId: role._id, type: 'driver_document_expiring',
          title: `Driver license expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
          message: `${driver.name}'s license (${driver.licenseNumber || 'no number on file'}) expires on ${driver.licenseExpiry.toDateString()}.`,
          entityType: 'Driver', entityId: driver._id,
        });
      }
      driver.licenseExpiryNotified = true;
      notifiedCount += 1;
      items.push({ driverId: driver._id, driverName: driver.name, document: 'license', expiryDate: driver.licenseExpiry });
    }

    for (const doc of driver.otherDocuments) {
      if (doc.expiryDate && !doc.expiryNotified && doc.expiryDate <= cutoff && doc.expiryDate >= now) {
        const daysRemaining = Math.ceil((doc.expiryDate - now) / (1000 * 60 * 60 * 24));
        for (const role of roles) {
          await notificationService.notify({
            companyId, roleId: role._id, type: 'driver_document_expiring',
            title: `${doc.label} expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
            message: `${driver.name}'s ${doc.label} expires on ${doc.expiryDate.toDateString()}.`,
            entityType: 'Driver', entityId: driver._id,
          });
        }
        doc.expiryNotified = true;
        notifiedCount += 1;
        items.push({ driverId: driver._id, driverName: driver.name, document: doc.label, expiryDate: doc.expiryDate });
      }
    }

    await driver.save();
  }

  return { notifiedCount, items };
}

module.exports = { listDrivers, getDriver, createDriver, updateDriver, addDriverDocument, getExpiringDriverDocuments };
