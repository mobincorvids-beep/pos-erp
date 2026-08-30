/**
 * CategoryService — CRUD + tree assembly for Category, and the default
 * supermarket-style category/subcategory seed used at onboarding.
 *
 * A "subcategory" is not a separate model — it's just a Category whose
 * parentId points at another Category (see models/Category.js). getTree()
 * assembles the two-level nesting the UI needs from that flat collection.
 */
const Category = require('../models/Category');
const Product = require('../models/Product');

const UNCATEGORIZED_NAME = 'Uncategorized';

/** Comprehensive, professional-supermarket-style default tree. Each entry is
 * a top-level category name with its subcategory names. Used both to seed a
 * brand-new company at onboarding and to "reseed"/top-up an existing one. */
const DEFAULT_CATEGORY_TREE = [
  { name: 'Groceries & Staples', children: ['Rice & Grains', 'Flour & Atta', 'Pulses & Lentils', 'Cooking Oil & Ghee', 'Sugar & Salt', 'Spices & Masala'] },
  { name: 'Beverages', children: ['Soft Drinks', 'Juices', 'Tea & Coffee', 'Water', 'Energy Drinks'] },
  { name: 'Dairy & Eggs', children: ['Milk', 'Yogurt', 'Cheese', 'Butter & Cream', 'Eggs'] },
  { name: 'Bakery', children: ['Bread', 'Biscuits & Cookies', 'Cakes & Pastries', 'Rusk'] },
  { name: 'Snacks & Confectionery', children: ['Chips & Crisps', 'Namkeen', 'Chocolates', 'Candy'] },
  { name: 'Frozen Foods', children: ['Frozen Vegetables', 'Frozen Meat', 'Ice Cream'] },
  { name: 'Meat, Poultry & Fish', children: ['Chicken', 'Mutton/Beef', 'Fish & Seafood'] },
  { name: 'Fruits & Vegetables', children: ['Fresh Fruits', 'Fresh Vegetables'] },
  { name: 'Personal Care', children: ['Skin Care', 'Hair Care', 'Oral Care', 'Bath & Body'] },
  { name: 'Household & Cleaning', children: ['Detergents', 'Cleaning Supplies', 'Air Fresheners', 'Paper & Disposables'] },
  { name: 'Baby Care', children: ['Diapers', 'Baby Food', 'Baby Care Products'] },
  { name: 'Health & Wellness', children: ['Medicines/OTC', 'Vitamins & Supplements', 'First Aid'] },
  { name: 'Stationery & Electronics', children: ['Stationery', 'Mobile Accessories', 'Batteries'] },
  { name: 'Clothing & Apparel', children: ['Men', 'Women', 'Kids'] },
  { name: 'Home & Kitchen', children: ['Kitchenware', 'Cookware', 'Storage'] },
  { name: 'Pet Supplies', children: ['Pet Food', 'Pet Accessories'] },
  { name: 'Tobacco & Paan', children: ['Cigarettes', 'Paan & Accessories'] },
  { name: 'General/Miscellaneous', children: [] },
];

/**
 * Auto-heals any company that has zero categories — covers every company
 * created before this feature existed (onboardCompany seeds new ones at
 * creation time, but nothing ever backfilled companies that already
 * existed), so every business gets a working category tree the first time
 * anyone loads Products/POS/Categories, with no manual "reseed" click
 * required. Safe to call on every read: seedDefaultCategories itself is
 * idempotent (find-or-create by name), and this only even calls it when
 * the company truly has nothing yet.
 */
async function ensureSeeded(companyId) {
  const count = await Category.countDocuments({ companyId });
  if (count === 0) await seedDefaultCategories(companyId);
}

async function list(companyId) {
  await ensureSeeded(companyId);
  return Category.find({ companyId }).sort({ name: 1 });
}

