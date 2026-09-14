import { useEffect, useState, useCallback } from "react";

function ChevronLeft(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Lightbox({ media, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);

  const goPrev = useCallback(() => {
    setIndex((i) => (i === 0 ? media.length - 1 : i - 1));
  }, [media.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i === media.length - 1 ? 0 : i + 1));
  }, [media.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, onClose]);

  const item = media[index];
  const isVideo = item.type === "VIDEO" || item.type === "video";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      {media.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 sm:left-6 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video src={item.url} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-lg" />
        ) : (
          <img src={item.url} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
        )}
      </div>

      {media.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 sm:right-6 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {media.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm">
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

export default function MediaGrid({ media }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!media || media.length === 0) return null;

  const openAt = (index) => setLightboxIndex(index);

  const renderCroppedItem = (item, index, extraClass = "") => {
    const isVideo = item.type === "VIDEO" || item.type === "video";
    return (
      <button
        key={item.id || item.url}
        type="button"
        onClick={() => openAt(index)}
        className={`relative overflow-hidden bg-[#1B2438]/5 text-left ${extraClass}`}
      >
        {isVideo ? (
          <video src={item.url} className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" />
        )}
      </button>
    );
  };

  const count = media.length;

  return (
    <>
      {/* Single image/video — shown at natural aspect ratio, nothing cropped.
          object-contain + a background so letterboxing (if any) looks intentional. */}
      {count === 1 && (
        <button
          type="button"
          onClick={() => openAt(0)}
          className="block w-full rounded-xl overflow-hidden mt-3 bg-[#1B2438]/5 max-h-[600px]"
        >
          {(media[0].type === "VIDEO" || media[0].type === "video") ? (
            <video
              src={media[0].url}
              controls
              className="w-full max-h-[600px] object-contain bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={media[0].url}
              alt=""
              className="w-full max-h-[600px] object-contain"
            />
          )}
        </button>
      )}

      {count === 2 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3">
          {media.map((item, i) => renderCroppedItem(item, i, "aspect-square"))}
        </div>
      )}

      {count === 3 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3 h-80">
          {renderCroppedItem(media[0], 0, "row-span-2")}
          {renderCroppedItem(media[1], 1)}
          {renderCroppedItem(media[2], 2)}
        </div>
      )}

      {count >= 4 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3 h-80">
          {media.slice(0, 4).map((item, i) => {
            const isLastVisible = i === 3 && count > 4;
            const isVideo = item.type === "VIDEO" || item.type === "video";
            return (
              <button
                type="button"
                key={item.id || item.url}
                onClick={() => openAt(i)}
                className="relative w-full h-full text-left"
              >
                {isVideo ? (
                  <video src={item.url} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
                {isLastVisible && (
                  <div className="absolute inset-0 bg-[#1B2438]/60 flex items-center justify-center text-white text-lg font-medium">
                    +{count - 4}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox media={media} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}