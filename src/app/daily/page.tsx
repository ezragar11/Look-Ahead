"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, truncate } from "@/lib/utils";
import type { ActivityOccurrence } from "@/types";
import { Calendar, MapPin, Users, RefreshCcw, HardHat, ChevronLeft, ChevronRight } from "lucide-react";

export default function DailyWorkPlanPage() {
  const [date, setDate]         = useState(() => new Date().toISOString().split("T")[0]);
  const [occurrences, setOccs]  = useState<(ActivityOccurrence & { activity: any })[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    setLoading(true);
    const start = new Date(date + "T00:00:00Z").toISOString();
    const end   = new Date(date + "T23:59:59Z").toISOString();

    // Fetch all activities and filter by date
    fetch(`/api/activities?limit=500`)
      .then((r) => r.json())
      .then((data) => {
        const all = data.activities ?? [];
        const matches: any[] = [];
        for (const a of all) {
          for (const occ of a.occurrences ?? []) {
            const d = occ.plannedDate.split("T")[0];
            if (d === date) matches.push({ ...occ, activity: a });
          }
        }
        setOccs(matches);
      })
      .finally(() => setLoading(false));
  }, [date]);

  const changeDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const grouped = occurrences.reduce((acc, occ) => {
    const sub = occ.activity?.subcontractor?.name ?? occ.activity?.responsibleSubcontractorRaw ?? "Unassigned";
    if (!acc[sub]) acc[sub] = [];
    acc[sub].push(occ);
    return acc;
  }, {} as Record<string, typeof occurrences>);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Work Plan</h1>
        <p className="text-gray-500 text-sm mt-1">All activities planned for a selected date</p>
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <button onClick={() => changeDay(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <Calendar className="w-4 h-4 text-blue-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-base font-semibold text-gray-800 border-none outline-none bg-transparent"
          />
          <span className="text-sm text-gray-400">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        <button onClick={() => changeDay(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCcw className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : occurrences.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No work planned for this date</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">{occurrences.length} activities · {Object.keys(grouped).length} subcontractors</p>
          </div>
          {Object.entries(grouped).map(([sub, occs]) => (
            <div key={sub} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-gray-100">
                <Users className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-800 text-sm">{sub}</h2>
                <span className="ml-auto text-xs text-gray-400">{occs.length} activities</span>
              </div>
              <div className="divide-y divide-gray-50">
                {occs.map((occ) => (
                  <Link
                    key={occ.id}
                    href={`/activities/${occ.activity.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{truncate(occ.activity.activityDescription, 70)}</p>
                      {occ.activity.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">{occ.activity.location}</span>
                        </div>
                      )}
                      {occ.activity.category && (
                        <span className="text-xs text-gray-400">{occ.activity.category}</span>
                      )}
                    </div>
                    <StatusBadge status={occ.activity.status} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
