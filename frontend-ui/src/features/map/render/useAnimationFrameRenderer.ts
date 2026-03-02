import { useEffect, useRef } from "react";

export function useAnimationFrameRenderer(render: () => void, maxFps: number = 30): void {
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    let rafId = 0;
    let active = true;
    let previousTs = 0;
    const frameBudgetMs = 1000 / Math.max(1, maxFps);

    const tick = (timestamp: number): void => {
      if (!active) {
        return;
      }
      if (timestamp - previousTs >= frameBudgetMs) {
        previousTs = timestamp;
        renderRef.current();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [maxFps]);
}
