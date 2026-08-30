/**
 * CategoryService — CRUD + tree assembly for Category, and the default
 * supermarket-style category/subcategory seed used at onboarding.
 *
 * A "subcategory" is not a separate model — it's just a Category whose
 * parentId points at another Category (see models/Category.js). getTree()
 * assembles the two-level nesting the UI needs from that flat collection.
 */
const Company = require('../models/Company');
const Category = require('../models/Category');
const Product = require('../models/Product');

const UNCATEGORIZED_NAME = 'Uncategorized';

/** Comprehensive, professional-supermarket-style default tree — correct for the
 * generic 'retail' and 'grocery' industry types. Used as the fallback for any
 * industryType not explicitly covered below, since a broad product mix is the
 * safest default when we don't know the business better. */
const GROCERY_TREE = [
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

/** Fallback tree for any industryType not explicitly mapped below (or when the
 * company/industryType can't be resolved). Kept identical to the grocery tree —
 * broad product mix is the least-wrong default when we don't know the business. */
const DEFAULT_CATEGORY_TREE_FALLBACK = GROCERY_TREE;

/** Per-industry default category/subcategory trees, keyed by Company.industryType.
 * Same shape as the old single tree: an array of { name, children: [string...] }.
 * Covers every industryType folder under src/modules plus the generic 'retail'.
 * A handful of pure-service industries (insurance, ngo, professional_services,
 * real_estate, housing_society) intentionally get short, service-line-oriented
 * trees with few/no subcategories rather than forced physical-product categories. */
const DEFAULT_CATEGORY_TREES = {
  retail: GROCERY_TREE,
  grocery: GROCERY_TREE,

  pharmacy: [
    { name: 'Prescription Medicines', children: ['Antibiotics', 'Painkillers & Analgesics', 'Cardiac Medicines', 'Diabetes Medicines', 'Antihistamines & Allergy', 'Respiratory & Asthma', 'Gastro & Digestive', 'Psychiatric Medicines'] },
    { name: 'OTC Medicines', children: ['Cold & Flu', 'Cough Syrups', 'Fever & Pain Relief', 'Digestive Relief', 'Allergy Relief'] },
    { name: 'Vitamins & Supplements', children: ['Multivitamins', 'Minerals', 'Protein & Nutrition', 'Herbal Supplements'] },
    { name: 'Baby & Mother Care', children: ['Baby Formula', 'Diapers & Wipes', 'Baby Medicines', 'Maternity Care'] },
    { name: 'Personal Care', children: ['Oral Care', 'Hair Care', 'Bath & Hygiene', 'Deodorants'] },
    { name: 'Skin Care & Cosmetics', children: ['Moisturizers', 'Sunscreens', 'Acne & Dermatology', 'Cosmetics'] },
    { name: 'Medical Devices & Equipment', children: ['Blood Pressure Monitors', 'Glucometers & Strips', 'Thermometers', 'Nebulizers', 'Mobility Aids'] },
    { name: 'First Aid', children: ['Bandages & Dressings', 'Antiseptics', 'Adhesive Tapes', 'First Aid Kits'] },
    { name: 'Surgical & Wound Care', children: ['Gloves & Masks', 'Syringes & Needles', 'Wound Dressings', 'Sutures'] },
    { name: 'Convenience Items', children: ['Bottled Water', 'Packaged Snacks'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  pharmaceutical: [
    { name: 'Prescription Medicines', children: ['Antibiotics', 'Analgesics', 'Cardiac Medicines', 'Diabetes Medicines', 'Antihistamines', 'Respiratory Medicines', 'Oncology Medicines'] },
    { name: 'OTC Medicines', children: ['Cold & Flu', 'Digestive Relief', 'Pain Relief'] },
    { name: 'Vaccines & Biologics', children: ['Vaccines', 'Immunoglobulins', 'Biosimilars'] },
    { name: 'Vitamins & Supplements', children: ['Multivitamins', 'Minerals', 'Nutraceuticals'] },
    { name: 'Raw Materials & APIs', children: ['Active Pharmaceutical Ingredients', 'Excipients'] },
    { name: 'Medical Devices & Equipment', children: ['Diagnostic Devices', 'Monitoring Equipment'] },
    { name: 'Packaging Materials', children: ['Blister Packs', 'Bottles & Vials', 'Labels & Cartons'] },
    { name: 'Laboratory Reagents', children: ['Reagents', 'Test Kits'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  hospital: [
    { name: 'Pharmaceuticals', children: ['Antibiotics', 'Analgesics', 'Anesthetics', 'Emergency Drugs', 'IV Medications'] },
    { name: 'Surgical Supplies', children: ['Sutures', 'Surgical Instruments', 'Surgical Drapes', 'Sterilization Supplies'] },
    { name: 'Diagnostic Consumables', children: ['Blood Collection Supplies', 'Test Strips', 'Swabs & Specimen Containers'] },
    { name: 'Medical Equipment', children: ['Monitors', 'Ventilators', 'Infusion Pumps', 'Diagnostic Imaging Supplies'] },
    { name: 'PPE & Hygiene', children: ['Gloves', 'Masks & Respirators', 'Gowns', 'Hand Sanitizers'] },
    { name: 'Lab Reagents', children: ['Chemistry Reagents', 'Hematology Reagents', 'Microbiology Media'] },
    { name: 'IV & Fluids', children: ['IV Fluids', 'IV Sets & Cannulas', 'Blood Bags'] },
    { name: 'Orthopedic Supplies', children: ['Casts & Splints', 'Braces', 'Implants'] },
    { name: 'Patient Care Supplies', children: ['Bedding & Linens', 'Wound Care', 'Catheters'] },
    { name: 'Dental Supplies', children: ['Dental Instruments', 'Dental Materials'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  restaurant: [
    { name: 'Beverages', children: ['Soft Drinks', 'Juices', 'Tea & Coffee', 'Mocktails', 'Water'] },
    { name: 'Appetizers', children: ['Soups', 'Salads', 'Starters'] },
    { name: 'Main Course', children: ['BBQ & Grill', 'Curries', 'Rice & Biryani', 'Pasta & Noodles', 'Seafood'] },
    { name: 'Fast Food', children: ['Burgers', 'Pizza', 'Sandwiches', 'Fried Chicken'] },
    { name: 'Desserts', children: ['Cakes', 'Ice Cream', 'Puddings'] },
    { name: 'Bakery Items', children: ['Bread', 'Pastries'] },
    { name: 'Raw Ingredients', children: ['Meat & Poultry', 'Vegetables', 'Spices & Condiments', 'Dairy'] },
    { name: 'Condiments & Sauces', children: ['Ketchup & Mayo', 'Hot Sauces', 'Dressings'] },
    { name: 'Packaging & Disposables', children: ['Takeaway Boxes', 'Cutlery', 'Napkins'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  cafe: [
    { name: 'Coffee', children: ['Espresso Drinks', 'Coffee Beans & Grounds', 'Cold Brew & Iced Coffee'] },
    { name: 'Tea', children: ['Black Tea', 'Green Tea', 'Herbal Tea'] },
    { name: 'Cold Beverages', children: ['Smoothies', 'Milkshakes', 'Juices', 'Soft Drinks'] },
    { name: 'Bakery Items', children: ['Croissants', 'Muffins', 'Cookies', 'Cakes'] },
    { name: 'Sandwiches & Wraps', children: ['Cold Sandwiches', 'Toasted Sandwiches', 'Wraps'] },
    { name: 'Breakfast Items', children: ['Pancakes', 'Eggs', 'Cereal & Oats'] },
    { name: 'Desserts', children: ['Ice Cream', 'Pastries', 'Waffles'] },
    { name: 'Raw Ingredients & Syrups', children: ['Coffee Syrups', 'Milk & Cream', 'Sugar & Sweeteners'] },
    { name: 'Packaging & Disposables', children: ['Cups & Lids', 'Napkins & Straws'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  bakery: [
    { name: 'Bread', children: ['White Bread', 'Whole Wheat Bread', 'Specialty Bread'] },
    { name: 'Cakes & Pastries', children: ['Birthday Cakes', 'Wedding Cakes', 'Cupcakes', 'Pastries'] },
    { name: 'Cookies & Biscuits', children: ['Butter Cookies', 'Cream Biscuits', 'Rusk'] },
    { name: 'Buns & Rolls', children: ['Sweet Buns', 'Dinner Rolls', 'Burger Buns'] },
    { name: 'Pies & Tarts', children: ['Fruit Pies', 'Savory Pies', 'Tarts'] },
    { name: 'Donuts', children: ['Glazed', 'Filled', 'Specialty'] },
    { name: 'Raw Ingredients', children: ['Flour', 'Sugar', 'Butter & Shortening', 'Yeast & Leavening', 'Flavorings & Extracts'] },
    { name: 'Decorations & Toppings', children: ['Icing & Frosting', 'Sprinkles', 'Edible Toppers'] },
    { name: 'Packaging', children: ['Cake Boxes', 'Bags & Wraps'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  electronics: [
    { name: 'Mobile Phones & Accessories', children: ['Smartphones', 'Cases & Covers', 'Screen Protectors', 'Power Banks'] },
    { name: 'Laptops & Computers', children: ['Laptops', 'Desktops', 'Monitors', 'Keyboards & Mice'] },
    { name: 'Home Appliances', children: ['Refrigerators', 'Washing Machines', 'Air Conditioners', 'Microwaves & Ovens'] },
    { name: 'Audio & Video', children: ['Headphones & Earbuds', 'Speakers', 'Televisions', 'Home Theater'] },
    { name: 'Cables & Chargers', children: ['USB Cables', 'Chargers & Adapters', 'HDMI & AV Cables'] },
    { name: 'Networking', children: ['Routers', 'Modems', 'Network Switches'] },
    { name: 'Cameras', children: ['DSLR & Mirrorless', 'Action Cameras', 'CCTV & Security Cameras', 'Camera Accessories'] },
    { name: 'Gaming', children: ['Consoles', 'Gaming Accessories', 'Video Games'] },
    { name: 'Batteries & Power', children: ['Batteries', 'UPS & Inverters'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  jewelry: [
    { name: 'Gold Jewelry', children: ['Rings', 'Necklaces', 'Bracelets & Bangles', 'Earrings'] },
    { name: 'Silver Jewelry', children: ['Rings', 'Necklaces', 'Bracelets & Bangles', 'Earrings'] },
    { name: 'Diamond Jewelry', children: ['Rings', 'Necklaces', 'Earrings'] },
    { name: 'Gemstones', children: ['Precious Stones', 'Semi-Precious Stones', 'Loose Stones'] },
    { name: 'Watches', children: ["Men's Watches", "Women's Watches", 'Smart Watches'] },
    { name: 'Bridal Sets', children: ['Bridal Necklace Sets', 'Bridal Ring Sets'] },
    { name: 'Custom/Bespoke', children: ['Custom Designs', 'Engraving Services'] },
    { name: 'Repair Parts', children: ['Clasps & Findings', 'Watch Straps & Batteries'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  hardware: [
    { name: 'Hand Tools', children: ['Hammers & Mallets', 'Screwdrivers', 'Wrenches & Pliers', 'Measuring Tools'] },
    { name: 'Power Tools', children: ['Drills', 'Saws', 'Grinders', 'Sanders'] },
    { name: 'Plumbing', children: ['Pipes & Fittings', 'Valves', 'Taps & Faucets', 'Sealants'] },
    { name: 'Electrical', children: ['Wires & Cables', 'Switches & Sockets', 'Circuit Breakers', 'Lighting'] },
    { name: 'Paint & Coatings', children: ['Wall Paint', 'Wood Finishes', 'Brushes & Rollers'] },
    { name: 'Building Materials', children: ['Cement', 'Sand & Aggregate', 'Bricks & Blocks', 'Steel & Rebar'] },
    { name: 'Fasteners & Hardware', children: ['Nails & Screws', 'Bolts & Nuts', 'Hinges & Locks'] },
    { name: 'Safety Equipment', children: ['Helmets', 'Gloves', 'Safety Goggles'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  construction: [
    { name: 'Building Materials', children: ['Cement', 'Sand & Aggregate', 'Bricks & Blocks', 'Steel & Rebar'] },
    { name: 'Plumbing', children: ['Pipes & Fittings', 'Valves', 'Sanitary Ware'] },
    { name: 'Electrical', children: ['Wires & Cables', 'Switches & Sockets', 'Lighting'] },
    { name: 'Paint & Coatings', children: ['Wall Paint', 'Waterproofing', 'Brushes & Rollers'] },
    { name: 'Tiles & Flooring', children: ['Ceramic Tiles', 'Marble & Granite', 'Wooden Flooring'] },
    { name: 'Doors & Windows', children: ['Wooden Doors', 'Aluminum Windows', 'Fittings & Hardware'] },
    { name: 'Tools & Equipment', children: ['Power Tools', 'Hand Tools', 'Scaffolding'] },
    { name: 'Safety Equipment', children: ['Helmets', 'Safety Vests', 'Harnesses'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  fashion: [
    { name: "Men's Wear", children: ['Shirts', 'T-Shirts', 'Trousers', 'Suits', 'Jackets'] },
    { name: "Women's Wear", children: ['Dresses', 'Tops', 'Trousers & Jeans', 'Ethnic Wear'] },
    { name: "Kids' Wear", children: ['Boys', 'Girls', 'Infants'] },
    { name: 'Footwear', children: ['Formal Shoes', 'Casual Shoes', 'Sandals'] },
    { name: 'Accessories', children: ['Belts', 'Bags & Purses', 'Jewelry', 'Sunglasses'] },
    { name: 'Innerwear & Sleepwear', children: ['Innerwear', 'Nightwear'] },
    { name: 'Seasonal Wear', children: ['Winter Wear', 'Summer Wear'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  textile: [
    { name: 'Cotton Fabrics', children: ['Plain Cotton', 'Printed Cotton', 'Cotton Blends'] },
    { name: 'Silk Fabrics', children: ['Pure Silk', 'Silk Blends'] },
    { name: 'Synthetic Fabrics', children: ['Polyester', 'Nylon', 'Rayon'] },
    { name: 'Woolen Fabrics', children: ['Pure Wool', 'Wool Blends'] },
    { name: 'Suiting & Shirting', children: ['Suiting Material', 'Shirting Material'] },
    { name: 'Embroidered & Designer Fabric', children: ['Embroidered', 'Sequined', 'Printed Designer'] },
    { name: 'Home Textiles', children: ['Bedsheets', 'Curtains', 'Towels'] },
    { name: 'Threads & Notions', children: ['Threads', 'Buttons & Zippers', 'Trims & Laces'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  footwear: [
    { name: "Men's Footwear", children: ['Formal Shoes', 'Casual Shoes', 'Sneakers', 'Sandals'] },
    { name: "Women's Footwear", children: ['Heels', 'Flats', 'Sandals', 'Sneakers'] },
    { name: "Kids' Footwear", children: ['School Shoes', 'Sandals', 'Sneakers'] },
    { name: 'Sports Footwear', children: ['Running Shoes', 'Training Shoes', 'Cleats'] },
    { name: 'Boots', children: ['Ankle Boots', 'Work Boots'] },
    { name: 'Accessories', children: ['Shoe Laces', 'Insoles', 'Shoe Care Products'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  auto_parts: [
    { name: 'Engine Parts', children: ['Pistons & Rings', 'Gaskets & Seals', 'Timing Belts', 'Engine Mounts'] },
    { name: 'Brake System', children: ['Brake Pads', 'Brake Discs', 'Brake Fluid', 'Calipers'] },
    { name: 'Electrical & Batteries', children: ['Batteries', 'Alternators', 'Starters', 'Sensors'] },
    { name: 'Filters & Fluids', children: ['Oil Filters', 'Air Filters', 'Fuel Filters', 'Coolants'] },
    { name: 'Tyres', children: ['Car Tyres', 'Bike Tyres', 'Tubes'] },
    { name: 'Body Parts', children: ['Bumpers', 'Mirrors', 'Headlights & Taillights'] },
    { name: 'Suspension & Steering', children: ['Shock Absorbers', 'Steering Parts', 'Bearings'] },
    { name: 'Accessories', children: ['Seat Covers', 'Floor Mats', 'Car Care Products'] },
    { name: 'Lubricants', children: ['Engine Oil', 'Gear Oil', 'Grease'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  automobile: [
    { name: 'Engine Parts', children: ['Pistons & Rings', 'Gaskets & Seals', 'Timing Belts'] },
    { name: 'Brake System', children: ['Brake Pads', 'Brake Discs', 'Brake Fluid'] },
    { name: 'Electrical & Batteries', children: ['Batteries', 'Alternators', 'Sensors'] },
    { name: 'Filters & Fluids', children: ['Oil Filters', 'Air Filters', 'Coolants'] },
    { name: 'Tyres', children: ['Car Tyres', 'Alloy Wheels'] },
    { name: 'Body Parts & Accessories', children: ['Bumpers', 'Seat Covers', 'Car Care Products'] },
    { name: 'Lubricants', children: ['Engine Oil', 'Gear Oil'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  service_station: [
    { name: 'Lubricants', children: ['Engine Oil', 'Gear Oil', 'Grease'] },
    { name: 'Filters & Fluids', children: ['Oil Filters', 'Air Filters', 'Coolants', 'Brake Fluid'] },
    { name: 'Tyres & Wheels', children: ['Tyres', 'Wheel Balancing Weights', 'Tubes'] },
    { name: 'Brake System', children: ['Brake Pads', 'Brake Discs'] },
    { name: 'Batteries', children: ['Car Batteries', 'Bike Batteries'] },
    { name: 'Car Care & Accessories', children: ['Car Wash Supplies', 'Air Fresheners', 'Seat Covers'] },
    { name: 'Workshop Consumables', children: ['Rags & Cleaning Supplies', 'Gloves'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  petrol_pump: [
    { name: 'Fuels', children: ['Petrol', 'Diesel', 'CNG/LPG'] },
    { name: 'Lubricants', children: ['Engine Oil', 'Gear Oil', 'Coolants'] },
    { name: 'Convenience Store Items', children: ['Snacks', 'Beverages', 'Tobacco'] },
    { name: 'Car Care', children: ['Car Wash Supplies', 'Air Fresheners'] },
    { name: 'Accessories', children: ['Tyre Repair Kits', 'Windshield Fluid'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  salon: [
    { name: 'Hair Care Products', children: ['Shampoos & Conditioners', 'Hair Color', 'Styling Products', 'Hair Treatments'] },
    { name: 'Skin Care Products', children: ['Facial Cleansers', 'Moisturizers', 'Facial Masks', 'Serums'] },
    { name: 'Nail Care', children: ['Nail Polish', 'Nail Art Supplies', 'Manicure/Pedicure Tools'] },
    { name: 'Salon Tools & Equipment', children: ['Hair Dryers & Straighteners', 'Scissors & Combs', 'Chairs & Stations'] },
    { name: 'Cosmetics & Makeup', children: ['Foundation', 'Lipsticks', 'Eye Makeup'] },
    { name: 'Spa & Massage', children: ['Massage Oils', 'Spa Consumables'] },
    { name: 'Men\'s Grooming', children: ['Shaving Products', 'Beard Care'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  gym: [
    { name: 'Supplements', children: ['Protein Powder', 'Pre-Workout', 'Vitamins', 'Weight Gainers'] },
    { name: 'Gym Equipment', children: ['Dumbbells & Plates', 'Resistance Bands', 'Cardio Equipment', 'Benches & Racks'] },
    { name: 'Apparel & Accessories', children: ['Gym Wear', 'Gloves', 'Shoes'] },
    { name: 'Beverages', children: ['Sports Drinks', 'Protein Shakes', 'Water'] },
    { name: 'Membership & Personal Training', children: ['Membership Plans', 'Personal Training Sessions'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  sports: [
    { name: 'Team Sports Equipment', children: ['Cricket Gear', 'Football Gear', 'Basketball Gear', 'Hockey Gear'] },
    { name: 'Fitness Equipment', children: ['Dumbbells', 'Yoga Mats', 'Resistance Bands'] },
    { name: 'Sportswear', children: ["Men's Sportswear", "Women's Sportswear", "Kids' Sportswear"] },
    { name: 'Footwear', children: ['Running Shoes', 'Cleats', 'Training Shoes'] },
    { name: 'Outdoor & Camping', children: ['Tents', 'Camping Gear', 'Cycling Gear'] },
    { name: 'Racquet Sports', children: ['Tennis Equipment', 'Badminton Equipment'] },
    { name: 'Accessories', children: ['Bags', 'Water Bottles', 'Protective Gear'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  furniture: [
    { name: 'Living Room Furniture', children: ['Sofas', 'Coffee Tables', 'TV Units'] },
    { name: 'Bedroom Furniture', children: ['Beds', 'Wardrobes', 'Dressers'] },
    { name: 'Dining Furniture', children: ['Dining Tables', 'Dining Chairs', 'Sideboards'] },
    { name: 'Office Furniture', children: ['Office Desks', 'Office Chairs', 'Filing Cabinets'] },
    { name: 'Outdoor Furniture', children: ['Patio Sets', 'Garden Chairs'] },
    { name: 'Storage & Shelving', children: ['Bookshelves', 'Cabinets'] },
    { name: 'Mattresses & Bedding', children: ['Mattresses', 'Pillows'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  toys_gifts: [
    { name: 'Toys', children: ['Action Figures', 'Dolls', 'Building Blocks', 'Board Games'] },
    { name: 'Educational Toys', children: ['Puzzles', 'Learning Kits'] },
    { name: 'Outdoor & Ride-on Toys', children: ['Bicycles', 'Ride-on Cars'] },
    { name: 'Gifts', children: ['Gift Cards', 'Gift Baskets', 'Personalized Gifts'] },
    { name: 'Party Supplies', children: ['Balloons', 'Decorations', 'Party Favors'] },
    { name: 'Stationery & Craft', children: ['Art Supplies', 'Craft Kits'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  telecom: [
    { name: 'SIM Cards & Plans', children: ['Prepaid SIM', 'Postpaid SIM', 'Data Plans'] },
    { name: 'Mobile Devices', children: ['Smartphones', 'Feature Phones'] },
    { name: 'Accessories', children: ['Chargers', 'Cases & Covers', 'Screen Protectors'] },
    { name: 'Prepaid Cards', children: ['Airtime Top-up Cards', 'Data Vouchers'] },
    { name: 'Broadband & Devices', children: ['WiFi Routers', 'MiFi Devices'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  agriculture: [
    { name: 'Seeds', children: ['Vegetable Seeds', 'Grain Seeds', 'Fruit Seeds'] },
    { name: 'Fertilizers', children: ['Organic Fertilizers', 'Chemical Fertilizers', 'Micronutrients'] },
    { name: 'Pesticides', children: ['Insecticides', 'Herbicides', 'Fungicides'] },
    { name: 'Farm Equipment', children: ['Tractors', 'Hand Tools', 'Irrigation Equipment'] },
    { name: 'Animal Feed', children: ['Cattle Feed', 'Poultry Feed'] },
    { name: 'Crop Protection Gear', children: ['Sprayers', 'Protective Clothing'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  dairy: [
    { name: 'Dairy Products', children: ['Milk', 'Yogurt', 'Cheese', 'Butter & Ghee', 'Cream'] },
    { name: 'Feed & Fodder', children: ['Cattle Feed', 'Silage', 'Mineral Supplements'] },
    { name: 'Dairy Equipment', children: ['Milking Machines', 'Storage Tanks', 'Pasteurizers'] },
    { name: 'Packaging', children: ['Bottles & Pouches', 'Cartons'] },
    { name: 'Veterinary Supplies', children: ['Vaccines', 'Medicines'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  hotel: [
    { name: 'Room Amenities', children: ['Toiletries', 'Bathrobes & Slippers', 'Minibar Items'] },
    { name: 'Food & Beverage', children: ['Restaurant Menu Items', 'Room Service Items', 'Bar Beverages'] },
    { name: 'Housekeeping Supplies', children: ['Linens & Towels', 'Cleaning Supplies'] },
    { name: 'Front Office Supplies', children: ['Stationery', 'Key Cards'] },
    { name: 'Banquet & Events', children: ['Event Setup Items', 'Catering Supplies'] },
    { name: 'Spa & Wellness', children: ['Spa Products', 'Gym Amenities'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  banquet: [
    { name: 'Catering Items', children: ['Appetizers', 'Main Course', 'Desserts', 'Beverages'] },
    { name: 'Décor & Setup', children: ['Table Settings', 'Floral Decorations', 'Lighting'] },
    { name: 'Furniture & Fixtures', children: ['Tables & Chairs', 'Stage & Podium'] },
    { name: 'Audio/Visual Equipment', children: ['Sound Systems', 'Projectors & Screens'] },
    { name: 'Event Packages', children: ['Wedding Packages', 'Corporate Event Packages'] },
    { name: 'Disposables & Supplies', children: ['Cutlery & Crockery', 'Napkins'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  travel: [
    { name: 'Travel Packages', children: ['Domestic Tours', 'International Tours', 'Honeymoon Packages'] },
    { name: 'Flight Bookings', children: ['Domestic Flights', 'International Flights'] },
    { name: 'Hotel Bookings', children: ['Budget Hotels', 'Luxury Hotels'] },
    { name: 'Visa Services', children: ['Tourist Visa', 'Business Visa'] },
    { name: 'Travel Insurance', children: ['Trip Insurance', 'Medical Travel Insurance'] },
    { name: 'Travel Accessories', children: ['Luggage', 'Travel Adapters'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  car_rental: [
    { name: 'Economy Cars', children: ['Hatchbacks', 'Sedans'] },
    { name: 'Luxury Cars', children: ['Premium Sedans', 'SUVs'] },
    { name: 'Vans & Buses', children: ['Passenger Vans', 'Mini Buses'] },
    { name: 'Rental Add-ons', children: ['Child Seats', 'GPS Devices', 'Insurance Add-on'] },
    { name: 'Chauffeur Services', children: ['Hourly Chauffeur', 'Full-day Chauffeur'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  hajj_umrah: [
    { name: 'Umrah Packages', children: ['Economy Packages', 'Premium Packages'] },
    { name: 'Hajj Packages', children: ['Standard Packages', 'VIP Packages'] },
    { name: 'Visa & Documentation', children: ['Visa Processing', 'Passport Services'] },
    { name: 'Accommodation', children: ['Makkah Hotels', 'Madinah Hotels'] },
    { name: 'Transport', children: ['Airport Transfers', 'Ziyarat Transport'] },
    { name: 'Ihram & Essentials', children: ['Ihram Clothing', 'Prayer Essentials'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  logistics: [
    { name: 'Freight Services', children: ['Road Freight', 'Air Freight', 'Sea Freight'] },
    { name: 'Packaging Supplies', children: ['Boxes & Cartons', 'Pallets', 'Wrapping Materials'] },
    { name: 'Fleet & Vehicle Parts', children: ['Truck Parts', 'Tyres', 'Fuel'] },
    { name: 'Warehousing Services', children: ['Storage Space', 'Handling Equipment'] },
    { name: 'Tracking & Equipment', children: ['GPS Trackers', 'Barcode Scanners'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  courier: [
    { name: 'Domestic Delivery', children: ['Same-day Delivery', 'Standard Delivery'] },
    { name: 'International Delivery', children: ['Express International', 'Economy International'] },
    { name: 'Packaging Supplies', children: ['Envelopes', 'Boxes', 'Bubble Wrap'] },
    { name: 'Cargo & Freight', children: ['Bulk Cargo', 'Freight Forwarding'] },
    { name: 'Value-Added Services', children: ['Insurance', 'COD Handling'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  warehouse_3pl: [
    { name: 'Storage Services', children: ['Pallet Storage', 'Bulk Storage', 'Cold Storage'] },
    { name: 'Handling Equipment', children: ['Forklifts', 'Pallet Jacks', 'Conveyor Systems'] },
    { name: 'Packaging Supplies', children: ['Cartons', 'Stretch Wrap', 'Labels'] },
    { name: 'Fulfillment Services', children: ['Pick & Pack', 'Order Processing'] },
    { name: 'Racking & Shelving', children: ['Pallet Racks', 'Shelving Units'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  distribution: [
    { name: 'FMCG Products', children: ['Packaged Foods', 'Beverages', 'Household Items'] },
    { name: 'Electronics Distribution', children: ['Mobile Accessories', 'Small Appliances'] },
    { name: 'Pharmaceutical Distribution', children: ['OTC Medicines', 'Medical Supplies'] },
    { name: 'Packaging & Logistics', children: ['Cartons', 'Pallets'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  import_export: [
    { name: 'Import Goods', children: ['Consumer Electronics', 'Textiles', 'Machinery'] },
    { name: 'Export Goods', children: ['Agricultural Produce', 'Handicrafts', 'Textiles'] },
    { name: 'Customs & Documentation', children: ['Customs Clearance', 'Certificates of Origin'] },
    { name: 'Shipping & Freight', children: ['Sea Freight', 'Air Freight'] },
    { name: 'Packaging Materials', children: ['Export Cartons', 'Pallets'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  media_entertainment: [
    { name: 'Event Services', children: ['Concerts', 'Corporate Events', 'Private Parties'] },
    { name: 'Audio/Visual Equipment', children: ['Sound Systems', 'Lighting', 'Projectors'] },
    { name: 'Production Services', children: ['Video Production', 'Photography'] },
    { name: 'Merchandise', children: ['Apparel', 'Collectibles'] },
    { name: 'Tickets & Passes', children: ['Event Tickets', 'Season Passes'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  school: [
    { name: 'Textbooks', children: ['Primary Books', 'Secondary Books', 'Reference Books'] },
    { name: 'Stationery', children: ['Notebooks', 'Pens & Pencils', 'Art Supplies'] },
    { name: 'Uniforms', children: ['Boys Uniform', 'Girls Uniform', 'Sportswear'] },
    { name: 'School Supplies', children: ['Bags & Backpacks', 'Lunch Boxes', 'Water Bottles'] },
    { name: 'Lab & Sports Equipment', children: ['Science Lab Equipment', 'Sports Gear'] },
    { name: 'Fees & Services', children: ['Tuition Fees', 'Transport Fees', 'Exam Fees'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  // Pure-service industries — small, service-line-oriented trees.
  insurance: [
    { name: 'Life Insurance', children: [] },
    { name: 'Health Insurance', children: [] },
    { name: 'Motor Insurance', children: [] },
    { name: 'Property Insurance', children: [] },
    { name: 'Travel Insurance', children: [] },
    { name: 'Business Insurance', children: [] },
  ],

  real_estate: [
    { name: 'Residential Properties', children: ['Apartments', 'Houses', 'Plots'] },
    { name: 'Commercial Properties', children: ['Offices', 'Shops', 'Warehouses'] },
    { name: 'Rental Services', children: ['Residential Rentals', 'Commercial Rentals'] },
    { name: 'Property Management', children: [] },
    { name: 'Consultancy Services', children: [] },
  ],

  professional_services: [
    { name: 'Consulting Services', children: [] },
    { name: 'Legal Services', children: [] },
    { name: 'Accounting & Tax Services', children: [] },
    { name: 'HR & Recruitment Services', children: [] },
    { name: 'IT & Technical Services', children: [] },
    { name: 'Marketing Services', children: [] },
  ],

  ngo: [
    { name: 'Relief Supplies', children: ['Food Aid', 'Medical Aid', 'Shelter Items'] },
    { name: 'Educational Programs', children: [] },
    { name: 'Healthcare Programs', children: [] },
    { name: 'Fundraising & Donations', children: [] },
    { name: 'Administrative Services', children: [] },
  ],

  housing_society: [
    { name: 'Maintenance Services', children: ['Plumbing', 'Electrical', 'Landscaping'] },
    { name: 'Security Services', children: [] },
    { name: 'Utilities', children: ['Water', 'Electricity', 'Gas'] },
    { name: 'Amenity Fees', children: ['Club House', 'Parking'] },
    { name: 'Administrative Services', children: [] },
  ],

  // ---- New (bulk buy-and-resell / production) verticals ----
  // A general wholesaler buying in bulk across many product lines and
  // reselling in bulk (carton/pallet quantities) to retailers — distinct
  // from 'distribution' (3PL/freight-forwarding-flavored) and from
  // 'distributor' below (bulk resale with a distribution/logistics lean).
  wholesaler: [
    { name: 'FMCG Bulk', children: ['Carton Packs', 'Case Lots', 'Multi-Pack Bundles'] },
    { name: 'Grocery & Staples (Bulk)', children: ['Rice & Grains (Sacks)', 'Pulses & Lentils (Sacks)', 'Cooking Oil (Drums/Tins)', 'Sugar & Salt (Bulk Bags)', 'Flour & Atta (Bulk Bags)'] },
    { name: 'Beverages (Bulk/Carton)', children: ['Soft Drinks (Cartons)', 'Juices (Cartons)', 'Water (Bulk Packs)', 'Tea & Coffee (Bulk)'] },
    { name: 'Household & Cleaning (Bulk)', children: ['Detergents (Cartons)', 'Cleaning Supplies (Cartons)', 'Paper & Disposables (Bulk)'] },
    { name: 'Personal Care (Bulk)', children: ['Soaps & Shampoos (Cartons)', 'Oral Care (Cartons)', 'Bath & Body (Bulk Packs)'] },
    { name: 'Stationery & Office Supplies', children: ['Paper & Notebooks (Bulk)', 'Pens & Writing (Bulk)', 'Office Consumables'] },
    { name: 'Electronics & Accessories', children: ['Mobile Accessories (Bulk)', 'Cables & Chargers (Bulk)', 'Batteries (Bulk Packs)'] },
    { name: 'Hardware & Tools', children: ['Fasteners (Bulk)', 'Hand Tools (Case Lots)', 'Electrical Supplies (Bulk)'] },
    { name: 'Textiles & Apparel (Bulk)', children: ['Fabric Rolls', 'Apparel (Case Packs)', 'Home Textiles (Bulk)'] },
    { name: 'Confectionery & Snacks', children: ['Chocolates (Cartons)', 'Biscuits (Cartons)', 'Chips & Namkeen (Cartons)'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  // Production/factory business — inventory here is about stages of the
  // manufacturing process (raw material -> WIP -> finished goods), not
  // retail-style merchandise categories.
  manufacturer: [
    { name: 'Raw Materials', children: ['Metals & Alloys', 'Plastics & Polymers', 'Chemicals', 'Textile Raw Materials', 'Wood & Timber'] },
    { name: 'Work-in-Progress', children: ['Partially Assembled Units', 'In-Process Batches'] },
    { name: 'Semi-Finished Goods', children: ['Components Awaiting Final Assembly', 'Sub-Assemblies'] },
    { name: 'Finished Goods', children: ['Ready for Dispatch', 'Warehouse Stock', 'Export Ready'] },
    { name: 'Packaging Materials', children: ['Cartons & Boxes', 'Labels & Stickers', 'Shrink Wrap & Pallet Wrap'] },
    { name: 'Consumables & Spare Parts', children: ['Machine Spare Parts', 'Lubricants & Coolants', 'Welding Consumables'] },
    { name: 'Tools & Dies', children: ['Molds & Dies', 'Jigs & Fixtures', 'Cutting Tools'] },
    { name: 'Scrap & By-Products', children: ['Metal Scrap', 'Off-Cuts & Rejects', 'Recyclable Waste'] },
    { name: 'General/Miscellaneous', children: [] },
  ],

  // Generic bulk-resale distributor with a distribution/logistics lean —
  // broad, not tied to one product vertical (unlike 'distribution', the
  // existing 3PL/freight-forwarding-flavored industryType).
  distributor: [
    { name: 'FMCG Distribution', children: ['Packaged Foods (Bulk)', 'Beverages (Bulk)', 'Household Items (Bulk)'] },
    { name: 'Pharma Distribution', children: ['OTC Medicines (Bulk)', 'Medical Supplies (Bulk)'] },
    { name: 'Electronics Distribution', children: ['Mobile Accessories (Bulk)', 'Small Appliances (Bulk)', 'Cables & Chargers (Bulk)'] },
    { name: 'Automotive Parts Distribution', children: ['Filters & Fluids (Bulk)', 'Spare Parts (Bulk)'] },
    { name: 'Building Materials Distribution', children: ['Cement & Aggregate (Bulk)', 'Steel & Rebar (Bulk)', 'Pipes & Fittings (Bulk)'] },
    { name: 'Packaging & Logistics Supplies', children: ['Cartons & Pallets', 'Stretch Wrap & Labels'] },
    { name: 'General/Miscellaneous', children: [] },
  ],
};

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

/** Resolves the correct default tree for an industryType, falling back to the
 * generic tree when the industryType is missing/unrecognized. */
function treeForIndustryType(industryType) {
  return (industryType && DEFAULT_CATEGORY_TREES[industryType]) || DEFAULT_CATEGORY_TREE_FALLBACK;
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

/** Seeds the industry-appropriate default tree for a company. Idempotent — matches
 * existing categories by name (case-insensitive) at each level and only creates
 * what's missing, so calling it again (e.g. "Reseed defaults") never duplicates.
 *
 * `industryType` is optional: pass it when the caller already has the Company
 * loaded (companyProvisioningService does, right after creation) to avoid a
 * redundant lookup; otherwise this looks it up itself (categoryController's
 * reseed endpoint and the ensureSeeded() auto-heal path don't have it handy).
 *
 * NOTE on already-seeded companies: if a company was previously auto-seeded
 * with the wrong (generic) tree — e.g. before this per-industry mapping
 * existed — calling this again does NOT remove those existing wrong
 * categories (a vendor may have already assigned products to them). It only
 * adds whatever's missing from the correct industry tree on top. A vendor who
 * got the wrong categories can click "Reseed defaults" to top up with the
 * right ones, but cleaning up the stale ones is a manual/out-of-scope step. */
async function seedDefaultCategories(companyId, industryType) {
  if (!industryType) {
    const company = await Company.findById(companyId).select('industryType').lean();
    industryType = company && company.industryType;
  }
  const tree = treeForIndustryType(industryType);
  let created = 0;
  for (const top of tree) {
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
  DEFAULT_CATEGORY_TREES, DEFAULT_CATEGORY_TREE_FALLBACK, UNCATEGORIZED_NAME,
  list, getTree, create, update, remove,
  getOrCreateUncategorized, seedDefaultCategories, findOrCreateByName,
};
