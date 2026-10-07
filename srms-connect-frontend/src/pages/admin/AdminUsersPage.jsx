import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { getUsers, updateUserStatus } from "../../services/adminService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Badge, EmptyState, ErrorState, Field, Input, PageHeader, Pager, Select, Skeleton, Textarea } from "../../components/ui/Primitives";

const STATUS = {
  ACTIVE: { label: "Active", tone: "positive" },
  PENDING: { label: "Pending", tone: "pending" },
  BLOCKED: { label: "Blocked", tone: "negative" },
  REJECTED: { label: "Rejected", tone: "neutral" },
};
const ROLE_LABEL = { STUDENT: "Student", ALUMNI: "Alumni", ADMIN: "Admin" };
const STATUSES = Object.keys(STATUS);
const SEARCH_DEBOUNCE_MS = 350;

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "";
  const role = ["STUDENT", "ALUMNI"].includes(searchParams.get("role")) ? searchParams.get("role") : "";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  const [result, setResult] = useState({ key: null, status: "loading", users: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [tick, setTick] = useState(0);
  const [searchDraft, setSearchDraft] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // user being rejected
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [blocking, setBlocking] = useState(null); // user being blocked
  const typingTimer = useRef(null);
  const { toasts, showToast, dismiss } = useToast();

  // back/forward changes the URL: the search box follows it
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setSearchDraft(search);
  }

  const requestKey = `${status}|${role}|${search}|${page}#${tick}`;
  useEffect(() => {
    let cancelled = false;
    const params = { page, limit: 10 };
    if (role) params.role = role;
    if (status) params.status = status;
    if (search) params.search = search;
    getUsers(params)
      .then((res) => !cancelled && setResult({ key: requestKey, status: "success", users: res?.data?.users || [], pagination: res?.data?.pagination || { page: 1, totalPages: 1, total: 0 } }))
      .catch(() => !cancelled && setResult((r) => ({ ...r, key: requestKey, status: "error" })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const update = (patch) => {
    const next = { status, role, search, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.role) params.set("role", next.role);
    if (next.search) params.set("search", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    setSearchParams(params, { replace: "search" in patch });
  };

  const onSearchChange = (value) => {
    setSearchDraft(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => update({ search: value.trim() }), SEARCH_DEBOUNCE_MS);
  };

  const refresh = () => setTick((n) => n + 1);
  const state = result.key === requestKey ? result.status : result.users.length ? "refreshing" : "loading";

  // one status change at a time; the list is always reloaded so it shows the real state
  const changeStatus = async (user, nextStatus, success, reason) => {
    setBusyId(user.id);
    try {
      await updateUserStatus(user.id, nextStatus, reason);
      showToast(success);
      return true;
    } catch (error) {
      showToast(error.response?.data?.message || "That didn't work. Please try again.", "error");
      return false;
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const confirmReject = async () => {
    if (rejectReason.trim().length < 3) {
      setRejectError("Give a short reason. The applicant sees it when they try to sign in.");
      return;
    }
    if (await changeStatus(rejecting, "REJECTED", "Registration rejected.", rejectReason.trim())) setRejecting(null);
  };

  const { users, pagination } = result;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin console" title="Members" subtitle="Approve new registrations, and block or reinstate accounts." />

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="Status" className="w-full sm:w-44">
          <Select value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </Field>
        <Field label="Role" className="w-full sm:w-40">
          <Select value={role} onChange={(e) => update({ role: e.target.value })}>
            <option value="">All roles</option>
            <option value="STUDENT">Students</option>
            <option value="ALUMNI">Alumni</option>
          </Select>
        </Field>
        <Field label="Search" className="min-w-[14rem] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" strokeWidth={1.9} aria-hidden="true" />
            <Input type="search" value={searchDraft} onChange={(e) => onSearchChange(e.target.value)} placeholder="Enrollment number" className="pl-9" />
          </div>
        </Field>
        {(status || role || search) && <Button variant="ghost" onClick={() => { setSearchDraft(""); setSearchParams(new URLSearchParams()); }}>Clear</Button>}
      </div>

      {state === "error" && <ErrorState title="Couldn't load members" onRetry={refresh} />}

      {state !== "error" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-ink/10 bg-canvas/70 text-left text-xs font-semibold uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-4 py-3">Enrollment</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {state === "loading" &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} aria-busy="true">
                      {Array.from({ length: 6 }).map((__, j) => <td key={j} className="px-4 py-3.5"><Skeleton className="h-4 w-full max-w-[8rem]" /></td>)}
                    </tr>
                  ))}

                {state !== "loading" && users.map((u) => {
                  const meta = STATUS[u.status] || { label: u.status, tone: "neutral" };
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-ink/[0.02]">
                      <td className="px-4 py-3 font-medium tabular-nums text-ink">{u.enrollment}</td>
                      <td className="max-w-[16rem] truncate px-4 py-3 text-ink/70">{u.email}</td>
                      <td className="px-4 py-3 text-ink/75">{ROLE_LABEL[u.role] || u.role}</td>
                      <td className="px-4 py-3"><Badge label={meta.label} tone={meta.tone} /></td>
                      <td className="px-4 py-3 tabular-nums text-ink/55">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          {u.status === "PENDING" && (
                            <>
                              <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setRejecting(u); setRejectReason(""); setRejectError(""); }}>Reject</Button>
                              <Button size="sm" loading={busy} onClick={() => changeStatus(u, "ACTIVE", "Registration approved.")}>Approve</Button>
                            </>
                          )}
                          {u.status === "ACTIVE" && u.role !== "ADMIN" && <Button variant="danger" size="sm" disabled={busy} onClick={() => setBlocking(u)}>Block</Button>}
                          {u.status === "BLOCKED" && <Button variant="secondary" size="sm" loading={busy} onClick={() => changeStatus(u, "ACTIVE", "Account reinstated.")}>Reinstate</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {state !== "loading" && users.length === 0 && (
            <EmptyState icon={Users} title="No members match" compact className="!border-0 !shadow-none">
              Try a different status, role or enrollment number.
            </EmptyState>
          )}

          {users.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 px-4 py-3">
              <p className="text-[13px] text-ink/55">{pagination.total ?? users.length} {pagination.total === 1 ? "member" : "members"}</p>
              <Pager page={pagination.page} totalPages={pagination.totalPages} onChange={(p) => update({ page: p })} className="!pt-0 gap-3" />
            </div>
          )}
        </div>
      )}

      {rejecting && (
        <Modal
          title="Reject this registration?"
          description={`Enrollment ${rejecting.enrollment}`}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="dangerSolid" loading={busyId === rejecting.id} onClick={confirmReject}>Reject registration</Button>
            </>
          }
        >
          <Field label="Reason" error={rejectError} hint="The applicant sees this when they try to sign in.">
            <Textarea value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setRejectError(""); }} rows={3} maxLength={255} autoFocus />
          </Field>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(blocking)}
        title={`Block ${blocking?.enrollment || "this account"}?`}
        description="They are signed out everywhere and can't sign in until an admin reinstates the account."
        confirmLabel="Block account"
        busy={Boolean(blocking) && busyId === blocking.id}
        onConfirm={async () => {
          await changeStatus(blocking, "BLOCKED", "Account blocked.");
          setBlocking(null);
        }}
        onCancel={() => setBlocking(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
