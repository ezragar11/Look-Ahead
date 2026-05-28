"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ScrollText, Loader2, Clock, Activity, Settings, Upload, Trash2, Search, ChevronLeft, ChevronRight, AlertTriangle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  changeReason: string | null;
  changedBy: string | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: "text-emerald-400 bg-emerald-500/15",
  STATUS_CHANGED: "text-sky-400 bg-sky-500/15",
  UPDATED: "text-amber-400 bg-amber-500/15",
  DELETED: "text-red-400 bg-red-500/15",
};

const ENTITY_TYPES = ["", "ACTIVITY", "CONFLICT", "CONSTRAINT", "DELAY", "LOOKAHEAD", "PROJECT"];
const ACTIONS = ["", "CREATED", "UPDATED", "STATUS_CHANGED", "DELETED"];

const PAGE_SIZE = 50;

export default function ProjectAuditPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!projectId) {
        const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
        if (!pRes.ok) { setError("Project not found"); setLoading(false); return; }
        const proj = await pRes.json();
        setProjectId(proj.id);
        return; // will re-trigger via useEffect
      }

      const params = new URLSearchParams({ projectId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (filterEntity) params.set("entityType", filterEntity);
      if (filterAction) params.set("action", filterAction);
      if (filterUser) params.set("userId", filterUser);

      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) { setError("Failed to load audit log"); setLoading(false); return; }
      const data = await res.json();

      // Handle both { logs, total } wrapper and flat array response
      if (Array.isArray(data)) {
        setLogs(data);
        setTotal(data.length);
      } else if (data.logs) {
        setLogs(data.logs);
        setTotal(data.total ?? data.logs.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch {
      setError("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [companySlug, projectSlug, projectId, page, filterEntity, filterAction, filterUser]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Group by date
  const grouped: Record<string, AuditEntry[]> = {};
  logs.forEach((l) => {
    try {
      const dateKey = new Date(l.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(l);
    } catch { /* skip malformed dates */ }
  });

  function formatAction(action: string): string {
    return action.replace(/_/g, " ").toLowerCase();
  }

  function formatEntity(type: string): string {
    return type.toLowerCase();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-slate-500 text-sm mt-1">{total} entries tracked</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        <select value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(0); }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Types</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Actions</option>
          {ACTIONS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 rounded-xl border border-red-500/20 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>
      )}

      {/* Empty */}
      {!loading && !error && logs.length === 0 && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-500/10 to-slate-600/10 flex items-center justify-center">
            <ScrollText className="w-10 h-10 text-slate-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Audit Entries</p>
          <p className="text-slate-500 text-sm mt-2">Actions on this project will be logged here.</p>
        </div>
      )}

      {/* Log entries grouped by date */}
      {!loading && !error && logs.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1 mb-3">{date}</h2>
              <div className="space-y-2">
                {entries.map((l) => {
                  const colorClass = ACTION_COLORS[l.action] ?? "text-slate-400 bg-slate-500/15";
                  return (
                    <div key={l.id} className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 flex items-start gap-4 hover:border-slate-600/50 transition-all">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold", colorClass)}>
                        {l.action === "DELETED" ? <Trash2 className="w-4 h-4" /> :
                         l.action === "CREATED" ? <Upload className="w-4 h-4" /> :
                         l.action === "STATUS_CHANGED" ? <Activity className="w-4 h-4" /> :
                         <Settings className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">
                          <span className="font-semibold">{l.user?.name ?? l.changedBy ?? "System"}</span>
                          <span className="text-slate-400"> {formatAction(l.action)}</span>
                          <span className="text-slate-500"> {formatEntity(l.entityType)}</span>
                        </p>
                        {l.fieldChanged && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            Changed <span className="text-slate-400 font-medium">{l.fieldChanged}</span>
                            {l.oldValue && <> from <span className="text-red-400/70 font-mono text-[11px]">{l.oldValue}</span></>}
                            {l.newValue && <> to <span className="text-emerald-400/70 font-mono text-[11px]">{l.newValue}</span></>}
                          </p>
                        )}
                        {l.changeReason && <p className="text-slate-600 text-xs mt-0.5">Reason: {l.changeReason}</p>}
                      </div>
                      <span className="text-slate-600 text-[11px] flex-shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-slate-500 text-xs">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-400 text-sm px-2">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
