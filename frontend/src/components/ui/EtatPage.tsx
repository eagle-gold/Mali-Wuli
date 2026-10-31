import type { ReactNode } from "react";

/** Squelette de chargement : bloc animé, masqué aux technologies d'assistance. */
export function Squelette({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-line-soft/70 ${className}`} />;
}

/** État vide ou d'erreur d'une page ou d'une section. */
export function EtatPage({
  icone,
  titre,
  children,
  actions,
  role,
}: {
  icone?: ReactNode;
  titre: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className="mx-auto flex max-w-md flex-col items-center px-5 py-12 text-center">
      {icone && (
        <span aria-hidden="true" className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          {icone}
        </span>
      )}
      <h2 className="font-display text-2xl font-bold text-ink">{titre}</h2>
      {children && <div className="mt-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
