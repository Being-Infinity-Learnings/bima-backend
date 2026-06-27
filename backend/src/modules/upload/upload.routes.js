const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const upload = require("../../middleware/upload.middleware");

const controller = require("./upload.controller");

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload endpoints. Files are stored in S3 and a public URL is returned.
 */

/**
 * @swagger
 * /uploads/image:
 *   post:
 *     summary: Upload an image to S3
 *     description: >
 *       Accepts a single image file via `multipart/form-data` under the field name `file`.
 *       The file is stored in S3 and a permanent public URL is returned.
 *       Supported formats: JPEG, PNG, GIF, WebP.
 *       Max file size is determined by the upload middleware configuration.
 *       Requires ADMIN or AUTHOR role.
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload (JPEG, PNG, GIF, or WebP)
 *     responses:
 *       200:
 *         description: Image uploaded successfully — returns the public S3 URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadImageResponse'
 *             example:
 *               success: true
 *               data:
 *                 url: "https://bima-assets.s3.ap-south-1.amazonaws.com/images/abc123.jpg"
 *       400:
 *         description: No file supplied or file type not accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "No file uploaded"
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role (requires ADMIN or AUTHOR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "File size exceeds the allowed limit"
 *       500:
 *         description: Unexpected server error or S3 upload failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/image",

  auth,

  allowRoles("ADMIN", "AUTHOR"),

  upload.single("file"),

  controller.uploadImage,
);

module.exports = router;
