const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// Logs from MongoDB
router.get('/', auth, role(['admin', 'developer']), logController.getLogs);
router.post('/', auth, role(['admin', 'developer']), logController.createLog);

module.exports = router;
