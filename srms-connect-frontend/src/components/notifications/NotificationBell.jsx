import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useNotifications from "../../hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import { Bell, BellOff } from "lucide-react";
import { bellLabel, describeNotification, formatBadgeCount } from "../../utils/notificationFormat";

export default function NotificationBell() {
  const { items, unreadCount, status, loadingMore, page, totalPages, actions } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  // close on outside click / Escape (same behaviour as the profile menu)
  useEffect(() => {
    const onOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleItemClick = (notification) => {
    actions.markRead(notification.id);
    setOpen(false);
    const { to, state } = describeNotification(notification);
    if (to) navigate(to, state ? { state } : undefined);
  };

  const badge = formatBadgeCount(unreadCount);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={bellLabel(unreadCount)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${open ? "bg-brand-50 text-brand" : "text-ink/65 hover:bg-ink/[0.06] hover:text-ink"}`}
      >
        <Bell className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
        {badge && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-2 top-[4.25rem] z-50 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-overlay animate-rise sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[25rem]"
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <h2 className="text-[15px] text-ink font-display">Notifications{unreadCount > 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">{unreadCount} new</span>}</h2>
            <button
              type="button"
              onClick={() => actions.markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-brand hover:text-brand-600 disabled:text-ink/30"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto" aria-live="polite">
            {status === "loading" && (
              <div className="space-y-3 px-4 py-4" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3"><div className="skeleton h-10 w-10 !rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-4/5" /><div className="skeleton h-3 w-1/3" /></div></div>
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-ink/60">Couldn't load notifications.</p>
                <button
                  type="button"
                  onClick={() => actions.load()}
                  className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                >
                  Try again
                </button>
              </div>
            )}

            {status === "ready" && items.length === 0 && (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.05] text-ink/40"><BellOff className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" /></span>
                <p className="text-sm font-semibold text-ink">You're all caught up</p>
                <p className="mt-1 text-xs text-ink/50">New activity will show up here.</p>
              </div>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-ink/5">
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
                ))}
              </ul>
            )}

            {items.length > 0 && page < totalPages && (
              <div className="border-t border-ink/5 p-2 text-center">
                <button
                  type="button"
                  onClick={() => actions.loadMore()}
                  disabled={loadingMore}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
