export function scheduleTokenRefresh(action: () => Promise<void>, refreshInMs: number): number {
  const delay = Math.max(0, refreshInMs);
  return window.setTimeout(() => {
    void action();
  }, delay);
}

export function cancelTokenRefresh(timerId: number): void {
  window.clearTimeout(timerId);
}
