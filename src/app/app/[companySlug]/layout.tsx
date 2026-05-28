"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, BarChart3, Users, ScrollText,
  Settings, HardHat, LogOut, UserCircle, ChevronDown, Building2,
} from "lucide-react";
import { useState } from "react";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params   = useParams<{ companySlug: string }>();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { companies, activeCompany, setActiveCompany } = useCompany();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const base = `/app/${params.companySlug}`;
  const afterProjects = pathname.split("/projects/")[1] ?? "";
  const isProjectRoute = pathname.includes("/projects/") && afterProjects.length > 0;

  if (isProjectRoute) {
    return <>{children}</>;
  }

  const role = (session?.user as { globalRole?: string } | undefined)?.globalRole ?? "";

  const companyNav = [
    { href: base,               label: "Dashboard",  icon: LayoutDashboard, color: "text-sky-400" },
    { href: `${base}/projects`, label: "Projects",   icon: FolderKanban,    color: "text-violet-400" },
    { href: `${base}/reports`,  label: "Reports",    icon: BarChart3,       color: "text-emerald-400" },
    { href: `${base}/users`,    label: "Users",      icon: Users,           color: "text-amber-400" },
    { href: `${base}/audit`,    label: "Audit Log",  icon: ScrollText,      color: "text-slate-400" },
    { href: `${base}/settings`, label: "Settings",   icon: Settings,        color: "text-slate-400" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col z-30 border-r border-slate-800">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">LookAhead Pro</p>
            <p className="text-slate-500 text-[10px] font-medium">Construction Platform</p>
          </div>
        </div>

        {/* Company switcher */}
        <div className="px-3 py-3 border-b border-slate-800 relative">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-sky-500/30 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-semibold truncate">
                {activeCompany?.name ?? params.companySlug}
              </p>
              <p className="text-slate-500 text-[10px]">Company Workspace</p>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform", showSwitcher && "rotate-180")} />
          </button>

          {showSwitcher && companies.length > 1 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-50 py-1 max-h-48 overflow-y-auto">
              {companies.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/${c.slug}`}
                  onClick={() => { setActiveCompany(c); setShowSwitcher(false); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    c.slug === params.companySlug
                      ? "text-sky-400 bg-sky-500/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{c.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {companyNav.map(({ href, label, icon: Icon, color }) => {
            const active = pathname === href || (href !== base && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-sky-600/90 to-violet-600/80 text-white shadow-lg shadow-sky-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-white" : color)} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-slate-800 space-y-1">
          {session?.user ? (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {(session.user.name ?? "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{session.user.name}</p>
                  <p className="text-slate-500 text-[10px] truncate">{role}</p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 text-xs font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </>
          ) : null}
        </div>
      </aside>

      <main className="ml-64 flex-1 min-h-screen bg-slate-950">
        <div className="max-w-[1600px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
