/**
 * Psychological Charm Pricing Engine (.99 & 9-Ending Rules) for Anchor Cafe
 *
 * Rules:
 * 1. Traditional Hot Beverages Exception: Filter Coffee (₹40), Lemon Tea (₹30),
 *    Green Tea (₹30), and Black Coffee (₹40) are authentic coastal staples.
 *    Their prices remain strictly untouched.
 * 2. Food & Cold Beverages:
 *    - Sub-threshold / round anchors (100 -> 99, 150 -> 149, 200 -> 199, 500 -> 499, 1200 -> 1199, 1500 -> 1499, 3000 -> 2999)
 *    - 10-step increments ending in 0 (e.g. 60 -> 69, 70 -> 79, 80 -> 89, 90 -> 99, 110 -> 119, etc.)
 *
 * @param {string} category - Menu category ('hot-beverages', 'mojitos', 'shakes', 'icecream', 'snacks', 'beach-services')
 * @param {number} basePrice - Raw menu base cost
 * @returns {number} Final selling charm price
 */
function calculateCharmPrice(category, basePrice, isMrp = false) {
  const numericPrice = Number(basePrice);
  if (isNaN(numericPrice) || numericPrice <= 0) return 0;

  // STRICT EXCEPTION: Hot Beverages and Packaged MRP items (Water bottles, Sodas) preserve authentic pricing
  if (category === 'hot-beverages' || isMrp) {
    return numericPrice;
  }

  // Specific Psychological sub-hundred/sub-fifty anchors
  if (numericPrice === 100) return 99;
  if (numericPrice === 150) return 149;
  if (numericPrice === 200) return 199;

  // Round hundred/thousand packages (e.g., 500 -> 499, 1200 -> 1199, 1500 -> 1499, 3000 -> 2999)
  if (numericPrice >= 500 && numericPrice % 100 === 0) {
    return numericPrice - 1;
  }

  // General 9-ending rule for 10-step increments
  if (numericPrice % 10 === 0) {
    return numericPrice + 9;
  }

  return numericPrice;
}

module.exports = {
  calculateCharmPrice
};
