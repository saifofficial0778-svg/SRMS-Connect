import Avatar from "../profile/Avatar";
import { formatConversationTime } from "../../utils/formatTime";

export default function ConversationItem({ conversation, active, online, onClick }) {
  const { otherUser, lastMessage, unreadCount } = conversation;
  const currentUserId = Number(localStorage.getItem("userId"));
  const isMine = lastMessage?.senderId === currentUserId;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-colors ${
        active ? "bg-brand-50" : "hover:bg-ink/[0.04]"
      }`}
    >
      <Avatar photoUrl={otherUser.profile_photo} fullName={otherUser.full_name} size={44} online={online} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate ${
              unreadCount > 0 ? "font-semibold text-ink" : "font-medium text-ink/90"
            }`}
          >
            {otherUser.full_name || "Unknown"}
          </p>
          {lastMessage && (
            <span
              className={`text-[11px] shrink-0 ${
                unreadCount > 0 ? "font-semibold text-brand" : "text-ink/40"
              }`}
            >
              {formatConversationTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={`text-xs truncate ${
              unreadCount > 0 ? "text-ink/80" : "text-ink/45"
            }`}
          >
            {lastMessage
              ? `${isMine ? "You: " : ""}${lastMessage.content}`
              : "Say hello \u{1F44B}"}
          </p>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
