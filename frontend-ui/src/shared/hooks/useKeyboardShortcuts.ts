import { useEffect } from "react";

export type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
  handler: (event: KeyboardEvent) => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable
    || tagName === "input"
    || tagName === "textarea"
    || tagName === "select"
  );
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const inEditableTarget = isEditableTarget(event.target);

      for (const shortcut of shortcuts) {
        if (
          event.key.toLowerCase() !== shortcut.key.toLowerCase()
          || Boolean(shortcut.ctrlKey) !== event.ctrlKey
          || Boolean(shortcut.metaKey) !== event.metaKey
          || Boolean(shortcut.shiftKey) !== event.shiftKey
          || Boolean(shortcut.altKey) !== event.altKey
        ) {
          continue;
        }

        if (inEditableTarget && shortcut.key !== "Escape") {
          return;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
