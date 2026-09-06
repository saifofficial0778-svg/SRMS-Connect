import { useState } from "react";
import Modal from "../ui/Modal";

export default function AddSkillModal({ onClose, onSubmit }) {
  const [skill, setSkill] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = skill.trim();
    if (!trimmed) {
      setError("Enter a skill first.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't add that skill.");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add a skill" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-[#1B2438]/60 mb-1.5">
            Skill
          </label>
          <input
            autoFocus
            type="text"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            maxLength={100}
            placeholder="e.g. React"
            className="w-full rounded-lg border border-[#1B2438]/15 px-3.5 py-2.5 text-sm text-[#1B2438] outline-none focus:border-[#C98A2B] focus:ring-1 focus:ring-[#C98A2B]"
          />
          {error && <p className="mt-1.5 text-xs text-[#B3432B]">{error}</p>}
        </div>

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
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#3F6B52] hover:bg-[#365D46] disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add skill"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
