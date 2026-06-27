const crypto = require("crypto");

const path = require("path");

const { PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = require("../../config/s3");

const ALLOWED_FOLDERS = [
  "quiz-covers",
  "question-images",
  "profile-images",
  "notification-images",
];

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function uploadImage(file, folder) {
  if (!file) {
    throw new Error("Image is required");
  }

  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw new Error("Invalid upload folder");
  }

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error("Unsupported image type");
  }

  const extension = path.extname(file.originalname);

  const key = `bima/${folder}/${crypto.randomUUID()}${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,

      Key: key,

      Body: file.buffer,

      ContentType: file.mimetype,
    }),
  );

  return {
    fileUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

module.exports = {
  uploadImage,
};
