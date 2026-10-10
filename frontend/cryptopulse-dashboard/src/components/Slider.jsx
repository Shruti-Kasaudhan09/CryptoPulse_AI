import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Accessible slide carousel.
 *  - tabs (numbered) + prev/next arrows + dots
 *  - keyboard ← / → when focused, swipe on touch screens
 *  - optional autoplay that pauses on hover/focus and stops for good once the
 *    viewer takes control (so it never yanks a chart away mid-read)
 *  - the frame animates its height to fit the active slide
 */
function readSaved(key, n) {
  try {
    const v = Number(sessionStorage.getItem(key));
    return Number.isInteger(v) && v >= 0 && v < n ? v : 0;
  } catch {
    return 0;
  }
}

export default function Slider({ slides, autoplayMs = 9000, label = "Slides", storageKey = "cp-slide" }) {
  // remember the slide when switching coins (the page remounts per coin)
  const [index, setIndex] = useState(() => readSaved(storageKey, slides.length));
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [height, setHeight] = useState(undefined);
  const slideRefs = useRef([]);
  const touch = useRef(null);
  const n = slides.length;

  const go = useCallback((i, byUser = true) => {
    const next = ((i % n) + n) % n;
    setIndex(next);
    try { sessionStorage.setItem(storageKey, String(next)); } catch { /* storage unavailable */ }
    if (byUser) setStopped(true);
  }, [n, storageKey]);

  // autoplay
  const running = autoplayMs && !paused && !stopped;
  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => go(index + 1, false), autoplayMs);
    return () => clearTimeout(t);
  }, [running, index, autoplayMs, go]);

  // animate frame height to the active slide
  useLayoutEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return undefined;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  const onKey = (e) => {
    if (e.target.closest?.("input, textarea, [role=radiogroup]")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  };

  const Arrow = ({ dir }) => (
    <button
      onClick={() => go(index + dir)}
      className="glass tilt flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink2 hover:text-ink"
      aria-label={dir < 0 ? "Previous slide" : "Next slide"}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir < 0 ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="space-y-5 rounded-2xl outline-none"
    >
      {/* tab rail */}
      <div className="flex items-center gap-3">
        <Arrow dir={-1} />
        <div className="glass flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-2xl p-1.5" role="tablist" aria-label={`${label} navigation`}>
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                aria-controls={`slide-${s.key}`}
                onClick={() => go(i)}
                className={`relative flex min-w-fit flex-1 items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 text-left transition-colors duration-300 ${
                  active ? "bg-white/[0.07] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                <span className={`tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors duration-300 ${
                  active ? "brand-gradient text-white shadow-[0_0_18px_-4px_var(--glow)]" : "bg-white/5"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[13px] font-semibold">{s.tab}</span>
                  <span className="hidden truncate text-[11px] text-muted 2xl:block">{s.hint}</span>
                </span>
                {/* autoplay progress */}
                {active && (
                  <span
                    key={`${index}-${running}`}
                    className="absolute inset-x-2 bottom-0.5 h-0.5 origin-left rounded-full bg-gradient-to-r from-sky-400 to-violet-400"
                    style={running
                      ? { animation: `progress ${autoplayMs}ms linear forwards` }
                      : { transform: "scaleX(1)", opacity: 0.5 }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <Arrow dir={1} />
      </div>

      {/* frame */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ height, transition: "height 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex items-start"
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: "transform 0.7s cubic-bezier(0.65, 0, 0.2, 1)",
          }}
        >
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.key}
                id={`slide-${s.key}`}
                ref={(el) => { slideRefs.current[i] = el; }}
                role="tabpanel"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${s.tab}`}
                aria-hidden={!active}
                inert={active ? undefined : ""}
                className="w-full shrink-0 px-2 pb-8 pt-3"
                style={{
                  opacity: active ? 1 : 0.25,
                  transform: active ? "scale(1)" : "scale(0.96)",
                  transition: "opacity 0.6s ease, transform 0.7s cubic-bezier(0.65, 0, 0.2, 1)",
                }}
              >
                {s.content}
              </div>
            );
          })}
        </div>
      </div>

      {/* dots */}
      <div className="flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.key}
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}: ${s.tab}`}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === index ? "w-8 bg-gradient-to-r from-sky-400 to-violet-400" : "w-2 bg-white/15 hover:bg-white/30"
            }`}
          />
        ))}
        {autoplayMs ? (
          <button
            onClick={() => setStopped((v) => !v)}
            className="ml-2 rounded-md px-2 py-0.5 text-[11px] text-muted hover:text-ink"
            aria-label={stopped ? "Start autoplay" : "Stop autoplay"}
          >
            {stopped ? "▶ Auto" : "❚❚ Auto"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Intro strip shown at the top of each slide. */
export function SlideIntro({ step, total, title, text, points = [], action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 px-1">
      <div className="max-w-2xl">
        <div className="tabular text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
        <h2 className="font-display mt-1 text-2xl font-bold text-ink sm:text-[26px]">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink2">{text}</p>
        {points.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {points.map((p) => (
              <li key={p} className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink2">{p}</li>
            ))}
          </ul>
        )}
      </div>
      {action}
    </div>
  );
}
