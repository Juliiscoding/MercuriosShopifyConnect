import mongoose from "mongoose";
const { Schema } = mongoose;

// Enhanced Customer Schema for Identity Verification + ProHandel Integration
const IdentityCustomerSchema = new Schema({
  // Basic customer information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    index: true
  },
  phoneNumber: {
    type: String,
    required: false, // Made optional - customer intake should work without phone number
    trim: true,
  },

  // ID Card Data extracted from OCR
  idCardData: {
    firstName: {
      type: String,
      trim: true,
      index: true
    },
    lastName: {
      type: String,
      trim: true,
      index: true
    },
    dateOfBirth: {
      type: String,
      trim: true,
    },
    address: {
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
        default: 'Deutschland'
      },
    },
    documentNumber: {
      type: String,
      trim: true,
      // Removed unique constraint to avoid null value conflicts
      // Will be validated at application level instead
    },
    expirationDate: {
      type: String,
      trim: true,
    },
    nationality: {
      type: String,
      trim: true,
    }
  },

  // ID Card Photos (base64 encoded or file paths)
  idCardPhotos: {
    frontPhoto: {
      type: String, // base64 encoded image or file path
    },
    backPhoto: {
      type: String, // base64 encoded image or file path
    },
    facePhoto: {
      type: String, // extracted face photo
    }
  },

  // Digital signature (base64 encoded)
  signature: {
    type: String, // base64 encoded signature image
  },
  signatureTimestamp: {
    type: Date,
  },

  // Additional customer fields (for unified customer data)
  firstName: String,
  lastName: String,
  phone: String,
  street: String,
  city: String,
  zipCode: String,
  dateOfBirth: String,
  totalSpent: {
    type: Number,
    default: 0.00
  },
  tier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  purchases: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: String,
  address: String,
  quelle: String,
  isManualEntry: {
    type: Boolean,
    default: false
  },
  singleStepProcess: {
    type: Boolean,
    default: false
  },

  // Verification Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'declined', 'resubmission_requested'],
    default: 'pending',
    index: true
  },

  // Double Opt-In Status
  optInStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'none'],
    default: 'none'
  },
  optInToken: {
    type: String,
    index: true
  },

  // ProHandel Integration Status
  prohandelIntegration: {
    isCreated: {
      type: Boolean,
      default: false
    },
    prohandelCustomerId: {
      type: String,
      sparse: true // Allow null but unique when set
    },
    customerNumber: {
      type: Number,
      sparse: true
    },
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'error', 'manual_review'],
      default: 'pending'
    },
    lastSyncDate: {
      type: Date
    },
    syncError: {
      type: String
    }
  },

  // Shopify Integration Status
  shopifyIntegration: {
    shopifyCustomerId: {
      type: String, // GraphQL ID or numeric ID string
      sparse: true
    },
    ordersCount: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: String, // String to handle currency potentially
      default: "0.00"
    },
    lastOrderId: String,
    tags: [String],
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'error'],
      default: 'pending'
    },
    lastSyncDate: Date
  },

  // OCR Processing Results
  ocrResults: {
    frontSide: {
      confidence: Number,
      extractedText: String,
      processedAt: Date,
      ocrEngine: {
        type: String,
        default: 'tesseract'
      }
    },
    backSide: {
      confidence: Number,
      extractedText: String,
      processedAt: Date,
      ocrEngine: {
        type: String,
        default: 'tesseract'
      }
    }
  },

  // Generated Documents
  documents: {
    verificationPdf: {
      type: String, // file path or URL to generated PDF
    },
    prohandelExport: {
      type: String, // export data for ProHandel
    }
  },

  // CRM Dashboard Fields
  crmData: {
    tags: [{
      type: String,
      trim: true
    }],
    notes: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    assignedTo: {
      type: String,
      trim: true
    },
    lastContactDate: {
      type: Date
    },
    nextFollowUpDate: {
      type: Date
    },
    source: {
      type: String,
      enum: ['web_form', 'id_scan', 'manual_entry', 'import'],
      default: 'id_scan'
    }
  },

  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: String,
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: {
      type: Schema.Types.Mixed
    }
  }],

  // Manual data entry (for single-step customer intake)
  manualData: {
    firstName: String,
    lastName: String,
    fullName: String,
    email: String,
    telefon: String,
    phone: String,
    street: String,
    city: String,
    zipCode: String,
    birthday: String,
    bonuskunde: Boolean,
    marketing: {
      newsletter: Boolean,
      werbung: Boolean,
      kontakt: Boolean
    },
    signature: String, // base64 encoded signature
    signatureTimestamp: Date,
    dataSource: String,
    timestamp: Date
  },

  // Tablet/Device tracking for analytics
  deviceInfo: {
    tabletId: {
      type: String,
      trim: true,
      index: true // Index for fast analytics queries
    },
    userAgent: String,
    screenResolution: String,
    ipAddress: String,
    registrationSource: {
      type: String,
      enum: ['tablet', 'web', 'mobile', 'unknown'],
      default: 'unknown'
    }
  },

  // Email open rate tracking
  emailTracking: {
    doubleOptInSent: Date,
    doubleOptInOpened: Date,
    walletEmailSent: Date,
    walletEmailOpened: Date
  },

  // Digital wallet tracking
  walletInfo: {
    hasWallet: {
      type: Boolean,
      default: false
    },
    walletType: {
      type: String,
      enum: ['apple', 'android', null],
      default: null
    },
    walletCreatedAt: Date,
    walletPassUrl: String
  },

  // Metadata for additional data and integrations
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
IdentityCustomerSchema.index({ verificationStatus: 1, createdAt: -1 });
IdentityCustomerSchema.index({ 'prohandelIntegration.syncStatus': 1 });
IdentityCustomerSchema.index({ 'idCardData.firstName': 1, 'idCardData.lastName': 1 });
IdentityCustomerSchema.index({ 'crmData.priority': 1, 'crmData.nextFollowUpDate': 1 });

