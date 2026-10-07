import { useEffect, useRef } from "react";
import { impressionTracker } from "../../services/analyticsService";

const VISIBLE_SHARE = 0.5; // at least half of the post on screen ...
const DWELL_MS = 1000; // ... for at least a second

// Wraps a post and reports it as "seen" once it has really been on screen. Scrolling past quickly
// does not count, and the author's own posts are never reported (disabled).
export default function ImpressionSentinel({ postId, disabled = false, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (disabled || !node || typeof IntersectionObserver === "undefined") return undefined;

    let timer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // a post taller than the screen can never be half visible, so filling half the screen counts too
        const fillsScreen = entry.intersectionRect.height >= window.innerHeight * VISIBLE_SHARE;
        if (entry.isIntersecting && (entry.intersectionRatio >= VISIBLE_SHARE || fillsScreen)) {
          if (timer === null) {
            timer = setTimeout(() => {
              impressionTracker.seen(postId);
              observer.disconnect();
            }, DWELL_MS);
          }
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.25, VISIBLE_SHARE, 0.75, 1] }
    );
    observer.observe(node);

    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [postId, disabled]);

  return <div ref={ref}>{children}</div>;
}
