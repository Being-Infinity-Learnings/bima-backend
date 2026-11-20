const express = require("express");

const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");

const storeController = require("./store.controller");

/**
 * @swagger
 * tags:
 *   name: Store
 *   description: >
 *     User-facing store endpoints for browsing redeemable items.
 *     All routes require a valid Firebase ID token.
 *     Only items with status `ACTIVE` are returned; out-of-stock items
 *     (stock = 0) are included so users can see what is available.
 */

/**
 * @swagger
 * /store/items:
 *   get:
 *     summary: List store items available for redemption
 *     description: >
 *       Returns ACTIVE store items with cursor-based pagination and sorting.
 *       Out-of-stock items (stock = 0) are included but can be identified
 *       by the `stock` field. Inactive items are never returned.
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, name, newest]
 *           default: newest
 *         description: >
 *           Field to sort by — `price` sorts by coinCost,
 *           `name` sorts alphabetically, `newest` sorts by creation date.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction — ascending or descending.
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *         description: >
 *           Pagination cursor — pass the `nextCursor` value from the
 *           previous response to fetch the next page.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of items per page (capped at 50).
 *     responses:
 *       200:
 *         description: Store items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StoreItemUser'
 *                 nextCursor:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   description: Cursor for the next page; null when there are no more items
 *                   example: null
 *             example:
 *               success: true
 *               data:
 *                 - id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                   name: "Premium Notebook"
 *                   description: "A premium spiral-bound notebook"
 *                   imageUrl: "https://cdn.example.com/store/notebook.png"
 *                   coinCost: 100
 *                   stock: 25
 *                   createdAt: "2026-10-15T08:00:00.000Z"
 *                 - id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   name: "BIMA T-Shirt"
 *                   description: null
 *                   imageUrl: null
 *                   coinCost: 250
 *                   stock: 0
 *                   createdAt: "2026-10-10T12:00:00.000Z"
 *               nextCursor: null
 *       400:
 *         description: Invalid query parameter (sortBy, sortOrder, limit, or cursor)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid sortBy value. Allowed: price, name, newest"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account is blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Account blocked"
 *       404:
 *         description: Authenticated user profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/items", authenticate, storeController.getStoreItems);

/**
 * @swagger
 * /store/items/{id}:
 *   get:
 *     summary: Get a single store item by ID
 *     description: >
 *       Returns a specific store item. Only ACTIVE items are returned —
 *       if the item does not exist or has been deactivated, a 404 is returned.
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the store item to retrieve
 *         example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *     responses:
 *       200:
 *         description: Store item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/StoreItemUser'
 *             example:
 *               success: true
 *               data:
 *                 id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                 name: "Premium Notebook"
 *                 description: "A premium spiral-bound notebook"
 *                 imageUrl: "https://cdn.example.com/store/notebook.png"
 *                 coinCost: 100
 *                 stock: 25
 *                 createdAt: "2026-10-15T08:00:00.000Z"
 *       400:
 *         description: Invalid store item ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "A valid store item ID is required"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account is blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Store item not found or inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Store item not found"
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/items/:id", authenticate, storeController.getStoreItemById);

module.exports = router;
