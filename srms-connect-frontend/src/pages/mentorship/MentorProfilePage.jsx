import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyMentorProfile, saveMentorProfile } from "../../services/mentorshipService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { EmptyCard, Field, LoadingCard, PageHeader } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES, inputClass } from "../../components/mentorship/mentorshipStyles";
import { extractFieldErrors } from "../../utils/jobFormat";
import { EMPTY_MENTOR_FORM, TOPICS, mentorProfileToPayload, mentorToForm, toggleTopic, validateMentorProfile } from "../../utils/mentorshipFormat";

// An alumnus's own mentor profile: create it to become a mentor, edit it, or pause it.
export default function MentorProfilePage() {
  const { toasts, showToast, dismiss } = useToast();
  const [state, setState] = useState({ status: "loading", canBeMentor: false, mentor: null });
  const [form, setForm] = useState(EMPTY_MENTOR_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyMentorProfile()
      .then((data) => {
        if (cancelled) return;
        setState({ status: "success", ...data });
        setForm(mentorToForm(data.mentor));
      })
      .catch(() => !cancelled && setState({ status: "error", canBeMentor: false, mentor: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = validateMentorProfile(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const data = await saveMentorProfile(mentorProfileToPayload(form));
      setState({ status: "success", ...data });
      setForm(mentorToForm(data.mentor));
      showToast("Mentor profile saved.");
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't save your mentor profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const { mentor } = state;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Mentor profile" subtitle="Tell students what you can help with and how much time you have." />

      {state.status === "loading" && <LoadingCard />}
      {state.status === "error" && <EmptyCard title="Couldn't load your mentor profile.">Please refresh the page.</EmptyCard>}
      {state.status === "success" && !state.canBeMentor && (
        <EmptyCard title="Mentor profiles are for alumni">
          <Link to="/mentorship" className="font-medium text-accent-700 hover:text-accent-800">Find a mentor instead</Link>
        </EmptyCard>
      )}

      {state.status === "success" && state.canBeMentor && (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 card p-6 sm:p-8">
          {mentor ? (
            <p className="rounded-lg bg-ink/[0.03] px-4 py-3 text-sm text-ink/70">
              You are listed as a mentor with {mentor.active_mentees} active {mentor.active_mentees === 1 ? "mentee" : "mentees"}.{" "}
              <Link to={`/mentorship/mentors/${mentor.user_id}`} className="font-medium text-accent-700 hover:text-accent-800">See how students see you</Link>
            </p>
          ) : (
            <p className="rounded-lg bg-accent/[0.08] px-4 py-3 text-sm text-ink/75">
              Saving this makes you a mentor and adds "Open to: Mentorship" to your profile. Your expertise is taken from the skills already on your profile.
            </p>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">What can you mentor on?</legend>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => {
                const on = form.topics.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setForm((f) => ({ ...f, topics: toggleTopic(f.topics, t.value) }));
                      setErrors((errs) => ({ ...errs, topics: undefined }));
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      on ? "border-accent bg-brand text-white" : "border-ink/15 text-ink/70 hover:bg-ink/5"
                    }`}
                  >
                    {on && <span aria-hidden="true">{"✓ "}</span>}
                    {t.label}
                  </button>
                );
              })}
            </div>
            {errors.topics && <p role="alert" className="mt-1 text-xs text-danger">{errors.topics}</p>}
          </fieldset>

          <Field label="Short bio for students" error={errors.bio} hint={`${form.bio.trim().length}/600 characters (at least 20)`}>
            <textarea value={form.bio} onChange={set("bio")} rows={4} maxLength={600} placeholder="Your path so far and how you like to help." className={inputClass} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Availability" error={errors.availability} hint="For example: Weekends, about 2 hours a week">
              <input value={form.availability} onChange={set("availability")} maxLength={200} className={inputClass} />
            </Field>
            <Field label="Max active mentees" error={errors.max_active_mentees}>
              <input type="number" min="1" max="20" inputMode="numeric" value={form.max_active_mentees} onChange={set("max_active_mentees")} className={inputClass} />
            </Field>
          </div>

          <Field label="Students you prefer to mentor (optional)" error={errors.areas} hint="Comma separated, up to 5. For example: Computer Applications, final-year students">
            <input value={form.areas} onChange={set("areas")} className={inputClass} />
          </Field>

          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_accepting}
              onChange={(e) => setForm((f) => ({ ...f, is_accepting: e.target.checked }))}
              className="h-4 w-4 accent-brand"
            />
            Accepting new mentorship requests
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={`rounded-lg px-6 py-2.5 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES.primary}`}>
              {saving ? "Saving..." : mentor ? "Save changes" : "Become a mentor"}
            </button>
          </div>
        </form>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
