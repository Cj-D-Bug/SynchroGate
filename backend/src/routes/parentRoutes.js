// src/routes/parentRoutes.js
import express from 'express';
import parentController from '../controllers/parentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['parent']));

// GET /api/parent/linked-students
router.get('/linked-students', parentController.getLinkedStudents);

export default router;
