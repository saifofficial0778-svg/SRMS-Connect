// Display helpers for people shown in search results, the directory and profiles.

export function headline({ designation, company } = {}) {
  if (designation && company) return `${designation} at ${company}`;
  return designation || company || "";
}

// "Computer Applications · Class of 2024" (alumni) / "Computer Applications · Batch 2025" (students)
export function academicLine({ role, branch, batch_year } = {}) {
  const batch = batch_year ? `${role === "ALUMNI" ? "Class of" : "Batch"} ${batch_year}` : "";
  return [branch, batch].filter(Boolean).join(" · ");
}

// MySQL booleans arrive as 0/1 on some endpoints and true/false on others
export const isVerifiedAlumni = (person) => Boolean(Number(person?.is_verified_alumni));

// short secondary line for the navbar dropdown
export function searchResultSubtitle(person) {
  return headline(person) || academicLine(person) || person?.location || "";
}
