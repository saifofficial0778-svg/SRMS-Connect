import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../profile/Avatar";
import ConfirmDialog from "../ui/ConfirmDialog";
import MediaGrid from "./MediaGrid";
import { timeAgo } from "./timeAgo";
import {
  ThumbsUpIcon,
  CommentIcon,
  DotsIcon,
  SendIcon,
  PencilIcon,
  TrashIcon,
} from "./icons";
import {
  likePost,
  unlikePost,
  getComments,
  addComment,
  updateComment,
  deleteComment,
  updatePost,
  deletePost,
} from "../../services/postService";

function ConnectionAction({ info, onConnect, onCancel, onAccept, onReject, onRemove, onMessage }) {
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (info.status === "connected") {
    return (
      <button
        onClick={() => run(onMessage)}
        disabled={busy}
        className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[#1B2438]/15 text-[#1B2438] hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
      >
        Message
      </button>
    );
  }

  if (info.status === "sent") {
    return (
      <button
        onClick={() => run(onCancel)}
        disabled={busy}
        className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1B2438]/5 text-[#1B2438]/60 hover:bg-[#1B2438]/10 disabled:opacity-60 transition-colors"
      >
        {busy ? "..." : "Pending"}
      </button>
    );
  }

  if (info.status === "received") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => run(onReject)}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1B2438]/15 text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => run(onAccept)}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C98A2B] text-white hover:bg-[#B37A22] disabled:opacity-60 transition-colors"
        >
          Accept
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => run(onConnect)}
      disabled={busy}
      className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#C98A2B] text-white hover:bg-[#B37A22] disabled:opacity-60 transition-colors"
    >
      {busy ? "Sending..." : "Connect"}
    </button>
  );
}

