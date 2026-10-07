import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createRequest, getEligibleAlumni } from "../../services/careerService";
import { getPublicProfileById } from "../../services/profileService";
import { getJob } from "../../services/jobService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { extractFieldErrors } from "../../utils/jobFormat";
import { headline } from "../../utils/personFormat";
import {
  REQUEST_TYPES,
  alumniTags,
  isRequestType,
  jobLine,
  requestFormToPayload,
  typeMeta,
  validateRequestForm,
} from "../../utils/careerFormat";

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-brand/20";

// /career/new                      pick a type and an alumnus
// /career/new?type=REFERRAL&job=7  "Ask for a referral" on a job
// /career/new?type=QUESTION&alumni=10   "Ask a question" on an alumnus's profile
export default function NewCareerRequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const jobId = /^\d+$/.test(searchParams.get("job") || "") ? searchParams.get("job") : "";
  const fixedAlumniId = /^\d+$/.test(searchParams.get("alumni") || "") ? searchParams.get("alumni") : "";
  const urlType = searchParams.get("type");

  // a job in the URL means a referral; without one a referral can't be started from here
  const [type, setType] = useState(jobId ? "REFERRAL" : isRequestType(urlType) && urlType !== "REFERRAL" ? urlType : "QUESTION");
  const [alumniId, setAlumniId] = useState(fixedAlumniId);
  const [message, setMessage] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // who can be asked: either the alumnus named in the URL, or the viewer's eligible connections
  const [people, setPeople] = useState({ key: null, alumni: [], job: null, error: "" });
  const peopleKey = `${type}|${jobId}|${fixedAlumniId}`;

  useEffect(() => {
    let cancelled = false;
    const done = (value) => !cancelled && setPeople({ key: peopleKey, alumni: [], job: null, error: "", ...value });

    if (fixedAlumniId) {
      // a specific alumnus (possibly not a connection - the server decides if asking is allowed)
      Promise.all([getPublicProfileById(fixedAlumniId), jobId ? getJob(jobId) : null])
        .then(([profileRes, job]) => {
          const p = profileRes?.data;
          done({ alumni: p ? [{ user_id: p.user_id, full_name: p.full_name, profile_photo: p.profile_photo, designation: p.designation, company: p.company }] : [], job });
        })
        .catch(() => done({ error: "This person isn't available." }));
    } else {
      getEligibleAlumni(type, jobId)
        .then(({ alumni, job }) => done({ alumni, job }))
        .catch((err) => done({ error: err?.response?.data?.message || "Couldn't load alumni." }));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleKey]);

  const loadingPeople = people.key !== peopleKey;
  const meta = typeMeta(type);
  const form = { type, alumni_id: alumniId, job_id: jobId, message, resume_url: resumeUrl };

  const changeType = (next) => {
    setType(next);
    setErrors({});
    if (!fixedAlumniId) setAlumniId(""); // the eligible list (and who already has a request) differs per type
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const found = validateRequestForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await createRequest(requestFormToPayload(form));
      navigate(`/career/requests/${result.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't send the request. Please try again.", "error");
      setSubmitting(false);
    }
  };

  const border = (field) => (errors[field] ? "border-red-300" : "border-ink/15 focus:border-brand/60");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to={jobId ? `/jobs/${jobId}` : "/career"} className="text-sm font-medium text-accent-700 hover:text-accent-800">
        &larr; {jobId ? "Back to job" : "Career help"}
      </Link>

      <h1 className="mt-3 text-3xl text-ink font-display">
        {jobId ? "Ask for a referral" : "Ask for help"}
      </h1>
      <p className="mt-1 text-sm text-ink/60">{meta.hint}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6 card p-5 sm:p-7">
        {/* what kind of help (fixed to "referral" when started from a job) */}
        {!jobId && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">What do you need?</legend>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.filter((t) => !t.needsJob).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={type === t.value}
                  onClick={() => changeType(t.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    type === t.value ? "border-accent bg-brand text-white" : "border-ink/15 text-ink/70 hover:bg-ink/5"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/45">For a referral, open the job on the Jobs page and choose "Ask for a referral".</p>
          </fieldset>
        )}

        {jobId && people.job && (
          <div className="rounded-lg bg-ink/[0.03] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Job</p>
            <p className="mt-1 text-sm font-medium text-ink">{jobLine(people.job)}</p>
          </div>
        )}

        {/* who to ask */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Who do you want to ask?</legend>

          {loadingPeople && <p className="text-sm text-ink/45" aria-busy="true">Loading...</p>}
          {!loadingPeople && people.error && <p className="text-sm text-danger">{people.error}</p>}

          {!loadingPeople && !people.error && people.alumni.length === 0 && (
            <div className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink">No connected alumni yet</p>
              <p className="mt-1 text-sm text-ink/55">Connect with alumni first, then you can ask them for help.</p>
              <Link to="/alumni" className="mt-3 inline-block text-sm font-medium text-accent-700 hover:text-accent-800">
                Browse the alumni directory
              </Link>
            </div>
          )}

          {!loadingPeople && people.alumni.length > 0 && (
            <ul className="space-y-2">
              {people.alumni.map((a) => {
                const id = String(a.user_id);
                const selected = alumniId === id;
                const tags = alumniTags(a, type);
                return (
                  <li key={id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        selected ? "border-accent bg-accent/[0.06]" : "border-ink/10 hover:bg-ink/[0.03]"
                      } ${a.has_active_request ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <input
                        type="radio"
                        name="alumni"
                        value={id}
                        checked={selected}
                        disabled={a.has_active_request || Boolean(fixedAlumniId)}
                        onChange={() => {
                          setAlumniId(id);
                          setErrors((errs) => ({ ...errs, alumni_id: undefined }));
                        }}
                        className="accent-brand"
                      />
                      <Avatar photoUrl={a.profile_photo} fullName={a.full_name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                          {a.full_name}
                          <VerifiedBadge compact />
                        </span>
                        <span className="block truncate text-xs text-ink/55">{headline(a)}</span>
                        {a.has_active_request ? (
                          <span className="block text-xs text-ink/55">You already have an open request with them</span>
                        ) : (
                          tags.length > 0 && <span className="block text-xs text-accent-700">{tags.join(" · ")}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {errors.alumni_id && <p role="alert" className="mt-1 text-xs text-danger">{errors.alumni_id}</p>}
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">{meta.messageLabel}</span>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setErrors((errs) => ({ ...errs, message: undefined }));
            }}
            rows={5}
            maxLength={meta.limits[1]}
            placeholder={meta.messagePlaceholder}
            className={`${inputClass} ${border("message")}`}
          />
          {errors.message ? (
            <span role="alert" className="mt-1 block text-xs text-danger">{errors.message}</span>
          ) : (
            <span className="mt-1 block text-xs text-ink/45">{message.trim().length}/{meta.limits[1]} characters (at least {meta.limits[0]})</span>
          )}
        </label>

        {meta.resume !== "none" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              Resume link{meta.resume === "optional" ? " (optional)" : ""}
            </span>
            <input
              type="url"
              value={resumeUrl}
              onChange={(e) => {
                setResumeUrl(e.target.value);
                setErrors((errs) => ({ ...errs, resume_url: undefined }));
              }}
              placeholder="https://drive.google.com/..."
              maxLength={500}
              className={`${inputClass} ${border("resume_url")}`}
            />
            {errors.resume_url ? (
              <span role="alert" className="mt-1 block text-xs text-danger">{errors.resume_url}</span>
            ) : (
              <span className="mt-1 block text-xs text-ink/45">A shareable https link. Only you and the alumnus you ask can see it.</span>
            )}
          </label>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link to={jobId ? `/jobs/${jobId}` : "/career"} className="rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Sending..." : "Send request"}
          </button>
        </div>
      </form>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
