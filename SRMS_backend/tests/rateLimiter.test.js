const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const { createLimiter } = require("../src/middlewares/rateLimiter");

const servers = [];
after(() => servers.forEach((s) => s.close()));

async function start(limiter) {
    const app = express();
    app.use(express.json());
    app.post("/login", limiter, (req, res) => res.json({ ok: true }));
    app.use(globalErrorHandler);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
}

const post = (base, enrollment) =>
    fetch(`${base}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollment }),
    });

test("limiter allows up to max then answers 429 with our error body", async () => {
    const base = await start(createLimiter({ windowMs: 60_000, max: 3, message: "slow down" }));

    for (let i = 0; i < 3; i++) assert.equal((await post(base, "EN1")).status, 200);

    const blocked = await post(base, "EN1");
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).message, "slow down");
});

test("limits are tracked per enrollment, so another account is unaffected", async () => {
    const base = await start(createLimiter({ windowMs: 60_000, max: 1, message: "slow down" }));

    assert.equal((await post(base, "A")).status, 200);
    assert.equal((await post(base, "A")).status, 429);
    assert.equal((await post(base, "B")).status, 200);
});

test("RATE_LIMIT_DISABLED=true bypasses the limiter (for local tooling only)", async () => {
    const base = await start(createLimiter({ windowMs: 60_000, max: 1, message: "slow down" }));
    process.env.RATE_LIMIT_DISABLED = "true";
    try {
        assert.equal((await post(base, "C")).status, 200);
        assert.equal((await post(base, "C")).status, 200);
    } finally {
        delete process.env.RATE_LIMIT_DISABLED;
    }
});
