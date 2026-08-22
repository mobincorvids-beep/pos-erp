import { lazy } from 'react';

/**
 * The client-side counterpart to src/routes/mountIndustryModules.js on the
 * backend — the same "one registry instead of scattered manual wiring"
 * fix, applied here. Before this file existed, adding a new industry page
 * meant editing App.jsx (import + <Route>) AND Sidebar.jsx (nav entry) by
 * hand, in addition to writing the page itself — three places to keep in
 * sync for one new page, and easy to add a page that's never actually
 * reachable because one of those edits was forgotten.
 *
 * Now: write the page, add ONE entry here. App.jsx and Sidebar.jsx both
 * iterate over this list instead of hardcoding it.
 *
 * `lazy()` also means each industry page is its own code-split chunk,
 * only downloaded when a user actually navigates to it — the previous
 * all-pages-in-one-bundle setup was the direct cause of the >500kB chunk
 * warning the build kept producing.
 *
 * Not every backend industry module has a page here yet — the ones
 * without a page are simply absent from this list, and the platform stays
 * honest about it rather than showing a broken nav link. Add the entry
 * the same day the page is written.
 */
export const INDUSTRY_MODULES = [
  { key: 'restaurant', path: '/restaurant', label: 'Restaurant', component: lazy(() => import('./pages/RestaurantPage').then((m) => ({ default: m.RestaurantPage }))) },
  { key: 'pharmacy', path: '/pharmacy', label: 'Pharmacy', component: lazy(() => import('./pages/PharmacyPage').then((m) => ({ default: m.PharmacyPage }))) },
  { key: 'salon', path: '/salon', label: 'Salon', component: lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage }))) },
  { key: 'jewelry', path: '/jewelry', label: 'Jewelry', component: lazy(() => import('./pages/JewelryPage').then((m) => ({ default: m.JewelryPage }))) },
  { key: 'hotel', path: '/hotel', label: 'Hotel', component: lazy(() => import('./pages/HotelPage').then((m) => ({ default: m.HotelPage }))) },
  { key: 'travel', path: '/travel', label: 'Travel', component: lazy(() => import('./pages/TravelPage').then((m) => ({ default: m.TravelPage }))) },
  { key: 'insurance', path: '/insurance', label: 'Insurance', component: lazy(() => import('./pages/InsurancePage').then((m) => ({ default: m.InsurancePage }))) },
  { key: 'sports', path: '/sports', label: 'Sports', component: lazy(() => import('./pages/SportsPage').then((m) => ({ default: m.SportsPage }))) },
  { key: 'media_entertainment', path: '/media-entertainment', label: 'Events & Ticketing', component: lazy(() => import('./pages/EventTicketingPage').then((m) => ({ default: m.EventTicketingPage }))) },
  { key: 'telecom', path: '/telecom', label: 'Telecom', component: lazy(() => import('./pages/TelecomPage').then((m) => ({ default: m.TelecomPage }))) },
  { key: 'professional_services', path: '/professional-services', label: 'Time & Billing', component: lazy(() => import('./pages/ProfessionalServicesPage').then((m) => ({ default: m.ProfessionalServicesPage }))) },
  { key: 'agriculture', path: '/agriculture', label: 'Agriculture', component: lazy(() => import('./pages/AgriculturePage').then((m) => ({ default: m.AgriculturePage }))) },
  { key: 'import_export', path: '/import-export', label: 'Import/Export', component: lazy(() => import('./pages/ImportExportPage').then((m) => ({ default: m.ImportExportPage }))) },
  { key: 'pharmaceutical', path: '/pharmaceutical', label: 'Batch Recalls', component: lazy(() => import('./pages/PharmaceuticalPage').then((m) => ({ default: m.PharmaceuticalPage }))) },
  { key: 'construction', path: '/construction', label: 'Construction', component: lazy(() => import('./pages/ConstructionPage').then((m) => ({ default: m.ConstructionPage }))) },
  { key: 'logistics', path: '/logistics', label: 'Logistics', component: lazy(() => import('./pages/LogisticsPage').then((m) => ({ default: m.LogisticsPage }))) },
  { key: 'automobile', path: '/automobile', label: 'Automobile', component: lazy(() => import('./pages/AutomobilePage').then((m) => ({ default: m.AutomobilePage }))) },
  { key: 'car_rental', path: '/car-rental', label: 'Car Rental', component: lazy(() => import('./pages/CarRentalPage').then((m) => ({ default: m.CarRentalPage }))) },
  { key: 'courier', path: '/courier', label: 'Courier', component: lazy(() => import('./pages/CourierPage').then((m) => ({ default: m.CourierPage }))) },
  { key: 'dairy', path: '/dairy', label: 'Dairy', component: lazy(() => import('./pages/DairyPage').then((m) => ({ default: m.DairyPage }))) },
  { key: 'petrol_pump', path: '/petrol-pump', label: 'Petrol Pump', component: lazy(() => import('./pages/PetrolPumpPage').then((m) => ({ default: m.PetrolPumpPage }))) },
  { key: 'warehouse_3pl', path: '/warehouse-3pl', label: '3PL Warehouse', component: lazy(() => import('./pages/Warehouse3plPage').then((m) => ({ default: m.Warehouse3plPage }))) },
  { key: 'hajj_umrah', path: '/hajj-umrah', label: 'Hajj/Umrah', component: lazy(() => import('./pages/HajjUmrahPage').then((m) => ({ default: m.HajjUmrahPage }))) },
  { key: 'housing_society', path: '/housing-society', label: 'Housing Society', component: lazy(() => import('./pages/HousingSocietyPage').then((m) => ({ default: m.HousingSocietyPage }))) },
  { key: 'ngo', path: '/ngo', label: 'NGO', component: lazy(() => import('./pages/NgoPage').then((m) => ({ default: m.NgoPage }))) },
  { key: 'real_estate', path: '/real-estate', label: 'Real Estate', component: lazy(() => import('./pages/RealEstatePage').then((m) => ({ default: m.RealEstatePage }))) },
  { key: 'school', path: '/school', label: 'School', component: lazy(() => import('./pages/SchoolPage').then((m) => ({ default: m.SchoolPage }))) },
  { key: 'distribution', path: '/distribution', label: 'Distribution', component: lazy(() => import('./pages/DistributionPage').then((m) => ({ default: m.DistributionPage }))) },
  { key: 'banquet', path: '/banquet', label: 'Banquet', component: lazy(() => import('./pages/BanquetPage').then((m) => ({ default: m.BanquetPage }))) },
  { key: 'service_station', path: '/service-station', label: 'Service Station', component: lazy(() => import('./pages/ServiceStationPage').then((m) => ({ default: m.ServiceStationPage }))) },
  { key: 'hospital', path: '/hospital', label: 'Hospital', component: lazy(() => import('./pages/HospitalPage').then((m) => ({ default: m.HospitalPage }))) },
  { key: 'gym', path: '/gym', label: 'Gym', component: lazy(() => import('./pages/GymPage').then((m) => ({ default: m.GymPage }))) },
  { key: 'auto_parts', path: '/auto-parts', label: 'Auto Parts', component: lazy(() => import('./pages/AutoPartsPage').then((m) => ({ default: m.AutoPartsPage }))) },
  { key: 'electronics', path: '/electronics', label: 'Electronics', component: lazy(() => import('./pages/ElectronicsPage').then((m) => ({ default: m.ElectronicsPage }))) },
  { key: 'furniture', path: '/furniture', label: 'Furniture', component: lazy(() => import('./pages/FurniturePage').then((m) => ({ default: m.FurniturePage }))) },
  { key: 'fashion', path: '/fashion', label: 'Fashion', component: lazy(() => import('./pages/FashionPage').then((m) => ({ default: m.FashionPage }))) },
  { key: 'bakery', path: '/bakery', label: 'Bakery', component: lazy(() => import('./pages/BakeryPage').then((m) => ({ default: m.BakeryPage }))) },
  { key: 'grocery', path: '/grocery', label: 'Grocery', component: lazy(() => import('./pages/GroceryPage').then((m) => ({ default: m.GroceryPage }))) },
  { key: 'footwear', path: '/footwear', label: 'Footwear', component: lazy(() => import('./pages/FootwearPage').then((m) => ({ default: m.FootwearPage }))) },
  { key: 'textile', path: '/textile', label: 'Textile', component: lazy(() => import('./pages/TextilePage').then((m) => ({ default: m.TextilePage }))) },
  { key: 'hardware', path: '/hardware', label: 'Hardware', component: lazy(() => import('./pages/HardwarePage').then((m) => ({ default: m.HardwarePage }))) },
  { key: 'retail', path: '/retail', label: 'Retail', component: lazy(() => import('./pages/RetailPage').then((m) => ({ default: m.RetailPage }))) },
  { key: 'cafe', path: '/cafe', label: 'Cafe', component: lazy(() => import('./pages/CafePage').then((m) => ({ default: m.CafePage }))) },
  { key: 'toys_gifts', path: '/toys-gifts', label: 'Toys & Gifts', component: lazy(() => import('./pages/ToysGiftsPage').then((m) => ({ default: m.ToysGiftsPage }))) },
];
