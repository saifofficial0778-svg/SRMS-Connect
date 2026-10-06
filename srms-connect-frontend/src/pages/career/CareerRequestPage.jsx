import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cancelRequest, getRequest, respondToRequest } from "../../services/careerService";
import { getOrCreateConversation } from "../../services/chatService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import StatusBadge from "../../components/career/StatusBadge";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { timeAgo } from "../../components/feed/timeAgo";
import { isSafeHttpsUrl } from "../../utils/jobFormat";
import { headline } from "../../utils/personFormat";
import {
  actionMeta,
  counterpart,
  historyLabel,
  jobLine,
  requestTitle,
  typeMeta,
  validateResponse,
} from "../../utils/careerFormat";

const BUTTON_TONES = {
  primary: "bg-[#C98A2B] text-white hover:bg-[#B37A22]",
  danger: "border border-red-200 text-red-600 hover:bg-red-50",
  secondary: "border border-[#1B2438]/15 text-[#1B2438]/80 hover:bg-[#1B2438]/5",
};

export default function CareerRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  // `loaded.key` ties a result to the request (and reload) it was fetched for
  const [loaded, setLoaded] = useState({ key: null, request: null, error: "" });
  const [reloadTick, setReloadTick] = useState(0);
  const [activeAction, setActiveAction] = useState(null); // an alumni action being filled in
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadKey = `${id}#${reloadTick}`;
  useEffect(() => {
    let cancelled = false;
    getRequest(id)
      .then((request) => !cancelled && setLoaded({ key: loadKey, request, error: "" }))
      .catch((err) => {
        if (!cancelled) {
          setLoaded({ key: loadKey, request: null, error: err?.response?.status === 404 ? "This request isn't available." : "Couldn't load this request." });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  // keep showing the current request while it refreshes after an action
  const loading = loaded.key === null || (loaded.key !== loadKey && !loaded.request);
  const { request, error } = loaded;
  const refresh = () => setReloadTick((n) => n + 1);

  const openAction = (action) => {
    setActiveAction(action);
    setResponseText("");
    setResponseError("");
  };

  const submitAction = async (e) => {
    e.preventDefault();
    const problem = validateResponse(activeAction, request.type, responseText);
    if (problem) {
      setResponseError(problem);
      return;
    }
    setBusy(true);
    try {
      await respondToRequest(request.id, activeAction, responseText);
      showToast("Request updated.");
      setActiveAction(null);
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't update the request.", "error");
      refresh(); // someone else may have changed it; show the real state
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelRequest(request.id);
      showToast("Request cancelled.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't cancel the request.", "error");
    } finally {
      setBusy(false);
      setConfirmCancel(false);
      refresh();
    }
  };

  const openChat = async () => {
    const other = counterpart(request);
    try {
      const res = await getOrCreateConversation(other.user_id);
      navigate("/chat", { state: { conversationId: res?.data?.conversationId, userId: other.user_id } });
    } catch (err) {
      // chat is only possible between connections; the server decides
      showToast(err?.response?.data?.message || "You can chat once you are connected.", "error");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" aria-busy="true">
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-8 animate-pulse space-y-3">
          <div className="h-6 w-2/3 rounded bg-[#1B2438]/10" />
          <div className="h-4 w-1/3 rounded bg-[#1B2438]/8" />
          <div className="h-20 w-full rounded bg-[#1B2438]/5" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="font-medium text-[#1B2438]">{error || "This request isn't available."}</p>
        <Link to="/career" className="mt-4 inline-block rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]">
          Back to career help
        </Link>
      </div>
    );
  }

  const other = counterpart(request);
  const meta = typeMeta(request.type);
  const alumniActions = request.actions.filter((a) => a !== "CANCEL");
  const canCancel = request.actions.includes("CANCEL");
  const activeMeta = activeAction ? actionMeta(activeAction, request.type) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <Link to="/career" className="text-sm font-medium text-[#C98A2B] hover:text-[#B37A22]">
        &larr; Career help
      </Link>

      <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1B2438]/45">{meta.label}</p>
            <h1 className="mt-1 text-2xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {requestTitle(request)}
            </h1>
            <p className="mt-1 text-sm text-[#1B2438]/50">Sent {timeAgo(request.created_at)}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* the other person: public profile details only */}
        <Link to={`/profile/${other.user_id}`} className="mt-5 flex items-center gap-3">
          <Avatar photoUrl={other.profile_photo} fullName={other.full_name} size={44} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 font-medium text-[#1B2438]">
              {other.full_name}
              {request.direction === "sent" && other.is_verified_alumni && <VerifiedBadge />}
            </span>
            <span className="block text-sm text-[#1B2438]/60">
              {headline(other) || (request.direction === "received" ? [other.branch, other.batch_year && `Batch ${other.batch_year}`].filter(Boolean).join(" · ") : "")}
            </span>
          </span>
        </Link>

        {request.job && (
          <section className="mt-6 rounded-xl bg-[#1B2438]/[0.03] px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B2438]/45">Job</h2>
            {request.job.status === "DELETED" ? (
              <p className="mt-1 text-sm text-[#1B2438]/70">{jobLine(request.job)} (no longer available)</p>
            ) : (
              <Link to={`/jobs/${request.job.id}`} className="mt-1 block text-sm font-medium text-[#1B2438] hover:text-[#9F6C1E]">
                {jobLine(request.job)}
                {request.job.location ? ` · ${request.job.location}` : ""}
                {request.job.status === "CLOSED" && <span className="font-normal text-[#1B2438]/45"> (closed)</span>}
              </Link>
            )}
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[#1B2438]">{request.direction === "sent" ? "Your note" : meta.messageLabel}</h2>
          {/* user-written text is always rendered as text, never as HTML */}
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{request.message}</p>
        </section>

        {request.resume_url && isSafeHttpsUrl(request.resume_url) && (
          <section className="mt-5">
            <h2 className="text-sm font-semibold text-[#1B2438]">Resume</h2>
            <a
              href={request.resume_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1 inline-block break-all text-sm font-medium text-[#C98A2B] hover:text-[#B37A22]"
            >
              Open resume ({new URL(request.resume_url).hostname})
            </a>
          </section>
        )}

        {request.response && (
          <section className="mt-6 border-l-2 border-[#C98A2B]/50 pl-4">
            <h2 className="text-sm font-semibold text-[#1B2438]">
              {request.type === "QUESTION" && request.status === "ANSWERED" ? "Answer" : "Reply"} from {request.alumni.full_name}
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1B2438]/80">{request.response}</p>
          </section>
        )}

        {/* actions the server says are possible for this viewer right now */}
        {(alumniActions.length > 0 || canCancel) && !activeAction && (
          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#1B2438]/8 pt-5">
            {alumniActions.map((action) => {
              const m = actionMeta(action, request.type);
              return (
                <button
                  key={action}
                  onClick={() => openAction(action)}
                  disabled={busy}
                  className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_TONES[m.tone]}`}
                >
                  {m.label}
                </button>
              );
            })}
            {canCancel && (
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
                className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_TONES.danger}`}
              >
                Cancel request
              </button>
            )}
          </div>
        )}

        {activeAction && (
          <form onSubmit={submitAction} className="mt-7 border-t border-[#1B2438]/8 pt-5" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#1B2438]">{activeMeta.responseLabel}</span>
              <textarea
                value={responseText}
                onChange={(e) => {
                  setResponseText(e.target.value);
                  setResponseError("");
                }}
                rows={activeAction === "ANSWER" ? 6 : 3}
                maxLength={2000}
                autoFocus
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1B2438] focus:outline-none focus:ring-2 focus:ring-[#C98A2B]/20 ${
                  responseError ? "border-red-300" : "border-[#1B2438]/15 focus:border-[#C98A2B]/60"
                }`}
              />
              {responseError && <span role="alert" className="mt-1 block text-xs text-red-600">{responseError}</span>}
            </label>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setActiveAction(null)} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES.secondary}`}>
                Back
              </button>
              <button type="submit" disabled={busy} className={`rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES[activeMeta.tone]}`}>
                {busy ? "Saving..." : activeMeta.label}
              </button>
            </div>
          </form>
        )}
      </article>

      {/* continuing the conversation reuses the existing chat (only between connections) */}
      <div className="flex justify-end">
        <button onClick={openChat} className={`rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES.secondary}`}>
          Message {other.full_name}
        </button>
      </div>

      <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[#1B2438]">History</h2>
        <ol className="mt-3 space-y-3">
          {request.history.map((entry, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#C98A2B]" aria-hidden="true" />
              <span className="flex-1 text-[#1B2438]/80">{historyLabel(entry, request)}</span>
              <span className="text-xs text-[#1B2438]/45">{timeAgo(entry.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this request?"
        description="The alumnus will no longer be able to respond to it."
        confirmLabel="Cancel request"
        busy={busy}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
