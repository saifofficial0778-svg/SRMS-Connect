export default function MediaGrid({ media }) {
  if (!media || media.length === 0) return null;

  const renderItem = (item, extraClass = "") => {
    const isVideo = item.type === "VIDEO" || item.type === "video";
    return (
      <div key={item.id || item.url} className={`relative overflow-hidden bg-[#1B2438]/5 ${extraClass}`}>
        {isVideo ? (
          <video src={item.url} controls className="w-full h-full object-cover" />
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" />
        )}
      </div>
    );
  };

  const count = media.length;

  if (count === 1) {
    return (
      <div className="rounded-xl overflow-hidden mt-3 max-h-[420px]">
        {renderItem(media[0], "aspect-[4/3] max-h-[420px]")}
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3">
        {media.map((item) => renderItem(item, "aspect-square"))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3 h-72">
        {renderItem(media[0], "row-span-2")}
        {renderItem(media[1])}
        {renderItem(media[2])}
      </div>
    );
  }

  // 4 or 5 — show first 4 in a grid, with a "+N" overlay if there are more
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden mt-3 h-72">
      {media.slice(0, 4).map((item, i) => {
        const isLastVisible = i === 3 && count > 4;
        return (
          <div key={item.id || item.url} className="relative">
            {renderItem(item, "w-full h-full")}
            {isLastVisible && (
              <div className="absolute inset-0 bg-[#1B2438]/60 flex items-center justify-center text-white text-lg font-medium">
                +{count - 4}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}