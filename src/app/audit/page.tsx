"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, RefreshCw, User, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

interface AuditEntry {
  id:          string;
  entityType:  string;
  entityId:    string;
  action:      string;
  fieldChanged: string | null;
  oldValue:    string | null;
  newValue:    string | null;
  changeReason: string | null;
  changedBy:   string | null;
  createdAt:   string;
  user?:       { id: string; name: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED:        "bg-green-50 text-green-700 border-green-200",
  UPDATED:        "bg-blue-50 text-blue-700 border-blue-200",
  STATUS_CHANGED: "bg-purple-50 text-purple-700 border-purple-200",
  DELETED:        "bg-red-50 text-red-700 border-red-200",
  RESTORED:       "bg-teal-50 text-teal-700 border-teal-200",
  UPLOADED:       "bg-yellow-50 text-yellow-700 border-yellow-200",
  IMPORTED:       "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const ENTITY_LABELS: Record<string, string> = {
  ACTIVITY:   "Activity",
  CONFLICT:   "Conflict",
  CONSTRAINT: "Constraint",
  DELAY:      "Delay",
  LOOKAHEAD:  "Lookahead",
  NOTE:       "Note",
  USER:       "User",
  PROJECT:    "Project",
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [logs, setLogs]               = useState<AuditEntry[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(0);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter]         = useState("");
  const [projectId, setProjectId]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((projects) => { if (projects.length > 0) setProjectId(projects[0].id); })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (projectId)        params.set("projectId",  projectId);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (actionFilter)     params.set("action",     actionFilter);

      const res  = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs  ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error("Failed to load audit log"); }
    finally  { setLoading(false); }
  }, [projectId, page, entityTypeFilter, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Audit Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Complete change history across all records · {total} entries</p>
        </div>
        <button onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={entityTypeFilter}
          onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(0); }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Entity Types</option>
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Actions</option>
          {["CREATED","UPDATED","STATUS_CHANGED","DELETED","RESTORED","UPLOADED","IMPORTED"].map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
        {(entityTypeFilter || actionFilter) && (
          <button onClick={() => { setEntityTypeFilter(""); setActionFilter(""); setPage(0); }}
            className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading audit log…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <ScrollText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No audit entries yet</p>
          <p className="text-gray-400 text-sm mt-1">Changes will appear here as users edit records.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">User</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Entity</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Action</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Field</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Before</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">After</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-700">
                          {log.user?.name ?? log.changedBy ?? "System"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs text-gray-500">
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLORS[log.action] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-500">{log.fieldChanged ?? "—"}</td>
                    <td className="py-2.5 px-4 text-xs text-gray-400 max-w-[140px] truncate" title={log.oldValue ?? ""}>
                      {log.oldValue ? <span className="line-through">{log.oldValue}</span> : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-700 max-w-[140px] truncate font-medium" title={log.newValue ?? ""}>
                      {log.newValue ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Page {page + 1} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
