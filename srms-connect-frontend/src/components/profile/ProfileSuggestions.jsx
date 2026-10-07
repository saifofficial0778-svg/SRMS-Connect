import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProfileConnections, sendConnectionRequest } from "../../services/connectionService";
import HorizontalSlider from "../ui/HorizontalSlider";
import Avatar from "./Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import { firstName, suggestionAction, suggestionSubtitle } from "../../utils/personFormat";

const ACTION_TONES = {
  primary: "border-accent text-accent-700 hover:bg-accent/10",
  muted: "border-ink/15 text-ink/50",
  secondary: "border-ink/15 text-ink/80 hover:bg-ink/5",
};
const buttonClass = "mt-3 block w-full rounded-full border px-4 py-1.5 text-center text-sm font-medium transition-colors disabled:cursor-default";

// Under someone's profile: the people they are connected with, so you can grow your own network.
// The server only returns ACTIVE members and says how YOU stand with each of them.
export default function ProfileSuggestions({ userId, ownerName, showToast }) {
  const [state, setState] = useState({ userId: null, people: [] });
  const [sending, setSending] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProfileConnections(userId)
      .then((people) => !cancelled && setState({ userId, people }))
      .catch(() => !cancelled && setState({ userId, people: [] })); // the section simply stays hidden
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const people = state.userId === userId ? state.people : [];
  if (people.length === 0) return null;

  const connect = async (person) => {
    setSending(person.user_id);
    try {
      const res = await sendConnectionRequest(person.user_id);
      setState((s) => ({ ...s, people: s.people.map((p) => (p.user_id === person.user_id ? { ...p, relation: "sent", connection_id: res?.data ?? null } : p)) }));
      showToast?.("Connection request sent.");
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't send request.", "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <section aria-label={`People ${ownerName} knows`} className="card p-5 sm:p-6">
      <h2 className="text-base text-ink font-display">
        People {firstName(ownerName)} knows
      </h2>
      <p className="mt-0.5 text-xs text-ink/50">Members connected with {firstName(ownerName)} on SRMS Connect</p>

      <HorizontalSlider label={`People ${ownerName} knows`} className="mt-4">
        {people.map((person) => {
          const action = suggestionAction(person.relation);
          return (
            <li key={person.user_id} className="flex w-[220px] shrink-0 snap-start flex-col rounded-lg border border-ink/10 bg-white p-4">
              <Link to={`/profile/${person.user_id}`} className="group flex flex-1 flex-col items-center text-center">
                <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={64} />
                <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold text-ink group-hover:text-accent-700">
                  {person.full_name}
                  {person.is_verified_alumni && <VerifiedBadge compact />}
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs text-ink/55">{suggestionSubtitle(person)}</span>
              </Link>

              {action.kind === "connect" ? (
                <button type="button" onClick={() => connect(person)} disabled={sending === person.user_id} className={`${buttonClass} ${ACTION_TONES[action.tone]}`}>
                  {sending === person.user_id ? "Sending..." : action.label}
                </button>
              ) : action.kind === "link" ? (
                <Link to={action.to(person)} className={`${buttonClass} ${ACTION_TONES[action.tone]}`}>{action.label}</Link>
              ) : (
                <button type="button" disabled className={`${buttonClass} ${ACTION_TONES[action.tone]}`}>{action.label}</button>
              )}
            </li>
          );
        })}
      </HorizontalSlider>
    </section>
  );
}
