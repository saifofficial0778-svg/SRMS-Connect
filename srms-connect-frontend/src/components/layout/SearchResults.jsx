import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import { UserIcon, DocumentIcon } from "./navIcons";
import { isVerifiedAlumni, searchResultSubtitle } from "../../utils/personFormat";

const TABS = ["All", "People", "Posts"];

// status comes from searchFlow: idle | too-short | loading | success | error
export default function SearchResults({ query, status, results, onSelect }) {
  const [tab, setTab] = useState("All");
  const navigate = useNavigate();

  const { people = [], posts = [] } = results || {};
  const totalCount = people.length + posts.length;

  const showPeople = tab === "All" || tab === "People";
  const showPosts = tab === "All" || tab === "Posts";

  const goTo = (path) => {
    onSelect?.();
    navigate(path);
  };

  const message =
    status === "idle" ? "Start typing to search SRMS Connect"
    : status === "too-short" ? "Type at least 2 characters"
    : status === "loading" ? "Searching..."
    : status === "error" ? "Search failed. Please try again."
    : status === "success" && totalCount === 0 ? `No results found for "${query}"`
    : null;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 min-w-[18rem] rounded-xl border border-[#1B2438]/10 bg-white shadow-xl overflow-hidden z-50">
      {/* Category tabs */}
      <div className="flex items-center gap-1 px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t
                ? "bg-[#1B2438] text-white"
                : "text-[#1B2438]/60 hover:bg-[#1B2438]/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto p-2" aria-live="polite">
        {message && (
          <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">{message}</p>
        )}

        {status === "success" && totalCount > 0 && (
          <>
            {showPeople && people.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[#1B2438]/40 uppercase flex items-center gap-1.5">
                  <UserIcon /> People
                </p>
                {people.map((person) => (
                  <button
                    key={person.user_id}
                    onClick={() => goTo(`/profile/${person.user_id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1B2438]/5 text-left"
                  >
                    <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={32} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-[#1B2438]">
                        <span className="truncate">{person.full_name}</span>
                        {isVerifiedAlumni(person) && <VerifiedBadge compact />}
                      </p>
                      <p className="text-xs text-[#1B2438]/50 truncate">{searchResultSubtitle(person)}</p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => goTo(`/alumni?q=${encodeURIComponent(query)}&role=ALL`)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#C98A2B] hover:text-[#B37A22]"
                >
                  See all people for "{query}"
                </button>
              </div>
            )}

            {showPosts && posts.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[#1B2438]/40 uppercase flex items-center gap-1.5">
                  <DocumentIcon /> Posts
                </p>
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => goTo("/home")}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#1B2438]/5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[#1B2438] line-clamp-2">"{post.content}"</p>
                      <p className="text-xs text-[#1B2438]/50 truncate">
                        Posted by {post.full_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* the active tab has nothing, but another one does */}
            {((tab === "People" && people.length === 0) || (tab === "Posts" && posts.length === 0)) && (
              <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">
                No {tab.toLowerCase()} found for "{query}"
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
