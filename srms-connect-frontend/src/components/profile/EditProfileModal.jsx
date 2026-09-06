import { useState } from "react";
import Modal from "../ui/Modal";

// Field list mirrors updateProfileSchema exactly (.strict() on the backend
// means unknown keys are rejected, so we never send anything outside this set).
const FIELDS = [
  { key: "full_name", label: "Full name", type: "text", maxLength: 100 },
  { key: "designation", label: "Designation", type: "text", maxLength: 150 },
  { key: "company", label: "Company", type: "text", maxLength: 150 },
  { key: "location", label: "Location", type: "text", maxLength: 100 },
  { key: "experience_years", label: "Experience (years)", type: "number", min: 0, max: 50 },
  { key: "linkedin_url", label: "LinkedIn URL", type: "url", maxLength: 500 },
  { key: "github_url", label: "GitHub URL", type: "url", maxLength: 500 },
  { key: "portfolio_url", label: "Portfolio URL", type: "url", maxLength: 500 },
  { key: "resume_url", label: "Resume URL", type: "url", maxLength: 500 },
  { key: "bio", label: "Bio", type: "textarea", maxLength: 500 },
  { key: "interests", label: "Interests", type: "textarea", maxLength: 500 },
  { key: "career_goals", label: "Career goals", type: "textarea", maxLength: 500 },
];

export default function EditProfileModal({ profile, onClose, onSubmit }) {
  const [form, setForm] = useState(() => {
    const initial = {};
    FIELDS.forEach(({ key }) => {
      initial[key] = profile[key] ?? "";
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // .url() fields on the backend reject empty strings, so those are
    // only sent when they actually have a value. Everything else
    // (text/textarea/number) is sent as-is, including empty strings —
    // otherwise there'd be no way to clear a field like Location or Bio
    // once it's been set.
    const payload = {};
    for (const { key, type } of FIELDS) {
      const value = form[key];
      if (type === "url") {
        if (value === "" || value == null) continue;
        payload[key] = value;
        continue;
      }
      if (type === "number") {
        payload[key] = value === "" || value == null ? null : Number(value);
        continue;
      }
      payload[key] = value ?? "";
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Couldn't save your changes."
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.filter((f) => f.type !== "textarea").map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-[#1B2438]/60 mb-1.5">
                {f.label}
              </label>
              <input
                type={f.type === "url" ? "text" : f.type}
                value={form[f.key]}
                onChange={update(f.key)}
                maxLength={f.maxLength}
                min={f.min}
                max={f.max}
                placeholder={f.type === "url" ? "https://..." : ""}
                className="w-full rounded-lg border border-[#1B2438]/15 px-3.5 py-2.5 text-sm text-[#1B2438] outline-none focus:border-[#C98A2B] focus:ring-1 focus:ring-[#C98A2B]"
              />
            </div>
          ))}
        </div>

        {FIELDS.filter((f) => f.type === "textarea").map((f) => (
          <div key={f.key}>
            <label className="block text-xs text-[#1B2438]/60 mb-1.5">
              {f.label}
            </label>
            <textarea
              rows={f.key === "bio" ? 3 : 2}
              value={form[f.key]}
              onChange={update(f.key)}
              maxLength={f.maxLength}
              className="w-full rounded-lg border border-[#1B2438]/15 px-3.5 py-2.5 text-sm text-[#1B2438] outline-none focus:border-[#C98A2B] focus:ring-1 focus:ring-[#C98A2B] resize-none"
            />
          </div>
        ))}

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
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#C98A2B] hover:bg-[#B37A22] disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}