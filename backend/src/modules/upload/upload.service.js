// const crypto = require("crypto");

// const { PutObjectCommand } = require("@aws-sdk/client-s3");

// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// const s3 = require("../../config/s3");

// const ALLOWED_FOLDERS = [
//   "quiz-covers",
//   "question-images",
//   "profile-images",
//   "notification-images",
// ];

// const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// async function generateUploadUrl(fileName, contentType, folder) {
//   if (!ALLOWED_FOLDERS.includes(folder)) {
//     throw new Error("Invalid upload folder");
//   }

//   if (!ALLOWED_TYPES.includes(contentType)) {
//     throw new Error("Unsupported file type");
//   }

//   const extension = fileName.split(".").pop();

//   const key = `bima/${folder}/${crypto.randomUUID()}.${extension}`;

//   const command = new PutObjectCommand({
//     Bucket: process.env.AWS_S3_BUCKET,

//     Key: key,

//     ContentType: contentType,
//   });

//   const uploadUrl = await getSignedUrl(s3, command, {
//     expiresIn: 60 * 5,
//   });

//   return {
//     uploadUrl,

//     fileUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
//   };
// }

// module.exports = {
//   generateUploadUrl,
// };

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