// Virtual for full name
IdentityCustomerSchema.virtual('fullName').get(function () {
  const first = this.idCardData?.firstName || '';
  const last = this.idCardData?.lastName || '';
  return `${first} ${last}`.trim();
});

// Virtual for formatted address
IdentityCustomerSchema.virtual('formattedAddress').get(function () {
  const address = this.idCardData?.address;
  if (!address) return '';

  const parts = [
    address.street,
    address.postalCode,
    address.city,
    address.country
  ].filter(Boolean);

  return parts.join(', ');
});

// Method to add audit trail entry
IdentityCustomerSchema.methods.addAuditEntry = function (action, performedBy, details = {}) {
  this.auditTrail.push({
    action,
    performedBy,
    details,
    performedAt: new Date()
  });
  return this.save();
};

// Method to update ProHandel sync status
IdentityCustomerSchema.methods.updateProHandelSync = function (status, customerId = null, error = null) {
  this.prohandelIntegration.syncStatus = status;
  this.prohandelIntegration.lastSyncDate = new Date();

  if (customerId) {
    this.prohandelIntegration.prohandelCustomerId = customerId;
    this.prohandelIntegration.isCreated = true;
  }

  if (error) {
    this.prohandelIntegration.syncError = error;
  }

  return this.save();
};

// Method to get public customer data (without sensitive info)
IdentityCustomerSchema.methods.toPublicJSON = function () {
  const customer = this.toObject();

  // Remove sensitive data for public view
  if (customer.idCardPhotos) {
    // Keep only thumbnails or remove completely for public API
    delete customer.idCardPhotos;
  }
  if (customer.signature) {
    delete customer.signature;
  }
  if (customer.auditTrail) {
    delete customer.auditTrail;
  }

  return customer;
};

// Method to prepare data for ProHandel API
IdentityCustomerSchema.methods.toProHandelData = function () {
  const data = this.idCardData || {};
  const address = data.address || {};

  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: this.email,
    phone: this.phoneNumber,
    street: address.street || '',
    city: address.city || '',
    zipCode: address.postalCode || '',
    countryName: address.country === 'Deutschland' ? 'D' : address.country || 'D',
    dateOfBirth: data.dateOfBirth,
    // ProHandel required fields
    signedDeclarationOfConsent: true,
    isBusiness: false,
    isStaff: false,
    subscriptionNewsletter: false,
    isLocked: false,
    subscriptionAdvertising: false,
    // Additional metadata
    source: 'id_verification',
    documentNumber: data.documentNumber
  };
};

// Static method to find customers ready for ProHandel sync
IdentityCustomerSchema.statics.findReadyForProHandelSync = function () {
  return this.find({
    verificationStatus: 'approved',
    'prohandelIntegration.syncStatus': { $in: ['pending', 'error'] }
  });
};

// Use the specific collection name 'mercurios-crm' to match the rest of the application
const IdentityCustomer = mongoose.model('IdentityCustomer', IdentityCustomerSchema, 'mercurios-crm');

export default IdentityCustomer; 