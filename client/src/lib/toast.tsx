import { useEffect, useState } from "react";

/** Minimal toast bus for lightweight, non-blocking confirmations. */
type Toast = { id: number; message: string };

let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l(toasts));
}

export function showToast(message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2.5" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className="max-w-xs rounded-lg bg-primary px-4 py-3 text-sm text-white shadow-card-hover animate-in fade-in slide-in-from-bottom-2"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
