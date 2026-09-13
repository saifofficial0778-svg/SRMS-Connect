import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFeed } from "../../services/postService";
import { getProfile } from "../../services/profileService";
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profileRes, feedRes] = await Promise.all([
          getProfile(),
          getFeed(1, PAGE_LIMIT),
        ]);
        if (cancelled) return;

        const profile = profileRes?.data || {};
        setCurrentUser({
          id: profile.user_id ?? Number(localStorage.getItem("userId")),
          full_name: profile.full_name,
          profile_photo: profile.profile_photo,
        });

        const feedPosts = feedRes?.data?.posts || [];
        setPosts(feedPosts);
        setHasMore(feedPosts.length === PAGE_LIMIT);
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

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Navbar — same record-card identity as the rest of the app */}
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