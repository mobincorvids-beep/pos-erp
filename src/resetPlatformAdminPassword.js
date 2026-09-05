/**
 * Force-resets the platform-admin password, even if the account already
 * exists. Run with: node src/resetPlatformAdminPassword.js
 *
 * Usage:
 *   node src/resetPlatformAdminPassword.js
 *     -> resets platform-admin@muhasib.test to a freshly generated random password (printed once)
 *
 *   node src/resetPlatformAdminPassword.js you@yourdomain.com MyNewPass123
 *     -> resets (or creates) that specific email with that specific password
 */
require('dotenv').config();
const crypto = require('crypto');
const connectDB = require('./config/db');
const PlatformAdmin = require('./models/PlatformAdmin');

async function main() {
  await connectDB();

  const email = (process.argv[2] || 'platform-admin@muhasib.test').toLowerCase();
  const password = process.argv[3] || crypto.randomBytes(9).toString('base64url');

  let admin = await PlatformAdmin.findOne({ email });
  if (!admin) {
    admin = new PlatformAdmin({ name: 'Platform Admin', email, role: 'admin' });
    console.log('No existing account for that email — creating a new one.');
  } else {
    console.log('Existing account found — resetting its password.');
  }

  admin.isActive = true;
  await admin.setPassword(password);
  await admin.save();

  console.log('\nDone. Login with:');
  console.log({ email, password, loginUrl: '/admin/login' });
  console.log('\nChange this password again once you are logged in — it was just printed to this terminal.');

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = main;