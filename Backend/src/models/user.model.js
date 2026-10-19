import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Mongoose Schema
 * 
 * Stores ONLY core user identity, contact coordinates, and confidential KYC records.
 * Policy details are stored separately in the PolicyDetail model.
 * The `policies` array on User stores only the ObjectId reference (`policyId`) to PolicyDetail
 * and the `policyName`.
 */
const userSchema = new mongoose.Schema(
  {
    // Full legal name
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },

    // Unique login email address
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },

    // Encrypted password credential
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false
    },

    // Confidential contact phone number
    phone: {
      type: String,
      trim: true,
      default: ''
    },

    // System authorization role
    role: {
      type: String,
      enum: ['COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE', 'POLICYHOLDER'],
      default: 'POLICYHOLDER'
    },

    // Account status
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },

    // Enterprise department placement (for staff)
    department: {
      type: String,
      trim: true,
      default: function () {
        if (this.role === 'COMPANY_ADMIN' || this.role === 'ADMIN') {
          return 'Executive Administration';
        }
        if (this.role === 'EMPLOYEE') {
          return 'Claims & Underwriting';
        }
        return 'Customer Portal';
      }
    },

    // Employee reference identifier (for staff)
    employeeId: {
      type: String,
      trim: true,
      default: null
    },

    // Customer reference identifier (for policyholders)
    customerId: {
      type: String,
      trim: true,
      default: null
    },

    // Subscribed policies: stores only ObjectId reference to PolicyDetail and the policyName
    policies: [
      {
        policyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PolicyDetail',
          required: true
        },
        policyName: {
          type: String,
          trim: true,
          required: true
        }
      }
    ],

    // Personal Identity & Demographics
    dateOfBirth: {
      type: String,
      trim: true,
      default: ''
    },
    age: {
      type: Number,
      default: null
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER'],
      default: 'PREFER_NOT_TO_SAY'
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: 'English'
    },

    // Confidential KYC & Data Storage Consent
    consentDataStore: {
      type: Boolean,
      default: true
    },
    idProofType: {
      type: String,
      enum: [
        'PASSPORT',
        'DRIVING_LICENSE',
        'NATIONAL_ID',
        'AADHAAR',
        'TAX_ID',
        'OTHER',
        'PENDING_AT_PURCHASE'
      ],
      default: 'PENDING_AT_PURCHASE'
    },
    idProofNumber: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: Hash password automatically before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next ? next() : undefined;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  if (next) next();
});

// Instance method: Safely compare candidate password against hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
