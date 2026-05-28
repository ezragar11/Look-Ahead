"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Calendar as CalIcon, Loader2, ChevronLeft, ChevronRight, MapPin, RefreshCw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  responsibleSubcontractorRaw: string | null;
  category: string | null;
  location: string | null;
}

/* ── Subcontractor color palettes ── */
const SUB_GRADIENTS = [
  "from-sky-600 to-sky-700", "from-emerald-600 to-emerald-700", "from-violet-600 to-violet-700",
  "from-orange-600 to-orange-700", "from-cyan-600 to-cyan-700", "from-fuchsia-600 to-fuchsia-700",
  "from-amber-600 to-amber-700", "from-red-600 to-red-700", "from-indigo-600 to-indigo-700",
  "from-teal-600 to-teal-700", "from-lime-600 to-lime-700", "from-rose-600 to-rose-700",
];
const SUB_DOTS = [
  "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-cyan-500", "bg-fuchsia-500", "bg-amber-500", "bg-red-500",
  "bg-indigo-500", "bg-teal-500", "bg-lime-500", "bg-rose-500",
];
const SUB_BORDERS = [
  "border-sky-500/40", "border-emerald-500/40", "border-violet-500/40", "border-orange-500/40",
  "border-cyan-500/40", "border-fuchsia-500/40", "border-amber-500/40", "border-red-500/40",
  "border-indigo-500/40", "border-teal-500/40", "border-lime-500/40", "border-rose-500/40",
];

/* ── Status dot colors ── */
const STATUS_DOT: Record<string, string> = {
  PLANNED: "bg-slate-400", IN_PROGRESS: "bg-amber-400", COMPLETE: "bg-emerald-400",
  DELAYED: "bg-red-500", BLOCKED: "bg-orange-500", MISSED: "bg-rose-600",
};

