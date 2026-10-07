import { useState } from "react";
import { updateOpenTo } from "../../services/profileService";
import { availableOpenToOptions, sameIntents, toggleIntent } from "../../utils/jobFormat";

// "Open to" career intents on your own profile: toggle options, then save.
export default function OpenToSection({ role, intents, onSaved, showToast }) {
  const [selected, setSelected] = useState(intents || []);
  const [saved, setSaved] = useState(intents || []);
  const [saving, setSaving] = useState(false);

  const options = availableOpenToOptions(role);
  const dirty = !sameIntents(selected, saved);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOpenTo(selected);
      setSaved(selected);
      onSaved?.(selected);
      showToast("Preferences updated.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Couldn't save your preferences.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2
        className="text-lg text-ink border-l-4 border-accent pl-3 font-display"
      >
        Open to
      </h2>
      <p className="mt-2 text-sm text-ink/55">
        Let others know how you can help. These show on your profile and in the directory.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Open to options">
        {options.map(({ value, label, hint }) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelected((cur) => toggleIntent(cur, value))}
              aria-pressed={on}
              title={hint}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? "border-accent bg-brand text-white"
                  : "border-ink/15 text-ink/70 hover:bg-ink/5"
              }`}
            >
              {on && <span aria-hidden="true">{"✓ "}</span>}
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {!dirty && saved.length === 0 && (
          <span className="text-xs text-ink/45">Nothing selected yet.</span>
        )}
      </div>
    </section>
  );
}