/** Nests the flat Category collection by parentId — top-level categories with a `children` array of their subcategories. Only two levels deep, matching the data model. */
async function getTree(companyId) {
  await ensureSeeded(companyId);
  const categories = await Category.find({ companyId }).sort({ name: 1 }).lean();
  const byParent = new Map();
  for (const c of categories) {
    const key = c.parentId ? String(c.parentId) : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  const top = byParent.get(null) || [];
  return top.map((c) => ({ ...c, children: byParent.get(String(c._id)) || [] }));
}

async function create(companyId, { name, parentId = null }) {
  if (!name || !name.trim()) throw new Error('Category name is required.');
  if (parentId) {
    const parent = await Category.findOne({ _id: parentId, companyId });
    if (!parent) throw new Error('Parent category not found.');
    if (parent.parentId) throw new Error('Subcategories cannot themselves have subcategories — only two levels are supported.');
  }
  return Category.create({ companyId, name: name.trim(), parentId: parentId || null });
}

async function update(companyId, id, { name, parentId }) {
  const category = await Category.findOne({ _id: id, companyId });
  if (!category) throw new Error('Category not found.');
  if (name !== undefined) category.name = name.trim();
  if (parentId !== undefined) {
    if (parentId) {
      if (String(parentId) === String(id)) throw new Error('A category cannot be its own parent.');
      const parent = await Category.findOne({ _id: parentId, companyId });
      if (!parent) throw new Error('Parent category not found.');
      if (parent.parentId) throw new Error('Subcategories cannot themselves have subcategories — only two levels are supported.');
      const hasChildren = await Category.exists({ companyId, parentId: id });
      if (hasChildren) throw new Error('This category has subcategories of its own and cannot be turned into a subcategory.');
    }
    category.parentId = parentId || null;
  }
  await category.save();
  return category;
}

/** Refuses to delete a category with subcategories (clean up those first) or one still referenced by a product — the same "past records keep resolving" rule other reference data (Unit, ExpenseCategory) follows elsewhere in this app. */
async function remove(companyId, id) {
  const hasChildren = await Category.exists({ companyId, parentId: id });
  if (hasChildren) throw new Error('Remove or reassign its subcategories first.');
  const inUse = await Product.exists({ companyId, categoryId: id });
  if (inUse) throw new Error('This category is assigned to one or more products and cannot be removed.');
  const category = await Category.findOneAndDelete({ _id: id, companyId });
  if (!category) throw new Error('Category not found.');
  return category;
}

/** Finds-or-creates the per-company "Uncategorized" fallback — used both for legacy
 * products created before categoryId was required, and as a migration-safe default. */
async function getOrCreateUncategorized(companyId) {
  let category = await Category.findOne({ companyId, name: UNCATEGORIZED_NAME, parentId: null });
  if (!category) category = await Category.create({ companyId, name: UNCATEGORIZED_NAME, parentId: null });
  return category;
}

/** Seeds the full default supermarket tree for a company. Idempotent — matches
 * existing categories by name (case-insensitive) at each level and only creates
 * what's missing, so calling it again (e.g. "Reseed defaults") never duplicates. */
async function seedDefaultCategories(companyId) {
  let created = 0;
  for (const top of DEFAULT_CATEGORY_TREE) {
    let parent = await Category.findOne({ companyId, parentId: null, name: new RegExp(`^${escapeRegex(top.name)}$`, 'i') });
    if (!parent) {
      parent = await Category.create({ companyId, name: top.name, parentId: null });
      created++;
    }
    for (const childName of top.children) {
      const existingChild = await Category.findOne({ companyId, parentId: parent._id, name: new RegExp(`^${escapeRegex(childName)}$`, 'i') });
      if (!existingChild) {
        await Category.create({ companyId, name: childName, parentId: parent._id });
        created++;
      }
    }
  }
  return { created };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive find-or-create by name, scoped to a company and optional parent — used by the CSV importer to resolve "category"/"subcategory" text columns into real Category docs. */
async function findOrCreateByName(companyId, name, parentId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  let category = await Category.findOne({ companyId, parentId: parentId || null, name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') });
  if (!category) category = await Category.create({ companyId, name: trimmed, parentId: parentId || null });
  return category;
}

module.exports = {
  DEFAULT_CATEGORY_TREE, UNCATEGORIZED_NAME,
  list, getTree, create, update, remove,
  getOrCreateUncategorized, seedDefaultCategories, findOrCreateByName,
};
