import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addGoal,
  addSession,
  cancelMentorship,
  completeMentorship,
  getMentorship,
  respondToMentorship,
  setGoalStatus,
} from "../../services/mentorshipService";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Timeline from "../../components/ui/Timeline";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { timeAgo } from "../../components/feed/timeAgo";
import { ActionWithNote, Badge, EmptyCard, Field, LoadingCard, PageHeader, PersonLine } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES, inputClass } from "../../components/mentorship/mentorshipStyles";
import {
  durationLabel,
  goalProgress,
  localToday,
  mentorshipAction,
  mentorshipHistoryLabel,
  mentorshipStatus,
  mentorshipTitle,
  sessionToPayload,
  topicLabel,
  validateGoal,
  validateSession,
} from "../../utils/mentorshipFormat";

const EMPTY_SESSION = { session_date: "", duration_minutes: "", notes: "" };

export default function MentorshipDetailPage() {
  const { id } = useParams();
  const { toasts, showToast, dismiss } = useToast();

  const [loaded, setLoaded] = useState({ key: null, mentorship: null, error: "" });
  const [tick, setTick] = useState(0);
  const [activeAction, setActiveAction] = useState(null); // ACCEPT | REJECT | COMPLETE being confirmed
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalError, setGoalError] = useState("");
  const [session, setSession] = useState(EMPTY_SESSION);
  const [sessionErrors, setSessionErrors] = useState({});
  const [showSessionForm, setShowSessionForm] = useState(false);

  const loadKey = `${id}#${tick}`;
  useEffect(() => {
    let cancelled = false;
    getMentorship(id)
      .then((mentorship) => !cancelled && setLoaded({ key: loadKey, mentorship, error: "" }))
      .catch((err) => !cancelled && setLoaded({ key: loadKey, mentorship: null, error: err?.response?.status === 404 ? "This mentorship isn't available." : "Couldn't load this mentorship." }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const refresh = () => setTick((n) => n + 1);
  // keep showing the current data while it refreshes after an action
  const loading = loaded.key === null || (loaded.key !== loadKey && !loaded.mentorship);
  const m = loaded.mentorship;

  // run a change, show the outcome, and always reload the real state afterwards
  const run = async (work, success) => {
    setBusy(true);
    try {
      await work();
      showToast(success);
      return true;
    } catch (err) {
      showToast(err?.response?.data?.message || "That didn't work. Please try again.", "error");
      return false;
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const submitAction = async (note) => {
    const done = await run(
      () => (activeAction === "COMPLETE" ? completeMentorship(m.id, note) : respondToMentorship(m.id, activeAction, note)),
      activeAction === "COMPLETE" ? "Mentorship completed." : "Request updated."
    );
    if (done) setActiveAction(null);
  };

  const submitGoal = async (e) => {
    e.preventDefault();
    const problem = validateGoal(goalTitle);
    setGoalError(problem);
    if (problem) return;
    if (await run(() => addGoal(m.id, goalTitle), "Goal added.")) setGoalTitle("");
  };

  const submitSession = async (e) => {
    e.preventDefault();
    const found = validateSession(session);
    setSessionErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await run(() => addSession(m.id, sessionToPayload(session)), "Session logged.")) {
      setSession(EMPTY_SESSION);
      setShowSessionForm(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><LoadingCard /></div>;
  if (loaded.error || !m) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyCard title={loaded.error || "This mentorship isn't available."}>
          <Link to="/mentorship/dashboard" className="font-medium text-accent-700 hover:text-accent-800">Back to my mentorships</Link>
        </EmptyCard>
      </div>
    );
  }

  const can = (action) => m.actions.includes(action);
  const isActive = m.status === "ACTIVE";
  const progress = goalProgress(m.goals);
  const decisionActions = ["ACCEPT", "REJECT"].filter(can);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Mentorship" />

      <article className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{topicLabel(m.topic)}</p>
            <h2 className="mt-1 text-2xl text-ink font-display">{mentorshipTitle(m)}</h2>
            <p className="mt-1 text-sm text-ink/50">Requested {timeAgo(m.created_at)}</p>
          </div>
          <Badge {...mentorshipStatus(m.status)} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Mentor</p>
            <PersonLine person={m.mentor} verified={m.mentor.is_verified_alumni} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Mentee</p>
            <PersonLine person={m.mentee} />
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-ink">{m.my_role === "mentee" ? "Your message" : "Their message"}</h3>
          {/* user-written text is always rendered as text, never as HTML */}
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/80">{m.message}</p>
        </section>

        {m.response && (
          <section className="mt-5 border-l-2 border-accent/50 pl-4">
            <h3 className="text-sm font-semibold text-ink">Reply from {m.mentor.full_name}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/80">{m.response}</p>
          </section>
        )}
        {m.closing_note && (
          <section className="mt-5 border-l-2 border-success/50 pl-4">
            <h3 className="text-sm font-semibold text-ink">Closing note</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/80">{m.closing_note}</p>
          </section>
        )}

        {/* request-stage actions (what the server says this viewer may do) */}
        {!activeAction && (decisionActions.length > 0 || can("CANCEL")) && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/8 pt-5">
            {decisionActions.map((action) => {
              const meta = mentorshipAction(action);
              return (
                <button key={action} onClick={() => setActiveAction(action)} disabled={busy} className={`rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 ${BUTTON_TONES[meta.tone]}`}>
                  {meta.label}
                </button>
              );
            })}
            {can("CANCEL") && (
              <button onClick={() => setConfirmCancel(true)} disabled={busy} className={`rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 ${BUTTON_TONES.danger}`}>
                Cancel request
              </button>
            )}
          </div>
        )}
        {activeAction && <ActionWithNote meta={mentorshipAction(activeAction)} busy={busy} onSubmit={submitAction} onBack={() => setActiveAction(null)} />}
      </article>

      {/* goals: shown once there are any, editable while active */}
      {(m.goals.length > 0 || isActive) && (
        <section className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base text-ink font-display">Goals</h3>
            <span className="text-sm tabular-nums text-ink/55">{progress.label}</span>
          </div>

          {m.goals.length > 0 && (
            <ul className="mt-3 divide-y divide-ink/8">
              {m.goals.map((goal) => {
                const done = goal.status === "DONE";
                return (
                  <li key={goal.id} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={!can("ADD_GOAL") || busy}
                      onChange={() => run(() => setGoalStatus(m.id, goal.id, done ? "OPEN" : "DONE"), done ? "Goal reopened." : "Goal done.")}
                      aria-label={`${goal.title}: ${done ? "done" : "not done"}`}
                      className="h-4 w-4 accent-success"
                    />
                    <span className={`flex-1 text-sm ${done ? "text-ink/50 line-through" : "text-ink"}`}>{goal.title}</span>
                    <span className="text-xs text-ink/45">{done ? "Done" : "Open"} · added by {goal.added_by === m.my_role ? "you" : `the ${goal.added_by}`}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {can("ADD_GOAL") && (
            <form onSubmit={submitGoal} className="mt-3 flex flex-wrap items-start gap-2" noValidate>
              <div className="min-w-0 flex-1">
                <input
                  value={goalTitle}
                  onChange={(e) => {
                    setGoalTitle(e.target.value);
                    setGoalError("");
                  }}
                  maxLength={200}
                  placeholder="Add a goal, e.g. Finish two mock interviews"
                  aria-label="New goal"
                  className={inputClass}
                />
                {goalError && <span role="alert" className="mt-1 block text-xs text-danger">{goalError}</span>}
              </div>
              <button type="submit" disabled={busy} className={`rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${BUTTON_TONES.secondary}`}>Add goal</button>
            </form>
          )}
        </section>
      )}

      {/* sessions: a simple log of what happened - no calendar or video */}
      {(m.sessions.length > 0 || isActive) && (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base text-ink font-display">Sessions</h3>
            {can("LOG_SESSION") && !showSessionForm && (
              <button onClick={() => setShowSessionForm(true)} className={`rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES.secondary}`}>Log a session</button>
            )}
          </div>

          {showSessionForm && (
            <form onSubmit={submitSession} noValidate className="mt-4 space-y-3 rounded-lg bg-ink/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date" error={sessionErrors.session_date}>
                  <input type="date" max={localToday()} value={session.session_date} onChange={(e) => setSession((s) => ({ ...s, session_date: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Duration in minutes (optional)" error={sessionErrors.duration_minutes}>
                  <input type="number" min="5" max="600" inputMode="numeric" value={session.duration_minutes} onChange={(e) => setSession((s) => ({ ...s, duration_minutes: e.target.value }))} className={inputClass} />
                </Field>
              </div>
              <Field label="What did you cover?" error={sessionErrors.notes}>
                <textarea value={session.notes} onChange={(e) => setSession((s) => ({ ...s, notes: e.target.value }))} rows={3} maxLength={1000} className={inputClass} />
              </Field>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSessionForm(false)} className={`rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES.secondary}`}>Cancel</button>
                <button type="submit" disabled={busy} className={`rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES.primary}`}>Save session</button>
              </div>
            </form>
          )}

          {m.sessions.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">No sessions logged yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-ink/8">
              {m.sessions.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="text-sm font-medium text-ink">
                    {s.session_date}
                    {s.duration_minutes && <span className="font-normal text-ink/55"> · {durationLabel(s.duration_minutes)}</span>}
                    <span className="font-normal text-ink/45"> · logged by {s.logged_by === m.my_role ? "you" : `the ${s.logged_by}`}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/75">{s.notes}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {can("COMPLETE") && !activeAction && (
        <div className="flex justify-end">
          <button onClick={() => setActiveAction("COMPLETE")} disabled={busy} className={`rounded-lg px-5 py-2.5 text-sm font-medium ${BUTTON_TONES.secondary}`}>
            Complete mentorship
          </button>
        </div>
      )}

      <Timeline items={m.history.map((entry) => ({ label: mentorshipHistoryLabel(entry, m), time: timeAgo(entry.at) }))} />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this request?"
        description="The mentor will no longer see it."
        confirmLabel="Cancel request"
        busy={busy}
        onConfirm={async () => {
          await run(() => cancelMentorship(m.id), "Request cancelled.");
          setConfirmCancel(false);
        }}
        onCancel={() => setConfirmCancel(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
