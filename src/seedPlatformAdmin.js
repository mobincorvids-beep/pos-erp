/**
 * Seeds one platform-admin account — the login for the /admin section of
 * the app, separate from any tenant company's users. Run with: npm run seed:admin
 */
require('dotenv').config();
const connectDB = require('./config/db');
const PlatformAdmin = require('./models/PlatformAdmin');

async function seed() {
  await connectDB();

  const email = 'platform-admin@muhasib.test';
  const existing = await PlatformAdmin.findOne({ email });
  if (existing) {
    console.log('Platform admin already exists:', email);
    process.exit(0);
  }

  const admin = new PlatformAdmin({ name: 'Platform Admin', email, role: 'admin' });
  await admin.setPassword('admin12345');
  await admin.save();

  console.log('Platform admin created:');
  console.log({ email, password: 'admin12345', loginUrl: '/admin/login (in the client)' });

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
