import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useNotifications from "../../hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import { BellIcon } from "../layout/navIcons";
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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#1B2438]/70 hover:bg-[#1B2438]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C98A2B]"
      >
        <BellIcon />
        {badge && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C98A2B] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#1B2438]/10 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[#1B2438]/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-[#1B2438]">Notifications</h2>
            <button
              type="button"
              onClick={() => actions.markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-[#C98A2B] hover:text-[#B37A22] disabled:text-[#1B2438]/30"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto" aria-live="polite">
            {status === "loading" && (
              <p className="px-4 py-8 text-center text-sm text-[#1B2438]/45">Loading...</p>
            )}

            {status === "error" && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[#1B2438]/60">Couldn't load notifications.</p>
                <button
                  type="button"
                  onClick={() => actions.load()}
                  className="mt-3 rounded-lg bg-[#1B2438] px-3 py-1.5 text-xs text-white hover:bg-[#141B2C]"
                >
                  Try again
                </button>
              </div>
            )}

            {status === "ready" && items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-[#1B2438]">You're all caught up</p>
                <p className="mt-1 text-xs text-[#1B2438]/50">New activity will show up here.</p>
              </div>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-[#1B2438]/5">
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
                ))}
              </ul>
            )}

            {items.length > 0 && page < totalPages && (
              <div className="border-t border-[#1B2438]/5 p-2 text-center">
                <button
                  type="button"
                  onClick={() => actions.loadMore()}
                  disabled={loadingMore}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-50"
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
