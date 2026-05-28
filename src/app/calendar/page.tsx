"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
  MapPin,
} from "lucide-react";
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";

interface CalActivity {
  id: string;
  activityDescription: string;
  category: string;
  location: string | null;
  status: string;
  subcontractor: { name: string } | null;
  occurrences: { plannedDate: string; status: string }[];
}

// Palette for subcontractor color coding (cycles through)
const SUB_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
];

const STATUS_DOT: Record<string, string> = {
  PLANNED:     "bg-blue-400",
  IN_PROGRESS: "bg-yellow-400",
  COMPLETE:    "bg-green-500",
  DELAYED:     "bg-red-500",
  BLOCKED:     "bg-red-700",
  CANCELLED:   "bg-gray-400",
};

export default function CalendarPage() {
  const [activities, setActivities] = useState<CalActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Mon start
  );
  const [subColorMap, setSubColorMap] = useState<Map<string, string>>(new Map());
  const [filterSub, setFilterSub] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activities?limit=500");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const acts: CalActivity[] = data.activities ?? data;
      setActivities(acts);

      // Build sub→color map
      const names = [...new Set(acts.map((a: CalActivity) => a.subcontractor?.name).filter(Boolean))] as string[];
      const map = new Map<string, string>();
      names.forEach((name, i) => map.set(name, SUB_COLORS[i % SUB_COLORS.length]));
      setSubColorMap(map);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // 3 weeks: current, next, next+1
  const weeks = [weekStart, addWeeks(weekStart, 1), addWeeks(weekStart, 2)];

  // All days in the view (21 days = 3 × 7)
  const allDays: Date[] = [];
  for (const ws of weeks) {
    for (let d = 0; d < 7; d++) allDays.push(addDays(ws, d));
  }

  // Get activities that have an occurrence on a given day
  function activitiesOnDay(day: Date): CalActivity[] {
    const dayStr = format(day, "yyyy-MM-dd");
    return activities
      .filter((a) => {
        if (filterSub !== "ALL" && a.subcontractor?.name !== filterSub) return false;
        if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
        return a.occurrences.some(
          (o) => format(parseISO(o.plannedDate), "yyyy-MM-dd") === dayStr
        );
      });
  }

  const uniqueSubs = [...new Set(activities.map((a) => a.subcontractor?.name).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">3-week visual activity schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
            {format(weekStart, "MMM d")} – {format(addDays(addWeeks(weekStart, 2), 6), "MMM d, yyyy")}
          </span>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterSub}
          onChange={(e) => setFilterSub(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Subcontractors</option>
          {uniqueSubs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETE">Complete</option>
          <option value="DELAYED">Delayed</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <button
          onClick={fetchActivities}
          className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Legend */}
      {uniqueSubs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Subs:</span>
          {uniqueSubs.slice(0, 8).map((sub) => (
            <span
              key={sub}
              onClick={() => setFilterSub(filterSub === sub ? "ALL" : sub)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-opacity ${
                subColorMap.get(sub) ?? SUB_COLORS[0]
              } ${filterSub !== "ALL" && filterSub !== sub ? "opacity-40" : ""}`}
            >
              {sub}
            </span>
          ))}
          {uniqueSubs.length > 8 && (
            <span className="text-xs text-gray-400">+{uniqueSubs.length - 8} more</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading calendar…</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Week headers */}
          <div className="grid grid-cols-3 border-b border-gray-100">
            {weeks.map((ws, wi) => (
              <div
                key={wi}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-r last:border-r-0 border-gray-100 ${wi === 0 ? "bg-blue-50/50" : ""}`}
              >
                Week {wi + 1} — {format(ws, "MMM d")} to {format(addDays(ws, 6), "MMM d")}
              </div>
            ))}
          </div>

          {/* Day headers row */}
          <div className="grid grid-cols-21 border-b border-gray-100" style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}>
            {allDays.map((day, i) => {
              const isTodayDay = isToday(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={`px-1 py-1.5 text-center border-r last:border-r-0 border-gray-100 ${
                    isWeekend ? "bg-gray-50" : ""
                  } ${isTodayDay ? "bg-blue-50" : ""} ${i === 7 || i === 14 ? "border-l-2 border-l-gray-200" : ""}`}
                >
                  <p className={`text-xs font-medium ${isTodayDay ? "text-blue-600" : "text-gray-400"}`}>
                    {format(day, "EEE")}
                  </p>
                  <p
                    className={`text-sm font-bold leading-none mt-0.5 ${
                      isTodayDay
                        ? "text-white bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                        : isWeekend
                        ? "text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Activity rows */}
          {activities.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                No activities found. Upload a lookahead to populate the calendar.
              </p>
            </div>
          ) : (
            <div
              className="grid border-b border-gray-50"
              style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}
            >
              {allDays.map((day, i) => {
                const acts = activitiesOnDay(day);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isTodayDay = isToday(day);
                return (
                  <div
                    key={i}
                    className={`min-h-[120px] p-1 border-r last:border-r-0 border-gray-100 align-top ${
                      isWeekend ? "bg-gray-50/60" : ""
                    } ${isTodayDay ? "bg-blue-50/30" : ""} ${i === 7 || i === 14 ? "border-l-2 border-l-gray-200" : ""}`}
                  >
                    {acts.map((act) => {
                      const subColor = act.subcontractor?.name
                        ? subColorMap.get(act.subcontractor.name) ?? SUB_COLORS[0]
                        : "bg-gray-100 text-gray-700 border-gray-200";
                      const dot = STATUS_DOT[act.status] ?? "bg-gray-300";
                      return (
                        <a
                          key={act.id}
                          href={`/activities/${act.id}`}
                          title={`${act.activityDescription}${act.location ? ` — ${act.location}` : ""}`}
                          className={`block mb-1 px-1.5 py-0.5 rounded border text-[10px] leading-tight font-medium truncate transition-opacity hover:opacity-80 ${subColor}`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${dot}`} />
                          {act.activityDescription.length > 22
                            ? act.activityDescription.slice(0, 22) + "…"
                            : act.activityDescription}
                          {act.location && (
                            <span className="ml-1 opacity-60">
                              <MapPin className="inline w-2.5 h-2.5" />
                              {act.location}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity count footer */}
      {!loading && activities.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {activities.filter((a) => {
            const start = allDays[0];
            const end = allDays[allDays.length - 1];
            return a.occurrences.some((o) => {
              const d = parseISO(o.plannedDate);
              return d >= start && d <= end;
            });
          }).length}{" "}
          activities in this 3-week window
        </p>
      )}
    </div>
  );
}
