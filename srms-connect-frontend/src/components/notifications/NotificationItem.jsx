import { BadgeCheck, Briefcase, Compass, Eye, Heart, LifeBuoy, MessageCircle, MessageSquare, Share2, UserCheck, UserPlus } from "lucide-react";
import Avatar from "../profile/Avatar";
import { timeAgo } from "../feed/timeAgo";
import { describeNotification } from "../../utils/notificationFormat";

// a small symbol on the avatar says what kind of thing happened before you read the sentence
const TYPE_ICON = {
  CONNECTION_REQUEST: { icon: UserPlus, tone: "bg-brand text-white" },
  CONNECTION_ACCEPTED: { icon: UserCheck, tone: "bg-success text-white" },
  POST_LIKE: { icon: Heart, tone: "bg-danger text-white" },
  POST_COMMENT: { icon: MessageCircle, tone: "bg-brand text-white" },
  NEW_MESSAGE: { icon: MessageSquare, tone: "bg-brand text-white" },
  JOB_POSTED: { icon: Briefcase, tone: "bg-accent text-white" },
  CAREER_REQUEST: { icon: LifeBuoy, tone: "bg-accent text-white" },
  CAREER_UPDATE: { icon: LifeBuoy, tone: "bg-accent text-white" },
  MENTORSHIP_REQUEST: { icon: Compass, tone: "bg-brand text-white" },
  MENTORSHIP_UPDATE: { icon: Compass, tone: "bg-brand text-white" },
  INTRO_REQUEST: { icon: Share2, tone: "bg-brand text-white" },
  INTRO_UPDATE: { icon: Share2, tone: "bg-brand text-white" },
  PROFILE_VIEW: { icon: Eye, tone: "bg-ink text-white" },
  ACCOUNT_STATUS: { icon: BadgeCheck, tone: "bg-success text-white" },
};

export default function NotificationItem({ notification, onClick }) {
  const { actorName, message, preview } = describeNotification(notification);
  const { actor, is_read: isRead, created_at: createdAt, type } = notification;
  // system notices carry the message itself; person notices read "<name> <message>"
  const isSystem = !actor;
  const mark = TYPE_ICON[type];
  const MarkIcon = mark?.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(notification)}
        className={`relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.04] ${isRead ? "" : "bg-brand-50/70"}`}
      >
        {!isRead && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" aria-hidden="true" />}

        <span className="relative shrink-0">
          {isSystem ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden="true">S</span>
          ) : (
            <Avatar photoUrl={actor.profile_photo} fullName={actor.full_name} size={40} />
          )}
          {MarkIcon && (
            <span className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-white ${mark.tone}`} aria-hidden="true">
              <MarkIcon className="h-2.5 w-2.5" strokeWidth={2.4} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className={`block text-[13.5px] leading-snug ${isRead ? "text-ink/70" : "text-ink/90"}`}>
            {isSystem ? message : <><span className="font-semibold text-ink">{actorName}</span> {message}</>}
          </span>
          {preview && <span className="mt-0.5 block truncate text-xs text-ink/55">&ldquo;{preview}&rdquo;</span>}
          <span className={`mt-1 block text-xs ${isRead ? "text-ink/45" : "font-medium text-brand"}`}>{timeAgo(createdAt)}</span>
        </span>

        {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" role="img" aria-label="Unread" />}
      </button>
    </li>
  );
}
