// Layout de la plateforme — navigation mobile + sidebar desktop
import type { ReactNode } from "react";
import BarreNavigationMobile from "@/components/BarreNavigationMobile";
import { MemberHeader } from "@/components/MaliWuliHeader";
import PlatformAuthGuard from "@/components/auth/PlatformAuthGuard";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformAuthGuard>
      <div className="min-h-screen min-h-dvh min-w-0 bg-[var(--color-page)] flex flex-col">
        <MemberHeader />

        <main className="min-w-0 flex-1 bg-[var(--color-page)] pb-24 lg:pb-0">
          {children}
        </main>

        <BarreNavigationMobile />
      </div>
    </PlatformAuthGuard>
  );
}
