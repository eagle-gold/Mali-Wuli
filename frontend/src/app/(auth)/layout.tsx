import type { ReactNode } from "react";
import { AuthFlowHeader } from "@/components/MaliWuliHeader";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen min-w-0 [overflow-wrap:anywhere] bg-[var(--color-page)]">
      <AuthFlowHeader />
      {children}
    </div>
  );
}
