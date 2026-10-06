import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createMentorship, getMentor } from "../../services/mentorshipService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { EmptyCard, Field, LoadingCard, MatchReasons, PageHeader, TopicChips } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES, inputClass } from "../../components/mentorship/mentorshipStyles";
import { extractFieldErrors } from "../../utils/jobFormat";
import { headline } from "../../utils/personFormat";
import { canRequestMentor, mentorshipRequestToPayload, spotsLabel, topicLabel, validateMentorshipRequest } from "../../utils/mentorshipFormat";

export default function MentorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const [loaded, setLoaded] = useState({ id: null, page: null, error: "" });
  const [form, setForm] = useState({ topic: "", message: "", goals: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMentor(id)
      .then((page) => !cancelled && setLoaded({ id, page, error: "" }))
      .catch((err) => !cancelled && setLoaded({ id, page: null, error: err?.response?.status === 404 ? "This mentor isn't available." : "Couldn't load this mentor." }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = loaded.id !== id;
  const page = loaded.page;

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const found = validateMentorshipRequest(form, page.mentor);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await createMentorship(mentorshipRequestToPayload(form, page.mentor.user_id));
      navigate(`/mentorship/requests/${result.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't send the request. Please try again.", "error");
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><LoadingCard /></div>;
  if (loaded.error || !page) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyCard title={loaded.error || "This mentor isn't available."}>
          <Link to="/mentorship" className="font-medium text-[#C98A2B] hover:text-[#B37A22]">Back to mentors</Link>
        </EmptyCard>
      </div>
    );
  }

  const { mentor, match, viewer } = page;
  const open = viewer.open_mentorship;
  const showForm = viewer.can_request && !open && canRequestMentor(mentor);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageHeader title="Mentor" />

      <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar photoUrl={mentor.profile_photo} fullName={mentor.full_name} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{mentor.full_name}</h2>
              {mentor.is_verified_alumni && <VerifiedBadge />}
            </div>
            {headline(mentor) && <p className="text-[#1B2438]/75">{headline(mentor)}</p>}
            <p className="mt-1 text-sm text-[#1B2438]/55">{spotsLabel(mentor)}</p>
            <Link to={`/profile/${mentor.user_id}`} className="mt-1 inline-block text-sm font-medium text-[#C98A2B] hover:text-[#B37A22]">
              View full profile
            </Link>
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[#1B2438]">About</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{mentor.bio}</p>
        </section>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-[#1B2438]">Mentors on</dt>
            <dd className="mt-2"><TopicChips topics={mentor.topics} /></dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[#1B2438]">Availability</dt>
            <dd className="mt-1 text-sm text-[#1B2438]/75">{mentor.availability}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[#1B2438]">Skills</dt>
            <dd className="mt-1 text-sm text-[#1B2438]/75">{mentor.skills.length ? mentor.skills.join(", ") : "No skills listed on their profile."}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[#1B2438]">Prefers mentoring</dt>
            <dd className="mt-1 text-sm text-[#1B2438]/75">{mentor.areas.length ? mentor.areas.join(", ") : "Students from any area"}</dd>
          </div>
        </dl>

        {match && <div className="mt-6"><MatchReasons match={match} /></div>}
      </article>

      {/* where you stand with this mentor */}
      {viewer.is_self && (
        <EmptyCard title="This is your mentor profile">
          <Link to="/mentorship/profile" className="font-medium text-[#C98A2B] hover:text-[#B37A22]">Edit it</Link>
        </EmptyCard>
      )}

      {open && (
        <EmptyCard title={open.status === "ACTIVE" ? "You have an active mentorship with this mentor" : "Your request is waiting for a reply"}>
          <Link to={`/mentorship/requests/${open.id}`} className="font-medium text-[#C98A2B] hover:text-[#B37A22]">Open it</Link>
        </EmptyCard>
      )}

      {!viewer.is_self && !open && viewer.can_request && !canRequestMentor(mentor) && <EmptyCard title={spotsLabel(mentor)}>Check back later.</EmptyCard>}

      {showForm && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-8">
          <h3 className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Request mentorship</h3>

          <Field label="What do you want help with?" error={errors.topic}>
            <select value={form.topic} onChange={set("topic")} className={inputClass}>
              <option value="">Choose a topic</option>
              {mentor.topics.map((t) => <option key={t} value={t}>{topicLabel(t)}</option>)}
            </select>
          </Field>

          <Field label="Message to the mentor" error={errors.message} hint={`${form.message.trim().length}/1000 characters (at least 20)`}>
            <textarea value={form.message} onChange={set("message")} rows={5} maxLength={1000} placeholder="Where you are now, what you are aiming for, and how they can help." className={inputClass} />
          </Field>

          <Field label="Goals to start with (optional)" error={errors.goals} hint="One per line, up to 3. You can add more once the mentorship starts.">
            <textarea value={form.goals} onChange={set("goals")} rows={3} placeholder={"Crack a mock interview\nFinish my resume"} className={inputClass} />
          </Field>

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className={`rounded-lg px-6 py-2.5 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES.primary}`}>
              {submitting ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      )}

      {/* not connected yet: a mutual alumnus may be able to introduce you */}
      {!viewer.is_self && !viewer.is_connected && viewer.can_request && (
        <p className="text-center text-sm text-[#1B2438]/60">
          Don't know them yet?{" "}
          <Link to={`/mentorship/intros/new?target=${mentor.user_id}`} className="font-medium text-[#C98A2B] hover:text-[#B37A22]">
            Ask a mutual connection for an introduction
          </Link>
        </p>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
