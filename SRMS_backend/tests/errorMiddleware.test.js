const { test } = require("node:test");
const assert = require("node:assert/strict");
const AppError = require("../src/utils/AppError");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const { normalizeError } = globalErrorHandler;

const run = (err, nodeEnv) => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    const origError = console.error;
    console.error = () => {}; // silence the expected server-side log
    const res = {
        headersSent: false,
        statusCode: null,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
    try {
        globalErrorHandler(err, { method: "GET", originalUrl: "/x" }, res, () => {});
    } finally {
        console.error = origError;
        process.env.NODE_ENV = previous;
    }
    return res;
};

test("production hides raw DB errors behind a generic 500", () => {
    const dbError = Object.assign(new Error("Unknown column 'secret_col' in 'field list'"), {
        code: "ER_BAD_FIELD_ERROR",
        sql: "SELECT secret_col FROM users",
    });

    const res = run(dbError, "production");

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, "Something went wrong. Please try again later.");
    assert.equal(JSON.stringify(res.body).includes("secret_col"), false);
    assert.equal(res.body.stack, undefined);
});

test("production still shows AppError messages", () => {
    const res = run(new AppError("Invalid credentials", 401), "production");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Invalid credentials");
});

test("development adds the stack for debugging", () => {
    const res = run(new Error("boom"), "development");
    assert.equal(res.statusCode, 500);
    assert.ok(res.body.stack);
});

test("known library errors map to safe 4xx responses", () => {
    assert.deepEqual(
        { s: normalizeError({ code: "ER_DUP_ENTRY", message: "Duplicate entry 'a@b.c' for key 'uq_email'" }).statusCode },
        { s: 409 }
    );
    assert.equal(normalizeError({ code: "ER_DUP_ENTRY", message: "Duplicate entry 'a@b.c'" }).message.includes("a@b.c"), false);
    assert.equal(normalizeError({ type: "entity.parse.failed" }).statusCode, 400);
    assert.equal(normalizeError({ name: "MulterError", code: "LIMIT_FILE_SIZE" }).statusCode, 413);
    assert.equal(normalizeError({ name: "MulterError", code: "LIMIT_FILE_COUNT" }).statusCode, 400);
    assert.equal(normalizeError({ name: "JsonWebTokenError" }).statusCode, 401);
});
