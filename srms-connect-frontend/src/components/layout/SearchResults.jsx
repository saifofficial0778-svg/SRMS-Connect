import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../profile/Avatar";
import { UserIcon, DocumentIcon, BriefcaseIcon } from "./navIcons";

const TABS = ["All", "People", "Posts", "Jobs"];

export default function SearchResults({ query, results, loading, error, onSelect }) {
  const [tab, setTab] = useState("All");
  const navigate = useNavigate();

  const { people = [], posts = [], jobs = [] } = results || {};
  const totalCount = people.length + posts.length + jobs.length;

  const showPeople = tab === "All" || tab === "People";
  const showPosts = tab === "All" || tab === "Posts";
  const showJobs = tab === "All" || tab === "Jobs";

  const goTo = (path) => {
    onSelect?.();
    navigate(path);
  };

  return (
    <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[#1B2438]/10 bg-white shadow-xl overflow-hidden z-50">
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

      <div className="max-h-96 overflow-y-auto p-2">
        {!query && (
          <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">
            Start typing to search SRMS Connect
          </p>
        )}

        {query && loading && (
          <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">
            Searching...
          </p>
        )}

        {query && !loading && error && (
          <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">
            Search isn't available yet.
          </p>
        )}

        {query && !loading && !error && totalCount === 0 && (
          <p className="px-3 py-6 text-center text-sm text-[#1B2438]/40">
            No results found for "{query}"
          </p>
        )}

        {query && !loading && !error && totalCount > 0 && (
          <>
            {showPeople && people.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[#1B2438]/40 uppercase flex items-center gap-1.5">
                  <UserIcon /> People
                </p>
                {/* TODO: there's currently no /profile/:id route — every
                    result lands on your own /profile until one exists. */}
                {people.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => goTo("/profile")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1B2438]/5 text-left"
                  >
                    <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1B2438] truncate">{person.full_name}</p>
                      <p className="text-xs text-[#1B2438]/50 truncate">
                        {[person.designation, person.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showPosts && posts.length > 0 && (
              <div className="mb-2">
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
                      <p className="text-sm text-[#1B2438] truncate">"{post.content}"</p>
                      <p className="text-xs text-[#1B2438]/50 truncate">
                        Posted by {post.full_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showJobs && jobs.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[#1B2438]/40 uppercase flex items-center gap-1.5">
                  <BriefcaseIcon className="w-3.5 h-3.5" /> Jobs
                </p>
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => goTo("/jobs")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1B2438]/5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1B2438] truncate">{job.title}</p>
                      <p className="text-xs text-[#1B2438]/50 truncate">{job.company}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}