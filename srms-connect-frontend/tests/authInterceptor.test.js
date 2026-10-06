import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearAuthState,
  endSession,
  isSessionExpiredResponse,
  handleResponseError,
} from "../src/services/authInterceptor.js";

const makeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => delete data[k],
  };
};

const makeDeps = (stored, pathname = "/home") => {
  const calls = { redirect: [], cleared: 0 };
  const storage = makeStorage(stored);
  return {
    calls,
    storage,
    deps: {
      storage,
      onClear: () => calls.cleared++,
      redirect: (p) => calls.redirect.push(p),
      getPathname: () => pathname,
    },
  };
};

const axiosError = (status, url) => ({ response: { status }, config: { url } });

test("clearAuthState removes token, userId and role but nothing else", () => {
  const storage = makeStorage({ token: "t", userId: "1", role: "ADMIN", theme: "dark" });
  clearAuthState(storage);
  assert.deepEqual(storage.data, { theme: "dark" });
});

test("a 401 on an authenticated request clears auth state and redirects to /login", async () => {
  const { calls, storage, deps } = makeDeps({ token: "t", userId: "1", role: "STUDENT" });
  const err = axiosError(401, "/posts/feed");

  await assert.rejects(handleResponseError(err, deps), (e) => e === err); // original error preserved

  assert.deepEqual(storage.data, {});
  assert.equal(calls.cleared, 1); // socket disconnect hook ran
  assert.deepEqual(calls.redirect, ["/login"]);
});

test("a second 401 after the state was cleared does not redirect again", async () => {
  const { calls, deps } = makeDeps({ token: "t" });
  await assert.rejects(handleResponseError(axiosError(401, "/a"), deps));
  await assert.rejects(handleResponseError(axiosError(401, "/b"), deps));
  assert.equal(calls.redirect.length, 1);
});

test("a failed login (401 from /auth/login) is a normal form error, not an expired session", async () => {
  const { calls, storage, deps } = makeDeps({ token: "stale" });
  await assert.rejects(handleResponseError(axiosError(401, "/auth/login"), deps));
  assert.equal(storage.getItem("token"), "stale");
  assert.deepEqual(calls.redirect, []);
});

test("non-401 errors and 401s without a stored token are left alone", async () => {
  for (const [status, stored] of [[403, { token: "t" }], [500, { token: "t" }], [401, {}]]) {
    const { calls, deps } = makeDeps(stored);
    await assert.rejects(handleResponseError(axiosError(status, "/posts/feed"), deps));
    assert.deepEqual(calls.redirect, []);
  }
});

test("network errors with no response do not crash the handler", async () => {
  const { calls, deps } = makeDeps({ token: "t" });
  await assert.rejects(handleResponseError(new Error("Network Error"), deps));
  assert.deepEqual(calls.redirect, []);
});

test("/auth/logout returning 401 still counts as an ended session", () => {
  assert.equal(isSessionExpiredResponse({ status: 401, url: "/auth/logout", hasToken: true }), true);
  assert.equal(isSessionExpiredResponse({ status: 401, url: "/auth/otp/verify", hasToken: true }), false);
});

test("endSession does not redirect when already on a public page (no reload loop)", () => {
  const storage = makeStorage({ token: "t" });
  const redirects = [];
  for (const pathname of ["/login", "/register", "/forgot-password", "/reset-password"]) {
    endSession({ storage, redirect: (p) => redirects.push(p), pathname });
  }
  assert.deepEqual(redirects, []);
  assert.equal(storage.getItem("token"), null);
});
