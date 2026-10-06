import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteJob, getJob, setJobStatus } from "../../services/jobService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { timeAgo } from "../../components/feed/timeAgo";
import { experienceLabel, isSafeHttpsUrl, jobSubtitle, jobTypeLabel } from "../../utils/jobFormat";
import { headline } from "../../utils/personFormat";

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  // `loaded.id` ties a result to the job it was fetched for, so switching jobs shows "loading"
  const [loaded, setLoaded] = useState({ id: null, job: null, error: "" });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJob(id)
      .then((job) => !cancelled && setLoaded({ id, job, error: "" }))
      .catch((err) => {
        if (!cancelled) {
          setLoaded({ id, job: null, error: err?.response?.status === 404 ? "This job isn't available." : "Couldn't load this job." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = loaded.id !== id;
  const { job, error } = loaded;

  const toggleStatus = async () => {
    const next = job.status === "OPEN" ? "CLOSED" : "OPEN";
    setBusy(true);
    try {
      await setJobStatus(job.id, next);
      setLoaded((l) => ({ ...l, job: { ...l.job, status: next } }));
      showToast(next === "CLOSED" ? "Job closed." : "Job reopened.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't update the job.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteJob(job.id);
      navigate("/jobs?tab=mine", { replace: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't delete the job.", "error");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" aria-busy="true">
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-8 animate-pulse space-y-3">
          <div className="h-7 w-2/3 rounded bg-[#1B2438]/10" />
          <div className="h-4 w-1/3 rounded bg-[#1B2438]/8" />
          <div className="h-24 w-full rounded bg-[#1B2438]/5" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="font-medium text-[#1B2438]">{error || "This job isn't available."}</p>
        <Link to="/jobs" className="mt-4 inline-block rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]">
          Back to jobs
        </Link>
      </div>
    );
  }

  const { poster } = job;
  const isOpen = job.status === "OPEN";
  const canApply = isOpen && isSafeHttpsUrl(job.apply_url);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <Link to="/jobs" className="text-sm font-medium text-[#C98A2B] hover:text-[#B37A22]">
        &larr; All jobs
      </Link>

      <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-8">
        {!isOpen && (
          <p role="status" className="mb-4 rounded-lg bg-[#1B2438]/5 px-4 py-2.5 text-sm text-[#1B2438]/70">
            This job is closed and no longer accepting applications.
          </p>
        )}

        <h1 className="text-2xl sm:text-3xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
          {job.title}
        </h1>
        <p className="mt-1 text-[#1B2438]/70">{jobSubtitle(job)}</p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[#1B2438]/5 px-3 py-1 font-medium text-[#1B2438]/75">{jobTypeLabel(job.job_type)}</span>
          <span className="rounded-full bg-[#1B2438]/5 px-3 py-1 text-[#1B2438]/75">
            {experienceLabel(job.experience_min, job.experience_max)}
          </span>
          <span className="px-1 py-1 text-[#1B2438]/45">Posted {timeAgo(job.created_at)}</span>
        </div>

        {/* application */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {canApply && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-lg bg-[#C98A2B] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] transition-colors"
            >
              Apply on company site
            </a>
          )}
          {canApply && (
            <span className="text-xs text-[#1B2438]/45">Opens {new URL(job.apply_url).hostname} in a new tab</span>
          )}
          {/* shown to students only; the server checks role and connection when the request is sent */}
          {isOpen && !job.is_owner && localStorage.getItem("role") === "STUDENT" && (
            <Link
              to={`/career/new?type=REFERRAL&job=${job.id}`}
              className="rounded-lg border border-[#C98A2B] px-5 py-2.5 text-sm font-medium text-[#9F6C1E] hover:bg-[#C98A2B]/10 transition-colors"
            >
              Ask for a referral
            </Link>
          )}
        </div>

        {job.skills.length > 0 && (
          <section className="mt-7">
            <h2 className="text-sm font-semibold text-[#1B2438]">Skills</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <li key={skill} className="rounded-full border border-[#1B2438]/10 px-3 py-1 text-sm text-[#1B2438]/75">
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <h2 className="text-sm font-semibold text-[#1B2438]">About the role</h2>
          {/* plain text, rendered as text (never as HTML) */}
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{job.description}</p>
        </section>
      </article>

      {/* who posted it */}
      <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[#1B2438]">Posted by</h2>
        <Link to={`/profile/${poster.user_id}`} className="mt-3 flex items-center gap-3">
          <Avatar photoUrl={poster.profile_photo} fullName={poster.full_name} size={48} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 font-medium text-[#1B2438]">
              {job.is_owner ? `${poster.full_name} (you)` : poster.full_name}
              {poster.is_verified_alumni && <VerifiedBadge />}
            </span>
            <span className="block text-sm text-[#1B2438]/60">{headline(poster)}</span>
          </span>
        </Link>
      </section>

      {/* owner controls: the server re-checks ownership on every request */}
      {job.is_owner && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#1B2438]/10 bg-white p-5">
          <span className="mr-auto text-sm font-medium text-[#1B2438]">Manage this job</span>
          <Link
            to={`/jobs/${job.id}/edit`}
            className="rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5"
          >
            Edit
          </Link>
          <button
            onClick={toggleStatus}
            disabled={busy}
            className="rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 disabled:opacity-50"
          >
            {isOpen ? "Close job" : "Reopen job"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this job?"
        description="It will be removed for everyone and can't be restored."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
