const mongoose = require('mongoose');
const { calculateCharmPrice } = require('../utils/pricingEngine');

const VariantSchema = new mongoose.Schema({
  variantName: { 
    type: String, 
    enum: ['Milkshake', 'Blended', 'Thickshake'],
    required: true 
  },
  baseCost: { 
    type: Number, 
    required: true 
  },
  sellingPrice: { 
    type: Number, 
    required: true 
  }
}, { _id: false });

const MenuItemSchema = new mongoose.Schema({
  sku: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  category: { 
    type: String, 
    required: true, 
    enum: ['hot-beverages', 'mojitos', 'shakes', 'icecream', 'snacks', 'soft-drinks', 'energy-drinks', 'beach-services'],
    index: true 
  },
  isMrp: {
    type: Boolean,
    default: false
  },
  baseCost: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  sellingPrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  hasVariants: { 
    type: Boolean, 
    default: false 
  },
  variants: [VariantSchema],
  servingSize: {
    type: String,
    default: ''
  },
  description: { 
    type: String, 
    default: '' 
  },
  imageUrl: { 
    type: String, 
    default: '' 
  },
  tags: [{ 
    type: String 
  }], // 'Veg', 'Non-Veg', 'Signature', 'Refreshing', 'Authentic'
  isAvailable: { 
    type: Boolean, 
    default: true, 
    index: true 
  },
  preparationTimeMinutes: { 
    type: Number, 
    default: 5 
  }
}, { 
  timestamps: true 
});

// Automated Pre-Save Hook: Enforce Charm Pricing Rule prior to saving
MenuItemSchema.pre('save', function(next) {
  if (this.isMrp) {
    if (!this.baseCost) this.baseCost = this.sellingPrice;
  } else {
    this.sellingPrice = calculateCharmPrice(this.category, this.baseCost, this.isMrp);
  }

  // Handle variants for shakes
  if (this.hasVariants && this.variants && this.variants.length > 0) {
    this.variants.forEach(v => {
      if (!this.isMrp) {
        v.sellingPrice = calculateCharmPrice(this.category, v.baseCost, this.isMrp);
      }
    });
  }
  next();
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
