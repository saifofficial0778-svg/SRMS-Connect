import { useEffect, useState } from "react";
import { CalendarDays, Megaphone, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { createSpotlight, deleteSpotlight, manageList, setSpotlightStatus, updateSpotlight } from "../../services/spotlightService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import Button, { IconButton } from "../../components/ui/Button";
import Drawer from "../../components/ui/Drawer";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Badge, EmptyState, ErrorState, Field, Input, PageHeader, Pager, Select, SkeletonCard, Tabs, Textarea } from "../../components/ui/Primitives";
import { SpotlightItem } from "../../components/home/HomeRail";
import { extractFieldErrors } from "../../utils/jobFormat";
import {
  SPOTLIGHT_CATEGORIES,
  SPOTLIGHT_FILTERS,
  categoryLabel,
  spotlightActions,
  spotlightState,
  spotlightToForm,
  spotlightToPayload,
  validateSpotlightForm,
  whenLabel,
  whereLabel,
} from "../../utils/spotlightFormat";

// ---------- the create / edit form, in a drawer so the list stays in view ----------
function SpotlightForm({ spotlight, onClose, onSaved, showToast }) {
  const editing = Boolean(spotlight);
  const [form, setForm] = useState(() => spotlightToForm(spotlight));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(null); // which button is working

  const set = (name) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  // status is decided by the button pressed; editing keeps the current one unless "Publish" is used
  const save = async (status) => {
    const found = validateSpotlightForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(status || "save");
    try {
      const payload = spotlightToPayload(form, status);
      if (editing) await updateSpotlight(spotlight.id, payload);
      else await createSpotlight(payload);
      showToast(status === "PUBLISHED" ? "Published." : editing ? "Changes saved." : "Saved as a draft.");
      onSaved();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(err?.response?.data?.message || "Couldn't save. Please try again.", "error");
    } finally {
      setSaving(null);
    }
  };

  const preview = { ...spotlightToPayload(form), id: 0, title: form.title || "Your title", description: form.description || "A short description appears here." };

  return (
    <Drawer
      title={editing ? "Edit spotlight" : "New spotlight"}
      description="Shown on every member's home page while it is published and has not ended."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={Boolean(saving)}>Cancel</Button>
          {editing ? (
            <Button variant="secondary" onClick={() => save()} loading={saving === "save"} disabled={Boolean(saving)}>Save changes</Button>
          ) : (
            <Button variant="secondary" onClick={() => save("DRAFT")} loading={saving === "DRAFT"} disabled={Boolean(saving)}>Save as draft</Button>
          )}
          {(!editing || spotlight.status !== "PUBLISHED") && (
            <Button onClick={() => save("PUBLISHED")} loading={saving === "PUBLISHED"} disabled={Boolean(saving)}>{form.publish_at ? "Schedule" : "Publish"}</Button>
          )}
        </>
      }
    >
      <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <Field label="Title" error={errors.title}>
          <Input value={form.title} onChange={set("title")} maxLength={120} placeholder="Campus Placement Drive 2026" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>
            <Select value={form.category} onChange={set("category")}>
              {SPOTLIGHT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Location" optional error={errors.location}>
            <Input value={form.location} onChange={set("location")} maxLength={150} placeholder="Seminar Hall 2" />
          </Field>
        </div>
        <Field label="Description" error={errors.description} hint={`${form.description.trim().length}/600 characters`}>
          <Textarea value={form.description} onChange={set("description")} rows={4} maxLength={600} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" optional error={errors.starts_at}>
            <Input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} />
          </Field>
          <Field label="Ends" optional error={errors.ends_at} hint="The card disappears on its own once this passes.">
            <Input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} min={form.starts_at || undefined} />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink/80">
          <input type="checkbox" checked={form.is_online} onChange={set("is_online")} className="h-4 w-4 rounded accent-brand" />
          This happens online
        </label>
        <Field label="Banner image link" optional error={errors.image_url} hint="A secure https:// link to an image. Without one, the card shows the date.">
          <Input type="url" value={form.image_url} onChange={set("image_url")} placeholder="https://" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text" optional error={errors.cta_label}>
            <Input value={form.cta_label} onChange={set("cta_label")} maxLength={40} placeholder="Register" />
          </Field>
          <Field label="Button link" optional error={errors.cta_url}>
            <Input type="url" value={form.cta_url} onChange={set("cta_url")} placeholder="https://" />
          </Field>
        </div>
        <Field label="Publish at" optional error={errors.publish_at} hint="Leave empty to show it as soon as it is published.">
          <Input type="datetime-local" value={form.publish_at} onChange={set("publish_at")} />
        </Field>

        <div>
          <p className="eyebrow mb-2">Preview</p>
          <div className="card p-4"><SpotlightItem spotlight={preview} /></div>
        </div>
      </form>
    </Drawer>
  );
}

