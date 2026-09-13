import { useEffect, useRef, useState } from "react";
import ConversationList from "../../components/messaging/ConversationList";
import ChatWindow from "../../components/messaging/ChatWindow";
import EmptyChat from "../../components/messaging/EmptyChat";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import {
  getConversations,
  getMessages,
  sendMessageRest,
  markConversationRead,
} from "../../services/chatService";
import { connectSocket, getSocket, disconnectSocket } from "../../services/socket";

export default function Messaging() {
  const currentUserId = Number(localStorage.getItem("userId"));

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState("");

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState("");

  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingConversationIds, setTypingConversationIds] = useState(new Set());

  const { toasts, showToast, dismiss } = useToast();

  // kept in a ref so socket callbacks always see the latest value
  // without having to reconnect the socket on every state change
  const activeConversationIdRef = useRef(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // ---- initial conversation list ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingConversations(true);
      setConversationsError("");
      try {
        const res = await getConversations();
        if (!cancelled) setConversations(res?.data || []);
      } catch (err) {
        if (!cancelled) {
          setConversationsError(
            err?.response?.data?.message || "Couldn't load your conversations."
          );
        }
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- socket lifecycle ----
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleOnlineUsers = (ids) => setOnlineUserIds(new Set(ids));
    const handleUserOnline = ({ userId }) =>
      setOnlineUserIds((prev) => new Set(prev).add(userId));
    const handleUserOffline = ({ userId }) =>
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

    const handleUserTyping = ({ conversationId }) => {
      setTypingConversationIds((prev) => new Set(prev).add(conversationId));
    };
    const handleUserStopTyping = ({ conversationId }) => {
      setTypingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    };

    const handleConversationRead = ({ conversationId }) => {
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] || [];
        const next = list.map((m) =>
          m.sender_id === currentUserId && m.status !== "seen"
            ? { ...m, status: "seen" }
            : m
        );
        return { ...prev, [conversationId]: next };
      });
    };

    const handleNewMessage = (payload) => {
      const { conversationId, senderId, content, createdAt, messageId } = payload;
      const isActive = activeConversationIdRef.current === conversationId;

      // a message arriving means that person is done typing
      setTypingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });

      setConversations((prev) => {
        const exists = prev.some((c) => c.conversationId === conversationId);
        if (!exists) {
          getConversations()
            .then((res) => setConversations(res?.data || []))
            .catch(() => {});
          return prev;
        }
        const updated = prev.map((c) =>
          c.conversationId === conversationId
            ? {
                ...c,
                lastMessage: { content, createdAt, senderId },
                unreadCount: isActive ? 0 : c.unreadCount + 1,
              }
            : c
        );
        const target = updated.find((c) => c.conversationId === conversationId);
        const rest = updated.filter((c) => c.conversationId !== conversationId);
        return target ? [target, ...rest] : updated;
      });

      if (isActive) {
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: [
            ...(prev[conversationId] || []),
            { id: messageId, sender_id: senderId, content, created_at: createdAt, status: "sent" },
          ],
        }));
        // we're actively viewing this conversation — mark read immediately
        // and let the sender know in real time (socket), REST as backup
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit("mark_read", { conversationId, otherUserId: senderId });
        }
        markConversationRead(conversationId).catch(() => {});
      }
    };

    const handleMessageSent = (payload) => {
      const { conversationId, messageId, content, createdAt } = payload;
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] || [];
        const idx = [...list].reverse().findIndex(
          (m) => m.status === "sending" && m.content === content
        );
        if (idx === -1) return prev;
        const realIdx = list.length - 1 - idx;
        const next = [...list];
        next[realIdx] = { ...next[realIdx], id: messageId, created_at: createdAt, status: "sent" };
        return { ...prev, [conversationId]: next };
      });
    };

    const handleMessageError = ({ message }) => {
      setSendError(message || "Message failed to send.");
      const conversationId = activeConversationIdRef.current;
      if (!conversationId) return;
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] || [];
        const idx = [...list].reverse().findIndex((m) => m.status === "sending");
        if (idx === -1) return prev;
        const realIdx = list.length - 1 - idx;
        const next = [...list];
        next[realIdx] = { ...next[realIdx], status: "failed" };
        return { ...prev, [conversationId]: next };
      });
    };

    const handleConnectError = () => {
      showToast("Connection lost. Trying to reconnect...", "error");
    };

    socket.on("online_users", handleOnlineUsers);
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);
    socket.on("conversation_read", handleConversationRead);
    socket.on("new_message", handleNewMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("message_error", handleMessageError);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("online_users", handleOnlineUsers);
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      socket.off("conversation_read", handleConversationRead);
      socket.off("new_message", handleNewMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off("message_error", handleMessageError);
      socket.off("connect_error", handleConnectError);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectConversation = async (conversationId) => {
    setActiveConversationId(conversationId);
    setSendError("");

    setConversations((prev) =>
      prev.map((c) => (c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c))
    );

    const conversation = conversations.find((c) => c.conversationId === conversationId);
    const socket = getSocket();
    if (socket && socket.connected && conversation) {
      socket.emit("mark_read", { conversationId, otherUserId: conversation.otherUser.id });
    }
    markConversationRead(conversationId).catch(() => {});

    if (!messagesByConversation[conversationId]) {
      setLoadingMessages(true);
      try {
        const res = await getMessages(conversationId);
        const raw = res?.data?.messages || [];
        // is_read comes back from the DB — use it to show the right
        // check-mark state for messages sent before this session started
        const transformed = raw.map((m) => ({
          ...m,
          status:
            m.sender_id === currentUserId ? (m.is_read ? "seen" : "sent") : undefined,
        }));
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: transformed,
        }));
      } catch (err) {
        showToast(
          err?.response?.data?.message || "Couldn't load this conversation.",
          "error"
        );
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  const doSend = async (conversationId, content) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimisticMessage],
    }));

    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.conversationId === conversationId
          ? {
              ...c,
              lastMessage: {
                content,
                createdAt: optimisticMessage.created_at,
                senderId: currentUserId,
              },
            }
          : c
      );
      const target = updated.find((c) => c.conversationId === conversationId);
      const rest = updated.filter((c) => c.conversationId !== conversationId);
      return target ? [target, ...rest] : updated;
    });

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit("send_message", { conversationId, content });
      return;
    }

    try {
      const res = await sendMessageRest(conversationId, content);
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] || [];
        const next = list.map((m) =>
          m.id === tempId
            ? { ...m, id: res?.data?.messageId, created_at: res?.data?.createdAt, status: "sent" }
            : m
        );
        return { ...prev, [conversationId]: next };
      });
    } catch (err) {
      setSendError(err?.response?.data?.message || "Message failed to send.");
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] || [];
        const next = list.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m));
        return { ...prev, [conversationId]: next };
      });
    }
  };

  const handleSend = (content) => {
    if (!activeConversationId) return;
    setSendError("");
    doSend(activeConversationId, content);
  };

  const handleRetryMessage = (message) => {
    if (!activeConversationId) return;
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).filter(
        (m) => m.id !== message.id
      ),
    }));
    doSend(activeConversationId, message.content);
  };

  const activeConversation = conversations.find(
    (c) => c.conversationId === activeConversationId
  );

  const handleTypingStart = () => {
    if (!activeConversation) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit("typing", {
        conversationId: activeConversationId,
        receiverId: activeConversation.otherUser.id,
      });
    }
  };

  const handleTypingStop = () => {
    if (!activeConversation) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit("stop_typing", {
        conversationId: activeConversationId,
        receiverId: activeConversation.otherUser.id,
      });
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] max-w-6xl mx-auto flex border-x border-[#1B2438]/10 bg-white overflow-hidden">
      <div
        className={`w-full md:w-[340px] shrink-0 border-r border-[#1B2438]/10 ${
          activeConversationId ? "hidden md:block" : "block"
        }`}
      >
        <ConversationList
          conversations={conversations}
          loading={loadingConversations}
          error={conversationsError}
          activeConversationId={activeConversationId}
          onlineUserIds={onlineUserIds}
          onSelect={handleSelectConversation}
        />
      </div>

      <div className={`flex-1 min-w-0 flex ${activeConversationId ? "flex" : "hidden md:flex"}`}>
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            online={onlineUserIds.has(activeConversation.otherUser.id)}
            isTyping={typingConversationIds.has(activeConversationId)}
            messages={messagesByConversation[activeConversationId] || []}
            loadingMessages={loadingMessages}
            sendError={sendError}
            currentUserId={currentUserId}
            onSend={handleSend}
            onRetryMessage={handleRetryMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onBack={() => setActiveConversationId(null)}
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
