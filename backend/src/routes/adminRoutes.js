// src/routes/adminRoutes.js
import express from 'express';
import adminController from '../controllers/adminController.js';
import developerController from '../controllers/developerController.js'; // Assuming you have this
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

// Routes accessible by both Admin and Developer roles
router.use(authMiddleware);
router.use(roleMiddleware(['admin', 'developer']));

// Admin & Developer shared routes
router.get('/users', adminController.getUsers);
router.post('/generate-qr', adminController.generateQR);
router.get('/reports', adminController.getReports);

// Developer-only routes
router.get('/system-logs', developerController.getSystemLogs);
router.get('/arduino-events', developerController.getArduinoEvents);

export default router;
