export default function EmptyChat() {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center bg-[#F5F6F8]">
      <div className="text-center max-w-xs">
        <div
          className="mx-auto h-14 w-14 rounded-full bg-[#1B2438]/8 flex items-center justify-center text-[#1B2438]/40 text-2xl"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          S
        </div>
        <p className="mt-4 text-sm font-medium text-[#1B2438]">
          Select a conversation
        </p>
        <p className="mt-1 text-xs text-[#1B2438]/50">
          Choose someone from your connections to start chatting.
        </p>
      </div>
    </div>
  );
}
