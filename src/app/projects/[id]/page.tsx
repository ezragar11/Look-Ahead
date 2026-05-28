"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  FolderOpen, Upload, FileText, Trash2, Brain, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Info, XCircle, RefreshCw, FileImage,
  FileArchive, Layers, ClipboardList, FileCheck, HardHat, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  pageCount: number | null;
  extractedText: string | null;
  createdAt: string;
}

interface AIAnalysis {
  id: string;
  title: string;
  analysisType: string;
  status: string;
  resultJson: string | null;
  errorMessage: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface AnalysisResult {
  summary: string;
  overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  scorecard: {
    scheduleCompleteness: number;
    scopeAlignment: number;
    resourceAdequacy: number;
    sequenceLogic: number;
  };
  findings: Array<{
    severity: "INFO" | "WARNING" | "CRITICAL";
    category: string;
    title: string;
    detail: string;
    recommendation: string;
    affectedActivities?: string[];
  }>;
  positives: string[];
  immediateActions: string[];
}

interface Project {
  id: string;
  projectName: string;
  description: string | null;
  _count: { activities: number; lookaheads: number; documents: number };
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  SCOPE_OF_WORK: "Scope of Work",
  BLUEPRINT:     "Blueprint / Drawing",
  SPECIFICATION: "Specification",
  SUBMITTAL:     "Submittal",
  CONTRACT:      "Contract",
  RFI_LOG:       "RFI Log",
  SCHEDULE:      "Schedule",
  OTHER:         "Other",
};

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  SCOPE_OF_WORK: ClipboardList,
  BLUEPRINT:     Layers,
  SPECIFICATION: FileCheck,
  SUBMITTAL:     FileText,
  CONTRACT:      FileArchive,
  RFI_LOG:       FileText,
  SCHEDULE:      HardHat,
  OTHER:         FileText,
};

const RISK_COLORS: Record<string, string> = {
  LOW:      "text-green-400  bg-green-900/30  border-green-700",
  MEDIUM:   "text-yellow-400 bg-yellow-900/30 border-yellow-700",
  HIGH:     "text-orange-400 bg-orange-900/30 border-orange-700",
  CRITICAL: "text-red-400    bg-red-900/30    border-red-700",
};

