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
      className="rounded-2xl border border-[#1B2438]/10 bg-white p-5"
    >
      <div className="flex gap-3">
        <Avatar photoUrl={currentUser?.profile_photo} fullName={currentUser?.full_name} size={40} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
          placeholder="Share something with your college community..."
          rows={2}
          className="flex-1 resize-none text-[15px] text-[#1B2438] placeholder:text-[#1B2438]/35 focus:outline-none"
        />
      </div>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden aspect-square bg-[#1B2438]/5">
              {p.isVideo ? (
                <video src={p.url} className="w-full h-full object-cover" />
              ) : (
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-[#1B2438]/70 text-white flex items-center justify-center hover:bg-[#1B2438]"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#1B2438]/10 pt-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_FILES}
          className="flex items-center gap-2 text-sm text-[#1B2438]/60 hover:text-[#C98A2B] disabled:opacity-40"
        >
          <ImageIcon />
          Photo/Video
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
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#C98A2B] hover:bg-[#B37A22] disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}