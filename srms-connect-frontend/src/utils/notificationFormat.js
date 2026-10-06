// Turns a notification from the API into what the UI shows and where a click should go.
// Pure (no React / router imports) so it is unit tested with plain Node.

import { careerNotificationText } from "./careerFormat.js";
import { introNotificationText, mentorshipNotificationText } from "./mentorshipFormat.js";

const SYSTEM_NAME = "SRMS Connect";

// -> { actorName, message, preview, to, state }
//   actorName  bold name shown before the message ("SRMS Connect" for system notices)
//   message    the sentence after the name
//   preview    optional quoted snippet (comment / message text)
//   to, state  arguments for react-router's navigate(to, { state })
export function describeNotification(notification) {
  const { type, actor, extra, reference_id: referenceId } = notification || {};
  const actorName = actor?.full_name || "Someone";

  switch (type) {
    case "CONNECTION_REQUEST":
      return {
        actorName,
        message: "sent you a connection request",
        to: "/network",
        state: { tab: "received" },
      };

    case "CONNECTION_ACCEPTED":
      return {
        actorName,
        message: "accepted your connection request",
        to: actor ? `/profile/${actor.user_id}` : "/network",
      };

    case "POST_LIKE":
      return { actorName, message: "liked your post", to: "/home" };

    case "POST_COMMENT":
      return { actorName, message: "commented on your post", preview: extra || "", to: "/home" };

    case "NEW_MESSAGE":
      return {
        actorName,
        message: "sent you a message",
        preview: extra || "",
        to: "/chat",
        state: { conversationId: referenceId, userId: actor?.user_id },
      };

    case "JOB_POSTED":
      return {
        actorName,
        message: "posted a new job",
        preview: extra || "",
        to: referenceId ? `/jobs/${referenceId}` : "/jobs",
      };

    case "CAREER_REQUEST":
    case "CAREER_UPDATE": {
      // no actor = closed by the system (e.g. the job was removed)
      const system = !actor;
      const { message, preview } = careerNotificationText(type, extra, { system });
      return {
        actorName: system ? SYSTEM_NAME : actorName,
        message,
        preview,
        to: referenceId ? `/career/requests/${referenceId}` : "/career",
      };
    }

    case "MENTORSHIP_REQUEST":
    case "MENTORSHIP_UPDATE": {
      const { message, preview } = mentorshipNotificationText(type, extra);
      return {
        actorName,
        message,
        preview,
        to: referenceId ? `/mentorship/requests/${referenceId}` : "/mentorship/dashboard",
      };
    }

    case "INTRO_REQUEST":
    case "INTRO_UPDATE": {
      const { message, preview } = introNotificationText(type, extra);
      return {
        actorName,
        message,
        preview,
        to: referenceId ? `/mentorship/intros/${referenceId}` : "/mentorship/intros",
      };
    }

    case "ACCOUNT_STATUS":
      return {
        actorName: SYSTEM_NAME,
        message:
          extra === "APPROVED"
            ? "Your account has been approved. Welcome!"
            : "Your account has been reinstated.",
        to: "/home",
      };

    default:
      return { actorName: SYSTEM_NAME, message: "You have a new notification", to: null };
  }
}

// "99+" so the badge never grows wider than the bell
export function formatBadgeCount(count) {
  if (!count || count < 1) return "";
  return count > 99 ? "99+" : String(count);
}

export function bellLabel(unreadCount) {
  return unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
}
