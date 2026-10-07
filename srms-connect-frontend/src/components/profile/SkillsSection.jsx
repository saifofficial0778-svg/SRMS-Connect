import { useState } from "react";
import AddSkillModal from "./AddSkillModal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { addSkill, deleteSkill } from "../../services/profileService";

export default function SkillsSection({ skills, setSkills, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // skill object
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async (skillValue) => {
    const res = await addSkill({ skill: skillValue });
    // backend returns only the new insertId, so build the display object here
    const newId = res?.data;
    setSkills((prev) => [...prev, { id: newId, skill: skillValue }]);
    setModalOpen(false);
    showToast("Skill added.");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSkill(pendingDelete.id);
      setSkills((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      showToast("Skill removed.");
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Couldn't remove that skill.",
        "error"
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2
          className="text-lg text-ink border-l-4 border-success pl-3 font-display"
        >
          Skills
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm font-medium text-accent-700 hover:text-accent-800"
        >
          + Add skill
        </button>
      </div>

      {skills.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">
          No skills added yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.map((s) => (
            <span
              key={s.id}
              className="group flex items-center gap-2 rounded-full bg-success/8 border border-success/20 pl-3.5 pr-2 py-1.5 text-sm text-success-700"
            >
              {s.skill}
              <button
                onClick={() => setPendingDelete(s)}
                aria-label={`Remove ${s.skill}`}
                className="h-4 w-4 flex items-center justify-center rounded-full text-success-700/50 hover:bg-success-700/10 hover:text-success-700"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddSkillModal onClose={() => setModalOpen(false)} onSubmit={handleAdd} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Remove "${pendingDelete?.skill}"?`}
        description="You can always add it back later."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
