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

// "Aditi Chauhan" -> "Aditi"
export const firstName = (fullName) => String(fullName || "").trim().split(/\s+/)[0] || "this member";

// one line under a name in a suggestion card: work for alumni, studies otherwise
export function suggestionSubtitle(person) {
  return headline(person) || academicLine(person) || (person?.role === "ALUMNI" ? "SRMS alumnus" : "SRMS student");
}

// The button on a suggestion card, from how the viewer stands with that person (decided by the server).
//   kind: "connect" sends a request, "link" goes somewhere, "status" is just a label
export function suggestionAction(relation) {
  switch (relation) {
    case "connected":
      return { kind: "link", label: "View profile", tone: "secondary", to: (person) => `/profile/${person.user_id}` };
    case "sent":
      return { kind: "status", label: "Pending", tone: "muted" };
    case "received":
      // they asked you: the answer is given on the Network page, not by sending a second request
      return { kind: "link", label: "Respond", tone: "primary", to: () => "/network" };
    default:
      return { kind: "connect", label: "Connect", tone: "primary" };
  }
}
