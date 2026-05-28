"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  Printer,
} from "lucide-react";

interface SubWorkload {
  subcontractorId: string;
  subcontractorName: string;
  planned: number;
  complete: number;
  inProgress: number;
  delayed: number;
  blocked: number;
  total: number;
}

interface DashboardStats {
  totalActivities: number;
  planned: number;
  inProgress: number;
  complete: number;
  delayed: number;
  blocked: number;
  missed: number;
  needsFollowUp: number;
  openConflicts: number;
  subcontractorWorkload: {
    name: string;
    total: number;
    complete: number;
    delayed: number;
    planned: number;
  }[];
  recentLookaheads: {
    id: string;
    name: string;
    uploadDate: string;
    _count: { activities: number };
    project: { projectName: string };
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED:     "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  COMPLETE:    "bg-green-500",
  DELAYED:     "bg-red-500",
  BLOCKED:     "bg-red-800",
  NOT_STARTED: "bg-gray-300",
  ON_HOLD:     "bg-gray-400",
  CANCELLED:   "bg-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED:     "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETE:    "Complete",
  DELAYED:     "Delayed",
  BLOCKED:     "Blocked",
  NOT_STARTED: "Not Started",
  ON_HOLD:     "On Hold",
  CANCELLED:   "Cancelled",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, dashRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/dashboard"),
      ]);
      const projects = await projectsRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);
      if (dashRes.ok) setStats(await dashRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function printReport() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Weekly performance summary</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading report data…</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.totalActivities === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Weekly performance summary</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No data available</p>
          <p className="text-gray-400 text-sm mt-1">
            Upload a lookahead file to generate reports.
          </p>
        </div>
      </div>
    );
  }

  const {
    totalActivities,
    planned,
    inProgress,
    complete,
    delayed,
    blocked,
    missed,
    needsFollowUp,
    openConflicts,
    subcontractorWorkload,
    recentLookaheads,
  } = stats;

  const completionRate = totalActivities > 0 ? Math.round((complete / totalActivities) * 100) : 0;
  const activeWork = (inProgress ?? 0) + (planned ?? 0);
  const issues = (delayed ?? 0) + (blocked ?? 0);

  const byStatus: Record<string, number> = {
    PLANNED:        planned     ?? 0,
    IN_PROGRESS:    inProgress  ?? 0,
    COMPLETE:       complete    ?? 0,
    DELAYED:        delayed     ?? 0,
    BLOCKED:        blocked     ?? 0,
    MISSED:         missed      ?? 0,
    NEEDS_FOLLOW_UP: needsFollowUp ?? 0,
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Weekly performance summary · {today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">LookAhead Pro — Weekly Report</h1>
        <p className="text-gray-500 text-sm">{today}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Completion Rate
          </p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-3xl font-bold text-green-600">{completionRate}%</p>
            {completionRate >= 70 ? (
              <TrendingUp className="w-5 h-5 text-green-500 mb-1" />
            ) : completionRate >= 40 ? (
              <Minus className="w-5 h-5 text-yellow-500 mb-1" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500 mb-1" />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {complete} of {totalActivities} activities
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Active Work
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{activeWork}</p>
          <p className="text-xs text-gray-400 mt-1">
            {inProgress} in progress · {planned} planned
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Issues
          </p>
          <p className={`text-3xl font-bold mt-1 ${issues > 0 ? "text-red-600" : "text-gray-400"}`}>
            {issues}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {delayed} delayed · {blocked} blocked
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Open Conflicts
          </p>
          <p className={`text-3xl font-bold mt-1 ${openConflicts > 0 ? "text-orange-500" : "text-gray-400"}`}>
            {openConflicts}
          </p>
          <p className="text-xs text-gray-400 mt-1">Require attention</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          Activity Status Breakdown
        </h2>
        <div className="space-y-3">
          {Object.entries(byStatus)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 flex-shrink-0">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_COLORS[status] ?? "bg-gray-400"}`}
                    style={{ width: `${totalActivities > 0 ? (count / totalActivities) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">
                  {count}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0}%
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Subcontractor performance table */}
      {subcontractorWorkload.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            Subcontractor Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">
                    Subcontractor
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 px-2">
                    Total
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 px-2">
                    Complete
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 px-2">
                    In Progress
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 px-2">
                    Delayed
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pl-4">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {subcontractorWorkload
                  .sort((a, b) => b.total - a.total)
                  .map((sub) => {
                    return (
                      <tr key={sub.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 pr-4 font-medium text-gray-700">
                          {sub.name}
                        </td>
                        <td className="py-2.5 px-2 text-right text-gray-600">{sub.total}</td>
                        <td className="py-2.5 px-2 text-right text-green-600 font-medium">
                          {sub.complete}
                        </td>
                        <td className="py-2.5 px-2 text-right text-yellow-600">
                          {sub.total - sub.complete - sub.delayed - sub.planned}
                        </td>
                        <td className="py-2.5 px-2 text-right text-red-500">{sub.delayed}</td>
                        <td className="py-2.5 pl-4">
                          <ProgressBar value={sub.complete} max={sub.total} color="bg-green-500" />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent lookaheads */}
      {recentLookaheads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Uploaded Lookaheads
          </h2>
          <div className="space-y-2">
            {recentLookaheads.map((la, i) => (
              <div
                key={la.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{la.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(la.uploadDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {la.project?.projectName ? ` · ${la.project.projectName}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-700">
                    {la._count?.activities ?? 0}
                  </span>
                  <p className="text-xs text-gray-400">activities</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts section */}
      {(issues > 0 || openConflicts > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Items Requiring Attention</p>
              <ul className="text-sm text-orange-700 mt-1 space-y-0.5 list-disc list-inside">
                {delayed > 0 && <li>{delayed} activities marked as delayed</li>}
                {blocked > 0 && <li>{blocked} activities currently blocked</li>}
                {openConflicts > 0 && (
                  <li>
                    <a href="/conflicts" className="underline hover:text-orange-900">
                      {openConflicts} open conflict{openConflicts !== 1 ? "s" : ""} — click to review
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
