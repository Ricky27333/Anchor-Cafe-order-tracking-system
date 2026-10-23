const { calculateCharmPrice } = require('../src/utils/pricingEngine');

describe('Anchor Cafe Charm Pricing Verification', () => {
  test('Hot Beverages MUST preserve authentic traditional pricing without modification', () => {
    expect(calculateCharmPrice('hot-beverages', 40)).toBe(40); // Filter Coffee
    expect(calculateCharmPrice('hot-beverages', 30)).toBe(30); // Lemon Tea
    expect(calculateCharmPrice('hot-beverages', 30)).toBe(30); // Green Tea
    expect(calculateCharmPrice('hot-beverages', 40)).toBe(40); // Black Coffee
  });

  test('Food and Cold Beverages ending in 00 must adopt sub-hundred charm (.99)', () => {
    expect(calculateCharmPrice('mojitos', 100)).toBe(99);
    expect(calculateCharmPrice('shakes', 100)).toBe(99);
    expect(calculateCharmPrice('shakes', 150)).toBe(149);
    expect(calculateCharmPrice('beach-services', 1500)).toBe(1499);
    expect(calculateCharmPrice('beach-services', 500)).toBe(499);
    expect(calculateCharmPrice('beach-services', 3000)).toBe(2999);
  });

  test('Items with 10-step increments must end in 9', () => {
    expect(calculateCharmPrice('snacks', 60)).toBe(69);
    expect(calculateCharmPrice('snacks', 70)).toBe(79);
    expect(calculateCharmPrice('shakes', 80)).toBe(89);
    expect(calculateCharmPrice('snacks', 90)).toBe(99);
    expect(calculateCharmPrice('snacks', 110)).toBe(119);
    expect(calculateCharmPrice('mojitos', 120)).toBe(129);
    expect(calculateCharmPrice('snacks', 130)).toBe(139);
    expect(calculateCharmPrice('mojitos', 140)).toBe(149);
    expect(calculateCharmPrice('snacks', 160)).toBe(169);
    expect(calculateCharmPrice('shakes', 180)).toBe(189);
    expect(calculateCharmPrice('shakes', 190)).toBe(199);
    expect(calculateCharmPrice('shakes', 210)).toBe(219);
  });

  test('Packaged Drinking Water and MRP items MUST preserve exact authentic MRP', () => {
    expect(calculateCharmPrice('soft-drinks', 20, true)).toBe(20); // 1L Water Bottle
    expect(calculateCharmPrice('soft-drinks', 10, true)).toBe(10); // 500ml Water Bottle
    expect(calculateCharmPrice('soft-drinks', 40, true)).toBe(40); // Thums Up / Coke
    expect(calculateCharmPrice('energy-drinks', 125, true)).toBe(125); // Red Bull
  });
});
