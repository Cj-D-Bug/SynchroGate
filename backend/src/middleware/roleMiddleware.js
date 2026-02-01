// src/middleware/roleMiddleware.js

/**
 * Middleware for role-based access control.
 * Example usage:
 * router.get("/admin", authMiddleware, roleMiddleware(["admin"]), handler);
 */
module.exports = function (allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission" });
    }

    next();
  };
};
