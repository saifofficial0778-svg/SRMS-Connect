import { JOB_TYPES } from "../../utils/jobFormat";
import { activeJobFilterCount } from "../../utils/jobParams";
import { SearchIcon } from "../layout/navIcons";

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

// `draft` holds what is typed right now; the page debounces text into the URL / API call.
export default function JobFilters({ draft, onChange, onClear }) {
  const refinements = activeJobFilterCount(draft);

  return (
    <section aria-label="Job filters" className="rounded-2xl border border-[#1B2438]/10 bg-white p-4 sm:p-5">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1B2438]/35">
          <SearchIcon className="w-4 h-4" />
        </span>
        <input
          type="search"
          value={draft.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search jobs by title, company, location or skill"
          aria-label="Search jobs"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Company">
          <input value={draft.company} onChange={(e) => onChange({ company: e.target.value })} placeholder="e.g. Wipro" className={inputClass} />
        </Field>

        <Field label="Location">
          <input value={draft.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="e.g. Noida or Remote" className={inputClass} />
        </Field>

        <Field label="Job type">
          <select value={draft.job_type} onChange={(e) => onChange({ job_type: e.target.value })} className={inputClass}>
            <option value="">Any type</option>
            {JOB_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Your experience (years)">
          <input
            type="number"
            min="0"
            max="40"
            inputMode="numeric"
            value={draft.experience}
            onChange={(e) => onChange({ experience: e.target.value })}
            placeholder="e.g. 2 (0 for freshers)"
            className={inputClass}
          />
        </Field>

        <Field label="Skills (comma separated)">
          <input value={draft.skills} onChange={(e) => onChange({ skills: e.target.value })} placeholder="e.g. React, Node.js" className={inputClass} />
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