/* ── Helpers ── */
function getWeekDates(refDate: Date): Date[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const dates: Date[] = [];
  for (let i = 0; i < 21; i++) {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    dates.push(dd);
  }
  return dates;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(date: Date, start: Date | null, end: Date | null) {
  if (!start) return false;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : s;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d >= s && d <= e;
}

export default function CalendarPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refDate, setRefDate]       = useState(new Date());
  const [filterSub, setFilterSub]   = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    const aRes = await fetch(`/api/activities?projectId=${proj.id}`);
    if (aRes.ok) setActivities(await aRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  const dates = getWeekDates(refDate);
  const today = new Date();

  /* Build sub color maps */
  const subs = useMemo(() => [...new Set(activities.map((a) => a.responsibleSubcontractorRaw ?? "Unassigned"))], [activities]);
  const subColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    subs.forEach((s, i) => { m[s] = SUB_GRADIENTS[i % SUB_GRADIENTS.length]; });
    return m;
  }, [subs]);
  const subDotMap = useMemo(() => {
    const m: Record<string, string> = {};
    subs.forEach((s, i) => { m[s] = SUB_DOTS[i % SUB_DOTS.length]; });
    return m;
  }, [subs]);
  const subBorderMap = useMemo(() => {
    const m: Record<string, string> = {};
    subs.forEach((s, i) => { m[s] = SUB_BORDERS[i % SUB_BORDERS.length]; });
    return m;
  }, [subs]);

  const statuses = useMemo(() => [...new Set(activities.map(a => a.status))].sort(), [activities]);

  /* Filter activities */
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (filterSub !== "ALL" && (a.responsibleSubcontractorRaw ?? "Unassigned") !== filterSub) return false;
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      return true;
    });
  }, [activities, filterSub, filterStatus]);

  function shiftWeeks(n: number) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + n * 7);
    setRefDate(d);
  }

  /* Week label chips */
  const weekLabels = [0, 1, 2].map((w) => {
    const start = dates[w * 7];
    const end = dates[w * 7 + 6];
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  });

  /* Count activities in this 3-week window */
  const windowCount = filteredActivities.filter(a => {
    const first = dates[0];
    const last = dates[dates.length - 1];
    return inRange(first, a.plannedStart ? new Date(a.plannedStart) : null, a.plannedFinish ? new Date(a.plannedFinish) : null) ||
           inRange(last, a.plannedStart ? new Date(a.plannedStart) : null, a.plannedFinish ? new Date(a.plannedFinish) : null) ||
           (a.plannedStart && a.plannedFinish && new Date(a.plannedStart) >= first && new Date(a.plannedStart) <= last);
  }).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">3-Week Look-Ahead Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">{filteredActivities.length} activities · {subs.length} subcontractors</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={cn(
            "p-2 rounded-xl border transition-all",
            showFilters ? "bg-sky-500/10 border-sky-500/30 text-sky-400" : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white"
          )}>
            <Filter className="w-4 h-4" />
          </button>
          <button onClick={load} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all" title="Refresh">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <div className="w-px h-6 bg-slate-700/50 mx-1" />
          <button onClick={() => shiftWeeks(-3)} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setRefDate(new Date())} className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600/80 to-violet-600/80 text-white text-xs font-semibold">Today</button>
          <button onClick={() => shiftWeeks(3)} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Filters panel ── */}
      {showFilters && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Subcontractor</label>
            <select
              value={filterSub}
              onChange={(e) => setFilterSub(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="ALL">All Subcontractors</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="ALL">All Statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(filterSub !== "ALL" || filterStatus !== "ALL") && (
            <button onClick={() => { setFilterSub("ALL"); setFilterStatus("ALL"); }} className="px-3 py-2 text-sm text-slate-400 hover:text-white border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-all mt-4">
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* ── Clickable Legend ── */}
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => {
          const isFiltered = filterSub !== "ALL" && filterSub !== s;
          return (
            <button
              key={s}
              onClick={() => setFilterSub(filterSub === s ? "ALL" : s)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer",
                filterSub === s
                  ? cn("bg-slate-700/50", subBorderMap[s], "ring-1 ring-white/10")
                  : isFiltered
                  ? "bg-slate-800/20 border-slate-800 opacity-30 hover:opacity-60"
                  : "bg-slate-800/50 border-slate-700/30 hover:border-slate-600"
              )}
            >
              <span className={cn("w-3 h-3 rounded-full", subDotMap[s])} />
              <span className={cn("text-xs font-medium", filterSub === s ? "text-white" : "text-slate-300")}>{s}</span>
            </button>
          );
        })}
      </div>

      {/* ── Status legend ── */}
      <div className="flex items-center gap-4 px-1">
        <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Status:</span>
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-all",
              filterStatus === status ? "text-white font-bold" : filterStatus !== "ALL" ? "text-slate-600 opacity-40 hover:opacity-70" : "text-slate-400 hover:text-slate-300"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", dot)} />
            {status.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* ── Week banners ── */}
      <div className="grid grid-cols-3 gap-4">
        {weekLabels.map((label, i) => (
          <div key={i} className="text-center">
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full inline-block",
              i === 0 ? "text-sky-300 bg-sky-500/10 border border-sky-500/20" :
              i === 1 ? "text-violet-300 bg-violet-500/10 border border-violet-500/20" :
              "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
            )}>Week {i + 1}: {label}</span>
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[1000px]">
          {/* Day headers */}
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
            <div key={d} className="px-3 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700/50 bg-slate-800/50">
              {d}
            </div>
          ))}

          {/* Day cells */}
          {dates.map((date, i) => {
            const isToday = sameDay(date, today);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const weekIndex = Math.floor(i / 7);
            const dayActivities = filteredActivities.filter((a) =>
              inRange(date, a.plannedStart ? new Date(a.plannedStart) : null, a.plannedFinish ? new Date(a.plannedFinish) : null)
            );
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[130px] border-b border-r border-slate-700/30 p-2 transition-colors",
                  isWeekend && "bg-slate-900/40",
                  isToday && "ring-2 ring-inset ring-sky-500/60 bg-sky-500/5",
                  !isWeekend && !isToday && (weekIndex === 0 ? "bg-sky-500/[0.02]" : weekIndex === 1 ? "bg-violet-500/[0.02]" : "bg-emerald-500/[0.02]")
                )}
              >
                {/* Day number header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isToday ? (
                      <span className="text-white bg-sky-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {date.getDate()}
                      </span>
                    ) : (
                      <span className={cn("text-xs font-bold", isWeekend ? "text-slate-600" : "text-slate-400")}>
                        {date.getDate()}
                      </span>
                    )}
                    {(date.getDate() === 1 || i === 0) && (
                      <span className="text-slate-600 text-[10px] font-medium">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                    )}
                  </div>
                  {dayActivities.length > 0 && (
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded-full">{dayActivities.length}</span>
                  )}
                </div>

                {/* Activity pills */}
                <div className="space-y-0.5">
                  {dayActivities.slice(0, 5).map((a) => {
                    const sub = a.responsibleSubcontractorRaw ?? "Unassigned";
                    const statusDot = STATUS_DOT[a.status] ?? "bg-slate-400";
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "text-[10px] text-white px-2 py-1 rounded-md truncate bg-gradient-to-r font-medium shadow-sm flex items-center gap-1",
                          subColorMap[sub]
                        )}
                        title={`${a.activityDescription}\nSub: ${sub}\nStatus: ${a.status}${a.location ? `\nLocation: ${a.location}` : ""}`}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot)} />
                        <span className="truncate">{a.activityDescription}</span>
                        {a.location && <MapPin className="w-2.5 h-2.5 flex-shrink-0 opacity-60 ml-auto" />}
                      </div>
                    );
                  })}
                  {dayActivities.length > 5 && (
                    <p className="text-[10px] text-sky-400 px-1 font-semibold">+{dayActivities.length - 5} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer count ── */}
      <p className="text-xs text-slate-600 text-right">
        {windowCount} activities in this 3-week window
        {(filterSub !== "ALL" || filterStatus !== "ALL") && (
          <span className="text-sky-500 ml-1">(filtered)</span>
        )}
      </p>
    </div>
  );
}
