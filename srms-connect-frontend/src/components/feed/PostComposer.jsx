import { useRef, useState } from "react";
import Avatar from "../profile/Avatar";
import { createPost } from "../../services/postService";
import { ImageIcon, CloseIcon } from "./icons";

const MAX_FILES = 5;
const MAX_CONTENT = 5000;

export default function PostComposer({ currentUser, onPostCreated, showToast }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const previews = files.map((file) => ({
    file,
    url: URL.createObjectURL(file),
    isVideo: file.type.startsWith("video/"),
  }));

  const handleFilesPicked = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const combined = [...files, ...picked].slice(0, MAX_FILES);
    if (files.length + picked.length > MAX_FILES) {
      showToast?.(`Only ${MAX_FILES} media files are allowed per post.`, "error");
    }
    setFiles(combined);
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && files.length === 0) {
      showToast?.("Write something or attach a photo/video first.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createPost(content.trim(), files);
      onPostCreated?.({
        id: res?.data?.postId,
        user_id: currentUser?.id,
        content: content.trim(),
        created_at: new Date().toISOString(),
        full_name: currentUser?.full_name,
        profile_photo: currentUser?.profile_photo,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        media: previews.map((p, i) => ({ id: `local-${i}`, url: p.url, type: p.isVideo ? "VIDEO" : "IMAGE" })),
      });
      setContent("");
      setFiles([]);
      showToast?.("Post shared.");
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't create the post.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-4 sm:p-5"
    >
      <div className="flex gap-3">
        <Avatar photoUrl={currentUser?.profile_photo} fullName={currentUser?.full_name} size={40} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
          placeholder="Share an update, a question or an opportunity"
          aria-label="Write a post"
          rows={2}
          className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-ink/12 bg-canvas/60 px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink/45 transition-colors hover:border-ink/20 focus:border-brand/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
      </div>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden aspect-square bg-ink/5">
              {p.isVideo ? (
                <video src={p.url} className="w-full h-full object-cover" />
              ) : (
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-ink"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_FILES}
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink/65 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-40"
        >
          <ImageIcon />
          Photo or video
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFilesPicked}
          className="hidden"
        />

        <button
          type="submit"
          disabled={submitting || (!content.trim() && files.length === 0)}
          className="h-9 rounded-lg bg-brand px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}