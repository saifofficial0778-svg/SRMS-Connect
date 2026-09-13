import { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal";
import Avatar from "./Avatar";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — keep in sync with backend's multer limit

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M12 16V4M12 4 8 8M12 4l4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export default function ChangePhotoModal({ currentPhoto, fullName, onClose, onSubmit }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentPhoto || "");
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Revoke the object URL we create for previews so we don't leak memory.
  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const validateAndSetFile = (candidate) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    setError("");
    setFile(candidate);
    setPreviewUrl(URL.createObjectURL(candidate));
  };

  const handleInputChange = (e) => {
    validateAndSetFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo to upload first.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(file);
    } catch (err) {
      console.error("Photo upload failed:", err); // TEMP DEBUG — remove later
      setError(err?.response?.data?.message || "Couldn't upload your photo.");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Change profile photo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <Avatar photoUrl={previewUrl || null} fullName={fullName} size={96} />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragActive
              ? "border-[#C98A2B] bg-[#C98A2B]/5"
              : "border-[#1B2438]/15 hover:border-[#1B2438]/30"
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-[#1B2438]/60">
            <UploadIcon />
            <p className="text-sm">
              <span className="font-medium text-[#C98A2B]">Click to upload</span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-[#1B2438]/40">
              {file ? file.name : "PNG, JPG up to 5MB"}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        {error && <p className="text-xs text-[#B3432B]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-[#1B2438]/70 hover:bg-[#1B2438]/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !file}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#C98A2B] hover:bg-[#B37A22] disabled:opacity-60"
          >
            {submitting ? "Uploading..." : "Upload photo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}