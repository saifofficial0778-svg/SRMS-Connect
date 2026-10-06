// Detects the real file type from its leading bytes. The client-supplied mimetype is
// attacker-controlled, so uploads are only accepted when the content matches what was declared.

const ascii = (buf, start, end) => buf.toString("latin1", start, end);

function detectFileKind(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return "gif";
    if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "webp";
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
    if (ascii(buf, 4, 8) === "ftyp") return ascii(buf, 8, 12) === "qt  " ? "mov" : "mp4";

    return null;
}

// declared mimetype -> detected kinds that are acceptable for it
const MIME_TO_KINDS = {
    "image/jpeg": ["jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "video/mp4": ["mp4", "mov"],
    "video/quicktime": ["mov", "mp4"],
    "video/webm": ["webm"],
};

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];

function contentMatchesMime(buf, mimetype) {
    const kind = detectFileKind(buf);
    return !!kind && (MIME_TO_KINDS[mimetype] || []).includes(kind);
}

module.exports = { detectFileKind, contentMatchesMime, IMAGE_MIMES, VIDEO_MIMES };
