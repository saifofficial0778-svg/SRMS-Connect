import { ROLE_OPTIONS, activeFilterCount } from "../../utils/searchParams";
import { SearchIcon } from "../layout/navIcons";
import { OPEN_TO_OPTIONS } from "../../utils/jobFormat";

const inputClass =
  "w-full rounded-lg border border-[#1B2438]/15 bg-white px-3 py-2 text-sm text-[#1B2438] placeholder:text-[#1B2438]/35 focus:outline-none focus:border-[#C98A2B]/60 focus:ring-2 focus:ring-[#C98A2B]/20";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">{label}</span>
      {children}
    </label>
  );
}

// `draft` holds what is typed right now; the page debounces it into the URL/search.
export default function DirectoryFilters({ draft, onChange, onClear, options }) {
  const refinements = activeFilterCount(draft);

  return (
    <section aria-label="Filters" className="rounded-2xl border border-[#1B2438]/10 bg-white p-4 sm:p-5">
      {/* role tabs */}
      <div role="tablist" aria-label="Show" className="inline-flex rounded-lg bg-[#1B2438]/5 p-1">
        {ROLE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={draft.role === value}
            onClick={() => onChange({ role: value })}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              draft.role === value ? "bg-white text-[#1B2438] shadow-sm" : "text-[#1B2438]/55 hover:text-[#1B2438]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* keyword */}
      <div className="relative mt-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1B2438]/35">
          <SearchIcon className="w-4 h-4" />
        </span>
        <input
          type="search"
          value={draft.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search by name, company, designation or skill"
          aria-label="Search people"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Branch">
          <select value={draft.branch} onChange={(e) => onChange({ branch: e.target.value })} className={inputClass}>
            <option value="">All branches</option>
            {options.branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>

        <Field label="Batch / year">
          <select value={draft.batch} onChange={(e) => onChange({ batch: e.target.value })} className={inputClass}>
            <option value="">All years</option>
            {options.batchYears.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </Field>

        <Field label="Open to">
          <select value={draft.openTo} onChange={(e) => onChange({ openTo: e.target.value })} className={inputClass}>
            <option value="">Anything</option>
            {OPEN_TO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Company">
          <input
            value={draft.company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="e.g. Wipro"
            className={inputClass}
          />
        </Field>

        <Field label="Designation">
          <input
            value={draft.designation}
            onChange={(e) => onChange({ designation: e.target.value })}
            placeholder="e.g. Software Developer"
            className={inputClass}
          />
        </Field>

        <Field label="Skills (comma separated)">
          <input
            value={draft.skills}
            onChange={(e) => onChange({ skills: e.target.value })}
            placeholder="e.g. React, Node.js"
            className={inputClass}
          />
        </Field>

        <div className="flex items-end">
          <button
            onClick={onClear}
            disabled={refinements === 0 && !draft.q}
            className="w-full rounded-lg border border-[#1B2438]/15 px-3 py-2 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            Clear filters{refinements > 0 ? ` (${refinements})` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}
