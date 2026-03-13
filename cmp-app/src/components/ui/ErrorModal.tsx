"use client";

import { X } from "lucide-react";
import { ErrorDisplay, ErrorDisplayProps } from "./ErrorDisplay";

export type ErrorModalProps = Omit<ErrorDisplayProps, "variant"> & {
  isOpen: boolean;
  onClose: () => void;
};

export function ErrorModal({ isOpen, onClose, ...errorProps }: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg transition-colors"
          style={{ borderColor: "var(--border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          aria-label="Close"
        >
          <X size={16} style={{ color: "var(--text-muted)" }} />
        </button>

        <ErrorDisplay
          {...errorProps}
          variant="modal"
          secondaryAction={errorProps.secondaryAction || { label: "Close", onClick: onClose }}
        />
      </div>
    </div>
  );
}
