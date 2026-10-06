const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectFileKind, contentMatchesMime } = require("../src/utils/fileSignature");
const { validateUploadedFiles } = require("../src/middlewares/multerMiddleware");

const pad = (...bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(32)]);
const JPEG = pad(0xff, 0xd8, 0xff, 0xe0);
const PNG = pad(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(32)]);
const MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(32)]);
const MOV = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  "), Buffer.alloc(32)]);
const WEBM = pad(0x1a, 0x45, 0xdf, 0xa3);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

test("detectFileKind recognises supported formats by their bytes", () => {
    assert.equal(detectFileKind(JPEG), "jpeg");
    assert.equal(detectFileKind(PNG), "png");
    assert.equal(detectFileKind(GIF), "gif");
    assert.equal(detectFileKind(WEBP), "webp");
    assert.equal(detectFileKind(MP4), "mp4");
    assert.equal(detectFileKind(MOV), "mov");
    assert.equal(detectFileKind(WEBM), "webm");
    assert.equal(detectFileKind(EXE), null);
    assert.equal(detectFileKind(Buffer.alloc(4)), null);
});

test("contentMatchesMime rejects spoofed mimetypes", () => {
    assert.equal(contentMatchesMime(JPEG, "image/jpeg"), true);
    assert.equal(contentMatchesMime(EXE, "image/jpeg"), false); // exe renamed to .jpg
    assert.equal(contentMatchesMime(PNG, "image/jpeg"), false);
    assert.equal(contentMatchesMime(MOV, "video/mp4"), true);
    assert.equal(contentMatchesMime(JPEG, "video/mp4"), false);
});

const runValidator = (req) => {
    let result;
    validateUploadedFiles(req, {}, (err) => { result = err; });
    return result;
};

test("validateUploadedFiles passes genuine files", () => {
    const err = runValidator({ files: [
        { mimetype: "image/png", buffer: PNG, size: PNG.length },
        { mimetype: "video/webm", buffer: WEBM, size: WEBM.length },
    ] });
    assert.equal(err, undefined);
});

test("validateUploadedFiles rejects a file whose content is not what it claims", () => {
    const err = runValidator({ file: { mimetype: "image/jpeg", buffer: EXE, size: EXE.length } });
    assert.equal(err.statusCode, 415);
});

test("validateUploadedFiles caps image size at 10 MB", () => {
    const err = runValidator({ files: [{ mimetype: "image/jpeg", buffer: JPEG, size: 11 * 1024 * 1024 }] });
    assert.equal(err.statusCode, 413);
});

test("validateUploadedFiles is a no-op when there are no files", () => {
    assert.equal(runValidator({}), undefined);
});
