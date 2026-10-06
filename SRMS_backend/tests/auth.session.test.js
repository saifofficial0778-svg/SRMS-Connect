process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const authRepository = require("../src/modules/auth/auth.repository");
const AuthService = require("../src/modules/auth/auth.service");

const sign = (payload = { userId: 7, role: "STUDENT" }, opts = { expiresIn: "1h" }) =>
    jwt.sign(payload, process.env.JWT_SECRET, opts);

afterEach(() => mock.restoreAll());

// ---------- authenticateToken ----------

test("authenticateToken accepts a live session of an ACTIVE user and returns the DB role", async () => {
    const token = sign({ userId: 7, role: "STUDENT" });
    const lookup = mock.method(authRepository, "findActiveSession", async () => ({
        id: 1, user_id: 7, role: "ADMIN", status: "ACTIVE",
    }));

    const user = await AuthService.authenticateToken(token);

    assert.deepEqual(user, { userId: 7, role: "ADMIN" }); // DB role wins over the stale token role
    const [userId, tokenHash] = lookup.mock.calls[0].arguments;
    assert.equal(userId, 7);
    assert.equal(tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
});

test("authenticateToken rejects a token with a bad signature without touching the DB", async () => {
    const lookup = mock.method(authRepository, "findActiveSession", async () => ({}));
    const forged = jwt.sign({ userId: 7 }, "another-secret");

    await assert.rejects(AuthService.authenticateToken(forged), { statusCode: 401 });
    assert.equal(lookup.mock.callCount(), 0);
});

test("authenticateToken rejects an expired JWT", async () => {
    mock.method(authRepository, "findActiveSession", async () => ({ user_id: 7, role: "STUDENT", status: "ACTIVE" }));
    const expired = sign({ userId: 7 }, { expiresIn: -10 });

    await assert.rejects(AuthService.authenticateToken(expired), { statusCode: 401 });
});

test("authenticateToken rejects when there is no live session (revoked / expired / unknown)", async () => {
    mock.method(authRepository, "findActiveSession", async () => undefined);

    await assert.rejects(AuthService.authenticateToken(sign()), { statusCode: 401 });
});

for (const status of ["BLOCKED", "PENDING", "REJECTED"]) {
    test(`authenticateToken rejects a ${status} user even with a valid session`, async () => {
        mock.method(authRepository, "findActiveSession", async () => ({ user_id: 7, role: "STUDENT", status }));

        await assert.rejects(AuthService.authenticateToken(sign()), { statusCode: 401 });
    });
}

// ---------- login lockout ----------

const passwordHash = bcrypt.hashSync("correct-password", 4);
const baseUser = { id: 3, password_hash: passwordHash, status: "ACTIVE", role: "STUDENT", is_locked: 0, lock_minutes: null };

test("login refuses a locked account with 429 and never checks the password", async () => {
    mock.method(authRepository, "findUserForLogin", async () => ({ ...baseUser, is_locked: 1, lock_minutes: 12 }));
    const failed = mock.method(authRepository, "registerFailedLogin", async () => {});

    await assert.rejects(
        AuthService.login("EN1", "correct-password", { deviceInfo: "x", ipAddress: "1.1.1.1" }),
        (err) => err.statusCode === 429 && /12 minute/.test(err.message)
    );
    assert.equal(failed.mock.callCount(), 0);
});

test("login records a failed attempt on a wrong password", async () => {
    mock.method(authRepository, "findUserForLogin", async () => baseUser);
    const failed = mock.method(authRepository, "registerFailedLogin", async () => {});

    await assert.rejects(
        AuthService.login("EN1", "wrong-password", { deviceInfo: "x", ipAddress: "1.1.1.1" }),
        { statusCode: 401 }
    );

    assert.equal(failed.mock.callCount(), 1);
    const [userId, maxAttempts, lockMinutes] = failed.mock.calls[0].arguments;
    assert.equal(userId, 3);
    assert.equal(maxAttempts, 5);
    assert.equal(lockMinutes, 15);
});

test("login does not count a failure for an unknown enrollment", async () => {
    mock.method(authRepository, "findUserForLogin", async () => undefined);
    const failed = mock.method(authRepository, "registerFailedLogin", async () => {});

    await assert.rejects(
        AuthService.login("NOPE", "whatever12", { deviceInfo: "x", ipAddress: "1.1.1.1" }),
        { statusCode: 401 }
    );
    assert.equal(failed.mock.callCount(), 0);
});
