export function scheduleTokenRefresh(action: () => Promise<void>, refreshInMs: number): number {
  return window.setTimeout(() => {
    void action();
  }, refreshInMs);
}

export function cancelTokenRefresh(timerId: number): void {
  window.clearTimeout(timerId);
}
