import { MessagesSquare } from "lucide-react";

export default function EmptyChat() {
  return (
    <div className="hidden flex-1 items-center justify-center bg-canvas/60 md:flex">
      <div className="max-w-xs text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand">
          <MessagesSquare className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-ink">Your messages</p>
        <p className="mt-1 text-sm leading-relaxed text-ink/55">Choose a conversation, or message one of your connections from their profile.</p>
      </div>
    </div>
  );
}
