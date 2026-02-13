// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Basic Info
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  nameEn: {
    type: String,
    required: true,
    index: true
  },
  
  // Category
  category: {
    type: String,
    required: true,
    index: true
  },
  categoryEn: {
    type: String,
    index: true
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  priceAdditions: {
    metalType: {
      type: Map,
      of: Number
    },
    length: {
      type: Map,
      of: Number
    }
  },
  
  // Description
  description: String,
  descriptionEn: String,
  
  // Images
  images: [{
    type: String
  }],
  
  // Metal types
  metals: [{
    type: String
  }],
  
  // Special fields (for letters, stones, etc)
  letter: String,
  gematria: Number,
  meaningHe: String,
  meaningEn: String,
  types: [String],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedBy: mongoose.Schema.Types.ObjectId
});

// Index for better performance
productSchema.index({ category: 1, status: 1 });
productSchema.index({ name: 'text', nameEn: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
