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
    <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
      <h2
        className="text-lg text-[#1B2438] border-l-4 border-[#C98A2B] pl-3"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        Open to
      </h2>
      <p className="mt-2 text-sm text-[#1B2438]/55">
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
                  ? "border-[#C98A2B] bg-[#C98A2B] text-white"
                  : "border-[#1B2438]/15 text-[#1B2438]/70 hover:bg-[#1B2438]/5"
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
          className="rounded-lg bg-[#C98A2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B37A22] disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {!dirty && saved.length === 0 && (
          <span className="text-xs text-[#1B2438]/45">Nothing selected yet.</span>
        )}
      </div>
    </section>
  );
}
