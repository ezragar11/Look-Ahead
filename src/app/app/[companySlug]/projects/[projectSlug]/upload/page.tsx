"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, ArrowRight, AlertTriangle, Zap, X, Eye, ChevronDown, ChevronRight as ChevRight } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";

interface PreviewActivity {
  category: string;
  activityDescription: string;
  responsibleSubcontractorRaw: string | null;
  location: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  occurrenceCount: number;
}

interface PreviewResult {
  projectName: string;
  lookaheadName: string;
  startDate: string;
  endDate: string;
  activityCount: number;
  occurrenceCount: number;
  categories: string[];
  subcontractors: string[];
  locations: string[];
  warnings: string[];
  activities: PreviewActivity[];
}

interface ImportResult {
  activitiesCreated?: number;
  activityCount?: number;
  occurrenceCount?: number;
  conflictsFound?: number;
  message?: string;
}

export default function UploadLookaheadPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step states
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showActivities, setShowActivities] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (res.ok) {
        const proj = await res.json();
        setProjectId(proj.id);
      }
    } catch { /* ignore */ }
  }, [companySlug, projectSlug]);

  useEffect(() => { loadProject(); }, [loadProject]);

  async function handleFileSelect(file: File) {
    setSelectedFile(file);
    setParsing(true);
    setPreview(null);
    setResult(null);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to parse file");
        toast.error(data.error ?? "Parse failed");
        return;
      }
      setPreview(data);
    } catch {
      setError("Failed to parse file — check format");
      toast.error("Parse failed");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!selectedFile || !projectId) return;
    setImporting(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("projectId", projectId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        toast.error(data.error ?? "Import failed");
        return;
      }
      setResult(data);
      setPreview(null);
      toast.success(`Imported ${data.activitiesCreated ?? data.activityCount ?? 0} activities`);
    } catch {
      setError("Import failed");
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  function resetAll() {
    setPreview(null);
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setShowActivities(false);
  }

  const actCount = result?.activitiesCreated ?? result?.activityCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Lookahead</h1>
        <p className="text-slate-500 text-sm mt-1">Import your 3-week lookahead schedule from Excel</p>
      </div>

      {/* ── Step 1: File drop zone (shown when no preview and no result) ── */}
      {!preview && !result && (
        <div
          onClick={() => !parsing && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          className={cn(
            "rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all",
            dragOver
              ? "border-sky-400 bg-sky-500/10"
              : "border-slate-700 bg-slate-800/50 hover:border-sky-500/50 hover:bg-slate-800/80"
          )}
        >
          {parsing ? (
            <div>
              <Loader2 className="w-14 h-14 text-sky-400 animate-spin mx-auto mb-4" />
              <p className="text-white text-lg font-semibold">Analyzing File...</p>
              <p className="text-slate-500 text-sm mt-1">Detecting activities, subcontractors, and dates</p>
            </div>
          ) : (
            <div>
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 flex items-center justify-center">
                <FileSpreadsheet className="w-10 h-10 text-sky-400" />
              </div>
              <p className="text-white text-lg font-semibold">Drop your Excel file here</p>
              <p className="text-slate-500 text-sm mt-1">or click to browse — you'll preview before importing</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-semibold">.xlsx</span>
                <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold">.xls</span>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        </div>
      )}

      {/* ── Step 2: Import Preview ── */}
      {preview && !result && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-2xl border border-sky-500/30 overflow-hidden">
            {/* Preview header */}
            <div className="px-6 py-4 bg-gradient-to-r from-sky-600/20 to-violet-600/20 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-white font-semibold">Import Preview</h3>
                  <p className="text-slate-400 text-xs">{selectedFile?.name}</p>
                </div>
              </div>
              <button onClick={resetAll} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detected info */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Project</p>
                  <p className="text-white font-medium text-sm mt-0.5">{preview.projectName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Lookahead</p>
                  <p className="text-white font-medium text-sm mt-0.5">{preview.lookaheadName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Date Range</p>
                  <p className="text-violet-400 font-medium text-sm mt-0.5">
                    {new Date(preview.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(preview.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Activities</p>
                    <p className="text-sky-400 font-black text-xl mt-0.5">{preview.activityCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Work Days</p>
                    <p className="text-emerald-400 font-black text-xl mt-0.5">{preview.occurrenceCount}</p>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-2">Detected Categories ({preview.categories.length})</p>
                <div className="flex flex-wrap gap-2">
                  {preview.categories.map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-slate-700/50 text-slate-300 text-[11px] font-medium rounded-lg">{c}</span>
                  ))}
                </div>
              </div>

              {/* Subcontractors */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-2">Detected Subcontractors ({preview.subcontractors.length})</p>
                <div className="flex flex-wrap gap-2">
                  {preview.subcontractors.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-sky-500/10 text-sky-400 text-[11px] font-semibold rounded-lg">{s}</span>
                  ))}
                </div>
              </div>

              {/* Locations */}
              {preview.locations.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-2">Detected Locations ({preview.locations.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.locations.map((l) => (
                      <span key={l} className="px-2.5 py-1 bg-violet-500/10 text-violet-400 text-[11px] font-medium rounded-lg">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Warnings
                  </p>
                  <ul className="space-y-1">
                    {preview.warnings.map((w, i) => (
                      <li key={i} className="text-amber-300/80 text-sm">• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activity list (collapsible) */}
              <div>
                <button onClick={() => setShowActivities(!showActivities)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  {showActivities ? <ChevronDown className="w-4 h-4" /> : <ChevRight className="w-4 h-4" />}
                  {showActivities ? "Hide" : "Show"} Activity Details ({preview.activityCount})
                </button>
                {showActivities && (
                  <div className="mt-3 bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-900">
                        <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                          <th className="px-4 py-2.5 text-left font-semibold">Activity</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Sub</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Location</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {preview.activities.map((a, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 text-white text-xs max-w-[250px] truncate">{a.activityDescription}</td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">{a.category}</td>
                            <td className="px-3 py-2 text-sky-400 text-[11px] font-medium">{a.responsibleSubcontractorRaw || <span className="text-slate-600">—</span>}</td>
                            <td className="px-3 py-2 text-slate-400 text-[11px]">{a.location || <span className="text-slate-600">—</span>}</td>
                            <td className="px-3 py-2 text-right text-emerald-400 text-[11px] font-semibold">{a.occurrenceCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
              <button onClick={resetAll} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={confirmImport} disabled={importing}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20">
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Confirm Import ({preview.activityCount} activities)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Import Complete ── */}
      {result && (
        <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-16 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Import Complete!</p>

          <div className="flex items-center justify-center gap-6 mt-4 mb-2">
            <div className="text-center">
              <p className="text-emerald-400 text-3xl font-black">{actCount}</p>
              <p className="text-slate-500 text-xs">Activities</p>
            </div>
            {(result.occurrenceCount ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-sky-400 text-3xl font-black">{result.occurrenceCount}</p>
                <p className="text-slate-500 text-xs">Work Days</p>
              </div>
            )}
            {(result.conflictsFound ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-orange-400 text-3xl font-black">{result.conflictsFound}</p>
                <p className="text-slate-500 text-xs">Conflicts Found</p>
              </div>
            )}
          </div>

          {result.message && (
            <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">{result.message}</p>
          )}

          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={resetAll}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all">
              Upload Another
            </button>
            <Link href={`${base}/schedule`}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 text-white rounded-xl text-sm font-semibold transition-all">
              View Schedule <ArrowRight className="w-4 h-4" />
            </Link>
            {(result.conflictsFound ?? 0) > 0 && (
              <Link href={`${base}/conflicts`}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600/20 border border-orange-500/30 text-orange-300 rounded-xl text-sm font-semibold transition-all hover:bg-orange-600/30">
                <AlertTriangle className="w-4 h-4" /> View Conflicts
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 rounded-xl border border-red-500/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Upload Error</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Format guide */}
      {!preview && !result && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
          <h3 className="text-white font-semibold mb-3">Supported Formats</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sky-400 text-sm font-bold mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> 3-Week Lookahead (X-mark format)
              </p>
              <p className="text-slate-500 text-sm mb-3">Spreadsheets with date columns and X marks showing planned work days. The system detects week groupings, categories, subcontractors, and locations automatically.</p>
              <div className="flex flex-wrap gap-2">
                {["Activity rows", "Category rows", "X marks → dates", "Subcontractors", "Locations", "Week labels"].map(tag => (
                  <span key={tag} className="text-[10px] text-slate-400 bg-slate-700/50 px-2 py-1 rounded">{tag}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-violet-400 text-sm font-bold mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Column-Based Schedule
              </p>
              <p className="text-slate-500 text-sm mb-3">Spreadsheets with standard columns for activity data:</p>
              <div className="grid grid-cols-2 gap-2">
                {["Activity Description", "Planned Start", "Planned Finish", "Subcontractor", "Category", "Location", "Status", "% Complete"].map((col) => (
                  <div key={col} className="px-2.5 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <span className="text-slate-300 text-[11px] font-medium">{col}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
