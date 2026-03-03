import { useRef, type ReactNode } from "react";

type OverlayPanelProps = {
  title: string;
  description?: string;
  ariaLabel: string;
  closeLabel?: string;
  onClose?: () => void;
  dockClassName?: string;
  widthClassName?: string;
  animationClassName?: string;
  enableSwipeClose?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function OverlayPanel({
  title,
  description,
  ariaLabel,
  closeLabel,
  onClose,
  dockClassName,
  widthClassName,
  animationClassName,
  enableSwipeClose = false,
  children,
  footer,
}: OverlayPanelProps): JSX.Element {
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  function handleTouchStart(event: React.TouchEvent<HTMLElement>): void {
    if (!enableSwipeClose) {
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>): void {
    if (!enableSwipeClose || !onClose) {
      return;
    }

    const startY = touchStartYRef.current;
    const startX = touchStartXRef.current;
    const endY = event.changedTouches[0]?.clientY ?? null;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (startY == null || startX == null || endY == null || endX == null) {
      return;
    }

    const deltaY = endY - startY;
    const deltaX = Math.abs(endX - startX);
    if (deltaY > 72 && deltaY > deltaX) {
      onClose();
    }
  }

  return (
    <section
      aria-label={ariaLabel}
      className={`glass-panel-strong absolute bottom-4 top-4 z-30 flex flex-col rounded-[28px] ${
        widthClassName ?? "w-80"
      } ${animationClassName ?? "animate-slide-in-left"} ${dockClassName ?? "left-4"}`}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      {enableSwipeClose ? (
        <div className="flex shrink-0 justify-center pt-2">
          <span className="h-1.5 w-14 rounded-full bg-slate-600/80" />
        </div>
      ) : null}
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/75">Panel</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-[11px] text-slate-400">{description}</p> : null}
        </div>
        {onClose ? (
          <button
            aria-label={closeLabel ?? `Close ${ariaLabel.toLowerCase()}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      {footer ? <footer className="shrink-0 border-t border-slate-800/80 px-4 py-3">{footer}</footer> : null}
    </section>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
