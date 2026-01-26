const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  // Delivery identification
  deliveryNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Order and driver assignment
  foodOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodOrder',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Delivery status
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'completed', 'failed', 'cancelled'],
    default: 'assigned'
  },
  statusHistory: [
    {
      status: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      notes: String
    }
  ],

  // Timing information
  assignedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  completedAt: Date,
  estimatedDeliveryTime: {
    type: String, // e.g., "12:00 PM - 1:00 PM"
    required: true
  },

  // Delivery proof
  proofOfDelivery: {
    recipientName: String,
    recipientPhone: String,
    notes: String,
    timestamp: Date
  },

  // Driver information snapshot (at time of assignment)
  driverDetails: {
    name: String,
    phone: String,
    email: String,
    vehicleType: String,
    vehicleNumber: String,
    rating: Number
  },

  // Customer information snapshot
  customerDetails: {
    name: String,
    phone: String,
    email: String,
    address: String,
    specialInstructions: String
  },

  // Feedback and ratings
  driverRating: {
    type: Number,
    min: 1,
    max: 5
  },
  driverFeedback: String,
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  customerFeedback: String,
  ratedAt: Date,

  // Cancellation information
  cancellationReason: String,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Failure information
  failureReason: String,
  failedAt: Date,

  // Additional notes
  internalNotes: String,
  customerNotes: String,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware
deliverySchema.pre('save', async function(next) {
  // Generate delivery number if not provided
  if (!this.deliveryNumber && this.isNew) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.deliveryNumber = `DEL-${timestamp}-${random}`;
  }

  // Add initial status to history if new delivery
  if (this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      notes: 'Delivery assigned'
    });
  }

  next();
});

// Post-save middleware to populate references
deliverySchema.post('save', async function(doc) {
  await doc.populate('foodOrderId');
  await doc.populate('driverId', 'name email phone');
  await doc.populate('cancelledBy', 'name email');
});

// Index for common queries
deliverySchema.index({ foodOrderId: 1 });
deliverySchema.index({ driverId: 1, status: 1 });
deliverySchema.index({ status: 1, assignedAt: -1 });
deliverySchema.index({ deliveryNumber: 1 });

// Virtual for is delivery active
deliverySchema.virtual('isActive').get(function() {
  return ['assigned', 'accepted'].includes(this.status);
});

// Virtual for is delivery completed
deliverySchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Virtual for is delivery failed
deliverySchema.virtual('isFailed').get(function() {
  return this.status === 'failed';
});

// Method to accept delivery
deliverySchema.methods.acceptDelivery = function() {
  if (this.status !== 'assigned') {
    throw new Error(`Cannot accept delivery with status: ${this.status}`);
  }
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.statusHistory.push({
    status: 'accepted',
    timestamp: new Date(),
    notes: 'Delivery accepted by driver'
  });
};

// Method to complete delivery
deliverySchema.methods.completeDelivery = function(proofOfDelivery) {
  if (this.status !== 'accepted') {
    throw new Error(`Cannot complete delivery with status: ${this.status}`);
  }
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (proofOfDelivery) {
    this.proofOfDelivery = {
      ...proofOfDelivery,
      timestamp: new Date()
    };
  }
  
  this.statusHistory.push({
    status: 'completed',
    timestamp: new Date(),
    notes: 'Delivery completed'
  });
};

// Method to mark delivery as failed
deliverySchema.methods.markFailed = function(reason) {
  if (['completed', 'cancelled'].includes(this.status)) {
    throw new Error(`Cannot mark failed delivery with status: ${this.status}`);
  }
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason || 'Delivery failed';
  
  this.statusHistory.push({
    status: 'failed',
    timestamp: new Date(),
    notes: `Delivery failed: ${reason}`
  });
};

// Method to cancel delivery
deliverySchema.methods.cancelDelivery = function(reason, cancelledBy) {
  if (['completed', 'cancelled'].includes(this.status)) {
    throw new Error(`Cannot cancel delivery with status: ${this.status}`);
  }
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason || 'Cancelled by system';
  this.cancelledBy = cancelledBy;
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    notes: `Delivery cancelled: ${reason}`
  });
};

// Method to add rating
deliverySchema.methods.addDriverRating = function(rating, feedback) {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  this.driverRating = rating;
  this.driverFeedback = feedback;
  this.ratedAt = new Date();
};

// Method to add customer rating
deliverySchema.methods.addCustomerRating = function(rating, feedback) {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  this.customerRating = rating;
  this.customerFeedback = feedback;
  this.ratedAt = new Date();
};

module.exports = mongoose.model('Delivery', deliverySchema);