const crypto = require("crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = require("../../config/s3");

const ALLOWED_FOLDERS = [
  "quiz-covers",
  "question-images",
  "profile-images",
  "notification-images",
];

const ALLOWED_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches old multer limit

/**
 * Parses a base64 data URL (e.g. "data:image/png;base64,AAAA...") into its
 * mime type and raw buffer. Throws if the format is not a recognized image
 * data URL.
 */
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("Image data must be a base64 data URL string");
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Image data must be a valid base64 data URL");
  }

  const [, mimeType, base64Payload] = match;

  if (!ALLOWED_TYPES[mimeType]) {
    throw new Error("Unsupported image type");
  }

  const buffer = Buffer.from(base64Payload, "base64");

  if (buffer.length === 0) {
    throw new Error("Image data is empty");
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 5 MB size limit");
  }

  return { mimeType, buffer };
}

/**
 * Uploads a base64-encoded image to S3 under the given folder and returns
 * the permanent public URL. This is the only place that should ever touch
 * S3 for quiz/question images — it is called from question.service and
 * quiz.service at the point a question/quiz is actually created or updated,
 * never on every file picker change.
 */
async function uploadBase64Image(dataUrl, folder) {
  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw new Error("Invalid upload folder");
  }

  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const extension = ALLOWED_TYPES[mimeType];
  const key = `bima/${folder}/${crypto.randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = {
  ALLOWED_FOLDERS,
  ALLOWED_TYPES,
  uploadBase64Image,
};
