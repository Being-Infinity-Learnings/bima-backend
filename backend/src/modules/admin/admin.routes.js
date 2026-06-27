const express = require("express");

const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");

const authorize = require("../../middleware/role.middleware");

const adminController = require("./admin.controller");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only user management endpoints. All routes require ADMIN role.
 */

/**
 * @swagger
 * /admin/pending-users:
 *   get:
 *     summary: List users awaiting approval
 *     description: Returns all users whose `approved` flag is `false` and `blocked` is `false`.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                   firebaseUid: "firebase-user-123"
 *                   email: "student@example.com"
 *                   phone: "+919999999999"
 *                   fullName: "Gourav Kumar"
 *                   gender: "Male"
 *                   collegeName: "ABC Institute of Technology"
 *                   rollNumber: "BIMA-2026-001"
 *                   role: "STUDENT"
 *                   approved: false
 *                   blocked: false
 *                   createdAt: "2026-06-01T10:00:00.000Z"
 *                   updatedAt: "2026-06-01T10:00:00.000Z"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
router.get(
  "/pending-users",
  authenticate,
  authorize("ADMIN"),
  adminController.getPendingUsers,
);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all registered users
 *     description: Returns every user record regardless of approval or blocked status.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                   firebaseUid: "firebase-user-123"
 *                   email: "student@example.com"
 *                   phone: "+919999999999"
 *                   fullName: "Gourav Kumar"
 *                   gender: "Male"
 *                   collegeName: "ABC Institute of Technology"
 *                   rollNumber: "BIMA-2026-001"
 *                   role: "STUDENT"
 *                   approved: true
 *                   blocked: false
 *                   createdAt: "2026-06-01T10:00:00.000Z"
 *                   updatedAt: "2026-06-01T10:30:00.000Z"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
router.get(
  "/users",
  authenticate,
  authorize("ADMIN"),
  adminController.getAllUsers,
);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get a specific user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user to retrieve
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     responses:
 *       200:
 *         description: User fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 firebaseUid: "firebase-user-123"
 *                 email: "student@example.com"
 *                 phone: "+919999999999"
 *                 fullName: "Gourav Kumar"
 *                 gender: "Male"
 *                 collegeName: "ABC Institute of Technology"
 *                 rollNumber: "BIMA-2026-001"
 *                 role: "STUDENT"
 *                 approved: true
 *                 blocked: false
 *                 createdAt: "2026-06-01T10:00:00.000Z"
 *                 updatedAt: "2026-06-01T10:30:00.000Z"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "User not found"
 *       500:
 *         description: Unexpected server error (including invalid UUID format)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/users/:id",
  authenticate,
  authorize("ADMIN"),
  adminController.getUserById,
);

/**
 * @swagger
 * /admin/users/{id}/approve:
 *   post:
 *     summary: Approve a user account
 *     description: Sets the user's `approved` flag to `true`, granting them access to the platform.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user to approve
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     responses:
 *       200:
 *         description: User approved — returns the updated user record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 approved: true
 *                 blocked: false
 *                 role: "STUDENT"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Target user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error (including invalid UUID format)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/users/:id/approve",
  authenticate,
  authorize("ADMIN"),
  adminController.approveUser,
);

/**
 * @swagger
 * /admin/users/{id}/block:
 *   post:
 *     summary: Block a user account
 *     description: >
 *       Sets the user's `blocked` flag to `true`. Blocked users cannot authenticate
 *       or use any protected endpoints until unblocked.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user to block
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     responses:
 *       200:
 *         description: User blocked — returns the updated user record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 approved: true
 *                 blocked: true
 *                 role: "STUDENT"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Target user not found
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
router.post(
  "/users/:id/block",
  authenticate,
  authorize("ADMIN"),
  adminController.blockUser,
);

/**
 * @swagger
 * /admin/users/{id}/unblock:
 *   post:
 *     summary: Unblock a user account
 *     description: Sets the user's `blocked` flag to `false`, restoring their access.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user to unblock
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     responses:
 *       200:
 *         description: User unblocked — returns the updated user record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 approved: true
 *                 blocked: false
 *                 role: "STUDENT"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Target user not found
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
router.post(
  "/users/:id/unblock",
  authenticate,
  authorize("ADMIN"),
  adminController.unblockUser,
);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Update a user's role
 *     description: Changes the user's role to one of ADMIN, AUTHOR, or STUDENT.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user whose role to update
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *           example:
 *             role: "AUTHOR"
 *     responses:
 *       200:
 *         description: Role updated — returns the updated user record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 role: "AUTHOR"
 *                 approved: true
 *                 blocked: false
 *       400:
 *         description: Invalid role value — must be ADMIN, AUTHOR, or STUDENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid role"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Target user not found
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
router.patch(
  "/users/:id/role",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserRole,
);

/**
 * @swagger
 * /admin/users/{id}/groups:
 *   get:
 *     summary: Get all groups a user belongs to
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the user
 *         example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserGroupsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *                   name: "Batch A"
 *                   description: "Primary student batch for orientation"
 *                 - id: "9a3cc027-8c2c-5g2b-a626-416gc7b15b9g"
 *                   name: "Batch B"
 *                   description: null
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
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
router.get(
  "/users/:id/groups",
  authenticate,
  authorize("ADMIN"),
  adminController.getUserGroups,
);

/**
 * @swagger
 * /admin/users/bulk-approve:
 *   post:
 *     summary: Approve multiple users at once
 *     description: >
 *       Sets `approved = true` for all supplied user IDs in a single database operation.
 *       Already-approved users are silently skipped.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkApproveRequest'
 *           example:
 *             userIds:
 *               - "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *               - "6c3aa914-04bb-4d64-876f-f34b9d890df5"
 *     responses:
 *       200:
 *         description: Users approved — returns the count of updated records
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkApproveResponse'
 *             example:
 *               success: true
 *               data:
 *                 count: 2
 *       400:
 *         description: userIds missing or not an array
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "userIds must be a non-empty array"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — requires ADMIN role
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
router.post(
  "/users/bulk-approve",
  authenticate,
  authorize("ADMIN"),
  adminController.bulkApproveUsers,
);

module.exports = router;
