import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode[];     // one child per slide
  activeIndex?: number;
  onIndexChange?: (i: number) => void;
  ariaLabel: string;
  testId?: string;
}

export function Carousel({ children, activeIndex, onIndexChange, ariaLabel, testId }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(activeIndex ?? 0);

  // Update index based on scroll position.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slideWidth = el.firstElementChild?.getBoundingClientRect().width ?? 1;
        const gap = parseFloat(getComputedStyle(el).gap || "0");
        const i = Math.round(el.scrollLeft / (slideWidth + gap));
        if (i !== idx) {
          setIdx(i);
          onIndexChange?.(i);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [idx, onIndexChange]);

  // External activeIndex prop → scroll to that slide.
  useEffect(() => {
    if (activeIndex === undefined) return;
    const el = ref.current;
    if (!el) return;
    const slideWidth = el.firstElementChild?.getBoundingClientRect().width ?? 1;
    const gap = parseFloat(getComputedStyle(el).gap || "0");
    el.scrollTo({ left: activeIndex * (slideWidth + gap), behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div className="app-carousel-wrap" aria-label={ariaLabel} data-testid={testId}>
      <div className="app-carousel" ref={ref} role="region">
        {children.map((c, i) => <div key={i}>{c}</div>)}
      </div>
      <div className="app-carousel-dots" aria-hidden>
        {children.map((_, i) => (
          <div key={i} className="dot" data-active={i === idx || undefined} />
        ))}
      </div>
    </div>
  );
}
