import Avatar from "../profile/Avatar";
import { BackIcon } from "./icons";

export default function ChatHeader({ otherUser, online, isTyping, onBack }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ink/10">
      <button
        onClick={onBack}
        className="md:hidden h-8 w-8 flex items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 shrink-0"
        aria-label="Back to conversations"
      >
        <BackIcon />
      </button>

      <Avatar photoUrl={otherUser.profile_photo} fullName={otherUser.full_name} size={38} online={online} />

      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink">
          {otherUser.full_name || "Unknown"}
        </p>
        {isTyping ? (
          <p className="text-xs font-medium text-brand">Typing…</p>
        ) : (
          <p className={`text-xs ${online ? "font-medium text-success-700" : "text-ink/45"}`}>
            {online ? "Active now" : "Offline"}
          </p>
        )}
      </div>
    </div>
  );
}
