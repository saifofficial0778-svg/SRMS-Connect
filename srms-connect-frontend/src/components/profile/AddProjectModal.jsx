import { useState } from "react";
import Modal from "../ui/Modal";

const EMPTY = { title: "", description: "", project_url: "" };

export default function AddProjectModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("Give the project a title.");
      return;
    }
    if (form.project_url && !/^https?:\/\/.+/i.test(form.project_url.trim())) {
      setError("Project URL must start with http:// or https://");
      return;
    }

    // addProjectSchema only accepts these three fields
    const payload = { title };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.project_url.trim()) payload.project_url = form.project_url.trim();

    setError("");
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't add that project.");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add a project" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-ink/60 mb-1.5">
            Title
          </label>
          <input
            autoFocus
            type="text"
            value={form.title}
            onChange={update("title")}
            maxLength={150}
            placeholder="e.g. Campus Event Finder"
            className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1.5">
            Description <span className="opacity-60">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={update("description")}
            maxLength={2000}
            placeholder="What does it do, what did you build it with..."
            className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-brand resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1.5">
            Project URL <span className="opacity-60">(optional)</span>
          </label>
          <input
            type="text"
            value={form.project_url}
            onChange={update("project_url")}
            maxLength={500}
            placeholder="https://..."
            className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-brand"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-success hover:bg-success disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
