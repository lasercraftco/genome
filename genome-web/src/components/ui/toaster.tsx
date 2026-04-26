"use client";

import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast gap-2 px-4 py-3 rounded-lg bg-surface-2 text-text border border-surface shadow-lg backdrop-blur-sm",
          description: "group-[.toast]:text-text-dim",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-surface group-[.toast]:text-text",
          error: "group toast gap-2 px-4 py-3 rounded-lg bg-down/10 text-down border border-down/30",
          success: "group toast gap-2 px-4 py-3 rounded-lg bg-up/10 text-up border border-up/30",
        },
      }}
    />
  );
}

export { toast };
