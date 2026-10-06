process.env.JWT_SECRET = "test-secret";

const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const PostRepository = require("../src/modules/post/post.repository");
const PostService = require("../src/modules/post/post.service");
const ConversationRepository = require("../src/modules/chat/chat.repository");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const ConversationService = require("../src/modules/chat/chat.service");

const stubNotifications = require("./helpers/stubNotifications");

beforeEach(() => stubNotifications(mock));
afterEach(() => mock.restoreAll());

// ---------- likePost ----------

test("likePost on a missing post is a 404, not a 500 TypeError", async () => {
    mock.method(PostRepository, "findPostById", async () => undefined);
    const createLike = mock.method(PostRepository, "createLike", async () => 1);

    await assert.rejects(PostService.likePost(5, 999), { statusCode: 404 });
    assert.equal(createLike.mock.callCount(), 0);
});

test("likePost on a deleted post is refused", async () => {
    mock.method(PostRepository, "findPostById", async () => ({ id: 1, status: "DELETED", deleted_at: new Date() }));
    const createLike = mock.method(PostRepository, "createLike", async () => 1);

    await assert.rejects(PostService.likePost(5, 1), { statusCode: 400 });
    assert.equal(createLike.mock.callCount(), 0);
});

test("likePost on an active post still works, and double likes are 409", async () => {
    mock.method(PostRepository, "findPostById", async () => ({ id: 1, status: "ACTIVE", deleted_at: null }));
    const findLike = mock.method(PostRepository, "findLike", async () => undefined);
    mock.method(PostRepository, "createLike", async () => 42);

    assert.equal(await PostService.likePost(5, 1), 42);

    findLike.mock.mockImplementation(async () => ({ id: 1 }));
    await assert.rejects(PostService.likePost(5, 1), { statusCode: 409 });
});

// ---------- sendMessage requires an ACCEPTED connection ----------

const conversation = { id: 10, user_one_id: 1, user_two_id: 2 };

function stubChat(connection) {
    mock.method(ConversationRepository, "findConversationById", async () => conversation);
    mock.method(ConnectionRepository, "findConnection", async () => connection);
    return mock.method(ConversationRepository, "createMessage", async () => 77);
}

for (const connection of [
    undefined,
    { id: 1, status: "PENDING" },
    { id: 1, status: "REJECTED" },
    { id: 1, status: "CANCELLED" },
    { id: 1, status: "REMOVED" },
]) {
    test(`sendMessage is refused and nothing is stored when connection is ${connection ? connection.status : "missing"}`, async () => {
        const createMessage = stubChat(connection);

        await assert.rejects(ConversationService.sendMessage(10, 1, "hi"), { statusCode: 403 });
        assert.equal(createMessage.mock.callCount(), 0);
    });
}

test("sendMessage works while the connection is ACCEPTED and checks the other participant", async () => {
    const createMessage = stubChat({ id: 1, status: "ACCEPTED" });

    const result = await ConversationService.sendMessage(10, 1, "  hello ");

    assert.equal(result.messageId, 77);
    assert.equal(result.receiverId, 2);
    assert.deepEqual(createMessage.mock.calls[0].arguments, [10, 1, "hello"]);
    assert.deepEqual(ConnectionRepository.findConnection.mock.calls[0].arguments, [1, 2]);
});

test("a non-participant still cannot send (checked before the connection lookup)", async () => {
    stubChat({ id: 1, status: "ACCEPTED" });
    await assert.rejects(ConversationService.sendMessage(10, 3, "hi"), { statusCode: 403 });
    assert.equal(ConnectionRepository.findConnection.mock.callCount(), 0);
});
