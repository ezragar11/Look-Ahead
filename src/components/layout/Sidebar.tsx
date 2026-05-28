"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  TableProperties,
  Calendar,
  Users,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  HardHat,
  ShieldAlert,
  Clock,
  ClipboardCheck,
  LogOut,
  UserCircle,
  ScrollText,
  FolderOpen,
} from "lucide-react";

const navItems = [
  { href: "/",            label: "Dashboard",       icon: LayoutDashboard },
  { href: "/upload",      label: "Upload Lookahead", icon: Upload },
  { href: "/schedule",    label: "Schedule",         icon: TableProperties },
  { href: "/calendar",    label: "Calendar",         icon: Calendar },
  { href: "/daily",       label: "Daily Work Plan",  icon: ClipboardList },
  { href: "/subs",        label: "Subcontractors",   icon: Users },
  { href: "/conflicts",   label: "Conflicts",        icon: AlertTriangle },
  { href: "/constraints", label: "Constraints",      icon: ShieldAlert },
  { href: "/delays",      label: "Delays",           icon: Clock },
  { href: "/reports",     label: "Reports",          icon: BarChart3 },
];


const adminNavItems = [
  { href: "/audit", label: "Audit Log",  icon: ScrollText },
  { href: "/users", label: "Users",      icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session }             = useSession();
  const { activeProject }             = useProject();

  const role = (session?.user as { globalRole?: string } | undefined)?.globalRole ?? "";
  const isAdmin = role === "ADMIN" || role === "PROJECT_MANAGER";

  // Don't render sidebar on login page
  if (pathname === "/login") return null;

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
          <HardHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">LookAhead Pro</p>
          <p className="text-slate-400 text-xs">Construction Scheduling</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Project Hub link */}
        {activeProject && (() => {
          const href   = `/projects/${activeProject.id}`;
          const active = pathname.startsWith(`/projects/${activeProject.id}`);
          return (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Project
                </p>
              </div>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{activeProject.projectName}</span>
              </Link>
            </>
          );
        })()}

        {/* Admin/PM section */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Admin
              </p>
            </div>
            {adminNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-700 space-y-1">
        {session?.user ? (
          <>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
              <UserCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{session.user.name}</p>
                <p className="text-slate-500 text-[10px] truncate">{role}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-2 py-1.5 w-full rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </>
        ) : (
          <p className="text-slate-600 text-xs px-2">Phase 2</p>
        )}
      </div>
    </aside>
  );
}
