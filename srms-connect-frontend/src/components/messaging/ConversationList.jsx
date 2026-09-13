import { useEffect, useMemo, useState } from "react";
import ConversationItem from "./ConversationItem";
import { ConversationListSkeleton } from "./MessagingSkeletons";
import { SearchIcon } from "./icons";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
];

export default function ConversationList({
  conversations,
  loading,
  error,
  activeConversationId,
  onlineUserIds,
  onSelect,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // debounce the search box — no backend search API for this, so we
  // filter client-side, but still avoid re-filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = useMemo(() => {
    let list = conversations;

    if (filter === "unread") {
      list = list.filter((c) => c.unreadCount > 0);
    }

    if (debouncedSearch) {
      list = list.filter((c) => {
        const name = c.otherUser.full_name?.toLowerCase() || "";
        const preview = c.lastMessage?.content?.toLowerCase() || "";
        return name.includes(debouncedSearch) || preview.includes(debouncedSearch);
      });
    }

    return list;
  }, [conversations, filter, debouncedSearch]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#1B2438]/10">
        <h1
          className="text-xl text-[#1B2438]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Messaging
        </h1>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#1B2438]/12 px-3 py-2 focus-within:border-[#C98A2B]">
          <SearchIcon className="text-[#1B2438]/35" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search messages"
            className="flex-1 bg-transparent text-sm text-[#1B2438] placeholder:text-[#1B2438]/40 outline-none"
          />
        </div>

        <div className="mt-3 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-[#1B2438] text-white"
                  : "bg-[#1B2438]/5 text-[#1B2438]/60 hover:bg-[#1B2438]/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ConversationListSkeleton />
        ) : error ? (
          <p className="px-4 py-6 text-sm text-[#B3432B]">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#1B2438]">
              {conversations.length === 0 ? "No conversations yet" : "No matches"}
            </p>
            <p className="mt-1 text-xs text-[#1B2438]/50">
              {conversations.length === 0
                ? "Connect with alumni and start a conversation."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-0.5">
            {filtered.map((c) => (
              <ConversationItem
                key={c.conversationId}
                conversation={c}
                active={c.conversationId === activeConversationId}
                online={onlineUserIds.has(c.otherUser.id)}
                onClick={() => onSelect(c.conversationId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
