const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Log all requests to auth routes
router.use((req, res, next) => {
  console.log(`📥 [AUTH ROUTE] ${req.method} ${req.path}`);
  next();
});

router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  authController.register
);

router.post(
  "/login",
  [
    body("idToken").notEmpty().withMessage("ID Token is required"),
  ],
  authController.login
);

// Protect this route with Firebase token verification
// router.post("/refresh-token", authMiddleware, authController.refreshToken);

// Logout route - requires authentication
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
