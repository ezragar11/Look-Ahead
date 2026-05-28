"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Coffee, Loader2, HardHat, MapPin, AlertTriangle, ShieldAlert,
  Clock, CheckCircle2, Zap, ClipboardCheck,
  ChevronRight, Calendar, ArrowRight, Eye, EyeOff, Check, Pause, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/* ── Types ── */
interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  category: string | null;
  location: string | null;
  priority: string;
  needsFollowUp: boolean;
}

interface Conflict {
  id: string;
  title: string;
  severity: string;
  status: string;
  location: string | null;
  description: string | null;
}

interface Constraint {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  neededBy: string | null;
  responsibleParty: string | null;
}

interface CrewGroup {
  sub: string;
  activities: Activity[];
  locations: string[];
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  PLANNED:     { color: "text-slate-300",   bg: "bg-slate-500/10",   border: "border-slate-500/20", dot: "bg-slate-400" },
  IN_PROGRESS: { color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/20", dot: "bg-amber-400" },
  COMPLETE:    { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  DELAYED:     { color: "text-red-300",     bg: "bg-red-500/10",     border: "border-red-500/20", dot: "bg-red-400" },
  BLOCKED:     { color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/20", dot: "bg-orange-400" },
  MISSED:      { color: "text-rose-300",    bg: "bg-rose-500/10",    border: "border-rose-500/20", dot: "bg-rose-400" },
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  LOW: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

/* ── Page ── */
export default function MorningHuddlePage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities]   = useState<Activity[]>([]);
  const [conflicts, setConflicts]     = useState<Conflict[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [reviewed, setReviewed]       = useState<Set<string>>(new Set());
  const [hidden, setHidden]           = useState<Set<string>>(new Set());

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectName(proj.projectName ?? projectSlug);
      setProjectId(proj.id);

      const [aRes, cRes, cnRes] = await Promise.all([
        fetch(`/api/activities?projectId=${proj.id}`),
        fetch(`/api/conflicts?projectId=${proj.id}`),
        fetch(`/api/constraints?projectId=${proj.id}`),
      ]);

      if (aRes.ok) setActivities(await aRes.json());
      if (cRes.ok) setConflicts(await cRes.json());
      if (cnRes.ok) setConstraints(await cnRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  // Huddle actions — update activity status inline
  async function updateActivity(id: string, status: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setActivities((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
      setReviewed((prev) => new Set(prev).add(id));
      toast.success(`Marked ${status.toLowerCase().replace("_", " ")}`);
    }
  }

  function toggleHide(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function markReviewed(id: string) {
    setReviewed((prev) => new Set(prev).add(id));
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const dayName = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Filter today's activities
  const todayActivities = activities.filter((a) => {
    if (!a.plannedStart) return false;
    const s = new Date(a.plannedStart).toISOString().split("T")[0];
    const e = a.plannedFinish ? new Date(a.plannedFinish).toISOString().split("T")[0] : s;
    return todayStr >= s && todayStr <= e;
  });

  const visibleActivities = todayActivities.filter((a) => !hidden.has(a.id));

  // Group by subcontractor
  const crewMap = new Map<string, CrewGroup>();
  visibleActivities.forEach((a) => {
    const sub = a.responsibleSubcontractorRaw ?? "Unassigned";
    if (!crewMap.has(sub)) crewMap.set(sub, { sub, activities: [], locations: [] });
    const g = crewMap.get(sub)!;
    g.activities.push(a);
    if (a.location && !g.locations.includes(a.location)) g.locations.push(a.location);
  });
  const crews = [...crewMap.values()].sort((a, b) => b.activities.length - a.activities.length);

  // Work locations + area overlap detection
  const allLocations = [...new Set(todayActivities.map(a => a.location).filter(Boolean))] as string[];
  const areaOverlaps = allLocations.filter((loc) => {
    const subs = new Set(todayActivities.filter(a => a.location === loc).map(a => a.responsibleSubcontractorRaw).filter(Boolean));
    return subs.size >= 2;
  });

  const openConflicts = conflicts.filter(c => c.status === "OPEN" || c.status === "UNDER_REVIEW");
  const activeConstraints = constraints.filter(c => c.status === "OPEN" || c.status === "IN_PROGRESS");
  const overdue = activities.filter(a => {
    if (a.status === "COMPLETE") return false;
    if (!a.plannedFinish) return false;
    return new Date(a.plannedFinish).toISOString().split("T")[0] < todayStr;
  });
  const blockedWork = todayActivities.filter(a => a.status === "DELAYED" || a.status === "BLOCKED" || a.status === "MISSED");
  const followUps = todayActivities.filter(a => a.needsFollowUp);

  // Needs decision today: open constraints due today/overdue + critical conflicts
  const needsDecision = [
    ...activeConstraints.filter(c => c.neededBy && new Date(c.neededBy).toISOString().split("T")[0] <= todayStr),
    ...openConflicts.filter(c => c.severity === "CRITICAL" || c.severity === "HIGH"),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-3" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ═══════ Huddle Header ═══════ */}
      <div className="bg-gradient-to-r from-amber-600/20 via-orange-600/10 to-transparent rounded-2xl border border-amber-500/20 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Coffee className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Morning Huddle</h1>
                <p className="text-amber-300/80 text-sm font-medium">{projectName}</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mt-1">{dayName}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-white">{todayActivities.length}</p>
            <p className="text-amber-300/60 text-xs font-bold uppercase tracking-wider">Activities Today</p>
            {reviewed.size > 0 && (
              <p className="text-emerald-400 text-xs mt-1">{reviewed.size} reviewed</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-amber-500/10">
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-amber-400" />
            <span className="text-white text-sm font-bold">{crews.length}</span>
            <span className="text-slate-400 text-sm">crews on site</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-400" />
            <span className="text-white text-sm font-bold">{allLocations.length}</span>
            <span className="text-slate-400 text-sm">work locations</span>
          </div>
          {areaOverlaps.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm font-bold">{areaOverlaps.length}</span>
              <span className="text-slate-400 text-sm">area overlaps</span>
            </div>
          )}
          {openConflicts.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-300 text-sm font-bold">{openConflicts.length}</span>
              <span className="text-slate-400 text-sm">open conflicts</span>
            </div>
          )}
          {hidden.size > 0 && (
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400 text-sm">{hidden.size} hidden</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ AREA OVERLAP WARNING ═══════ */}
      {areaOverlaps.length > 0 && (
        <div className="bg-red-500/5 rounded-2xl border border-red-500/15 p-5">
          <h2 className="text-red-400 font-bold text-lg flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" /> Area Overlap — Multiple Crews Same Location
          </h2>
          <div className="space-y-2">
            {areaOverlaps.map((loc) => {
              const locActs = todayActivities.filter(a => a.location === loc);
              const locSubs = [...new Set(locActs.map(a => a.responsibleSubcontractorRaw).filter(Boolean))];
              return (
                <div key={loc} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-red-500/10">
                  <MapPin className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{loc}</p>
                    <p className="text-slate-500 text-xs">{locActs.length} activities from {locSubs.length} crews</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {locSubs.map((s) => (
                      <span key={s} className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ NEEDS DECISION TODAY ═══════ */}
      {needsDecision.length > 0 && (
        <div className="bg-amber-500/5 rounded-2xl border border-amber-500/15 p-5">
          <h2 className="text-amber-400 font-bold text-lg flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5" /> Needs Decision Today
          </h2>
          <div className="space-y-2">
            {needsDecision.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-amber-500/10">
                {"severity" in item ? (
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                )}
                <p className="text-white text-sm flex-1 truncate">{item.title}</p>
                {"severity" in item && (
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", SEVERITY_COLORS[(item as Conflict).severity])}>{(item as Conflict).severity}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ SOLVE TODAY ═══════ */}
      {(openConflicts.length > 0 || activeConstraints.length > 0 || blockedWork.length > 0) && (
        <div className="bg-red-500/5 rounded-2xl border border-red-500/15 p-5">
          <h2 className="text-red-400 font-bold text-lg flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" /> Solve Today
          </h2>
          <div className="space-y-2">
            {openConflicts.map(c => (
              <Link key={c.id} href={`${base}/conflicts`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-orange-500/10 hover:border-orange-500/30 transition-all group">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{c.title}</p>
                  {c.location && <p className="text-slate-500 text-xs">{c.location}</p>}
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", SEVERITY_COLORS[c.severity] ?? SEVERITY_COLORS.MEDIUM)}>{c.severity}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-orange-400" />
              </Link>
            ))}
            {activeConstraints.slice(0, 5).map(c => (
              <Link key={c.id} href={`${base}/constraints`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-yellow-500/10 hover:border-yellow-500/30 transition-all group">
                <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{c.title}</p>
                  <p className="text-slate-500 text-xs">{c.type}{c.responsibleParty ? ` - ${c.responsibleParty}` : ""}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-yellow-400" />
              </Link>
            ))}
            {blockedWork.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-red-500/10">
                <Zap className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{a.activityDescription}</p>
                  <p className="text-slate-500 text-xs">{a.responsibleSubcontractorRaw ?? "Unassigned"}{a.location ? ` - ${a.location}` : ""}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", STATUS_CONFIG[a.status]?.bg, STATUS_CONFIG[a.status]?.color, STATUS_CONFIG[a.status]?.border)}>{a.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ WHO IS ON SITE — with review actions ═══════ */}
      <div>
        <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
          <HardHat className="w-5 h-5 text-amber-400" /> Who Is On Site
        </h2>

        {crews.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-10 text-center">
            <HardHat className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No crews scheduled for today.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {crews.map((crew, ci) => {
              const gradients = [
                "from-sky-500/8 border-sky-500/15", "from-emerald-500/8 border-emerald-500/15",
                "from-violet-500/8 border-violet-500/15", "from-amber-500/8 border-amber-500/15",
                "from-cyan-500/8 border-cyan-500/15", "from-fuchsia-500/8 border-fuchsia-500/15",
                "from-orange-500/8 border-orange-500/15", "from-rose-500/8 border-rose-500/15",
              ];
              const g = gradients[ci % gradients.length];

              return (
                <div key={crew.sub} className={cn("rounded-2xl border p-5 bg-gradient-to-br to-transparent", g)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-800/80 flex items-center justify-center">
                        <HardHat className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{crew.sub}</p>
                        <p className="text-slate-500 text-[11px]">
                          {crew.activities.length} task{crew.activities.length !== 1 ? "s" : ""}
                          {crew.locations.length > 0 && <> &middot; {crew.locations.join(", ")}</>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {crew.activities.map(a => {
                      const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PLANNED;
                      const isReviewed = reviewed.has(a.id);
                      return (
                        <div key={a.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg transition-all", isReviewed ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-slate-800/40")}>
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                          <p className={cn("text-sm truncate flex-1", isReviewed ? "text-slate-500 line-through" : "text-slate-200")}>{a.activityDescription}</p>
                          {a.location && <span className="text-slate-600 text-[10px] flex-shrink-0">{a.location}</span>}

                          {/* Huddle action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!isReviewed && a.status === "PLANNED" && (
                              <button onClick={() => updateActivity(a.id, "IN_PROGRESS")} title="Start"
                                className="p-1 rounded text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isReviewed && (a.status === "PLANNED" || a.status === "IN_PROGRESS") && (
                              <button onClick={() => updateActivity(a.id, "COMPLETE")} title="Done"
                                className="p-1 rounded text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isReviewed && (
                              <button onClick={() => updateActivity(a.id, "DELAYED")} title="Delayed"
                                className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isReviewed && (
                              <button onClick={() => markReviewed(a.id)} title="Reviewed"
                                className="p-1 rounded text-sky-400/60 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => toggleHide(a.id)} title={hidden.has(a.id) ? "Show" : "Hide"}
                              className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors">
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════ WORK LOCATIONS with overlap markers ═══════ */}
      {allLocations.length > 0 && (
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-violet-400" /> Work Locations
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allLocations.map(loc => {
              const locActivities = todayActivities.filter(a => a.location === loc);
              const locSubs = [...new Set(locActivities.map(a => a.responsibleSubcontractorRaw).filter(Boolean))];
              const hasOverlap = locSubs.length >= 2;
              return (
                <div key={loc} className={cn("rounded-xl border p-4", hasOverlap ? "border-red-500/30 bg-red-500/5" : "border-slate-700/50 bg-slate-800/40")}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className={cn("w-4 h-4 flex-shrink-0", hasOverlap ? "text-red-400" : "text-violet-400")} />
                    <p className="text-white font-semibold text-sm">{loc}</p>
                    {hasOverlap && <AlertTriangle className="w-3.5 h-3.5 text-red-400 ml-auto" />}
                  </div>
                  <p className="text-slate-500 text-xs mb-2">{locActivities.length} activities · {locSubs.length} crew{locSubs.length !== 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {locSubs.map(sub => (
                      <span key={sub} className={cn("text-[10px] px-2 py-0.5 rounded-full border", hasOverlap ? "text-red-300 bg-red-500/10 border-red-500/20" : "text-amber-300 bg-amber-500/10 border-amber-500/15")}>{sub}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ OVERDUE ═══════ */}
      {overdue.length > 0 && (
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-red-400" /> Overdue Work ({overdue.length})
          </h2>
          <div className="bg-slate-800/40 rounded-2xl border border-red-500/10 divide-y divide-slate-700/30">
            {overdue.slice(0, 10).map(a => {
              const daysLate = a.plannedFinish ? Math.max(1, Math.floor((Date.now() - new Date(a.plannedFinish).getTime()) / 86400000)) : 0;
              return (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-red-400 text-xs font-black w-10 text-right flex-shrink-0">{daysLate}d</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{a.activityDescription}</p>
                    <p className="text-slate-500 text-xs">{a.responsibleSubcontractorRaw ?? "Unassigned"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ FOLLOW-UPS ═══════ */}
      {followUps.length > 0 && (
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5 text-purple-400" /> Needs Follow-Up ({followUps.length})
          </h2>
          <div className="space-y-2">
            {followUps.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                <ClipboardCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{a.activityDescription}</p>
                  <p className="text-slate-500 text-xs">{a.responsibleSubcontractorRaw ?? "Unassigned"}{a.location ? ` - ${a.location}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ Quick Links ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {[
          { href: `${base}/daily`,     label: "Daily Work Plan", icon: Calendar,       color: "text-sky-400",    from: "from-sky-600/10" },
          { href: `${base}/schedule`,  label: "Full Schedule",   icon: CheckCircle2,   color: "text-violet-400", from: "from-violet-600/10" },
          { href: `${base}/conflicts`, label: "Conflicts",       icon: AlertTriangle,  color: "text-orange-400", from: "from-orange-600/10" },
          { href: `${base}/subs`,      label: "Subcontractors",  icon: HardHat,        color: "text-amber-400",  from: "from-amber-600/10" },
        ].map(({ href, label, icon: Icon, color, from }) => (
          <Link key={href} href={href}
            className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-all bg-gradient-to-br to-transparent", from)}>
            <Icon className={cn("w-5 h-5", color)} />
            <span className="text-slate-300 text-sm font-medium">{label}</span>
            <ArrowRight className="w-3 h-3 text-slate-600 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
