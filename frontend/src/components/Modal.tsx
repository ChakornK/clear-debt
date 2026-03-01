"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TbX } from "react-icons/tb";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, confirmText, cancelText, onConfirm, onCancel, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  function handleClose(): void {
    onCancel ? onCancel() : onClose();
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === overlayRef.current) handleClose();
  }

  if (!isOpen) return null;

  return createPortal(
    <div ref={overlayRef} onClick={handleOverlayClick} className="z-9998 fixed inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={handleClose} className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300">
            <TbX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {children && <div className="p-4 text-sm text-slate-300">{children}</div>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-700 p-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-600 hover:text-white"
            >
              {cancelText ?? "Cancel"}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700"
          >
            {confirmText ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
