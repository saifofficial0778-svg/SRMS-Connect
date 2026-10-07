import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createIntro, getIntroPaths } from "../../services/mentorshipService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { EmptyCard, Field, LoadingCard, PageHeader } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES, inputClass } from "../../components/mentorship/mentorshipStyles";
import { extractFieldErrors } from "../../utils/jobFormat";
import { headline } from "../../utils/personFormat";
import { introPathState, introToPayload, validateIntro } from "../../utils/mentorshipFormat";
import IntroPath from "../../components/mentorship/IntroPath";

// /mentorship/intros/new?target=<alumnus id>: is there someone who knows you both?
export default function NewIntroPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();
  const targetId = /^\d+$/.test(searchParams.get("target") || "") ? searchParams.get("target") : "";

  const [loaded, setLoaded] = useState({ id: null, paths: null, error: "" });
  const [form, setForm] = useState({ introducer_id: "", message: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!targetId) return undefined;
    let cancelled = false;
    getIntroPaths(targetId)
      .then((paths) => !cancelled && setLoaded({ id: targetId, paths, error: "" }))
      .catch((err) => !cancelled && setLoaded({ id: targetId, paths: null, error: err?.response?.data?.message || "Couldn't check for mutual connections." }));
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const found = validateIntro(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await createIntro(introToPayload(form, targetId));
      navigate(`/mentorship/intros/${result.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't send the request. Please try again.", "error");
      setSubmitting(false);
    }
  };

  const loading = Boolean(targetId) && loaded.id !== targetId;
  const { paths } = loaded;
  const view = paths ? introPathState(paths) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Ask for an introduction" subtitle="Someone you both know can introduce you. They decide whether to do it." />

      {!targetId && <EmptyCard title="Choose who you want to reach">Open an alumnus's profile and choose "Ask for an introduction".</EmptyCard>}
      {loading && <LoadingCard />}
      {!loading && loaded.error && <EmptyCard title={loaded.error}><Link to="/alumni" className="font-medium text-accent-700 hover:text-accent-800">Back to the directory</Link></EmptyCard>}

      {!loading && paths && (
        <>
          <IntroPath
            requester={null}
            introducer={paths.introducers.find((p) => String(p.user_id) === form.introducer_id) || null}
            target={paths.target}
            status={paths.existing?.status || null}
          />

          {view === "connected" && (
            <EmptyCard title="You are already connected">
              You can message them directly. <Link to={`/profile/${paths.target.user_id}`} className="font-medium text-accent-700 hover:text-accent-800">Open their profile</Link>
            </EmptyCard>
          )}
          {(view === "pending" || view === "introduced") && (
            <EmptyCard title={view === "pending" ? "You already asked for this introduction" : "You have already been introduced"}>
              <Link to={`/mentorship/intros/${paths.existing.id}`} className="font-medium text-accent-700 hover:text-accent-800">Open it</Link>
            </EmptyCard>
          )}
          {view === "not-allowed" && <EmptyCard title="Introductions are for students">You can connect with them directly from their profile.</EmptyCard>}
          {view === "no-path" && (
            <EmptyCard title="No mutual alumni connections yet">
              None of the alumni you are connected with are connected to them. You can still send a connection request from{" "}
              <Link to={`/profile/${paths.target.user_id}`} className="font-medium text-accent-700 hover:text-accent-800">their profile</Link>.
            </EmptyCard>
          )}

          {view === "ready" && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5 card p-5 sm:p-7">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Who should introduce you?</legend>
                <ul className="space-y-2">
                  {paths.introducers.map((p) => {
                    const pid = String(p.user_id);
                    const selected = form.introducer_id === pid;
                    return (
                      <li key={pid}>
                        <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${selected ? "border-accent bg-accent/[0.06]" : "border-ink/10 hover:bg-ink/[0.03]"}`}>
                          <input
                            type="radio"
                            name="introducer"
                            value={pid}
                            checked={selected}
                            onChange={() => {
                              setForm((f) => ({ ...f, introducer_id: pid }));
                              setErrors((errs) => ({ ...errs, introducer_id: undefined }));
                            }}
                            className="accent-brand"
                          />
                          <Avatar photoUrl={p.profile_photo} fullName={p.full_name} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">{p.full_name}<VerifiedBadge compact /></span>
                            <span className="block truncate text-xs text-ink/55">{headline(p)} · connected with you both</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {errors.introducer_id && <p role="alert" className="mt-1 text-xs text-danger">{errors.introducer_id}</p>}
              </fieldset>

              <Field label="Why would you like to be introduced?" error={errors.message} hint={`${form.message.trim().length}/600 characters (at least 20). The introducer sees this, and so does the other person if the introduction is made.`}>
                <textarea
                  value={form.message}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, message: e.target.value }));
                    setErrors((errs) => ({ ...errs, message: undefined }));
                  }}
                  rows={4}
                  maxLength={600}
                  className={inputClass}
                />
              </Field>

              <p className="text-xs text-ink/50">
                Only the person you choose is notified. {paths.target.full_name} hears nothing unless they decide to introduce you.
              </p>

              <div className="flex justify-end gap-3">
                <Link to={`/profile/${paths.target.user_id}`} className={`rounded-lg px-4 py-2.5 text-sm font-medium ${BUTTON_TONES.secondary}`}>Cancel</Link>
                <button type="submit" disabled={submitting} className={`rounded-lg px-6 py-2.5 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES.primary}`}>
                  {submitting ? "Sending..." : "Ask for the introduction"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
