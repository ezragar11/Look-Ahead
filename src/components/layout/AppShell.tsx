"use client";

import { usePathname } from "next/navigation";
import { Sidebar }    from "@/components/layout/Sidebar";
import { ProjectBar } from "@/components/layout/ProjectBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin  = pathname === "/login";

  if (isLogin) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <main className="ml-60 min-h-screen flex flex-col">
        <ProjectBar />
        <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </>
  );
}
