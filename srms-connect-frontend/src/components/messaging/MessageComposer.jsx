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
    <div className="flex items-end gap-2.5 px-4 py-3 border-t border-ink/10">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={stopTypingNow}
        placeholder="Write a message"
        aria-label="Message"
        rows={1}
        maxLength={2000}
        className="max-h-[120px] flex-1 resize-none rounded-lg border border-ink/15 bg-canvas/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/45 transition-colors focus:border-brand/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-40 disabled:hover:bg-brand"
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </div>
  );
}
