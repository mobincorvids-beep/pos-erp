const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..', 'modules');

/**
 * Scans src/modules/ for every folder containing a manifest.js, and mounts
 * its routes/index.js at the manifest's declared mountPath. This is the
 * entire mechanism that makes adding a new industry module a "drop in a
 * folder" operation instead of a "remember to also edit routes/index.js"
 * operation — the second kind is exactly how drift happens (a module gets
 * built, works fine in isolation, and is invisible in production because
 * the one line mounting it was never added).
 *
 * A module folder is REQUIRED to have both manifest.js and routes/index.js
 * to be mounted — a folder with only one or the other is skipped with a
 * console warning rather than crashing the whole server at startup, since
 * a half-finished module mid-development shouldn't be able to take down
 * every other module's routes.
 */
function mountIndustryModules(router) {
  if (!fs.existsSync(MODULES_DIR)) return; // no modules directory at all is a valid, if unusual, deployment — not an error

  const mounted = [];
  const skipped = [];

  for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleDir = path.join(MODULES_DIR, entry.name);
    const manifestPath = path.join(moduleDir, 'manifest.js');
    const routesPath = path.join(moduleDir, 'routes');

    const hasManifest = fs.existsSync(manifestPath);
    const hasRoutes = fs.existsSync(routesPath) || fs.existsSync(routesPath + '.js') || fs.existsSync(path.join(routesPath, 'index.js'));

    if (!hasManifest || !hasRoutes) {
      skipped.push({ folder: entry.name, hasManifest, hasRoutes });
      continue;
    }

    const manifest = require(manifestPath);
    if (!manifest.key || !manifest.mountPath) {
      skipped.push({ folder: entry.name, reason: 'manifest.js is missing a required key or mountPath field' });
      continue;
    }

    const routes = require(routesPath);
    router.use(manifest.mountPath, routes);
    mounted.push({ key: manifest.key, mountPath: manifest.mountPath });
  }

  console.log(`Industry modules auto-mounted: ${mounted.length} (${mounted.map((m) => m.key).join(', ')})`);
  if (skipped.length > 0) {
    console.warn(`Industry module folders skipped (incomplete — missing manifest.js or routes/index.js):`, skipped);
  }

  return { mounted, skipped };
}

module.exports = { mountIndustryModules, MODULES_DIR };
