import { formatClock } from "../../utils/formatTime";
import { ClockIcon, CheckIcon, DoubleCheckIcon, AlertIcon } from "./icons";

export default function MessageBubble({ message, isMine, showTail, onRetry }) {
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";
  const isSeen = message.status === "seen";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] sm:max-w-[65%] ${showTail ? "" : "opacity-95"}`}>
        <div
          className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMine
              ? `bg-brand text-white ${showTail ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`
              : `bg-ink/[0.06] text-ink ${showTail ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`
          } ${isFailed ? "opacity-60 border border-danger" : ""}`}
        >
          {message.content}
        </div>
        <div
          className={`mt-1 flex items-center gap-1 text-[11px] text-ink/40 ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          {isMine && isSending && <ClockIcon className="w-3 h-3" />}
          {isMine && !isSending && !isFailed && !isSeen && <CheckIcon className="w-3 h-3" />}
          {isMine && isSeen && <DoubleCheckIcon className="w-3.5 h-3.5 text-success" />}
          {isFailed ? (
            <button
              onClick={() => onRetry?.(message)}
              className="flex items-center gap-1 text-danger"
            >
              <AlertIcon className="w-3 h-3" />
              Failed — retry
            </button>
          ) : (
            <span>{formatClock(message.created_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
