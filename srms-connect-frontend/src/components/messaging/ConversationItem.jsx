import Avatar from "../profile/Avatar";
import { formatConversationTime } from "../../utils/formatTime";

export default function ConversationItem({ conversation, active, online, onClick }) {
  const { otherUser, lastMessage, unreadCount } = conversation;
  const currentUserId = Number(localStorage.getItem("userId"));
  const isMine = lastMessage?.senderId === currentUserId;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors ${
        active ? "bg-[#C98A2B]/10" : "hover:bg-[#1B2438]/5"
      }`}
    >
      <Avatar photoUrl={otherUser.profile_photo} fullName={otherUser.full_name} size={44} online={online} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate ${
              unreadCount > 0 ? "font-semibold text-[#1B2438]" : "font-medium text-[#1B2438]/90"
            }`}
          >
            {otherUser.full_name || "Unknown"}
          </p>
          {lastMessage && (
            <span
              className={`text-[11px] shrink-0 ${
                unreadCount > 0 ? "text-[#C98A2B] font-medium" : "text-[#1B2438]/40"
              }`}
            >
              {formatConversationTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={`text-xs truncate ${
              unreadCount > 0 ? "text-[#1B2438]/80" : "text-[#1B2438]/45"
            }`}
          >
            {lastMessage
              ? `${isMine ? "You: " : ""}${lastMessage.content}`
              : "Say hello \u{1F44B}"}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-[#C98A2B] text-white text-[11px] font-medium flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
