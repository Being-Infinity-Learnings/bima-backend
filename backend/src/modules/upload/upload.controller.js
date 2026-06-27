const service = require("./upload.service");

async function uploadImage(req, res) {
  try {
    const { folder } = req.body;

    const result = await service.uploadImage(req.file, folder);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  uploadImage,
};
