import mongoose from "mongoose";

const VoucherSchema = new mongoose.Schema({
    // Shopify Data
    shopifyCode: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    shopifyOrderId: String, // To link back to the order

    // Linked Customer Data (Snapshot)
    customer: {
        shopifyId: String,
        email: String,
        firstName: String,
        lastName: String
    },

    // Pro Handel Data
    proHandelNumber: {
        type: Number,
        unique: true,
        sparse: true
    },
    proHandelUuid: {
        type: String, // UUID
        sparse: true
    },

    // Common Data
    value: {
        type: Number,
        required: true
    },
    initialValue: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'EUR'
    },

    status: {
        type: String,
        enum: ['active', 'redeemed', 'partial', 'cancelled', 'expired'],
        default: 'active'
    },

    issuedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,

    redeemedAt: Date,
    redeemedAmount: {
        type: Number,
        default: 0
    },

    // Metadata
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

export default mongoose.model('Voucher', VoucherSchema, 'mercurios-vouchers');