function CommentRow({ comment, isOwn, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!value.trim() || value === comment.content) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(value.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2.5">
      <Avatar photoUrl={comment.profile_photo} fullName={comment.full_name} size={30} />
      <div className="flex-1 min-w-0">
        <div className="bg-[#F5F6F8] rounded-xl px-3.5 py-2 inline-block max-w-full">
          <p className="text-[13px] font-medium text-[#1B2438]">{comment.full_name}</p>
          {editing ? (
            <textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={2}
              className="mt-1 w-full text-sm text-[#1B2438] bg-white rounded-md border border-[#1B2438]/15 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#C98A2B]"
            />
          ) : (
            <p className="text-sm text-[#1B2438]/85 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[#1B2438]/45 px-1">
          <span>{timeAgo(comment.created_at)}</span>
          {isOwn && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="hover:text-[#1B2438]">
                Edit
              </button>
              <button onClick={onDelete} className="hover:text-[#B3432B]">
                Delete
              </button>
            </>
          )}
          {editing && (
            <>
              <button disabled={busy} onClick={save} className="font-medium text-[#C98A2B] hover:text-[#B37A22]">
                Save
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setValue(comment.content);
                  setEditing(false);
                }}
                className="hover:text-[#1B2438]"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostCard({
  post,
  currentUser,
  showToast,
  onDeleted,
  connectionInfo,
  onConnect,
  onCancel,
  onAccept,
  onReject,
  onRemove,
  onMessage,
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(post);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editValue, setEditValue] = useState(post.content || "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(null); // null = not loaded yet
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const isOwnPost = currentUser?.id === data.user_id;

  const goToProfile = () => {
    if (isOwnPost) {
      navigate("/profile");
    } else {
      navigate(`/profile/${data.user_id}`);
    }
  };

  const toggleLike = async () => {
    setData((prev) => ({
      ...prev,
      is_liked: !prev.is_liked,
      likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1,
    }));
    try {
      if (data.is_liked) {
        await unlikePost(data.id);
      } else {
        await likePost(data.id);
      }
    } catch (err) {
      setData((prev) => ({
        ...prev,
        is_liked: !prev.is_liked,
        likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1,
      }));
      showToast?.(err?.response?.data?.message || "Couldn't update your like.", "error");
    }
  };

  const openComments = async () => {
    setCommentsOpen((v) => !v);
    if (comments === null && !loadingComments) {
      setLoadingComments(true);
      try {
        const res = await getComments(data.id);
        setComments(res?.data || []);
      } catch (err) {
        showToast?.("Couldn't load comments.", "error");
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    setPostingComment(true);
    try {
      const res = await addComment(data.id, commentDraft.trim());
      const newComment = {
        id: res?.data,
        content: commentDraft.trim(),
        created_at: new Date().toISOString(),
        user_id: currentUser?.id,
        full_name: currentUser?.full_name,
        profile_photo: currentUser?.profile_photo,
      };
      setComments((prev) => [...(prev || []), newComment]);
      setData((prev) => ({ ...prev, comments_count: prev.comments_count + 1 }));
      setCommentDraft("");
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't add your comment.", "error");
    } finally {
      setPostingComment(false);
    }
  };

  const saveCommentEdit = async (commentId, newContent) => {
    try {
      await updateComment(commentId, newContent);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: newContent } : c))
      );
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't update comment.", "error");
    }
  };

  const removeComment = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setData((prev) => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }));
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't delete comment.", "error");
    }
  };

  const savePostEdit = async () => {
    if (!editValue.trim() || editValue === data.content) {
      setEditingPost(false);
      return;
    }
    try {
      await updatePost(data.id, editValue.trim());
      setData((prev) => ({ ...prev, content: editValue.trim() }));
      setEditingPost(false);
      showToast?.("Post updated.");
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't update post.", "error");
    }
  };

  const confirmDeletePost = async () => {
    setDeleting(true);
    try {
      await deletePost(data.id);
      onDeleted?.(data.id);
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't delete post.", "error");
      setDeleting(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <button onClick={goToProfile} className="flex items-center gap-3.5 text-left group min-w-0">
          <Avatar photoUrl={data.profile_photo} fullName={data.full_name} size={52} />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-[#1B2438] group-hover:text-[#C98A2B] transition-colors truncate">
              {data.full_name}
            </p>
            {(data.designation || data.company) && (
              <p className="text-[13px] text-[#1B2438]/60 truncate">
                {[data.designation, data.company].filter(Boolean).join(" at ")}
              </p>
            )}
            {data.bio && (
              <p className="text-[13px] text-[#1B2438]/50 mt-0.5 line-clamp-1 max-w-md">
                {data.bio}
              </p>
            )}
            <p className="text-xs text-[#1B2438]/40 mt-0.5">{timeAgo(data.created_at)}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isOwnPost && connectionInfo && (
            <ConnectionAction
              info={connectionInfo}
              onConnect={onConnect}
              onCancel={onCancel}
              onAccept={onAccept}
              onReject={onReject}
              onRemove={onRemove}
              onMessage={onMessage}
            />
          )}

          {isOwnPost && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-full text-[#1B2438]/40 hover:bg-[#1B2438]/5 hover:text-[#1B2438]"
              >
                <DotsIcon />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-[#1B2438]/10 bg-white shadow-xl overflow-hidden">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setEditingPost(true);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-[#1B2438] hover:bg-[#1B2438]/5 text-left"
                    >
                      <PencilIcon /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDeleteOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-[#B3432B] hover:bg-[#B3432B]/5 text-left border-t border-[#1B2438]/5"
                    >
                      <TrashIcon /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {editingPost ? (
          <div>
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              className="w-full text-[15px] text-[#1B2438] rounded-lg border border-[#1B2438]/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C98A2B]/40"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditValue(data.content || "");
                  setEditingPost(false);
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-[#1B2438]/70 hover:bg-[#1B2438]/5"
              >
                Cancel
              </button>
              <button
                onClick={savePostEdit}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#C98A2B] hover:bg-[#B37A22]"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          data.content && (
            <p className="text-[15px] text-[#1B2438]/90 whitespace-pre-wrap break-words">
              {data.content}
            </p>
          )
        )}
      </div>

      <div className="mt-3">
        <MediaGrid media={data.media} />
      </div>

            {(data.likes_count > 0 || data.comments_count > 0) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#1B2438]/50">
          {data.likes_count > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUpIcon filled className="h-3.5 w-3.5 text-[#C98A2B]" />
              {data.likes_count}
            </span>
          )}
          {data.likes_count > 0 && data.comments_count > 0 && <span>·</span>}
          {data.comments_count > 0 && (
            <span>{data.comments_count} comment{data.comments_count === 1 ? "" : "s"}</span>
          )}
        </div>
      )}

            <div className="mt-2 pt-2 border-t border-[#1B2438]/10 flex items-center gap-1">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            data.is_liked ? "text-[#C98A2B]" : "text-[#1B2438]/60 hover:bg-[#1B2438]/5"
          }`}
        >
          <ThumbsUpIcon filled={data.is_liked} />
          Like
        </button>
        <button
          onClick={openComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#1B2438]/60 hover:bg-[#1B2438]/5"
        >
          <CommentIcon />
          Comment
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-3 pt-3 border-t border-[#1B2438]/10 space-y-3">
          {loadingComments && (
            <p className="text-sm text-[#1B2438]/50">Loading comments...</p>
          )}
          {!loadingComments &&
            comments?.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                isOwn={currentUser?.id === comment.user_id}
                onSave={(val) => saveCommentEdit(comment.id, val)}
                onDelete={() => removeComment(comment.id)}
              />
            ))}
          {!loadingComments && comments?.length === 0 && (
            <p className="text-sm text-[#1B2438]/40">No comments yet. Be the first to say something.</p>
          )}

          <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
            <Avatar photoUrl={currentUser?.profile_photo} fullName={currentUser?.full_name} size={30} />
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 text-sm rounded-full border border-[#1B2438]/15 px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#C98A2B]/40"
            />
            <button
              type="submit"
              disabled={postingComment || !commentDraft.trim()}
              className="h-9 w-9 shrink-0 rounded-full bg-[#C98A2B] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#B37A22]"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this post?"
        description="This will permanently remove the post and its media."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDeletePost}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </article>
  );
}