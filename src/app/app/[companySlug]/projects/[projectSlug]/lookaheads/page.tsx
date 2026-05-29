"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Layers, Loader2, Upload, Trash2, Calendar, FileSpreadsheet,
  ArrowLeftRight, Plus, Minus, Users, AlertTriangle,
  ChevronDown, ChevronUp, Archive, Clock, TrendingDown, TrendingUp,
  Repeat, HardHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Lookahead {
  id: string;
  name: string;
  sourceFileName: string | null;
  uploadDate: string;
  startDate: string | null;
  endDate: string | null;
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
  pushedForward: { description: string; oldStart: string | null; newStart: string | null; oldFinish: string | null; newFinish: string | null }[];
  summary: { addedCount: number; removedCount: number; movedCount: number; subChangeCount: number; pushedForwardCount: number };
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysDiff(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function LookaheadsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [lookaheads, setLookaheads] = useState<Lookahead[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [oldId, setOldId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>("slipped");

  const [deletedItems, setDeletedItems] = useState<(Lookahead & { deletedAt?: string })[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const lRes = await fetch(`/api/lookaheads?projectId=${proj.id}`);
      if (lRes.ok) {
        const data: Lookahead[] = await lRes.json();
        setLookaheads(data);
        if (data.length >= 2) { setNewId(data[0].id); setOldId(data[1].id); }
        else if (data.length === 1) { setNewId(data[0].id); }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function runCompare() {
    if (!oldId || !newId || oldId === newId) { toast.error("Select two different lookaheads"); return; }
    setComparing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/lookaheads/compare?oldId=${oldId}&newId=${newId}`);
      if (res.ok) { setResult(await res.json()); setExpanded("slipped"); }
      else toast.error("Comparison failed");
    } catch { toast.error("Comparison failed"); }
    finally { setComparing(false); }
  }

  function deleteLookahead(id: string) {
    const prev = lookaheads;
    setLookaheads(ls => ls.filter(l => l.id !== id));
    if (oldId === id) setOldId(null);
    if (newId === id) setNewId(null);
    let cancelled = false;
    const tid = setTimeout(async () => {
      if (cancelled) return;
      const res = await fetch(`/api/lookaheads/${id}`, { method: "DELETE" });
      if (!res.ok) { setLookaheads(prev); toast.error("Delete failed — reverted"); }
    }, 4000);
    toast((t) => (
      <span className="flex items-center gap-3">
        Lookahead deleted
        <button className="font-bold text-sky-500 hover:text-sky-400" onClick={() => { cancelled = true; clearTimeout(tid); setLookaheads(prev); toast.dismiss(t.id); }}>
          Undo
        </button>
      </span>
    ), { duration: 4000 });
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

  function toggle(s: string) { setExpanded(expanded === s ? null : s); }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const r = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lookahead History</h1>
          <p className="text-slate-500 text-sm mt-1">
            {lookaheads.length} upload{lookaheads.length !== 1 ? "s" : ""} — compare versions to see what slipped
          </p>
        </div>
        <Link href={`${base}/upload`}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
        >
          <Upload className="w-4 h-4" /> Upload New
        </Link>
      </div>

      {/* Upload list */}
      {lookaheads.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <Layers className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">No Lookaheads Uploaded</p>
          <p className="text-slate-500 text-sm mt-2">Upload your first 3-week lookahead to start tracking.</p>
          <Link href={`${base}/upload`} className="mt-4 inline-block text-sky-400 hover:text-sky-300 text-sm font-medium">Upload now →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {lookaheads.map((l) => (
            <div key={l.id} className={cn(
              "rounded-xl border p-4 flex items-center gap-4 transition-all",
              l.id === newId ? "bg-emerald-500/5 border-emerald-500/30" :
              l.id === oldId ? "bg-amber-500/5 border-amber-500/30" :
              "bg-slate-800/30 border-slate-700/50 hover:border-slate-600"
            )}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-sky-500/20 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{l.name || l.sourceFileName || "Lookahead"}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(l.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>{l._count.activities} activities</span>
                  {l.startDate && l.endDate && <span>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setOldId(l.id)}
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                    l.id === oldId ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-slate-700 text-slate-500 hover:text-amber-300 hover:border-amber-500/30"
                  )}>Old</button>
                <button onClick={() => setNewId(l.id)}
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                    l.id === newId ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/30"
                  )}>New</button>
                <button onClick={() => deleteLookahead(l.id)} className="px-2 py-1 text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compare button */}
      {lookaheads.length >= 2 && (
        <div className="flex justify-center">
          <button onClick={runCompare} disabled={comparing || !oldId || !newId || oldId === newId}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            {comparing ? "Comparing…" : "Compare Lookaheads"}
          </button>
        </div>
      )}

      {/* Compare results */}
      {r && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 space-y-4">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-orange-400" /> Comparison Results
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              <span className="text-amber-300">{r.oldName}</span> ({fmtDate(r.oldDate)})
              {" → "}
              <span className="text-emerald-300">{r.newName}</span> ({fmtDate(r.newDate)})
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Slipped", count: r.summary.pushedForwardCount, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: TrendingDown },
              { label: "Date Changes", count: r.summary.movedCount, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
              { label: "Added", count: r.summary.addedCount, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Plus },
              { label: "Removed", count: r.summary.removedCount, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: Minus },
              { label: "Sub Changes", count: r.summary.subChangeCount, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", icon: HardHat },
            ].map(({ label, count, color, bg, border, icon: Icon }) => (
              <div key={label} className={cn("rounded-xl border p-3 text-center", bg, border)}>
                <Icon className={cn("w-4 h-4 mx-auto mb-1", color)} />
                <p className={cn("text-2xl font-black", color)}>{count}</p>
                <p className="text-slate-600 text-[10px] font-bold uppercase">{label}</p>
              </div>
            ))}
          </div>

          {/* No changes */}
          {r.summary.addedCount + r.summary.removedCount + r.summary.movedCount + r.summary.subChangeCount === 0 && (
            <p className="text-slate-500 text-center py-8">No differences found between these two uploads.</p>
          )}

          {/* Slipped — the key insight */}
          {r.pushedForward.length > 0 && (
            <CollapsibleSection
              title={`Slipped Activities (${r.pushedForward.length})`}
              subtitle="Pushed later — schedule risk"
              icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              open={expanded === "slipped"} onToggle={() => toggle("slipped")}
            >
              {r.pushedForward.map((m, i) => {
                const d = daysDiff(m.oldStart, m.newStart);
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                    <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{m.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        {m.oldStart && m.newStart && <span>Start: {fmtDate(m.oldStart)} → {fmtDate(m.newStart)}</span>}
                        {m.oldFinish && m.newFinish && <span>Finish: {fmtDate(m.oldFinish)} → {fmtDate(m.newFinish)}</span>}
                      </div>
                    </div>
                    {d != null && d > 0 && <span className="text-red-400 text-xs font-bold flex-shrink-0">+{d}d</span>}
                  </div>
                );
              })}
            </CollapsibleSection>
          )}

          {/* All date changes */}
          {r.moved.length > 0 && (
            <CollapsibleSection
              title={`Date Changes (${r.moved.length})`}
              subtitle="Modified start or finish dates"
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              open={expanded === "moved"} onToggle={() => toggle("moved")}
            >
              {r.moved.map((m, i) => {
                const d = daysDiff(m.oldStart, m.newStart);
                const slipped = d != null && d > 0;
                const advanced = d != null && d < 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30">
                    {slipped ? <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> :
                     advanced ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> :
                     <Repeat className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{m.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        {m.oldStart !== m.newStart && <span>Start: {fmtDate(m.oldStart)} → {fmtDate(m.newStart)}</span>}
                        {m.oldFinish !== m.newFinish && <span>Finish: {fmtDate(m.oldFinish)} → {fmtDate(m.newFinish)}</span>}
                      </div>
                    </div>
                    {d != null && d !== 0 && (
                      <span className={cn("text-xs font-bold flex-shrink-0", d > 0 ? "text-red-400" : "text-emerald-400")}>
                        {d > 0 ? "+" : ""}{d}d
                      </span>
                    )}
                  </div>
                );
              })}
            </CollapsibleSection>
          )}

          {/* Added */}
          {r.added.length > 0 && (
            <CollapsibleSection
              title={`New Activities (${r.added.length})`}
              subtitle="Added in the newer upload"
              icon={<Plus className="w-4 h-4 text-emerald-400" />}
              open={expanded === "added"} onToggle={() => toggle("added")}
            >
              {r.added.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <Plus className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-white text-sm truncate flex-1">{a.description}</span>
                  {a.sub && <span className="text-violet-400/60 text-xs flex-shrink-0">{a.sub}</span>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Removed */}
          {r.removed.length > 0 && (
            <CollapsibleSection
              title={`Removed Activities (${r.removed.length})`}
              subtitle="No longer in the newer upload"
              icon={<Minus className="w-4 h-4 text-slate-400" />}
              open={expanded === "removed"} onToggle={() => toggle("removed")}
            >
              {r.removed.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
                  <Minus className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-400 text-sm truncate flex-1 line-through">{a.description}</span>
                  {a.sub && <span className="text-slate-600 text-xs flex-shrink-0">{a.sub}</span>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Sub changes */}
          {r.subChanges.length > 0 && (
            <CollapsibleSection
              title={`Subcontractor Changes (${r.subChanges.length})`}
              subtitle="Reassigned to different subs"
              icon={<HardHat className="w-4 h-4 text-violet-400" />}
              open={expanded === "subs"} onToggle={() => toggle("subs")}
            >
              {r.subChanges.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                  <HardHat className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                  <span className="text-white text-sm truncate flex-1">{s.description}</span>
                  <span className="text-xs flex-shrink-0">
                    <span className="text-amber-400">{s.oldSub || "None"}</span>
                    {" → "}
                    <span className="text-emerald-400">{s.newSub || "None"}</span>
                  </span>
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* Deleted History */}
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
              {deletedLoaded && deletedItems.length === 0 && <p className="text-slate-600 text-sm px-1">No deleted lookaheads.</p>}
              {deletedItems.map((la) => (
                <div key={la.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 font-medium line-through">{la.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        <span>Uploaded {new Date(la.uploadDate).toLocaleDateString()}</span>
                        {la.deletedAt && <span className="text-red-400/60">Deleted {new Date(la.deletedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
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

function CollapsibleSection({ title, subtitle, icon, open, onToggle, children }: {
  title: string; subtitle: string; icon: React.ReactNode;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-1 py-2 text-left hover:opacity-80 transition-opacity">
        {icon}
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="text-slate-600 text-xs">{subtitle}</span>
        <div className="ml-auto">
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>
      {open && <div className="space-y-1.5 mt-1">{children}</div>}
    </div>
  );
}
