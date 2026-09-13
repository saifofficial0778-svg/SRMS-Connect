import Avatar from "../profile/Avatar";
import { BackIcon } from "./icons";

export default function ChatHeader({ otherUser, online, isTyping, onBack }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1B2438]/10">
      <button
        onClick={onBack}
        className="md:hidden h-8 w-8 flex items-center justify-center rounded-full text-[#1B2438]/60 hover:bg-[#1B2438]/5 shrink-0"
        aria-label="Back to conversations"
      >
        <BackIcon />
      </button>

      <Avatar photoUrl={otherUser.profile_photo} fullName={otherUser.full_name} size={38} />

      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1B2438] truncate">
          {otherUser.full_name || "Unknown"}
        </p>
        {isTyping ? (
          <p className="text-xs text-[#C98A2B] font-medium">Typing...</p>
        ) : (
          <p className={`text-xs ${online ? "text-[#3F6B52]" : "text-[#1B2438]/40"}`}>
            {online ? "Online" : "Offline"}
          </p>
        )}
      </div>
    </div>
  );
}
