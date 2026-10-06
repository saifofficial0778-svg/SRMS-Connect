import Avatar from "../profile/Avatar";
import { timeAgo } from "../feed/timeAgo";
import { describeNotification } from "../../utils/notificationFormat";

// round "S" mark for system notices (account approved etc.), which have no person behind them
function SystemAvatar() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B2438] text-sm font-semibold text-[#C98A2B]"
      aria-hidden="true"
    >
      S
    </span>
  );
}

export default function NotificationItem({ notification, onClick }) {
  const { actorName, message, preview } = describeNotification(notification);
  const { actor, is_read: isRead, created_at: createdAt } = notification;
  // system notices carry the message itself; person notices read "<name> <message>"
  const isSystem = !actor;

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(notification)}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1B2438]/5 ${
          isRead ? "" : "bg-[#C98A2B]/[0.06]"
        }`}
      >
        {isSystem ? (
          <SystemAvatar />
        ) : (
          <span className="shrink-0">
            <Avatar photoUrl={actor.profile_photo} fullName={actor.full_name} size={36} />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug text-[#1B2438]/85">
            {isSystem ? (
              message
            ) : (
              <>
                <span className="font-semibold text-[#1B2438]">{actorName}</span> {message}
              </>
            )}
          </span>
          {preview && (
            <span className="mt-0.5 block truncate text-xs text-[#1B2438]/55">&ldquo;{preview}&rdquo;</span>
          )}
          <span className="mt-0.5 block text-xs text-[#1B2438]/45">{timeAgo(createdAt)}</span>
        </span>

        {!isRead && (
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#C98A2B]"
            role="img"
            aria-label="Unread"
          />
        )}
      </button>
    </li>
  );
}
