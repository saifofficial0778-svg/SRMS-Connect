import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyPosts } from "../../services/analyticsService";
import HorizontalSlider from "../ui/HorizontalSlider";
import { timeAgo } from "../feed/timeAgo";
import { formatCount, postPreview, postStatsLine } from "../../utils/analyticsFormat";

const LIMIT = 12;

// "Your posts" on your own profile: a compact row of cards that slides sideways, each with how
// many people saw it. Only ever your own posts - other members' profiles do not have this section.
export default function PostsSection() {
  const [state, setState] = useState({ status: "loading", posts: [], total: 0 });

  useEffect(() => {
    let cancelled = false;
    getMyPosts(1, LIMIT)
      .then((data) => !cancelled && setState({ status: "success", posts: data.posts, total: data.pagination.total }))
      .catch(() => !cancelled && setState({ status: "error", posts: [], total: 0 }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { status, posts, total } = state;

  return (
    <section aria-label="Your posts" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base text-ink font-display">
          Your posts
          {status === "success" && total > 0 && <span className="ml-2 text-sm text-ink/45">{total}</span>}
        </h2>
        <p className="text-xs text-ink/50">The numbers are private to you</p>
      </div>

      {status === "loading" && <div className="mt-4 h-40 skeleton" aria-busy="true" />}
      {status === "error" && <p className="mt-4 py-6 text-center text-sm text-ink/55">Couldn't load your posts.</p>}
      {status === "success" && posts.length === 0 && (
        <p className="mt-4 py-6 text-center text-sm text-ink/55">
          You haven't posted anything yet. <Link to="/home" className="font-medium text-accent-700 hover:text-accent-800">Share something</Link>
        </p>
      )}

      {status === "success" && posts.length > 0 && (
        <>
          <HorizontalSlider label="Your posts" className="mt-4">
            {posts.map((post) => {
              const image = (post.media || []).find((m) => m.type === "IMAGE");
              return (
                <li key={post.id} className="flex w-[260px] shrink-0 snap-start flex-col rounded-lg border border-ink/10 bg-white p-4">
                  <p className="text-xs text-ink/45">{timeAgo(post.created_at)}</p>
                  {image && <img src={image.url} alt="" loading="lazy" className="mt-2 h-20 w-full rounded-lg object-cover" />}
                  {/* user-written text is always rendered as text, never as HTML */}
                  <p className={`mt-2 flex-1 text-sm leading-relaxed text-ink/85 ${image ? "line-clamp-2" : "line-clamp-3"}`}>
                    {postPreview({ content: post.content, media_count: (post.media || []).length }, 400)}
                  </p>
                  <p className="mt-3 text-xs tabular-nums text-ink/55">
                    {formatCount(post.likes_count)} {Number(post.likes_count) === 1 ? "like" : "likes"} · {formatCount(post.comments_count)} {Number(post.comments_count) === 1 ? "comment" : "comments"}
                  </p>
                  <p className="mt-2 border-t border-ink/8 pt-2 text-xs font-medium tabular-nums text-ink/75">{postStatsLine(post.analytics)}</p>
                </li>
              );
            })}
          </HorizontalSlider>

          <div className="mt-3 text-right">
            <Link to="/analytics#posts" className="text-sm font-medium text-accent-700 hover:text-accent-800">
              {total > posts.length ? `Show all ${total} posts and their analytics` : "Show post analytics"}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
