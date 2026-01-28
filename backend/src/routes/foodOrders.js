const express = require('express');
const FoodOrder = require('../models/FoodOrder');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');
const { isValidObjectId } = require('mongoose');

const router = express.Router();

// Define valid status transitions as a constant to avoid duplication
const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out-for-delivery', 'cancelled'],
  'out-for-delivery': ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

const VALID_STATUSES = Object.keys(VALID_TRANSITIONS);

/**
 * Get food order statistics (admin only)
 * GET /api/v1/food-orders/stats/overview
 */
router.get('/stats/overview', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const stats = await FoodOrder.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalOrders = await FoodOrder.countDocuments();
    const totalRevenue = await FoodOrder.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      statsByStatus: stats
    });
  } catch (error) {
    console.error('Error fetching food order statistics:', error);
    next(error);
  }
});

/**
 * Get all food orders (admin only)
 * GET /api/v1/food-orders/admin/all
 */
router.get('/admin/all', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = -1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: parseInt(sortOrder) };

    let query = {};
    if (status) {
      query.status = status;
    }

    const orders = await FoodOrder.find(query)
      .populate('userId', 'name email phone')
      .populate('items.menuItemId')
      .limit(parseInt(limit))
      .skip(skip)
      .sort(sortObj);

    const total = await FoodOrder.countDocuments(query);

    res.status(200).json({
      count: orders.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      orders
    });
  } catch (error) {
    console.error('Error fetching all food orders:', error);
    next(error);
  }
});


/*
 * Create new food order
 * POST /api/v1/food-orders
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { items, deliveryAddress, deliveryInstructions, paymentMethod } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Items array is required and must not be empty'
      });
    }

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({
        message: 'Delivery address is required'
      });
    }

    // Calculate total amount and validate items
    let totalAmount = 0;
    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          message: 'Each item must have a valid menuItemId and quantity'
        });
      }
      if (!item.price || item.price < 0) {
        return res.status(400).json({
          message: 'Each item must have a valid price'
        });
      }
      totalAmount += item.price * item.quantity;
    }

    const order = new FoodOrder({
      userId: req.user.userId,
      items,
      totalAmount,
      deliveryAddress: deliveryAddress.trim(),
      deliveryInstructions: deliveryInstructions || '',
      paymentMethod: paymentMethod || 'cash_on_delivery',
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        updatedBy: req.user.userId,
        notes: 'Order created'
      }]
    });

    await order.save();
    await order.populate('items.menuItemId');

    res.status(201).json({
      message: 'Food order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating food order:', error);
    next(error);
  }
});


/**
 * Get all food orders for authenticated user
 * GET /api/v1/food-orders
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const userId = req.user.userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: parseInt(sortOrder) };

    let query = { userId };
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`
        });
      }
      query.status = status;
    }

    const orders = await FoodOrder.find(query)
      .populate('items.menuItemId')
      .limit(parseInt(limit))
      .skip(skip)
      .sort(sortObj);

    const total = await FoodOrder.countDocuments(query);

    res.status(200).json({
      count: orders.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      orders
    });
  } catch (error) {
    console.error('Error fetching food orders:', error);
    next(error);
  }
});



/**
 * Get food order by ID
 * GET /api/v1/food-orders/:id
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID format'
      });
    }

    const order = await FoodOrder.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('items.menuItemId');

    if (!order) {
      return res.status(404).json({
        message: 'Food order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.userId._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Unauthorized to view this order'
      });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching food order:', error);
    next(error);
  }
});



/**
 * Update food order (user can only update pending orders)
 * PATCH /api/v1/food-orders/:id
 */
router.patch('/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID format'
      });
    }

    const { items, deliveryAddress, deliveryInstructions, paymentMethod } = req.body;

    const order = await FoodOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Food order not found'
      });
    }

    // Check if user owns the order
    if (order.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        message: 'Unauthorized to update this order'
      });
    }

    // Only allow updates to pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({
        message: `Cannot update order with status: ${order.status}`
      });
    }

    // Update fields
    if (items && Array.isArray(items) && items.length > 0) {
      let totalAmount = 0;
      for (const item of items) {
        if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            message: 'Each item must have a valid menuItemId and quantity'
          });
        }
        if (!item.price || item.price < 0) {
          return res.status(400).json({
            message: 'Each item must have a valid price'
          });
        }
        totalAmount += item.price * item.quantity;
      }
      order.items = items;
      order.totalAmount = totalAmount;
    }

    if (deliveryAddress && deliveryAddress.trim()) {
      order.deliveryAddress = deliveryAddress.trim();
    }
    if (deliveryInstructions !== undefined) {
      order.deliveryInstructions = deliveryInstructions;
    }
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }

    order.updatedAt = new Date();

    await order.save();
    await order.populate('items.menuItemId');

    res.status(200).json({
      message: 'Food order updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating food order:', error);
    next(error);
  }
});

/**
 * Update food order status (admin only)
 * PATCH /api/v1/food-orders/:id/status
 */
router.patch('/:id/status', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID format'
      });
    }

    const { newStatus, notes } = req.body;

    if (!newStatus) {
      return res.status(400).json({
        message: 'New status is required'
      });
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`
      });
    }

    const order = await FoodOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Food order not found'
      });
    }

    // Check if transition is valid
    if (!VALID_TRANSITIONS[order.status].includes(newStatus)) {
      return res.status(400).json({
        message: `Cannot transition from ${order.status} to ${newStatus}`
      });
    }

    // Update status
    order.status = newStatus;

    // Add to status history
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      updatedBy: req.user.userId,
      notes: notes || `Status updated to ${newStatus}`
    });

    order.updatedAt = new Date();

    await order.save();
    await order.populate('items.menuItemId');

    res.status(200).json({
      message: 'Food order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating food order status:', error);
    next(error);
  }
});


/**
 * Cancel food order (admin only)
 * DELETE /api/v1/food-orders/:id/cancel
 */
router.delete('/:id/cancel', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID format'
      });
    }

    const { reason } = req.body;

    const order = await FoodOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Food order not found'
      });
    }

    // Check if order can be cancelled
    if (!VALID_TRANSITIONS[order.status].includes('cancelled')) {
      return res.status(400).json({
        message: `Cannot cancel order with status: ${order.status}`
      });
    }

    // Update status to cancelled
    order.status = 'cancelled';

    // Add to status history
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      updatedBy: req.user.userId,
      notes: reason || 'Order cancelled by admin'
    });

    order.updatedAt = new Date();

    await order.save();
    await order.populate('items.menuItemId');

    res.status(200).json({
      message: 'Food order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Error cancelling food order:', error);
    next(error);
  }
});

/**
 * Delete food order (admin only)
 * DELETE /api/v1/food-orders/:id
 */
router.delete('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID format'
      });
    }

    const order = await FoodOrder.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Food order not found'
      });
    }

    res.status(200).json({
      message: 'Food order deleted successfully',
      order
    });
  } catch (error) {
    console.error('Error deleting food order:', error);
    next(error);
  }
});

module.exports = router;