const SEVERITY_ICON: Record<string, React.ElementType> = {
  INFO:     Info,
  WARNING:  AlertTriangle,
  CRITICAL: XCircle,
};
const SEVERITY_COLOR: Record<string, string> = {
  INFO:     "text-blue-400   border-blue-800",
  WARNING:  "text-yellow-400 border-yellow-800",
  CRITICAL: "text-red-400    border-red-800",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectHubPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"overview" | "documents" | "analysis">("overview");

  const [project,   setProject]   = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [analyses,  setAnalyses]  = useState<AIAnalysis[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Upload state
  const fileInputRef                   = useRef<HTMLInputElement>(null);
  const [uploading,   setUploading]    = useState(false);
  const [uploadType,  setUploadType]   = useState("OTHER");
  const [uploadName,  setUploadName]   = useState("");
  const [dragOver,    setDragOver]     = useState(false);

  // Analysis state
  const [selectedDocs,  setSelectedDocs]  = useState<Set<string>>(new Set());
  const [analysisTitle, setAnalysisTitle] = useState("Schedule vs. Documents Analysis");
  const [running,       setRunning]       = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [parsedResult, setParsedResult]   = useState<Record<string, AnalysisResult>>({});

  // Load project + documents + analyses
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, dRes, aRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/documents`),
        fetch(`/api/projects/${id}/analyze`),
      ]);
      if (pRes.ok) setProject(await pRes.json());
      if (dRes.ok) setDocuments(await dRes.json());
      if (aRes.ok) setAnalyses(await aRes.json());
    } catch {
      toast.error("Failed to load project data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Upload ──────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", uploadType);
      fd.append("name", uploadName || file.name);
      const res  = await fetch(`/api/projects/${id}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Upload failed"); return; }
      toast.success("Document uploaded");
      setUploadName("");
      setDocuments((prev) => [data, ...prev]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function deleteDoc(docId: string) {
    if (!confirm("Remove this document?")) return;
    const res = await fetch(`/api/projects/${id}/documents?docId=${docId}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocs((prev) => { const next = new Set(prev); next.delete(docId); return next; });
      toast.success("Document removed");
    } else {
      toast.error("Failed to remove document");
    }
  }

  // ── Analysis ────────────────────────────────────────────────────────────

  async function runAnalysis() {
    setRunning(true);
    try {
      const res  = await fetch(`/api/projects/${id}/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:       analysisTitle,
          documentIds: selectedDocs.size > 0 ? Array.from(selectedDocs) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 422) {
        toast.error(data.error ?? "Analysis failed");
        return;
      }
      if (data.status === "FAILED") {
        toast.error(`Analysis failed: ${data.errorMessage}`);
      } else {
        toast.success("Analysis complete!");
      }
      setAnalyses((prev) => [data, ...prev]);
      setExpandedAnalysis(data.id);
      setTab("analysis");

      // Parse result
      if (data.resultJson) {
        try {
          const parsed = JSON.parse(data.resultJson);
          setParsedResult((prev) => ({ ...prev, [data.id]: parsed }));
        } catch { /* ignore */ }
      }
    } catch {
      toast.error("Analysis request failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleExpand(analysisId: string, resultJson: string | null) {
    if (expandedAnalysis === analysisId) {
      setExpandedAnalysis(null);
    } else {
      setExpandedAnalysis(analysisId);
      if (resultJson && !parsedResult[analysisId]) {
        try {
          const parsed = JSON.parse(resultJson);
          setParsedResult((prev) => ({ ...prev, [analysisId]: parsed }));
        } catch { /* ignore */ }
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{project?.projectName ?? "Project Hub"}</h1>
            {project?.description && (
              <p className="text-slate-400 text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-center">
          {[
            { label: "Activities",  val: project?._count?.activities  ?? 0 },
            { label: "Lookaheads",  val: project?._count?.lookaheads  ?? 0 },
            { label: "Documents",   val: project?._count?.documents   ?? 0 },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-800 rounded-lg px-4 py-2 text-center">
              <p className="text-white font-bold text-lg leading-tight">{val}</p>
              <p className="text-slate-400 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {(["overview", "documents", "analysis"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            )}
          >
            {t === "analysis" ? "AI Analysis" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-400" /> Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setTab("documents")}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm transition-colors"
              >
                <Upload className="w-4 h-4" /> Upload project documents
              </button>
              <button
                onClick={() => setTab("analysis")}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm transition-colors"
              >
                <Brain className="w-4 h-4" /> Run AI schedule analysis
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> Recent Documents
            </h3>
            {documents.length === 0 ? (
              <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1">
                {documents.slice(0, 5).map((d) => {
                  const Icon = DOC_TYPE_ICONS[d.type] ?? FileText;
                  return (
                    <li key={d.id} className="flex items-center gap-2 text-sm text-slate-300 py-1">
                      <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{d.name}</span>
                      <span className="text-slate-600 text-xs ml-auto flex-shrink-0">{DOC_TYPE_LABELS[d.type] ?? d.type}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Documents Tab ────────────────────────────────────────────────── */}
      {tab === "documents" && (
        <div className="space-y-5">
          {/* Upload panel */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Upload Document
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. Scope of Work Rev 3"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver  ? "border-blue-500 bg-blue-900/20" : "border-slate-600 hover:border-slate-500",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-slate-400 text-sm">Uploading and processing…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-500" />
                  <p className="text-white text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-slate-500 text-xs">PDF, images, Word, or plain text · max 50 MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.doc,.docx,.txt"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Document list */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Project Documents ({documents.length})
              </h3>
            </div>
            {documents.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-500 text-sm">
                No documents uploaded yet. Upload your scope of work, blueprints, and specs above.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
                    <th className="px-5 py-2.5 text-left">Name</th>
                    <th className="px-5 py-2.5 text-left hidden sm:table-cell">Type</th>
                    <th className="px-5 py-2.5 text-left hidden md:table-cell">Size</th>
                    <th className="px-5 py-2.5 text-left hidden md:table-cell">Text</th>
                    <th className="px-5 py-2.5 text-left hidden lg:table-cell">Uploaded</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {documents.map((doc) => {
                    const Icon = doc.mimeType?.startsWith("image/") ? FileImage : (DOC_TYPE_ICONS[doc.type] ?? FileText);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-3 text-white flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.name}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 hidden sm:table-cell whitespace-nowrap">
                          {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {formatBytes(doc.fileSize)}
                          {doc.pageCount ? ` · ${doc.pageCount}pp` : ""}
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          {doc.extractedText ? (
                            <span className="text-green-400 text-xs">✓ extracted</span>
                          ) : doc.mimeType?.startsWith("image/") ? (
                            <span className="text-slate-500 text-xs">image</span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs hidden lg:table-cell whitespace-nowrap">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => deleteDoc(doc.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Analysis Tab ─────────────────────────────────────────────────── */}
      {tab === "analysis" && (
        <div className="space-y-5">
          {/* Run analysis panel */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-400" /> Run AI Schedule Analysis
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Claude will compare your live 3-week lookahead against the selected project documents and identify scope gaps, conflicts, resource issues, and sequencing problems.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">Analysis Title</label>
              <input
                type="text"
                value={analysisTitle}
                onChange={(e) => setAnalysisTitle(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {documents.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">
                  Select documents to include (leave all unchecked to use all documents)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {documents.map((doc) => {
                    const checked = selectedDocs.has(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm",
                          checked
                            ? "border-blue-600 bg-blue-900/20 text-white"
                            : "border-slate-700 bg-slate-700/30 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedDocs((prev) => {
                              const next = new Set(prev);
                              if (checked) next.delete(doc.id); else next.add(doc.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <span className="truncate">{doc.name}</span>
                        <span className="ml-auto text-xs text-slate-600 flex-shrink-0">
                          {DOC_TYPE_LABELS[doc.type]?.split(" ")[0]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {documents.length === 0 && (
              <div className="mb-4 bg-yellow-900/20 border border-yellow-800 rounded-lg px-4 py-3 text-yellow-300 text-sm">
                No documents uploaded yet. Analysis will run on the schedule alone. Upload your scope of work or blueprints for a more detailed comparison.
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {running ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing… (this may take 30–60 s)</>
              ) : (
                <><Brain className="w-4 h-4" /> Run Analysis</>
              )}
            </button>
          </div>

          {/* Past analyses */}
          {analyses.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-500" /> Previous Analyses
              </h3>
              {analyses.map((a) => {
                const result   = parsedResult[a.id];
                const isOpen   = expandedAnalysis === a.id;
                const riskKey  = result?.overallRisk ?? "";

                return (
                  <div key={a.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    {/* Header row */}
                    <button
                      onClick={() => toggleExpand(a.id, a.resultJson)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-slate-500" />
                          : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        <div>
                          <p className="text-white text-sm font-medium">{a.title}</p>
                          <p className="text-slate-500 text-xs">
                            {new Date(a.createdAt).toLocaleString()} ·{" "}
                            {a.model ?? ""}
                            {a.inputTokens ? ` · ${(a.inputTokens + (a.outputTokens ?? 0)).toLocaleString()} tokens` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {a.status === "RUNNING" && (
                          <span className="text-blue-400 text-xs flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Running
                          </span>
                        )}
                        {a.status === "FAILED" && (
                          <span className="text-red-400 text-xs">Failed</span>
                        )}
                        {a.status === "COMPLETED" && riskKey && (
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                            RISK_COLORS[riskKey]
                          )}>
                            {riskKey} RISK
                          </span>
                        )}
                        {a.status === "COMPLETED" && !riskKey && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded result */}
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-slate-700">
                        {a.status === "FAILED" && (
                          <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
                            {a.errorMessage}
                          </div>
                        )}

                        {!result && a.status === "COMPLETED" && (
                          <div className="mt-4 text-slate-500 text-sm">
                            Could not parse analysis result. Raw:
                            <pre className="mt-2 text-xs bg-slate-900 rounded p-3 overflow-auto max-h-60">{a.resultJson}</pre>
                          </div>
                        )}

                        {result && (
                          <div className="mt-4 space-y-5">
                            {/* Summary + scorecard */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-2 bg-slate-900/50 rounded-lg p-4">
                                <p className="text-white text-sm leading-relaxed">{result.summary}</p>
                              </div>
                              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Scorecard</p>
                                <ScoreBar label="Schedule Completeness" value={result.scorecard?.scheduleCompleteness ?? 0} />
                                <ScoreBar label="Scope Alignment"       value={result.scorecard?.scopeAlignment       ?? 0} />
                                <ScoreBar label="Resource Adequacy"     value={result.scorecard?.resourceAdequacy     ?? 0} />
                                <ScoreBar label="Sequence Logic"        value={result.scorecard?.sequenceLogic        ?? 0} />
                              </div>
                            </div>

                            {/* Immediate actions */}
                            {result.immediateActions?.length > 0 && (
                              <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                                <p className="text-amber-300 font-semibold text-sm mb-2">⚡ Immediate Actions</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  {result.immediateActions.map((a, i) => (
                                    <li key={i} className="text-amber-200/80 text-sm">{a}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Findings */}
                            {result.findings?.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Findings ({result.findings.length})</p>
                                <div className="space-y-2">
                                  {result.findings.map((f, i) => {
                                    const SIcon  = SEVERITY_ICON[f.severity]  ?? Info;
                                    const sColor = SEVERITY_COLOR[f.severity] ?? "text-slate-400 border-slate-700";
                                    return (
                                      <div key={i} className={cn("border rounded-lg p-3.5", sColor)}>
                                        <div className="flex items-start gap-2">
                                          <SIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                          <div className="space-y-1 min-w-0">
                                            <p className="font-semibold text-sm">{f.title}
                                              <span className="ml-2 text-xs font-normal text-slate-500">{f.category}</span>
                                            </p>
                                            <p className="text-sm text-slate-300">{f.detail}</p>
                                            {f.recommendation && (
                                              <p className="text-xs text-slate-400 mt-1">
                                                <span className="font-medium text-blue-400">→ </span>
                                                {f.recommendation}
                                              </p>
                                            )}
                                            {f.affectedActivities && f.affectedActivities.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {f.affectedActivities.map((act, j) => (
                                                  <span key={j} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5 py-0.5">{act}</span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Positives */}
                            {result.positives?.length > 0 && (
                              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                                <p className="text-green-300 font-semibold text-sm mb-2">✓ What looks good</p>
                                <ul className="space-y-1">
                                  {result.positives.map((p, i) => (
                                    <li key={i} className="text-green-200/80 text-sm flex items-start gap-2">
                                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
