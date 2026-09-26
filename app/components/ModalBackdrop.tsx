"use client";

import type { ReactNode } from "react";

type ModalBackdropProps = {
  children: ReactNode;
  className?: string;
  onClose: () => void;
};

export function ModalBackdrop({ children, className = "preview-modal-backdrop", onClose }: ModalBackdropProps) {
  return (
    <div
      className={className}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      {children}
    </div>
  );
}
