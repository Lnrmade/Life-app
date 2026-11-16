"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PixelIcon } from "./PixelIcon";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** CSS colour used for accents inside the sheet. */
  color?: string;
}

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({ open, onClose, title, children, color }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={color ? ({ "--tc": color } as React.CSSProperties) : undefined}>
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[22px] border border-b-0 border-line bg-coal px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 sm:rounded-[22px] sm:border-b"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-pixel text-[29px] leading-none">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-10 place-items-center rounded-full bg-pit text-ash hover:text-bone"
              >
                <PixelIcon name="close" size={12} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
