"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Layers, Loader2, Upload, Trash2, Calendar, FileSpreadsheet, Clock, GitCompareArrows, Plus, Minus, ArrowRightLeft, Users, AlertTriangle, ChevronDown, ChevronRight, X, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Lookahead {
  id: string;
  name: string;
  sourceFileName: string | null;
  uploadDate: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  _count: { activities: number };
}

interface CompareResult {
  oldName: string;
  newName: string;
  oldDate: string;
  newDate: string;
  added: { description: string; sub: string | null; category: string | null }[];
  removed: { description: string; sub: string | null; category: string | null }[];
  moved: { description: string; oldStart: string | null; newStart: string | null; oldFinish: string | null; newFinish: string | null }[];
  subChanges: { description: string; oldSub: string | null; newSub: string | null }[];
  pushedForward: { description: string; oldStart: string | null; newStart: string | null }[];
  summary: { addedCount: number; removedCount: number; movedCount: number; subChangeCount: number; pushedForwardCount: number };
}

export default function LookaheadsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [lookaheads, setLookaheads] = useState<Lookahead[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedOld, setSelectedOld] = useState<string | null>(null);
  const [selectedNew, setSelectedNew] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<CompareResult | null>(null);

  // Deleted history
  const [deletedItems, setDeletedItems] = useState<(Lookahead & { deletedAt?: string })[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const lRes = await fetch(`/api/lookaheads?projectId=${proj.id}`);
    if (lRes.ok) setLookaheads(await lRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete lookahead "${name}" and all its activities? It will be moved to Deleted History.`)) return;
    const res = await fetch(`/api/lookaheads/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Lookahead deleted"); load(); }
    else toast.error("Delete failed");
  }

  async function loadDeleted() {
    if (!projectId) return;
    const res = await fetch(`/api/lookaheads?projectId=${projectId}&deleted=only`);
    if (res.ok) setDeletedItems(await res.json());
    setDeletedLoaded(true);
  }

  function toggleDeleted() {
    const next = !showDeleted;
    setShowDeleted(next);
    if (next && !deletedLoaded) loadDeleted();
  }

  async function runComparison() {
    if (!selectedOld || !selectedNew) return;
    setComparing(true);
    const res = await fetch(`/api/lookaheads/compare?oldId=${selectedOld}&newId=${selectedNew}`);
    if (res.ok) {
      setComparison(await res.json());
    } else {
      toast.error("Comparison failed");
    }
    setComparing(false);
  }

  function exitCompare() {
    setCompareMode(false);
    setSelectedOld(null);
    setSelectedNew(null);
    setComparison(null);
  }

  function handleSelect(id: string) {
    if (!compareMode) return;
    if (!selectedOld) { setSelectedOld(id); return; }
    if (selectedOld === id) { setSelectedOld(null); return; }
    if (!selectedNew) { setSelectedNew(id); return; }
    if (selectedNew === id) { setSelectedNew(null); return; }
  }

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lookaheads</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and compare your 3-week lookahead schedules</p>
        </div>
        <div className="flex items-center gap-3">
          {lookaheads.length >= 2 && !compareMode && (
            <button onClick={() => setCompareMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all">
              <GitCompareArrows className="w-4 h-4" /> Compare Versions
            </button>
          )}
          {compareMode && (
            <button onClick={exitCompare}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all">
              <X className="w-4 h-4" /> Exit Compare
            </button>
          )}
          <Link
            href={`${base}/upload`}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
          >
            <Upload className="w-4 h-4" /> Upload New
          </Link>
        </div>
      </div>

      {/* Compare mode instructions */}
      {compareMode && !comparison && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 flex items-center gap-3">
          <GitCompareArrows className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sky-300 text-sm font-semibold">
              {!selectedOld ? "Select the older lookahead (base)" : !selectedNew ? "Now select the newer lookahead to compare" : "Ready to compare"}
            </p>
            {selectedOld && selectedNew && (
              <button onClick={runComparison} disabled={comparing}
                className="mt-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {comparing ? "Comparing..." : "Run Comparison"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Comparison Results ── */}
      {comparison && (
        <div className="bg-slate-800 rounded-2xl border border-sky-500/30 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-sky-600/20 to-violet-600/20 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <GitCompareArrows className="w-5 h-5 text-sky-400" /> Lookahead Version Comparison
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">{comparison.oldName} → {comparison.newName}</p>
            </div>
            <button onClick={() => setComparison(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-5 gap-px bg-slate-700/50 border-b border-slate-700/50">
            {[
              { label: "Added", count: comparison.summary.addedCount, color: "text-emerald-400" },
              { label: "Removed", count: comparison.summary.removedCount, color: "text-red-400" },
              { label: "Moved", count: comparison.summary.movedCount, color: "text-amber-400" },
              { label: "Sub Changes", count: comparison.summary.subChangeCount, color: "text-violet-400" },
              { label: "Pushed Forward", count: comparison.summary.pushedForwardCount, color: "text-orange-400" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800 px-4 py-3 text-center">
                <p className={cn("text-xl font-black", s.color)}>{s.count}</p>
                <p className="text-slate-500 text-[10px] font-semibold uppercase">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-5 max-h-[600px] overflow-y-auto">
            {/* Added */}
            {comparison.added.length > 0 && (
              <div>
                <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Added Activities</h4>
                <div className="space-y-1.5">
                  {comparison.added.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-4 py-2">
                      <span className="text-white text-sm flex-1">{a.description}</span>
                      {a.sub && <span className="text-sky-400 text-[11px] font-medium">{a.sub}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Removed */}
            {comparison.removed.length > 0 && (
              <div>
                <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Minus className="w-3.5 h-3.5" /> Removed Activities</h4>
                <div className="space-y-1.5">
                  {comparison.removed.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-2 opacity-70">
                      <span className="text-slate-300 text-sm flex-1 line-through">{a.description}</span>
                      {a.sub && <span className="text-slate-500 text-[11px]">{a.sub}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Moved */}
            {comparison.moved.length > 0 && (
              <div>
                <h4 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><ArrowRightLeft className="w-3.5 h-3.5" /> Moved Activities</h4>
                <div className="space-y-1.5">
                  {comparison.moved.map((m, i) => (
                    <div key={i} className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-4 py-2">
                      <p className="text-white text-sm">{m.description}</p>
                      <p className="text-xs mt-1">
                        <span className="text-slate-500">{fmtDate(m.oldStart)}{m.oldFinish ? ` – ${fmtDate(m.oldFinish)}` : ""}</span>
                        <span className="text-slate-600 mx-2">→</span>
                        <span className="text-amber-400 font-semibold">{fmtDate(m.newStart)}{m.newFinish ? ` – ${fmtDate(m.newFinish)}` : ""}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub changes */}
            {comparison.subChanges.length > 0 && (
              <div>
                <h4 className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Subcontractor Changes</h4>
                <div className="space-y-1.5">
                  {comparison.subChanges.map((s, i) => (
                    <div key={i} className="bg-violet-500/5 border border-violet-500/10 rounded-lg px-4 py-2">
                      <p className="text-white text-sm">{s.description}</p>
                      <p className="text-xs mt-1">
                        <span className="text-slate-500">{s.oldSub || "Unassigned"}</span>
                        <span className="text-slate-600 mx-2">→</span>
                        <span className="text-violet-400 font-semibold">{s.newSub || "Unassigned"}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pushed forward warning */}
            {comparison.pushedForward.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <h4 className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Schedule Drift — Pushed Forward
                </h4>
                <p className="text-slate-400 text-xs mb-3">These activities were pushed to later dates. Watch for repeated delays across lookahead versions.</p>
                <div className="space-y-1.5">
                  {comparison.pushedForward.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-white flex-1">{p.description}</span>
                      <span className="text-slate-500 text-xs">{fmtDate(p.oldStart)}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-orange-400 text-xs font-semibold">{fmtDate(p.newStart)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No changes */}
            {comparison.summary.addedCount === 0 && comparison.summary.removedCount === 0 && comparison.summary.movedCount === 0 && comparison.summary.subChangeCount === 0 && (
              <p className="text-slate-500 text-center py-8">No differences found between these lookaheads.</p>
            )}
          </div>
        </div>
      )}

      {/* Lookahead list */}
      {lookaheads.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 flex items-center justify-center">
            <Layers className="w-10 h-10 text-sky-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Lookaheads Yet</p>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">Upload your first 3-week lookahead schedule to start tracking activities, subcontractors, and project progress.</p>
          <Link href={`${base}/upload`}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
            <Upload className="w-4 h-4" /> Upload Your First Lookahead
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {lookaheads.map((la) => {
            const start = la.startDate ? new Date(la.startDate) : null;
            const end = la.endDate ? new Date(la.endDate) : null;
            const dayRange = start && end ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : null;
            const isOld = selectedOld === la.id;
            const isNew = selectedNew === la.id;

            return (
              <div key={la.id}
                onClick={() => handleSelect(la.id)}
                className={cn(
                  "bg-slate-800/50 rounded-2xl border transition-all group",
                  compareMode ? "cursor-pointer" : "",
                  isOld ? "border-sky-500 bg-sky-500/5" :
                  isNew ? "border-violet-500 bg-violet-500/5" :
                  compareMode ? "border-slate-700/50 hover:border-sky-500/30" :
                  "border-slate-700/50 hover:border-sky-500/30"
                )}>
                <div className="p-5 flex items-center gap-5">
                  {/* Compare badge or icon */}
                  {compareMode ? (
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold",
                      isOld ? "bg-sky-500/20 text-sky-400" :
                      isNew ? "bg-violet-500/20 text-violet-400" :
                      "bg-slate-700/50 text-slate-500"
                    )}>
                      {isOld ? "OLD" : isNew ? "NEW" : "—"}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-sky-500/30 group-hover:to-violet-500/30 transition-all">
                      <FileSpreadsheet className="w-7 h-7 text-sky-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg truncate">{la.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      {dayRange && (
                        <span className="text-violet-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {dayRange}
                        </span>
                      )}
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Uploaded {new Date(la.uploadDate).toLocaleDateString()}
                      </span>
                    </div>
                    {la.sourceFileName && <p className="text-slate-600 text-xs mt-1 truncate">Source: {la.sourceFileName}</p>}
                  </div>

                  {/* Activity count + delete */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                      <p className="text-sky-300 text-xl font-black">{la._count.activities}</p>
                      <p className="text-sky-500/60 text-[10px] font-semibold uppercase tracking-wider">Activities</p>
                    </div>
                    {!compareMode && (
                      <button onClick={() => handleDelete(la.id, la.name)}
                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete lookahead">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ── Deleted History ── */}
      {projectId && (
        <div className="pt-2">
          <button onClick={toggleDeleted}
            className="text-sm font-bold text-slate-600 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-slate-400 transition-colors">
            <Archive className="w-4 h-4" /> Deleted History
            {deletedLoaded && <span className="text-xs font-normal">({deletedItems.length})</span>}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDeleted && "rotate-180")} />
          </button>
          {showDeleted && (
            <div className="mt-3 space-y-2">
              {!deletedLoaded && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-slate-600 animate-spin" /></div>}
              {deletedLoaded && deletedItems.length === 0 && (
                <p className="text-slate-600 text-sm px-1">No deleted lookaheads.</p>
              )}
              {deletedItems.map((la) => (
                <div key={la.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 font-medium line-through">{la.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        {la.sourceFileName && <span>{la.sourceFileName}</span>}
                        <span>Uploaded {new Date(la.uploadDate).toLocaleDateString()}</span>
                        {la.deletedAt && <span className="text-red-400/60">Deleted {new Date(la.deletedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span className="text-slate-600 text-xs">{la._count.activities} activities</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
