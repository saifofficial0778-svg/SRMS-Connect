const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["#B3432B", "#B3432B", "#C98A2B", "#3F6B52", "#3F6B52"];

function getStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0–4
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const score = getStrength(password);

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: i < score ? COLORS[score] : "#1B24381A",
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs" style={{ color: COLORS[score] }}>
        {LABELS[score]}
      </p>
    </div>
  );
}
