// Simple health-check route(s) used by monitoring and local
// sanity checks. Keeps a lightweight response that can be used by
// load balancers or uptime monitors.

const express = require("express");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Service health and availability endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check backend health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Backend is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend Running",
  });
});

module.exports = router;
