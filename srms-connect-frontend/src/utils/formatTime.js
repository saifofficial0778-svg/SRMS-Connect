// Used in the conversation list ("5:41 PM" for today, "Aug 31" otherwise)
export function formatConversationTime(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Used under each message bubble ("5:41 PM")
export function formatClock(dateInput) {
  if (!dateInput) return "";
  return new Date(dateInput).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Used as a day divider in the message list ("Today", "Yesterday", "Sep 2")
export function formatDayLabel(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function isSameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
