/**
 * Module manifest — the single source of truth this module carries about
 * itself. routes/index.js auto-discovers and mounts every module with one
 * of these; industries.js's INDUSTRIES catalog is built FROM these rather
 * than duplicating the same key/label/category by hand in a second file —
 * the exact "two places to keep in sync" problem this whole registry
 * system exists to remove. Adding a new industry module now means: create
 * the folder, add this file, done — no other file needs editing to make
 * the backend aware it exists.
 */
module.exports = {
  key: 'cafe',
  label: 'Cafe',
  category: 'Food & Hospitality',
  mountPath: '/cafe',
  optionalModuleLabel: 'Cafe (daily-resetting subscription redemption cap)', // richer description shown in the Optional Modules toggle list specifically
};