// ---------- one row: what it is, what members see of it, what can be done ----------
function SpotlightRow({ spotlight, busy, onEdit, onStatus, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const state = spotlightState(spotlight);
  const when = whenLabel(spotlight.starts_at, spotlight.ends_at);
  const where = whereLabel(spotlight);
  const [primary, ...others] = spotlightActions(spotlight);

  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={state.label} tone={state.tone} />
          <span className="eyebrow">{categoryLabel(spotlight.category)}</span>
        </div>
        <h3 className="mt-1.5 text-[15px] font-semibold text-ink">{spotlight.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/65 line-clamp-2">{spotlight.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/55">
          {when && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.9} aria-hidden="true" />{when}</span>}
          {where && <span>{where}</span>}
          <span className="text-ink/40">{state.hint}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant={primary.status === "PUBLISHED" ? "primary" : "secondary"} size="sm" loading={busy} onClick={() => onStatus(primary.status)}>{primary.label}</Button>
        <IconButton icon={Pencil} label="Edit" variant="secondary" size="sm" onClick={onEdit} />
        <div className="relative">
          <IconButton icon={MoreHorizontal} label="More actions" variant="secondary" size="sm" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-ink/10 bg-white p-1 shadow-overlay animate-rise">
                {others.map((action) => (
                  <button key={action.status} role="menuitem" onClick={() => { setMenuOpen(false); onStatus(action.status); }} className="flex w-full rounded-md px-3 py-2 text-left text-sm text-ink/85 hover:bg-ink/[0.05]">{action.label}</button>
                ))}
                <button role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger-50">
                  <Trash2 className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AdminSpotlightsPage() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: null, status: "loading", data: null });
  const [formFor, setFormFor] = useState(null); // null = closed, "new", or the spotlight being edited
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { toasts, showToast, dismiss } = useToast();

  const requestKey = `${filter}|${page}#${tick}`;
  useEffect(() => {
    let cancelled = false;
    manageList({ status: filter }, page, 10)
      .then((data) => !cancelled && setResult({ key: requestKey, status: "success", data }))
      .catch(() => !cancelled && setResult((r) => ({ ...r, key: requestKey, status: "error" })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const refresh = () => setTick((n) => n + 1);
  const status = result.key === requestKey ? result.status : result.data ? "refreshing" : "loading";
  const data = result.data;

  const changeStatus = async (spotlight, next) => {
    setBusyId(spotlight.id);
    try {
      await setSpotlightStatus(spotlight.id, next);
      showToast(next === "PUBLISHED" ? "Published." : next === "ARCHIVED" ? "Archived." : "Moved to drafts.");
    } catch (err) {
      showToast(err?.response?.data?.message || "That didn't work. Please try again.", "error");
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const confirmDelete = async () => {
    setBusyId(deleting.id);
    try {
      await deleteSpotlight(deleting.id);
      showToast("Deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't delete.", "error");
    } finally {
      setBusyId(null);
      setDeleting(null);
      refresh();
    }
  };

  const tabs = SPOTLIGHT_FILTERS.map((f) => ({ ...f, count: f.value && data ? data.counts[f.value] : 0 }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin console"
        title="Campus Spotlight"
        subtitle="Events, placement drives and announcements shown on every member's home page."
        actions={<Button icon={Plus} onClick={() => setFormFor("new")}>New spotlight</Button>}
      />

      <Tabs tabs={tabs} value={filter} onChange={(value) => { setFilter(value); setPage(1); }} label="Filter by status" />

      {status === "loading" && <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>}
      {status === "error" && <ErrorState title="Couldn't load spotlights" onRetry={refresh} />}

      {data && status !== "error" && data.spotlights.length === 0 && (
        <EmptyState icon={Megaphone} title={filter ? "Nothing here" : "No spotlights yet"} action={<Button icon={Plus} onClick={() => setFormFor("new")}>Create the first one</Button>}>
          {filter ? "No spotlight has this status." : "Announce an event, a placement drive or a workshop to the whole SRMS community."}
        </EmptyState>
      )}

      {data && status !== "error" && data.spotlights.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.spotlights.map((spotlight) => (
              <SpotlightRow
                key={spotlight.id}
                spotlight={spotlight}
                busy={busyId === spotlight.id}
                onEdit={() => setFormFor(spotlight)}
                onStatus={(next) => changeStatus(spotlight, next)}
                onDelete={() => setDeleting(spotlight)}
              />
            ))}
          </ul>
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {formFor && (
        <SpotlightForm
          key={formFor === "new" ? "new" : formFor.id}
          spotlight={formFor === "new" ? null : formFor}
          showToast={showToast}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this spotlight?"
        description={`"${deleting?.title || ""}" will be removed for everyone. This can't be undone - archive it instead if you may need it again.`}
        confirmLabel="Delete"
        busy={Boolean(deleting) && busyId === deleting.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
