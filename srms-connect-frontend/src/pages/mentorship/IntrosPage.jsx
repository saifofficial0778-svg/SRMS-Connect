import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listIntros } from "../../services/mentorshipService";
import { timeAgo } from "../../components/feed/timeAgo";
import { Badge, EmptyCard, LoadingCard, PageHeader, Pager } from "../../components/mentorship/MentorshipParts";
import { BUTTON_TONES } from "../../components/mentorship/mentorshipStyles";
import { introStatus, introTitle } from "../../utils/mentorshipFormat";

const BOXES = [
  { value: "sent", label: "I asked for", empty: "You haven't asked for an introduction yet.", hint: "Open an alumnus's profile and choose \"Ask for an introduction\"." },
  { value: "to_introduce", label: "Asked of me", empty: "Nobody has asked you to introduce them.", hint: "Requests from students you are connected with show up here." },
  { value: "received", label: "Introduced to me", empty: "Nobody has been introduced to you yet.", hint: "You only hear about an introduction once someone you know decides to make it." },
];

const tabClass = (active) =>
  `rounded-md px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${active ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`;

export default function IntrosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBox = searchParams.get("box");
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  const [result, setResult] = useState({ key: null, state: "loading", intros: [], pagination: null, canRequest: false, canIntroduce: false });
  const [tick, setTick] = useState(0);

  // with no box in the URL: students start on what they asked for, alumni on what was asked of them
  const box = BOXES.some((b) => b.value === urlBox) ? urlBox : result.key && result.canIntroduce && !result.canRequest ? "to_introduce" : "sent";
  const requestKey = `${box}|${page}#${tick}`;

  useEffect(() => {
    let cancelled = false;
    listIntros(box, page)
      .then((data) => !cancelled && setResult({ key: requestKey, state: "success", ...data }))
      .catch(() => !cancelled && setResult((r) => ({ ...r, key: requestKey, state: "error", intros: [], pagination: null })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const go = (nextBox, nextPage = 1) => {
    const params = new URLSearchParams({ box: nextBox });
    if (nextPage > 1) params.set("page", String(nextPage));
    setSearchParams(params);
  };

  const state = result.key === requestKey ? result.state : "loading";
  // students never introduce and alumni never ask, so each sees only the boxes that can have content
  const boxes = BOXES.filter((b) => (b.value === "sent" ? result.canRequest || box === "sent" : result.canIntroduce || box === b.value));
  const current = BOXES.find((b) => b.value === box);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Introductions" subtitle="Ask someone you both know to introduce you. Nobody is contacted unless they choose to make the introduction." />

      {boxes.length > 1 && (
        <div role="tablist" aria-label="Introductions" className="inline-flex max-w-full overflow-x-auto scrollbar-none rounded-lg bg-ink/[0.06] p-1">
          {boxes.map((b) => (
            <button key={b.value} role="tab" aria-selected={box === b.value} onClick={() => go(b.value)} className={tabClass(box === b.value)}>{b.label}</button>
          ))}
        </div>
      )}

      {state === "loading" && <LoadingCard />}
      {state === "error" && (
        <EmptyCard title="Couldn't load introductions.">
          <button onClick={() => setTick((n) => n + 1)} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600">Try again</button>
        </EmptyCard>
      )}
      {state === "success" && result.intros.length === 0 && <EmptyCard title={current.empty}>{current.hint}</EmptyCard>}

      {state === "success" && result.intros.length > 0 && (
        <>
          <ul className="space-y-4">
            {result.intros.map((intro) => {
              const needsYou = intro.my_role === "introducer" && intro.status === "PENDING";
              return (
                <li key={intro.id} className={`card p-5 transition-shadow hover:shadow-raised ${needsYou ? "!border-brand/40 ring-1 ring-brand/10" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-medium text-ink">
                      <Link to={`/mentorship/intros/${intro.id}`} className="hover:text-brand">{introTitle(intro)}</Link>
                    </h3>
                    <Badge {...introStatus(intro.status)} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink/55">{timeAgo(intro.created_at)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65 line-clamp-2">{intro.message}</p>
                  <div className="mt-4 flex justify-end border-t border-ink/8 pt-3">
                    <Link to={`/mentorship/intros/${intro.id}`} className={`rounded-lg px-4 py-2 text-sm font-medium ${needsYou ? BUTTON_TONES.primary : BUTTON_TONES.secondary}`}>
                      {needsYou ? "Respond" : "Open"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager page={page} totalPages={result.pagination.totalPages} onChange={(p) => go(box, p)} />
        </>
      )}
    </div>
  );
}
