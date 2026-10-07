import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, PenLine } from "lucide-react";
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
import Button from "../../components/ui/Button";
import HorizontalSlider from "../../components/ui/HorizontalSlider";
import { EmptyState, ErrorState, SkeletonCard } from "../../components/ui/Primitives";
import PostComposer from "../../components/feed/PostComposer";
import PostCard from "../../components/feed/PostCard";
import ImpressionSentinel from "../../components/feed/ImpressionSentinel";
import useAsyncData from "../../hooks/useAsyncData";
import { listSpotlights } from "../../services/spotlightService";
import {
  CampusSpotlightCard,
  OpportunitiesCard,
  PeopleYouMayKnowCard,
  ProfileSummaryCard,
  QuickLinksCard,
  RailFooter,
  SpotlightItem,
  TrendingSkillsCard,
} from "../../components/home/HomeRail";

const PAGE_LIMIT = 10;

// Home: who you are (left), what the community is saying (centre), what is worth knowing (right).
//   xl and up   three columns
//   lg          two columns - the right rail's Campus Spotlight moves into a strip above the feed
//   below lg    one column - the feed first, with the spotlight strip on top
export default function Home() {
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // loaded once here: the right rail lists them, narrower layouts show them as a strip
  const spotlights = useAsyncData(listSpotlights);

  // connectionMap: { [otherUserId]: { status: "none"|"sent"|"received"|"connected", connectionId } }
  const [connectionMap, setConnectionMap] = useState({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profileRes, feedRes, connRes, recvRes, sentRes] = await Promise.all([
          getProfile().catch(() => null), // an admin has no profile; the feed still works
          getFeed(1, PAGE_LIMIT),
          getMyConnections(),
          getReceivedRequests(),
          getSentRequests(),
        ]);
        if (cancelled) return;

        const data = profileRes?.data || {};
        const myId = data.user_id ?? Number(localStorage.getItem("userId"));
        setProfile(profileRes ? data : null);
        setCurrentUser({ id: myId, full_name: data.full_name, profile_photo: data.profile_photo });

        const feedPosts = feedRes?.data?.posts || [];
        setPosts(feedPosts);
        setPage(1);
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
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getFeed(nextPage, PAGE_LIMIT);
      const morePosts = res?.data?.posts || [];
      // a post that moved between pages while you were reading is not shown twice
      setPosts((prev) => [...prev, ...morePosts.filter((p) => !prev.some((x) => x.id === p.id))]);
      setPage(nextPage);
      setHasMore(morePosts.length === PAGE_LIMIT);
    } catch {
      showToast("Couldn't load more posts.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePostCreated = (newPost) => setPosts((prev) => [newPost, ...prev]);

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast("Post deleted.");
  };

  // ---- connection actions, shared by every PostCard via connectionMap ----

  const setRelation = (userId, relation, connectionId = null) =>
    setConnectionMap((prev) => ({ ...prev, [userId]: { status: relation, connectionId } }));
  const fail = (err, fallback) => showToast(err?.response?.data?.message || fallback, "error");

  const handleConnect = async (targetUserId) => {
    try {
      const res = await sendConnectionRequest(targetUserId);
      setRelation(targetUserId, "sent", res?.data);
    } catch (err) {
      fail(err, "Couldn't send request.");
    }
  };
  const handleCancel = async (targetUserId, connectionId) => {
    try {
      await cancelConnectionRequest(connectionId);
      setRelation(targetUserId, "none");
    } catch (err) {
      fail(err, "Couldn't cancel request.");
    }
  };
  const handleAccept = async (targetUserId, connectionId) => {
    try {
      await acceptConnectionRequest(connectionId);
      setRelation(targetUserId, "connected", connectionId);
    } catch (err) {
      fail(err, "Couldn't accept request.");
    }
  };
  const handleReject = async (targetUserId, connectionId) => {
    try {
      await rejectConnectionRequest(connectionId);
      setRelation(targetUserId, "none");
    } catch (err) {
      fail(err, "Couldn't reject request.");
    }
  };
  const handleRemove = async (targetUserId, connectionId) => {
    try {
      await removeConnection(connectionId);
      setRelation(targetUserId, "none");
    } catch (err) {
      fail(err, "Couldn't remove connection.");
    }
  };
  const handleMessage = async (targetUserId) => {
    try {
      const res = await getOrCreateConversation(targetUserId);
      const conversationId = res?.data?.id || res?.data?._id || res?.data?.conversationId;
      navigate("/chat", { state: { conversationId, userId: targetUserId } });
    } catch (err) {
      fail(err, "Couldn't open chat.");
    }
  };

  const liveSpotlights = spotlights.data || [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-6">
      <h1 className="sr-only">Home</h1>
      <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        {/* LEFT: identity and shortcuts */}
        <aside className="hidden space-y-4 lg:sticky lg:top-[5.25rem] lg:block" aria-label="You">
          <ProfileSummaryCard profile={status === "loading" ? null : profile || { full_name: "SRMS Member", role: localStorage.getItem("role") }} />
          <QuickLinksCard role={profile?.role || localStorage.getItem("role")} />
        </aside>

        {/* CENTRE: composer and feed */}
        <div className="min-w-0 space-y-4">
          {/* Campus Spotlight as a strip wherever the right rail is not on screen */}
          {liveSpotlights.length > 0 && (
            <section aria-label="Campus Spotlight" className="xl:hidden">
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm text-ink font-display">
                <Megaphone className="h-4 w-4 text-ink/45" strokeWidth={1.9} aria-hidden="true" />
                Campus Spotlight
              </h2>
              <HorizontalSlider label="Campus Spotlight">
                {liveSpotlights.map((s) => <li key={s.id} className="flex"><SpotlightItem spotlight={s} compact /></li>)}
              </HorizontalSlider>
            </section>
          )}

          {currentUser && profile && <PostComposer currentUser={currentUser} onPostCreated={handlePostCreated} showToast={showToast} />}

          {status === "loading" && (
            <>
              <SkeletonCard avatar lines={3} />
              <SkeletonCard avatar lines={4} />
              <SkeletonCard avatar lines={2} />
            </>
          )}

          {status === "error" && <ErrorState title="Couldn't load your feed" onRetry={retry} />}

          {status === "ready" && posts.length === 0 && (
            <EmptyState icon={PenLine} title="Your feed is quiet">
              Nobody has posted yet. Share an update, a question or an opportunity with the SRMS community.
            </EmptyState>
          )}

          {status === "ready" &&
            posts.map((post) => (
              // counts as an impression for the author once the post has really been on screen
              <ImpressionSentinel key={post.id} postId={post.id} disabled={post.user_id === currentUser?.id}>
                <PostCard
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
              </ImpressionSentinel>
            ))}

          {status === "ready" && hasMore && posts.length > 0 && (
            <div className="flex justify-center pb-4 pt-1">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Show more posts</Button>
            </div>
          )}
          {status === "ready" && !hasMore && posts.length > 0 && <p className="pb-4 pt-1 text-center text-xs text-ink/40">You're all caught up.</p>}
        </div>

        {/* RIGHT: what is worth knowing right now */}
        <aside className="hidden space-y-4 xl:sticky xl:top-[5.25rem] xl:block" aria-label="For you">
          <CampusSpotlightCard state={spotlights} />
          <PeopleYouMayKnowCard showToast={showToast} />
          <OpportunitiesCard />
          <TrendingSkillsCard />
          <RailFooter />
        </aside>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
