"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Printer, Loader2 } from "lucide-react";

interface Activity {
  id: string;
  activityDescription: string;
  category: string | null;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  responsibleSubcontractorRaw: string | null;
  location: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getWeekDates(startOffset: number) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + startOffset * 7);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function isInRange(activity: Activity, start: Date, end: Date) {
  const aStart = activity.plannedStart ? new Date(activity.plannedStart) : null;
  const aEnd = activity.plannedFinish ? new Date(activity.plannedFinish) : null;
  if (!aStart && !aEnd) return false;
  const s = aStart ?? aEnd!;
  const e = aEnd ?? aStart!;
  return s <= end && e >= start;
}

export default function PrintLookaheadPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) return;
      const proj = await pRes.json();
      setProjectName(proj.projectName ?? projectSlug);
      const bRes = await fetch(`/api/projects/${proj.id}/bundle`);
      if (bRes.ok) {
        const data = await bRes.json();
        setActivities(data.activities ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  const week1 = getWeekDates(0);
  const week2 = getWeekDates(1);
  const week3 = getWeekDates(2);
  const allWeeks = [
    { label: "Week 1", days: week1 },
    { label: "Week 2", days: week2 },
    { label: "Week 3", days: week3 },
  ];

  const threeWeekStart = week1[0];
  const threeWeekEnd = week3[4];

  const relevantActivities = activities.filter(a =>
    a.status !== "COMPLETE" && isInRange(a, threeWeekStart, threeWeekEnd)
  );

  const bySub = new Map<string, Activity[]>();
  for (const a of relevantActivities) {
    const sub = a.responsibleSubcontractorRaw || "Unassigned";
    if (!bySub.has(sub)) bySub.set(sub, []);
    bySub.get(sub)!.push(a);
  }
  const sortedSubs = [...bySub.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Screen controls - hidden when printing */}
      <div className="print:hidden mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Print 3-Week Lookahead</h1>
          <p className="text-slate-500 text-sm mt-1">{relevantActivities.length} activities across {sortedSubs.length} subcontractors</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      {/* Printable content */}
      <div className="print:m-0 print:p-0 bg-white text-black print:text-black rounded-xl print:rounded-none overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{projectName}</h1>
              <p className="text-sm text-gray-600">3-Week Lookahead Schedule</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Prepared: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              <p>{fmtDate(threeWeekStart.toISOString())} - {fmtDate(threeWeekEnd.toISOString())}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5 text-left font-bold w-[30%]">Activity</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left font-bold w-[12%]">Location</th>
              {allWeeks.map((week) => (
                <th key={week.label} colSpan={5} className="border border-gray-300 px-1 py-1.5 text-center font-bold">
                  {week.label} ({fmtDate(week.days[0].toISOString())} - {fmtDate(week.days[4].toISOString())})
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-2 py-1"></th>
              <th className="border border-gray-300 px-2 py-1"></th>
              {allWeeks.flatMap((week) =>
                week.days.map((d) => (
                  <th key={d.toISOString()} className="border border-gray-300 px-0.5 py-1 text-center text-[10px] font-medium w-[3.7%]">
                    {d.toLocaleDateString("en-US", { weekday: "short" }).charAt(0)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {sortedSubs.map(([sub, subActivities]) => (
              <>
                <tr key={`h-${sub}`} className="bg-gray-200">
                  <td colSpan={17} className="border border-gray-300 px-2 py-1.5 font-bold text-xs">
                    {sub} ({subActivities.length})
                  </td>
                </tr>
                {subActivities.map((a) => {
                  const aStart = a.plannedStart ? new Date(a.plannedStart) : null;
                  const aEnd = a.plannedFinish ? new Date(a.plannedFinish) : null;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 text-[10px]">{a.activityDescription}</td>
                      <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-600">{a.location ?? ""}</td>
                      {allWeeks.flatMap((week) =>
                        week.days.map((d) => {
                          const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
                          const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
                          const active = aStart && aEnd && aStart <= dayEnd && aEnd >= dayStart;
                          return (
                            <td key={d.toISOString()} className="border border-gray-300 px-0 py-0 text-center">
                              {active && (
                                <div className="w-full h-4 bg-blue-500 print:bg-blue-600" />
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-300 flex justify-between text-[10px] text-gray-500">
          <span>LookAhead Pro - {projectName}</span>
          <span>{relevantActivities.length} activities | {sortedSubs.length} subcontractors</span>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, aside, .print\\:hidden { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          @page { size: landscape; margin: 0.5cm; }
        }
      `}</style>
    </>
  );
}
