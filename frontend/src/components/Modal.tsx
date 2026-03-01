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
    <div ref={overlayRef} onClick={handleOverlayClick} className="z-9998 fixed inset-0 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={handleClose} className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <TbX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {children && <div className="p-4 text-sm text-slate-600">{children}</div>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {cancelText ?? "Cancel"}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-600"
          >
            {confirmText ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
