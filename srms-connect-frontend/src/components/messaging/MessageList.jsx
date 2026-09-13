import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import { MessageListSkeleton } from "./MessagingSkeletons";
import { formatDayLabel, isSameDay } from "../../utils/formatTime";
import { ChevronDownIcon } from "./icons";

const NEAR_BOTTOM_THRESHOLD = 120;

export default function MessageList({ messages, loading, currentUserId, onRetryMessage }) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLengthRef = useRef(0);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    setIsNearBottom(near);
    if (near) setNewMessagesCount(0);
  };

  const scrollToBottom = (behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewMessagesCount(0);
  };

  useEffect(() => {
    const grew = messages.length > prevLengthRef.current;
    if (grew) {
      const lastMessage = messages[messages.length - 1];
      const isMine = lastMessage?.sender_id === currentUserId;
      if (isNearBottom || isMine) {
        scrollToBottom(prevLengthRef.current === 0 ? "auto" : "smooth");
      } else {
        setNewMessagesCount((c) => c + (messages.length - prevLengthRef.current));
      }
    }
    prevLengthRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  if (loading) return <MessageListSkeleton />;

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-[#1B2438]">No messages yet</p>
          <p className="mt-1 text-xs text-[#1B2438]/50">Start the conversation 👋</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDayDivider = !prev || !isSameDay(prev.created_at, m.created_at);
          const isMine = m.sender_id === currentUserId;
          const next = messages[i + 1];
          const showTail = !next || next.sender_id !== m.sender_id || !isSameDay(next.created_at, m.created_at);

          return (
            <div key={m.id}>
              {showDayDivider && (
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-[#1B2438]/8" />
                  <span className="text-[11px] text-[#1B2438]/40">
                    {formatDayLabel(m.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-[#1B2438]/8" />
                </div>
              )}
              <div className={showTail ? "mb-2.5" : "mb-0.5"}>
                <MessageBubble
                  message={m}
                  isMine={isMine}
                  showTail={showTail}
                  onRetry={onRetryMessage}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {newMessagesCount > 0 && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1B2438] text-white text-xs font-medium shadow-lg"
        >
          <ChevronDownIcon className="w-3.5 h-3.5" />
          New messages
        </button>
      )}
    </div>
  );
}
