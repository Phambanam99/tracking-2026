import type { ReactNode } from "react";

type IconButtonProps = {
  ariaLabel: string;
  tooltip: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  sizeClassName?: string;
  type?: "button" | "submit" | "reset";
};

export function IconButton({
  ariaLabel,
  tooltip,
  children,
  onClick,
  active = false,
  disabled = false,
  className,
  sizeClassName,
  type = "button",
}: IconButtonProps): JSX.Element {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`group relative inline-flex items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
        sizeClassName ?? "h-11 w-11"
      } ${
        active
          ? "border-cyan-400/60 bg-cyan-400/12 text-cyan-200 shadow-lg"
          : "border-transparent bg-white/0 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-100"
      } ${className ?? ""}`}
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      type={type}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-700/90 bg-slate-950/95 px-2.5 py-1 text-[10px] font-medium text-slate-200 shadow-lg group-hover:block group-focus-visible:block">
        {tooltip}
      </span>
    </button>
  );
}
