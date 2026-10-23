/**
 * Complete Anchor Cafe Menu Catalog with Base Costs and Charm Pricing Rules
 * Location: Ramapuram Beach, Chirala (Choramandal Coast)
 */

const { calculateCharmPrice } = require('../utils/pricingEngine');

const rawCatalog = [
  // --- Category 1: Hot Beverages (Authentic Coastal Staples) ---
  {
    sku: 'HB-001',
    title: 'Traditional Filter Coffee',
    category: 'hot-beverages',
    baseCost: 40,
    servingSize: 'Brass Davarah (150ml)',
    description: 'Freshly decocted Chicory & Arabica blend served in authentic south Indian brass davarah.',
    tags: ['Authentic', 'Bestseller', 'Hot', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/filter_coffee.webp'
  },
  {
    sku: 'HB-002',
    title: 'Fresh Lemon Honey Tea',
    category: 'hot-beverages',
    baseCost: 30,
    servingSize: 'Glass (180ml)',
    description: 'Steeped black tea infused with coastal farm lemons and organic raw honey.',
    tags: ['Authentic', 'Hot', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/lemon_tea.webp'
  },
  {
    sku: 'HB-003',
    title: 'Steamed Herbal Green Tea',
    category: 'hot-beverages',
    baseCost: 30,
    servingSize: 'Glass (180ml)',
    description: 'Whole leaf green tea with subtle notes of mint and lemongrass.',
    tags: ['Authentic', 'Hot', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/green_tea.webp'
  },
  {
    sku: 'HB-004',
    title: 'Pure Roasted Black Coffee',
    category: 'hot-beverages',
    baseCost: 40,
    servingSize: 'Glass (150ml)',
    description: 'Bold, dark roast Arabica espresso brew with no added chicory.',
    tags: ['Authentic', 'Hot', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/black_coffee.webp'
  },

  // --- Category 2: Handcrafted Beach Mojitos & Coolers ---
  {
    sku: 'MJ-001',
    title: 'Fresh Mint Lime Mojito',
    category: 'mojitos',
    baseCost: 100,
    servingSize: 'Mug (350ml)',
    description: 'Crushed garden mint, freshly squeezed beach lime, sparkling soda & cane syrup.',
    tags: ['Refreshing', 'Bestseller', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/mint_mojito.webp'
  },
  {
    sku: 'MJ-002',
    title: 'Virgin Strawberry Mojito',
    category: 'mojitos',
    baseCost: 100,
    servingSize: 'Mug (350ml)',
    description: 'Muddled hill strawberries, mint leaves, crushed ice and bubbly soda.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/strawberry_mojito.webp'
  },
  {
    sku: 'MJ-003',
    title: 'Sunset Glory (Golden Pineapple)',
    category: 'mojitos',
    baseCost: 100,
    servingSize: 'Mug (350ml)',
    description: 'Tropical pineapple nectar, zesty lime, fresh mint sprigs & splash of club soda.',
    tags: ['Refreshing', 'Signature', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/sunset_glory.webp'
  },
  {
    sku: 'MJ-004',
    title: 'Sunburst (Citrus Orange)',
    category: 'mojitos',
    baseCost: 100,
    servingSize: 'Mug (350ml)',
    description: 'Sun-ripened orange citrus, crushed mint sprigs and sparkling soda.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/sunburst.webp'
  },
  {
    sku: 'MJ-005',
    title: 'Electric Blue Curacao Mojito',
    category: 'mojitos',
    baseCost: 100,
    servingSize: 'Mug (350ml)',
    description: 'Vibrant blue citrus cooler with lemon juice, mint leaves, and ice crystals.',
    tags: ['Refreshing', 'Signature', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/blue_curacao.webp'
  },
  {
    sku: 'MJ-006',
    title: 'Sunrise (Pineapple & Orange Blend)',
    category: 'mojitos',
    baseCost: 120,
    servingSize: 'Tall Glass (380ml)',
    description: 'Layered gradient of fresh pineapple juice, sweet orange pulp, and mint.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/sunrise_blend.webp'
  },
  {
    sku: 'MJ-007',
    title: 'Emerald Kiwi Mojito',
    category: 'mojitos',
    baseCost: 120,
    servingSize: 'Tall Glass (380ml)',
    description: 'Tart kiwi fruit puree shaken with lime, mint and chilled tonic.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/kiwi_mojito.webp'
  },
  {
    sku: 'MJ-008',
    title: 'Virgin Guava Mojito with Pink Salt',
    category: 'mojitos',
    baseCost: 120,
    servingSize: 'Tall Glass (380ml)',
    description: 'Pink guava juice rimmed with Himalayan salt & mild chili dust, muddled with mint.',
    tags: ['Signature', 'Bestseller', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/guava_salt.webp'
  },
  {
    sku: 'MJ-009',
    title: 'Alphonso Mango Mojito',
    category: 'mojitos',
    baseCost: 120,
    servingSize: 'Tall Glass (380ml)',
    description: 'Sweet Alphonso mango pulp blended with lime juice, mint and sparkling bubbles.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/mango_mojito.webp'
  },
  {
    sku: 'MJ-010',
    title: 'Mint Berry Smash (Triple Berries)',
    category: 'mojitos',
    baseCost: 140,
    servingSize: 'Tall Glass (400ml)',
    description: 'Muddled blackberries, raspberries, and blueberries with bruised garden mint.',
    tags: ['Premium', 'Refreshing', 'Veg'],
    preparationTimeMinutes: 5,
    imageUrl: '/assets/images/berry_smash.webp'
  },
  {
    sku: 'MJ-011',
    title: 'Virgin Jalapeño Guava',
    category: 'mojitos',
    baseCost: 140,
    servingSize: 'Tall Glass (400ml)',
    description: 'Spicy coastal twist with sliced pickled jalapeño, sweet guava juice and fresh lime.',
    tags: ['Spicy', 'Signature', 'Veg'],
    preparationTimeMinutes: 5,
    imageUrl: '/assets/images/jalapeno_guava.webp'
  },
  {
    sku: 'MJ-012',
    title: 'Paradise (Guava & Pineapple)',
    category: 'mojitos',
    baseCost: 140,
    servingSize: 'Tall Glass (400ml)',
    description: 'Tropical duo of guava and sweet pineapple with cooling crushed ice.',
    tags: ['Refreshing', 'Veg'],
    preparationTimeMinutes: 4,
    imageUrl: '/assets/images/paradise.webp'
  },
  {
    sku: 'MJ-013',
    title: 'Guava Pink Watermelon Lemonade',
    category: 'mojitos',
    baseCost: 140,
    servingSize: 'Tall Glass (400ml)',
    description: 'Sweet watermelon puree, tropical guava, lemon juice & crushed mint.',
    tags: ['Refreshing', 'Bestseller', 'Veg'],
    preparationTimeMinutes: 5,
    imageUrl: '/assets/images/watermelon_lemonade.webp'
  },

  // --- Category 4: Artisanal Ice Creams & Sundaes ---
  {
    sku: 'IC-001',
    title: 'Pure Madagascar Vanilla Ice Cream',
    category: 'icecream',
    baseCost: 60,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Velvety smooth churned ice cream infused with real Madagascar vanilla bean seeds.',
    tags: ['Classic', 'Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/vanilla_icecream.webp'
  },
  {
    sku: 'IC-002',
    title: 'Dark Cocoa Chocolate Gelato',
    category: 'icecream',
    baseCost: 60,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Rich 70% dark Belgian cocoa churned to creamy Italian gelato perfection.',
    tags: ['Bestseller', 'Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/chocolate_gelato.webp'
  },
  {
    sku: 'IC-003',
    title: 'Strawberry Berry Swirl',
    category: 'icecream',
    baseCost: 60,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Creamy dairy ice cream swirled with tart strawberry preserve ribbons.',
    tags: ['Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/strawberry_swirl.webp'
  },
  {
    sku: 'IC-004',
    title: 'Roasted Green Pista Ice Cream',
    category: 'icecream',
    baseCost: 60,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Nutty royal pistachio gelato studded with roasted Iranian pista slivers.',
    tags: ['Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/pista_icecream.webp'
  },
  {
    sku: 'IC-005',
    title: 'Golden Butterscotch Praline Scoop',
    category: 'icecream',
    baseCost: 60,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Caramel butterscotch scoop loaded with crunchy cashew praline toffee bits.',
    tags: ['Bestseller', 'Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/butterscotch_scoop.webp'
  },
  {
    sku: 'IC-006',
    title: 'Royal Kaju Kishmish Scoop',
    category: 'icecream',
    baseCost: 70,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Creamy saffron scented base with golden raisins and whole roasted cashews.',
    tags: ['Premium', 'Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/kaju_kishmish.webp'
  },
  {
    sku: 'IC-007',
    title: 'Tropical Fruit Punch Scoop',
    category: 'icecream',
    baseCost: 70,
    servingSize: 'Scoop in Cup/Waffle Cone',
    description: 'Exotic blend of mango, pineapple, cherry and papaya bits in sweet cream.',
    tags: ['Veg'],
    preparationTimeMinutes: 2,
    imageUrl: '/assets/images/fruit_punch.webp'
  },
  {
    sku: 'IC-008',
    title: 'American Dry Fruits Sundae Scoop',
    category: 'icecream',
    baseCost: 70,
    servingSize: 'Sundae Glass',
    description: 'Almonds, cashews, pistachios, black currants & honey drizzle over sweet cream.',
    tags: ['Premium', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/dry_fruits_sundae.webp'
  },
  {
    sku: 'IC-009',
    title: 'Dulce De Leche Caramel Swirl',
    category: 'icecream',
    baseCost: 80,
    servingSize: 'Sundae Glass',
    description: 'Slow-cooked golden dulce de leche caramel swirled in creamy milk gelato.',
    tags: ['Bestseller', 'Signature', 'Veg'],
    preparationTimeMinutes: 3,
    imageUrl: '/assets/images/dulce_caramel.webp'
  },

  // --- Category 5: Crispy Beach Bites & Savory Snacks ---
  {
    sku: 'SN-001',
    title: 'Golden Salted French Fries',
    category: 'snacks',
    baseCost: 90,
    servingSize: '150g portion with dip',
    description: 'Double fried golden potato batons lightly tossed with sea salt. Served with hot ketchup & mayo.',
    tags: ['Bestseller', 'Hot', 'Veg'],
    preparationTimeMinutes: 6,
    imageUrl: '/assets/images/french_fries.webp'
  },
  {
    sku: 'SN-002',
    title: 'Crispy Spiced Corn Samosa',
    category: 'snacks',
    baseCost: 70,
    servingSize: '4 pieces with green chutney',
    description: 'Flaky pastry pockets stuffed with buttered corn, potatoes & beach spices.',
    tags: ['Hot', 'Veg'],
    preparationTimeMinutes: 5,
    imageUrl: '/assets/images/corn_samosa.webp'
  },
  {
    sku: 'SN-003',
    title: 'Golden Crunchy Corn Rolls',
    category: 'snacks',
    baseCost: 110,
    servingSize: '5 pieces with mayo',
    description: 'Crispy crumbed rolls packed with seasoned sweet corn and melted cheese.',
    tags: ['Hot', 'Veg'],
    preparationTimeMinutes: 7,
    imageUrl: '/assets/images/corn_rolls.webp'
  },
  {
    sku: 'SN-004',
    title: 'Crumbed Vegetable Fingers',
    category: 'snacks',
    baseCost: 110,
    servingSize: '5 pieces with dip',
    description: 'Seasoned carrot, pea and potato batons fried in panko crumbs until golden.',
    tags: ['Hot', 'Veg'],
    preparationTimeMinutes: 6,
    imageUrl: '/assets/images/veg_fingers.webp'
  },
  {
    sku: 'SN-005',
    title: 'Steamed Vegetable Momos',
    category: 'snacks',
    baseCost: 130,
    servingSize: '5 pieces with spicy dip',
    description: 'Delicate steamed Tibetan dumplings stuffed with cabbage, carrots, onion & ginger. Spicy chili dip.',
    tags: ['Hot', 'Veg'],
    preparationTimeMinutes: 8,
    imageUrl: '/assets/images/veg_momos.webp'
  },
  {
    sku: 'SN-006',
    title: 'Crispy Chicken Nuggets',
    category: 'snacks',
    baseCost: 160,
    servingSize: '6 pieces with BBQ sauce',
    description: 'Tender minced chicken patties encased in a crunchy tempura batter.',
    tags: ['Non-Veg', 'Hot', 'Bestseller'],
    preparationTimeMinutes: 7,
    imageUrl: '/assets/images/chicken_nuggets.webp'
  },
  {
    sku: 'SN-007',
    title: 'Peri-Peri Chicken Popcorn',
    category: 'snacks',
    baseCost: 160,
    servingSize: '150g tossed bucket',
    description: 'Bite-sized crispy chicken chunks dusted generously with African bird’s eye chili seasoning.',
    tags: ['Non-Veg', 'Spicy', 'Hot', 'Bestseller'],
    preparationTimeMinutes: 7,
    imageUrl: '/assets/images/chicken_popcorn.webp'
  },
  {
    sku: 'SN-008',
    title: 'Juicy Steamed Chicken Momos',
    category: 'snacks',
    baseCost: 140,
    servingSize: '5 pieces with red garlic dip',
    description: 'Thin wonton skins filled with scallion-infused spiced minced chicken. Served with spicy garlic chutney.',
    tags: ['Non-Veg', 'Hot'],
    preparationTimeMinutes: 8,
    imageUrl: '/assets/images/chicken_momos.webp'
  },
  {
    sku: 'SN-009',
    title: 'Golden Tender Chicken Fingers',
    category: 'snacks',
    baseCost: 130,
    servingSize: '5 prime breaded strips',
    description: 'Whole chicken breast tenders coated in seasoned breading and flash fried.',
    tags: ['Non-Veg', 'Hot'],
    preparationTimeMinutes: 7,
    imageUrl: '/assets/images/chicken_fingers.webp'
  },
  {
    sku: 'SN-010',
    title: 'BBQ Glazed Chicken Wings',
    category: 'snacks',
    baseCost: 160,
    servingSize: '5 crispy coated wings',
    description: 'Crispy fried wings tossed in sweet, smoky and tangy coastal BBQ glaze.',
    tags: ['Non-Veg', 'Hot', 'Signature'],
    preparationTimeMinutes: 8,
    imageUrl: '/assets/images/bbq_wings.webp'
  },

  // --- Category 6: Beach Experiences & Event Packages ---
  {
    sku: 'EXP-001',
    title: 'Night Beach Candlelight Table Setup',
    category: 'beach-services',
    baseCost: 1500,
    servingSize: 'Private Sand Setup (2-4 Guests)',
    description: 'Dedicated waterfront setup with lantern canopy, woven bamboo mats, candle centerpieces and flower petals.',
    tags: ['Experience', 'Signature', 'Romantic'],
    preparationTimeMinutes: 20,
    imageUrl: '/assets/images/candlelight_beach.webp'
  },
  {
    sku: 'EXP-002',
    title: 'Birthday Beach Lighting & Neon Canopy',
    category: 'beach-services',
    baseCost: 3000,
    servingSize: 'Party Zone (6-12 Guests)',
    description: 'Fairy light tunnel, custom celebratory neon sign, balloon clusters, high-top cake table and audio bluetooth speaker.',
    tags: ['Experience', 'Celebration'],
    preparationTimeMinutes: 30,
    imageUrl: '/assets/images/birthday_neon.webp'
  },
  {
    sku: 'EXP-003',
    title: 'Sunset Beach Campfire & Bonfire Pit',
    category: 'beach-services',
    baseCost: 1200,
    servingSize: 'Campfire Circle (2 Hours)',
    description: 'Shoreline hardwood bonfire pit with low beach chairs, fire tender assistance, and marshmallow skewer kit.',
    tags: ['Experience', 'Sunset'],
    preparationTimeMinutes: 15,
    imageUrl: '/assets/images/sunset_bonfire.webp'
  },
  {
    sku: 'EXP-004',
    title: 'Beach Sports Kit Rental (Cricket / Volleyball)',
    category: 'beach-services',
    baseCost: 500,
    servingSize: '2 Hours Kit Rental',
    description: 'Regulation volleyball sand net & match ball, plus lightweight beach cricket bats, rubber balls & stumps.',
    tags: ['Experience', 'Sports'],
    preparationTimeMinutes: 5,
    imageUrl: '/assets/images/beach_sports.webp'
  },

  // --- Category 7: Packaged Water & Soft Drinks ---
  {
    sku: 'SD-001',
    title: 'Packaged Drinking Water (1 Litre)',
    category: 'soft-drinks',
    baseCost: 20,
    isMrp: true,
    servingSize: '1000ml Sealed Chilled Bottle',
    description: 'Chilled pure mineral drinking water bottle.',
    tags: ['Water', 'Authentic', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/water_bottle.webp'
  },
  {
    sku: 'SD-002',
    title: 'Packaged Drinking Water (500ml)',
    category: 'soft-drinks',
    baseCost: 10,
    isMrp: true,
    servingSize: '500ml Sealed Chilled Bottle',
    description: 'Pure chilled drinking water for beach strolls.',
    tags: ['Water', 'Authentic', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/water_bottle_small.webp'
  },
  {
    sku: 'SD-003',
    title: 'Kinley Sparkling Club Soda',
    category: 'soft-drinks',
    baseCost: 20,
    isMrp: true,
    servingSize: '750ml Chilled Bottle',
    description: 'Crisp carbonated sparkling soda water.',
    tags: ['Soda', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/club_soda.webp'
  },
  {
    sku: 'SD-004',
    title: 'Thums Up (Charged / Cold Can)',
    category: 'soft-drinks',
    baseCost: 40,
    isMrp: true,
    servingSize: '300ml Chilled Can / Bottle',
    description: 'Toofani strong fizzy cola served chilled with fresh lime slice.',
    tags: ['Bestseller', 'Soft Drink', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/thums_up.webp'
  },
  {
    sku: 'SD-005',
    title: 'Coca-Cola Classic',
    category: 'soft-drinks',
    baseCost: 40,
    isMrp: true,
    servingSize: '300ml Chilled Can / Bottle',
    description: 'Iconic chilled cola served with ice crystals.',
    tags: ['Soft Drink', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/coca_cola.webp'
  },
  {
    sku: 'SD-006',
    title: 'Sprite Lime Fizz',
    category: 'soft-drinks',
    baseCost: 40,
    isMrp: true,
    servingSize: '300ml Chilled Can / Bottle',
    description: 'Crisp lemon-lime sparkling refresher.',
    tags: ['Soft Drink', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/sprite.webp'
  },
  {
    sku: 'SD-007',
    title: 'Limca Fresh Lemon Drink',
    category: 'soft-drinks',
    baseCost: 40,
    isMrp: true,
    servingSize: '300ml Chilled Can / Bottle',
    description: 'Zesty cloudy lemon soda for sunny beach afternoons.',
    tags: ['Soft Drink', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/limca.webp'
  },
  {
    sku: 'SD-008',
    title: 'Fanta Orange Punch',
    category: 'soft-drinks',
    baseCost: 40,
    isMrp: true,
    servingSize: '300ml Chilled Can / Bottle',
    description: 'Vibrant sweet orange fizzy refreshment.',
    tags: ['Soft Drink', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/fanta.webp'
  },
  {
    sku: 'SD-009',
    title: 'Diet Coke / Coke Zero',
    category: 'soft-drinks',
    baseCost: 50,
    isMrp: true,
    servingSize: '300ml Can',
    description: 'Zero calorie, zero sugar crisp chilled cola.',
    tags: ['Soft Drink', 'Zero Sugar', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/diet_coke.webp'
  },

  // --- Category 8: Power Energy Drinks ---
  {
    sku: 'ED-001',
    title: 'Red Bull Energy Drink',
    category: 'energy-drinks',
    baseCost: 125,
    isMrp: true,
    servingSize: '250ml Chilled Can',
    description: 'Vitalizes body and mind with taurine and alpine water. Served ice cold.',
    tags: ['Energy', 'Bestseller', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/red_bull.webp'
  },
  {
    sku: 'ED-002',
    title: 'Sting Energy Berry',
    category: 'energy-drinks',
    baseCost: 20,
    isMrp: true,
    servingSize: '250ml Chilled Bottle',
    description: 'Electrifying berry energy booster with ginseng extract.',
    tags: ['Energy', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/sting.webp'
  },
  {
    sku: 'ED-003',
    title: 'Monster Energy Original',
    category: 'energy-drinks',
    baseCost: 125,
    isMrp: true,
    servingSize: '350ml Chilled Can',
    description: 'Smooth intense energy blend for beach sports and late night bonfires.',
    tags: ['Energy', 'Veg'],
    preparationTimeMinutes: 1,
    imageUrl: '/assets/images/monster.webp'
  }
];

// --- Category 3: 27 Signature Thick Shakes (Complete 3-Variant Matrix = 81 SKUs) ---
const shakeFlavors = [
  { id: '01', title: 'Chocolate Shake', baseCosts: [80, 100, 120], tags: ['Bestseller', 'Classic', 'Veg'] },
  { id: '02', title: 'Classic Vanilla Shake', baseCosts: [80, 100, 130], tags: ['Classic', 'Veg'] },
  { id: '03', title: 'Citrus Orange Shake', baseCosts: [80, 100, 130], tags: ['Veg', 'Fruity'] },
  { id: '04', title: 'Pink Watermelon Shake', baseCosts: [80, 100, 130], tags: ['Veg', 'Fruity'] },
  { id: '05', title: 'Butterscotch Crunch Shake', baseCosts: [80, 100, 130], tags: ['Bestseller', 'Veg'] },
  { id: '06', title: 'Fresh Banana Honey Shake', baseCosts: [80, 100, 140], tags: ['Veg', 'Healthy'] },
  { id: '07', title: 'Alphonso Mango Shake', baseCosts: [80, 100, 140], tags: ['Bestseller', 'Veg', 'Fruity'] },
  { id: '08', title: 'Sweet Strawberry Shake', baseCosts: [80, 100, 140], tags: ['Veg', 'Fruity'] },
  { id: '09', title: 'Tropical Pineapple Shake', baseCosts: [80, 100, 140], tags: ['Veg', 'Fruity'] },
  { id: '10', title: 'Pink Guava Shake', baseCosts: [80, 100, 140], tags: ['Veg', 'Fruity'] },
  { id: '11', title: 'Tangy Kiwi Shake', baseCosts: [90, 110, 140], tags: ['Veg', 'Fruity'] },
  { id: '12', title: 'Frosty Litchi Shake', baseCosts: [90, 110, 140], tags: ['Veg', 'Fruity'] },
  { id: '13', title: 'Roasted Pista Shake', baseCosts: [90, 110, 140], tags: ['Veg', 'Nutty'] },
  { id: '14', title: 'Wild Blueberry Shake', baseCosts: [100, 120, 150], tags: ['Premium', 'Veg'] },
  { id: '15', title: 'Royal Kesar Badam Shake', baseCosts: [100, 120, 150], tags: ['Premium', 'Veg', 'Nutty'] },
  { id: '16', title: 'Tart Black Currant Shake', baseCosts: [100, 120, 150], tags: ['Veg', 'Fruity'] },
  { id: '17', title: 'Banana Dry Fruit Shake', baseCosts: [160, 180, 210], tags: ['Premium', 'Nutty', 'Veg'] },
  { id: '18', title: 'Royal Dry Fruit Shake (Kaju, Badam, Pista)', baseCosts: [160, 190, 210], tags: ['Premium', 'Bestseller', 'Nutty', 'Veg'] },
  { id: '19', title: 'Banana Bonkers Shake', baseCosts: [100, 120, 150], tags: ['Veg'] },
  { id: '20', title: 'Kit Kat Chunky Shake', baseCosts: [110, 130, 150], tags: ['Bestseller', 'Veg'] },
  { id: '21', title: 'Oreo Cookies & Cream Shake', baseCosts: [110, 130, 150], tags: ['Bestseller', 'Veg'] },
  { id: '22', title: 'Cadbury 5 Star Nougat Shake', baseCosts: [110, 130, 150], tags: ['Veg'] },
  { id: '23', title: 'Rainbow Gems Fun Shake', baseCosts: [110, 130, 150], tags: ['Veg'] },
  { id: '24', title: 'Snickers Caramel Peanut Shake', baseCosts: [110, 130, 150], tags: ['Veg', 'Nutty'] },
  { id: '25', title: 'Blended Brownie Fudge Shake', baseCosts: [120, 140, 160], tags: ['Bestseller', 'Premium', 'Veg'] },
  { id: '26', title: 'Choco Butterscotch Praline', baseCosts: [120, 140, 160], tags: ['Premium', 'Veg'] },
  { id: '27', title: 'Choco-Nut Crunch Supreme', baseCosts: [120, 140, 160], tags: ['Premium', 'Veg'] }
];

const shakeMenuItems = shakeFlavors.map(sf => {
  const [milkCost, blendCost, thickCost] = sf.baseCosts;
  return {
    sku: `SH-${sf.id}`,
    title: sf.title,
    category: 'shakes',
    baseCost: blendCost, // default reference base
    sellingPrice: calculateCharmPrice('shakes', blendCost),
    hasVariants: true,
    variants: [
      {
        variantName: 'Milkshake',
        baseCost: milkCost,
        sellingPrice: calculateCharmPrice('shakes', milkCost)
      },
      {
        variantName: 'Blended',
        baseCost: blendCost,
        sellingPrice: calculateCharmPrice('shakes', blendCost)
      },
      {
        variantName: 'Thickshake',
        baseCost: thickCost,
        sellingPrice: calculateCharmPrice('shakes', thickCost)
      }
    ],
    servingSize: 'Glass / Tall Cup (350ml)',
    description: `Indulgent ${sf.title} crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.`,
    tags: sf.tags,
    preparationTimeMinutes: 4,
    imageUrl: `/assets/images/shake_${sf.id}.webp`
  };
});

// Process all items with charm price calculation
const fullCatalog = [
  ...rawCatalog.map(item => ({
    ...item,
    hasVariants: false,
    sellingPrice: item.isMrp ? item.baseCost : calculateCharmPrice(item.category, item.baseCost, item.isMrp)
  })),
  ...shakeMenuItems
];

module.exports = {
  fullCatalog,
  shakeFlavors
};
