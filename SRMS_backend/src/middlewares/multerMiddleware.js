const multer = require("multer");
const AppError = require("../utils/AppError");
const { contentMatchesMime, IMAGE_MIMES, VIDEO_MIMES } = require("../utils/fileSignature");

const MB = 1024 * 1024;

const storage = multer.memoryStorage();

// 1st line of defence: reject by declared mimetype and enforce hard size/count limits
// while the upload streams in (nothing larger than maxFileSize is ever buffered).
const createUploader = ({ allowedMimes, maxFileSize, maxFiles }) =>
    multer({
        storage,
        limits: { fileSize: maxFileSize, files: maxFiles },
        fileFilter: (req, file, cb) => {
            if (!allowedMimes.includes(file.mimetype)) {
                return cb(new AppError(`Unsupported file type: ${file.mimetype}`, 415));
            }
            cb(null, true);
        },
    });

// post media: images or videos. Images are capped lower by validateUploadedFiles below.
const MAX_POST_IMAGE_BYTES = 10 * MB;
const postMedia = createUploader({
    allowedMimes: [...IMAGE_MIMES, ...VIDEO_MIMES],
    maxFileSize: 50 * MB,
    maxFiles: 5,
});

// profile photo: images only
const MAX_PROFILE_PHOTO_BYTES = 5 * MB;
const profilePhoto = createUploader({
    allowedMimes: IMAGE_MIMES,
    maxFileSize: MAX_PROFILE_PHOTO_BYTES,
    maxFiles: 1,
});

// 2nd line of defence: after multer, verify the bytes really are the declared type
// and apply per-type size caps. Run this directly after the uploader on the route.
const validateUploadedFiles = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);

    for (const file of files) {
        if (!contentMatchesMime(file.buffer, file.mimetype)) {
            return next(new AppError("File content does not match its declared type", 415));
        }
        if (IMAGE_MIMES.includes(file.mimetype) && file.size > MAX_POST_IMAGE_BYTES) {
            return next(new AppError("Image is too large (max 10 MB)", 413));
        }
    }
    next();
};

module.exports = { postMedia, profilePhoto, validateUploadedFiles };
