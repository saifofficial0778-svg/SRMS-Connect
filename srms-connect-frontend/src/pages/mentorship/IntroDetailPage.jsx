import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelIntro, getIntro, respondToIntro } from "../../services/mentorshipService";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { timeAgo } from "../../components/feed/timeAgo";
import { ActionWithNote, Badge, EmptyCard, LoadingCard, PageHeader, PersonLine } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES } from "../../components/mentorship/mentorshipStyles";
import { introAction, introStatus, introTitle } from "../../utils/mentorshipFormat";

export default function IntroDetailPage() {
  const { id } = useParams();
  const { toasts, showToast, dismiss } = useToast();

  const [loaded, setLoaded] = useState({ key: null, intro: null, error: "" });
  const [tick, setTick] = useState(0);
  const [activeAction, setActiveAction] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadKey = `${id}#${tick}`;
  useEffect(() => {
    let cancelled = false;
    getIntro(id)
      .then((intro) => !cancelled && setLoaded({ key: loadKey, intro, error: "" }))
      .catch((err) => !cancelled && setLoaded({ key: loadKey, intro: null, error: err?.response?.status === 404 ? "This introduction isn't available." : "Couldn't load this introduction." }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const run = async (work, success) => {
    setBusy(true);
    try {
      await work();
      showToast(success);
      setActiveAction(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "That didn't work. Please try again.", "error");
    } finally {
      setBusy(false);
      setConfirmCancel(false);
      setTick((n) => n + 1); // always show the real state afterwards
    }
  };

  const loading = loaded.key === null || (loaded.key !== loadKey && !loaded.intro);
  const intro = loaded.intro;

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><LoadingCard /></div>;
  if (loaded.error || !intro) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyCard title={loaded.error || "This introduction isn't available."}>
          <Link to="/mentorship/intros" className="font-medium text-[#C98A2B] hover:text-[#B37A22]">Back to introductions</Link>
        </EmptyCard>
      </div>
    );
  }

  const decisions = intro.actions.filter((a) => a !== "CANCEL");
  const canCancel = intro.actions.includes("CANCEL");
  const introduced = intro.status === "INTRODUCED";
  // once introduced, the two people take it from here themselves (connect, then chat)
  const nextPerson = intro.my_role === "target" ? intro.requester : intro.my_role === "requester" ? intro.target : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageHeader title="Introduction" />

      <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{introTitle(intro)}</h2>
            <p className="mt-1 text-sm text-[#1B2438]/50">Asked {timeAgo(intro.created_at)}</p>
          </div>
          <Badge {...introStatus(intro.status)} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1B2438]/45">Wants an introduction</p>
            <PersonLine person={intro.requester} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1B2438]/45">Introduced by</p>
            <PersonLine person={intro.introducer} verified={intro.introducer.is_verified_alumni} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1B2438]/45">To</p>
            <PersonLine person={intro.target} verified={intro.target.is_verified_alumni} />
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[#1B2438]">Why {intro.my_role === "requester" ? "you" : intro.requester.full_name} asked</h3>
          {/* user-written text is always rendered as text, never as HTML */}
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{intro.message}</p>
        </section>

        {intro.introducer_note && (
          <section className="mt-5 border-l-2 border-[#C98A2B]/50 pl-4">
            <h3 className="text-sm font-semibold text-[#1B2438]">Note from {intro.introducer.full_name}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{intro.introducer_note}</p>
          </section>
        )}

        {intro.my_role === "introducer" && intro.status === "PENDING" && !activeAction && (
          <p className="mt-5 rounded-xl bg-[#1B2438]/[0.03] px-4 py-3 text-xs text-[#1B2438]/60">
            {intro.target.full_name} has not been told about this. If you make the introduction they get a notification with your note; nothing else is sent, and no connection is created for anyone.
          </p>
        )}

        {!activeAction && (decisions.length > 0 || canCancel) && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[#1B2438]/8 pt-5">
            {decisions.map((action) => {
              const meta = introAction(action);
              return (
                <button key={action} onClick={() => setActiveAction(action)} disabled={busy} className={`rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 ${BUTTON_TONES[meta.tone]}`}>
                  {meta.label}
                </button>
              );
            })}
            {canCancel && (
              <button onClick={() => setConfirmCancel(true)} disabled={busy} className={`rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 ${BUTTON_TONES.danger}`}>Cancel request</button>
            )}
          </div>
        )}
        {activeAction && (
          <ActionWithNote
            meta={introAction(activeAction)}
            busy={busy}
            onBack={() => setActiveAction(null)}
            onSubmit={(note) => run(() => respondToIntro(intro.id, activeAction, note), activeAction === "INTRODUCE" ? "Introduction made." : "Request declined.")}
          />
        )}
      </article>

      {introduced && nextPerson && (
        <EmptyCard title="The introduction has been made">
          The next step is yours: open{" "}
          <Link to={`/profile/${nextPerson.user_id}`} className="font-medium text-[#C98A2B] hover:text-[#B37A22]">{nextPerson.full_name}'s profile</Link>{" "}
          to connect and start a conversation.
        </EmptyCard>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this request?"
        description="The person you asked will no longer see it."
        confirmLabel="Cancel request"
        busy={busy}
        onConfirm={() => run(() => cancelIntro(intro.id), "Request cancelled.")}
        onCancel={() => setConfirmCancel(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
