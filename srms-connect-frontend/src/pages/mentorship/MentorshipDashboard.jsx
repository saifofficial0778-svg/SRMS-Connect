import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listMentorships } from "../../services/mentorshipService";
import Avatar from "../../components/profile/Avatar";
import { timeAgo } from "../../components/feed/timeAgo";
import { Badge, EmptyCard, LoadingCard, PageHeader, Pager } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES, inputClass } from "../../components/mentorship/mentorshipStyles";
import { MENTORSHIP_STATUS_OPTIONS, mentorshipStatus, mentorshipTitle, otherPerson, topicLabel } from "../../utils/mentorshipFormat";

const tabClass = (active) =>
  `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${active ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`;

// Students see the mentorships where they are the mentee; alumni see the ones where they mentor.
export default function MentorshipDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBox = searchParams.get("box");
  const status = MENTORSHIP_STATUS_OPTIONS.some((s) => s.value === searchParams.get("status")) ? searchParams.get("status") : "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  const [result, setResult] = useState({ key: null, state: "loading", mentorships: [], pagination: null, canRequest: false, canBeMentor: false });
  const [tick, setTick] = useState(0);

  // with no box in the URL, an alumnus lands on "mentor" and a student on "mentee"
  const box = urlBox === "mentor" || urlBox === "mentee" ? urlBox : result.key && result.canBeMentor && !result.canRequest ? "mentor" : "mentee";
  const requestKey = `${box}|${status}|${page}#${tick}`;
  const query = useMemo(() => ({ box, status }), [box, status]);

  useEffect(() => {
    let cancelled = false;
    listMentorships(query, page)
      .then((data) => !cancelled && setResult({ key: requestKey, state: "success", ...data }))
      .catch(() => !cancelled && setResult((r) => ({ ...r, key: requestKey, state: "error", mentorships: [], pagination: null })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const update = (patch) => {
    const next = { box, status, page: 1, ...patch };
    const params = new URLSearchParams();
    params.set("box", next.box);
    if (next.status) params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    setSearchParams(params);
  };

  const state = result.key === requestKey ? result.state : "loading";
  const { mentorships, pagination, canRequest, canBeMentor } = result;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="My mentorships" subtitle="Requests, active mentorships and their history." />

      <div className="flex flex-wrap items-center gap-3">
        {canRequest && canBeMentor ? (
          <div role="tablist" aria-label="View" className="inline-flex rounded-lg bg-ink/[0.06] p-1">
            <button role="tab" aria-selected={box === "mentee"} onClick={() => update({ box: "mentee" })} className={tabClass(box === "mentee")}>As mentee</button>
            <button role="tab" aria-selected={box === "mentor"} onClick={() => update({ box: "mentor" })} className={tabClass(box === "mentor")}>As mentor</button>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-ink">{box === "mentor" ? "People you mentor" : "Your mentors"}</h2>
        )}
        <select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value })} className={`${inputClass} ml-auto w-auto`}>
          <option value="">Any status</option>
          {MENTORSHIP_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {state === "loading" && <LoadingCard />}
      {state === "error" && (
        <EmptyCard title="Couldn't load your mentorships.">
          <button onClick={() => setTick((n) => n + 1)} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600">Try again</button>
        </EmptyCard>
      )}

      {state === "success" && mentorships.length === 0 && (
        <EmptyCard title={status ? "Nothing with this status" : box === "mentor" ? "No one has asked you for mentorship yet" : "You don't have a mentor yet"}>
          {!status && box === "mentee" && <Link to="/mentorship" className="font-medium text-accent-700 hover:text-accent-800">Find a mentor</Link>}
          {!status && box === "mentor" && <Link to="/mentorship/profile" className="font-medium text-accent-700 hover:text-accent-800">Check your mentor profile</Link>}
        </EmptyCard>
      )}

      {state === "success" && mentorships.length > 0 && (
        <>
          <ul className="space-y-4">
            {mentorships.map((m) => {
              const other = otherPerson(m);
              const badge = mentorshipStatus(m.status);
              const needsYou = m.my_role === "mentor" && m.status === "PENDING";
              return (
                <li key={m.id} className={`card p-5 transition-shadow hover:shadow-raised ${needsYou ? "!border-brand/40 ring-1 ring-brand/10" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0"><Avatar photoUrl={other.profile_photo} fullName={other.full_name} size={44} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-medium text-ink">
                          <Link to={`/mentorship/requests/${m.id}`} className="hover:text-brand">{mentorshipTitle(m)}</Link>
                        </h3>
                        <Badge {...badge} />
                      </div>
                      <p className="mt-0.5 text-xs text-ink/55">{topicLabel(m.topic)} · {timeAgo(m.created_at)}</p>
                      <p className="mt-2 text-sm leading-relaxed text-ink/65 line-clamp-2">{m.message}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end border-t border-ink/8 pt-3">
                    <Link to={`/mentorship/requests/${m.id}`} className={`rounded-lg px-4 py-2 text-sm font-medium ${needsYou ? BUTTON_TONES.primary : BUTTON_TONES.secondary}`}>
                      {needsYou ? "Respond" : "Open"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager page={page} totalPages={pagination.totalPages} onChange={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
