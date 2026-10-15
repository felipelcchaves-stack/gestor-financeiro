"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

// Título de página do design system "Vimeo": grande e pesado (44px / 800; 32px no celular), sem sobretítulo.
// `eyebrow` continua aceito (as telas passam), mas não aparece — fica só para quem lê o código.
export function PageHeader({
  eyebrow: _eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  void _eyebrow;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.02em] break-words md:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base text-muted-foreground">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
