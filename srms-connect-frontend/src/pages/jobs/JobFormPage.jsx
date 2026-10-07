import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createJob, getJob, updateJob } from "../../services/jobService";
import {
  EMPTY_JOB_FORM,
  JOB_TYPES,
  extractFieldErrors,
  formToPayload,
  jobToForm,
  validateJobForm,
} from "../../utils/jobFormat";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-brand/20";

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink/45">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

// One form for both "Post a job" (/jobs/new) and "Edit job" (/jobs/:id/edit).
export default function JobFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const [form, setForm] = useState(EMPTY_JOB_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState({ id: null, error: "" });

  // editing: load the job (the server only returns it for viewing; saving is owner-checked there)
  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    getJob(id)
      .then((job) => {
        if (cancelled) return;
        if (!job.is_owner) {
          setLoaded({ id, error: "You can only edit your own jobs." });
          return;
        }
        setForm(jobToForm(job));
        setLoaded({ id, error: "" });
      })
      .catch(() => !cancelled && setLoaded({ id, error: "This job isn't available." }));
    return () => {
      cancelled = true;
    };
  }, [id, editing]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  };
  const borderFor = (field) => (errors[field] ? "border-red-300" : "border-ink/15 focus:border-brand/60");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const found = validateJobForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      const result = editing ? await updateJob(id, payload) : await createJob(payload);
      navigate(`/jobs/${result?.id || id}`, { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't save the job. Please try again.", "error");
      setSubmitting(false);
    }
  };

  if (editing && loaded.id !== id) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-center text-sm text-ink/50" aria-busy="true">Loading...</div>;
  }
  if (editing && loaded.error) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="font-medium text-ink">{loaded.error}</p>
        <Link to="/jobs" className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm text-white">Back to jobs</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to={editing ? `/jobs/${id}` : "/jobs"} className="text-sm font-medium text-accent-700 hover:text-accent-800">
        &larr; {editing ? "Back to job" : "All jobs"}
      </Link>

      <h1 className="mt-3 text-3xl text-ink font-display">
        {editing ? "Edit job" : "Post a job"}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Share an opportunity with students and fellow alumni. Applicants apply on your own site.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4 card p-5 sm:p-7">
        <Field label="Job title" error={errors.title}>
          <input value={form.title} onChange={set("title")} placeholder="e.g. Software Engineer" maxLength={150} className={`${inputClass} ${borderFor("title")}`} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" error={errors.company}>
            <input value={form.company} onChange={set("company")} placeholder="e.g. Acme Labs" maxLength={150} className={`${inputClass} ${borderFor("company")}`} />
          </Field>
          <Field label="Location" error={errors.location}>
            <input value={form.location} onChange={set("location")} placeholder="e.g. Noida, or Remote" maxLength={150} className={`${inputClass} ${borderFor("location")}`} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Job type" error={errors.job_type}>
            <select value={form.job_type} onChange={set("job_type")} className={`${inputClass} ${borderFor("job_type")}`}>
              {JOB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Min experience (years)" error={errors.experience_min}>
            <input type="number" min="0" max="40" inputMode="numeric" value={form.experience_min} onChange={set("experience_min")} className={`${inputClass} ${borderFor("experience_min")}`} />
          </Field>
          <Field label="Max experience (years)" error={errors.experience_max} hint="Leave empty for no upper limit">
            <input type="number" min="0" max="40" inputMode="numeric" value={form.experience_max} onChange={set("experience_max")} className={`${inputClass} ${borderFor("experience_max")}`} />
          </Field>
        </div>

        <Field label="Required skills" error={errors.skills} hint="Comma separated, up to 10. e.g. React, Node.js, SQL">
          <input value={form.skills} onChange={set("skills")} placeholder="React, Node.js" className={`${inputClass} ${borderFor("skills")}`} />
        </Field>

        <Field label="Description" error={errors.description} hint={`${form.description.trim().length}/5000 characters (at least 20)`}>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={8}
            maxLength={5000}
            placeholder="What will the person do? What are you looking for?"
            className={`${inputClass} ${borderFor("description")}`}
          />
        </Field>

        <Field label="Application link" error={errors.apply_url} hint="Where candidates apply. Must start with https://">
          <input type="url" value={form.apply_url} onChange={set("apply_url")} placeholder="https://company.com/careers/123" maxLength={500} className={`${inputClass} ${borderFor("apply_url")}`} />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={editing ? `/jobs/${id}` : "/jobs"}
            className="rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Saving..." : editing ? "Save changes" : "Post job"}
          </button>
        </div>
      </form>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
