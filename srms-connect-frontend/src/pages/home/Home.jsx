import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getFeed } from "../../services/postService";
import { getProfile } from "../../services/profileService";
import {
  getMyConnections,
  getReceivedRequests,
  getSentRequests,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
} from "../../services/connectionService";
import { getOrCreateConversation } from "../../services/chatService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import Avatar from "../../components/profile/Avatar";
import PostComposer from "../../components/feed/PostComposer";
import PostCard from "../../components/feed/PostCard";

const PAGE_LIMIT = 10;

export default function Home() {
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // connectionMap: { [otherUserId]: { status: "none"|"sent"|"received"|"connected", connectionId } }
  const [connectionMap, setConnectionMap] = useState({});

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profileRes, feedRes, connRes, recvRes, sentRes] = await Promise.all([
          getProfile(),
          getFeed(1, PAGE_LIMIT),
          getMyConnections(),
          getReceivedRequests(),
          getSentRequests(),
        ]);
        if (cancelled) return;

        const profile = profileRes?.data || {};
        const myId = profile.user_id ?? Number(localStorage.getItem("userId"));
        setCurrentUser({
          id: myId,
          full_name: profile.full_name,
          profile_photo: profile.profile_photo,
        });

        const feedPosts = feedRes?.data?.posts || [];
        setPosts(feedPosts);
        setHasMore(feedPosts.length === PAGE_LIMIT);

        const otherIdOf = (row) => (row.sender_id === myId ? row.receiver_id : row.sender_id);
        const map = {};
        (connRes?.data || []).forEach((row) => {
          map[otherIdOf(row)] = { status: "connected", connectionId: row.id };
        });
        (recvRes?.data || []).forEach((row) => {
          map[row.sender_id] = { status: "received", connectionId: row.id };
        });
        (sentRes?.data || []).forEach((row) => {
          map[row.receiver_id] = { status: "sent", connectionId: row.id };
        });
        setConnectionMap(map);
      } catch (err) {
        if (!cancelled) showToast("Couldn't load your feed.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getFeed(nextPage, PAGE_LIMIT);
      const morePosts = res?.data?.posts || [];
      setPosts((prev) => [...prev, ...morePosts]);
      setPage(nextPage);
      setHasMore(morePosts.length === PAGE_LIMIT);
    } catch (err) {
      showToast("Couldn't load more posts.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast("Post deleted.");
  };

  // ---- connection actions, shared by every PostCard via connectionMap ----

  const handleConnect = async (targetUserId) => {
    try {
      const res = await sendConnectionRequest(targetUserId);
      setConnectionMap((prev) => ({
        ...prev,
        [targetUserId]: { status: "sent", connectionId: res?.data },
      }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't send request.", "error");
    }
  };

  const handleCancel = async (targetUserId, connectionId) => {
    try {
      await cancelConnectionRequest(connectionId);
      setConnectionMap((prev) => ({ ...prev, [targetUserId]: { status: "none", connectionId: null } }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't cancel request.", "error");
    }
  };

  const handleAccept = async (targetUserId, connectionId) => {
    try {
      await acceptConnectionRequest(connectionId);
      setConnectionMap((prev) => ({ ...prev, [targetUserId]: { status: "connected", connectionId } }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't accept request.", "error");
    }
  };

  const handleReject = async (targetUserId, connectionId) => {
    try {
      await rejectConnectionRequest(connectionId);
      setConnectionMap((prev) => ({ ...prev, [targetUserId]: { status: "none", connectionId: null } }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't reject request.", "error");
    }
  };

  const handleRemove = async (targetUserId, connectionId) => {
    try {
      await removeConnection(connectionId);
      setConnectionMap((prev) => ({ ...prev, [targetUserId]: { status: "none", connectionId: null } }));
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't remove connection.", "error");
    }
  };

  const handleMessage = async (targetUserId) => {
    try {
      const res = await getOrCreateConversation(targetUserId);
      const conversationId = res?.data?.id || res?.data?._id || res?.data?.conversationId;
      navigate("/chat", { state: { conversationId, userId: targetUserId } });
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't open chat.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <nav className="bg-[#1B2438] sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <h1
            className="text-xl text-white"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            SRMS Connect
          </h1>
          <div className="flex items-center gap-3">
            <Avatar
              photoUrl={currentUser?.profile_photo}
              fullName={currentUser?.full_name}
              size={34}
            />
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {currentUser && (
          <PostComposer
            currentUser={currentUser}
            onPostCreated={handlePostCreated}
            showToast={showToast}
          />
        )}

        {loading && (
          <div className="text-center py-10 text-[#1B2438]/40 text-sm">
            Loading your feed...
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#1B2438]/50 text-sm">
              No posts yet — be the first to share something with your college.
            </p>
          </div>
        )}

        {!loading &&
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              showToast={showToast}
              onDeleted={handlePostDeleted}
              connectionInfo={connectionMap[post.user_id] || { status: "none", connectionId: null }}
              onConnect={() => handleConnect(post.user_id)}
              onCancel={() => handleCancel(post.user_id, connectionMap[post.user_id]?.connectionId)}
              onAccept={() => handleAccept(post.user_id, connectionMap[post.user_id]?.connectionId)}
              onReject={() => handleReject(post.user_id, connectionMap[post.user_id]?.connectionId)}
              onRemove={() => handleRemove(post.user_id, connectionMap[post.user_id]?.connectionId)}
              onMessage={() => handleMessage(post.user_id)}
            />
          ))}

        {!loading && hasMore && posts.length > 0 && (
          <div className="text-center pt-2 pb-6">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-5 py-2 rounded-lg text-sm font-medium text-[#1B2438] border border-[#1B2438]/15 hover:bg-white disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}