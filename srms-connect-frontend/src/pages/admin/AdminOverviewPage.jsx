import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone, ShieldAlert, UserCheck, UserPlus, Users } from "lucide-react";
import { getUsers } from "../../services/adminService";
import { manageList } from "../../services/spotlightService";
import { ErrorState, PageHeader, Skeleton, StatCard } from "../../components/ui/Primitives";
import Button from "../../components/ui/Button";

// counts come from the existing list endpoints (one row each, read the total) - no new API
const countUsers = (params) => getUsers({ ...params, page: 1, limit: 1 }).then((res) => res?.data?.pagination?.total ?? 0);

export default function AdminOverviewPage() {
  const [state, setState] = useState({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      countUsers({ status: "PENDING" }),
      countUsers({ status: "ACTIVE" }),
      countUsers({ status: "BLOCKED" }),
      countUsers({ role: "ALUMNI", status: "ACTIVE" }),
      manageList({}, 1, 1),
    ])
      .then(([pending, active, blocked, alumni, spotlights]) => !cancelled && setState({ status: "ready", data: { pending, active, blocked, alumni, spotlights: spotlights.counts } }))
      .catch(() => !cancelled && setState({ status: "error", data: null }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const d = state.data;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin console" title="Overview" subtitle="What needs your attention, and the state of the platform." />

      {state.status === "error" && <ErrorState onRetry={() => { setState({ status: "loading", data: null }); setAttempt((n) => n + 1); }} />}

      {state.status === "loading" && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 !rounded-xl" />)}
        </div>
      )}

      {d && (
        <>
          {d.pending > 0 && (
            <div className="card flex flex-wrap items-center justify-between gap-3 !border-accent/50 bg-accent-50/60 p-4">
              <p className="flex items-center gap-3 text-sm text-ink/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-accent-800"><UserPlus className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" /></span>
                <span><span className="font-semibold text-ink">{d.pending} {d.pending === 1 ? "registration is" : "registrations are"} waiting</span> for approval.</span>
              </p>
              <Button size="sm" to="/admin/users?status=PENDING">Review now</Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard value={d.pending} label="Waiting for approval" icon={UserPlus} hint="New registrations" />
            <StatCard value={d.active} label="Active members" icon={Users} hint={`${d.alumni} verified alumni`} />
            <StatCard value={d.blocked} label="Blocked accounts" icon={ShieldAlert} />
            <StatCard value={d.spotlights.PUBLISHED} label="Published spotlights" icon={Megaphone} hint={`${d.spotlights.DRAFT} drafts · ${d.spotlights.ARCHIVED} archived`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { to: "/admin/users", icon: UserCheck, title: "Members", text: "Approve registrations, and block or reinstate accounts." },
              { to: "/admin/spotlights", icon: Megaphone, title: "Campus Spotlight", text: "Publish events, placement drives and announcements to every member's home page." },
            ].map(({ to, icon: Icon, title, text }) => (
              <Link key={to} to={to} className="card group flex items-start gap-4 p-5 transition-shadow hover:shadow-raised">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] text-ink font-display">{title}<ArrowRight className="h-4 w-4 text-ink/35 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" /></span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink/60">{text}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
