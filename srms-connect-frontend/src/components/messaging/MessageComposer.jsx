import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./icons";

const TYPING_IDLE_MS = 1500;

export default function MessageComposer({ onSend, onTypingStart, onTypingStop, disabled }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (isTypingRef.current) onTypingStop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoGrow = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    autoGrow(e.target);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.();
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop?.();
    }, TYPING_IDLE_MS);
  };

  const stopTypingNow = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    stopTypingNow();
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2.5 px-4 py-3 border-t border-[#1B2438]/10">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={stopTypingNow}
        placeholder="Write a message..."
        rows={1}
        maxLength={2000}
        className="flex-1 resize-none rounded-2xl border border-[#1B2438]/15 px-4 py-2.5 text-sm text-[#1B2438] outline-none focus:border-[#C98A2B] max-h-[120px]"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="h-10 w-10 shrink-0 rounded-full bg-[#C98A2B] text-white flex items-center justify-center hover:bg-[#B37A22] disabled:opacity-40 disabled:hover:bg-[#C98A2B] transition-colors"
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </div>
  );
}
