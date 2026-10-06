// Maps any thrown value to a safe { statusCode, message, operational } triple.
// Only AppError messages (written by us) and a few known library errors are ever
// shown to clients - raw DB / library errors are logged and replaced by a generic message.
function normalizeError(err) {
    if (err && err.isOperational) {
        return { statusCode: err.statusCode || 500, message: err.message, operational: true };
    }

    if (err && err.type === "entity.parse.failed") {
        return { statusCode: 400, message: "Invalid JSON body", operational: true };
    }
    if (err && err.type === "entity.too.large") {
        return { statusCode: 413, message: "Request body too large", operational: true };
    }

    if (err && err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return { statusCode: 413, message: "File is too large", operational: true };
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
            return { statusCode: 400, message: "Too many files or unexpected file field", operational: true };
        }
        return { statusCode: 400, message: "Invalid file upload", operational: true };
    }

    if (err && err.name === "TokenExpiredError") {
        return { statusCode: 401, message: "Session expired. Please log in again.", operational: true };
    }
    if (err && err.name === "JsonWebTokenError") {
        return { statusCode: 401, message: "Invalid token. Please log in again.", operational: true };
    }

    if (err && err.code === "ER_DUP_ENTRY") {
        return { statusCode: 409, message: "This record already exists", operational: true };
    }

    return { statusCode: 500, message: "Something went wrong. Please try again later.", operational: false };
}

const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const { statusCode, message, operational } = normalizeError(err);

    if (!operational || statusCode >= 500) {
        console.error("[error]", req.method, req.originalUrl, err);
    }

    const body = {
        status: String(statusCode).startsWith("4") ? "fail" : "error",
        message,
    };

    // full details only when explicitly running in development
    if (process.env.NODE_ENV === "development") {
        body.error = { name: err && err.name, code: err && err.code };
        body.stack = err && err.stack;
    }

    res.status(statusCode).json(body);
};

module.exports = globalErrorHandler;
module.exports.normalizeError = normalizeError;
