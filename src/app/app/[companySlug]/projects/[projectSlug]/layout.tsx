"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Upload, TableProperties, Calendar, ClipboardList,
  Users, AlertTriangle, ShieldAlert, Clock, BarChart3, HardHat,
  ScrollText, LogOut, ChevronDown, ChevronLeft, FolderOpen,
  FileText, Brain, Settings, Layers, Bell, StickyNote,
  Megaphone, Coffee, Map, MapPin, Compass,
} from "lucide-react";

interface ProjectInfo {
  id: string;
  projectName: string;
  slug: string | null;
  status: string;
  companyId: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface NavGroup {
  title: string;
  accent: string;
  items: NavItem[];
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params   = useParams<{ companySlug: string; projectSlug: string }>();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { companies } = useCompany();

  const [project, setProject]         = useState<ProjectInfo | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const base = `/app/${params.companySlug}/projects/${params.projectSlug}`;

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${params.companySlug}/projects/${params.projectSlug}`);
      if (res.ok) setProject(await res.json());
    } catch { /* ignore */ }
  }, [params.companySlug, params.projectSlug]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${params.companySlug}/projects`);
      if (res.ok) setAllProjects(await res.json());
    } catch { /* ignore */ }
  }, [params.companySlug]);

  useEffect(() => { loadProject(); loadProjects(); }, [loadProject, loadProjects]);

  const role = (session?.user as { globalRole?: string } | undefined)?.globalRole ?? "";

  // Phase 1 sidebar structure: clean groups following construction workflow
  const navGroups: NavGroup[] = [
    {
      title: "COMMAND CENTER",
      accent: "text-sky-400",
      items: [
        { href: base,                   label: "Dashboard",        icon: LayoutDashboard, color: "text-sky-400" },
        { href: `${base}/daily`,        label: "Daily Work Plan",  icon: ClipboardList,   color: "text-sky-300" },
        { href: `${base}/huddle`,       label: "Morning Huddle",   icon: Coffee,          color: "text-amber-400" },
        { href: `${base}/alerts`,       label: "Alerts",           icon: Megaphone,       color: "text-red-400" },
      ],
    },
    {
      title: "LOOKAHEAD",
      accent: "text-violet-400",
      items: [
        { href: `${base}/upload`,       label: "Upload Lookahead", icon: Upload,          color: "text-violet-400" },
        { href: `${base}/schedule`,     label: "Schedule",         icon: TableProperties, color: "text-violet-300" },
        { href: `${base}/calendar`,     label: "Calendar",         icon: Calendar,        color: "text-violet-200" },
        { href: `${base}/lookaheads`,   label: "Lookahead History",icon: Layers,          color: "text-violet-200" },
      ],
    },
    {
      title: "FIELD TRACKING",
      accent: "text-orange-400",
      items: [
        { href: `${base}/subs`,         label: "Subcontractors",   icon: HardHat,         color: "text-amber-400" },
        { href: `${base}/conflicts`,    label: "Conflicts",        icon: AlertTriangle,   color: "text-orange-400" },
        { href: `${base}/constraints`,  label: "Constraints",      icon: ShieldAlert,     color: "text-yellow-400" },
        { href: `${base}/delays`,       label: "Delays",           icon: Clock,           color: "text-red-400" },
      ],
    },
    {
      title: "SITE",
      accent: "text-cyan-400",
      items: [
        { href: `${base}/map`,          label: "Project Map",      icon: Compass,         color: "text-emerald-400" },
        { href: `${base}/site-plans`,   label: "Site Plans",       icon: Map,             color: "text-cyan-400" },
        { href: `${base}/locations`,    label: "Locations",        icon: MapPin,          color: "text-cyan-300" },
      ],
    },
    {
      title: "REPORTING",
      accent: "text-emerald-400",
      items: [
        { href: `${base}/reports`,      label: "Reports",          icon: BarChart3,       color: "text-emerald-400" },
        { href: `${base}/analysis`,     label: "AI Analysis",      icon: Brain,           color: "text-fuchsia-400" },
        { href: `${base}/documents`,    label: "Documents",        icon: FileText,        color: "text-cyan-400" },
        { href: `${base}/notes`,        label: "Field Notes",      icon: StickyNote,      color: "text-cyan-300" },
      ],
    },
    {
      title: "PROJECT",
      accent: "text-slate-400",
      items: [
        { href: `${base}/team`,         label: "Team",             icon: Users,           color: "text-slate-300" },
        { href: `${base}/audit`,        label: "Audit Log",        icon: ScrollText,      color: "text-slate-400" },
        { href: `${base}/notifications`,label: "Notifications",    icon: Bell,            color: "text-slate-400" },
        { href: `${base}/settings`,     label: "Settings",         icon: Settings,        color: "text-slate-500" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col z-30 border-r border-slate-800">
        {/* Back to company */}
        <Link
          href={`/app/${params.companySlug}`}
          className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/80 text-slate-500 hover:text-sky-400 text-xs transition-colors group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="truncate">
            {companies.find((c) => c.slug === params.companySlug)?.name ?? params.companySlug}
          </span>
        </Link>

        {/* Project header + switcher */}
        <div className="px-3 py-3 border-b border-slate-800/80 relative">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-sky-500/30 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-semibold truncate">
                {project?.projectName ?? params.projectSlug}
              </p>
              <p className="text-slate-500 text-[10px]">{project?.status ?? "Loading..."}</p>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform", showSwitcher && "rotate-180")} />
          </button>

          {showSwitcher && allProjects.length > 1 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-50 py-1 max-h-48 overflow-y-auto">
              {allProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/app/${params.companySlug}/projects/${p.slug ?? p.id}`}
                  onClick={() => setShowSwitcher(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    (p.slug ?? p.id) === params.projectSlug
                      ? "text-sky-400 bg-sky-500/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  )}
                >
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{p.projectName}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Grouped nav — Phase 1 structure */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-1">
              <p className={cn("px-3 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase", group.accent, "opacity-60")}>
                {group.title}
              </p>
              {group.items.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href || (href !== base && pathname.startsWith(href + "/")) || (href !== base && pathname === href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all",
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
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-slate-800/80 space-y-1">
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
