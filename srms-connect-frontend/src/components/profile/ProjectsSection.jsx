import { useState } from "react";
import AddProjectModal from "./AddProjectModal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { LinkIcon } from "./icons";
import { addProject, deleteProject } from "../../services/profileService";

export default function ProjectsSection({ projects, setProjects, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // project object
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async (payload) => {
    const res = await addProject(payload);
    // backend returns only the new insertId, so build the display object here
    const newId = res?.data;
    setProjects((prev) => [{ id: newId, ...payload }, ...prev]);
    setModalOpen(false);
    showToast("Project added.");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProject(pendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      showToast("Project removed.");
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Couldn't remove that project.",
        "error"
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2
          className="text-lg text-[#1B2438] border-l-4 border-[#3F6B52] pl-3"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Projects
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm font-medium text-[#C98A2B] hover:text-[#B37A22]"
        >
          + Add project
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-[#1B2438]/50">
          No projects added yet.
        </p>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="relative rounded-xl border border-[#1B2438]/10 p-4 hover:border-[#C98A2B]/40 transition-colors"
            >
              <button
                onClick={() => setPendingDelete(p)}
                aria-label={`Delete ${p.title}`}
                className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full text-[#1B2438]/40 hover:bg-[#B3432B]/10 hover:text-[#B3432B]"
              >
                &times;
              </button>
              <h3 className="pr-6 font-medium text-[#1B2438]">{p.title}</h3>
              {p.description && (
                <p className="mt-1.5 text-sm text-[#1B2438]/70 leading-relaxed">
                  {p.description}
                </p>
              )}
              {p.project_url && (
                <a
                  href={p.project_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#3F6B52] hover:text-[#2D4E3B] font-medium"
                >
                  <LinkIcon />
                  View project
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddProjectModal onClose={() => setModalOpen(false)} onSubmit={handleAdd} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.title}"?`}
        description="This can't be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
