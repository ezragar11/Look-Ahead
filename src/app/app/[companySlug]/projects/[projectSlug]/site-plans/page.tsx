"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Map, Loader2, Upload, Trash2, FileImage, Eye, X, ZoomIn, ZoomOut,
  ChevronDown, Filter, ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface SitePlan {
  id: string;
  name: string;
  originalName: string;
  type: string;           // SITE_PLAN_ELECTRICAL etc.
  mimeType: string | null;
  fileSize: number | null;
  storedName: string | null;
  createdAt: string;
}

const DISCIPLINES = [
  { value: "ELECTRICAL",       label: "Electrical",       color: "text-yellow-400",  bg: "bg-yellow-500/15",  border: "border-yellow-500/30" },
  { value: "MECHANICAL",       label: "Mechanical",       color: "text-sky-400",     bg: "bg-sky-500/15",     border: "border-sky-500/30" },
  { value: "STRUCTURAL",       label: "Structural",       color: "text-orange-400",  bg: "bg-orange-500/15",  border: "border-orange-500/30" },
  { value: "CIVIL",            label: "Civil",            color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  { value: "PLUMBING",         label: "Plumbing",         color: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30" },
  { value: "FIRE_PROTECTION",  label: "Fire Protection",  color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30" },
  { value: "ARCHITECTURAL",    label: "Architectural",    color: "text-violet-400",  bg: "bg-violet-500/15",  border: "border-violet-500/30" },
  { value: "GENERAL",          label: "General / Site",   color: "text-slate-300",   bg: "bg-slate-500/15",   border: "border-slate-500/30" },
  { value: "OTHER",            label: "Other",            color: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-500/30" },
];

function getDiscipline(type: string) {
  const disc = type.replace("SITE_PLAN_", "");
  return DISCIPLINES.find(d => d.value === disc) ?? DISCIPLINES[DISCIPLINES.length - 1];
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileUrl(projectId: string, storedName: string | null) {
  if (!storedName) return "";
  return `/api/files/projects/${projectId}/site-plans/${storedName}`;
}

export default function SitePlansPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [plans, setPlans]       = useState<SitePlan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [uploadDisc, setUploadDisc] = useState("GENERAL");
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filter
  const [filterDisc, setFilterDisc] = useState("");

  // Viewer
  const [viewing, setViewing] = useState<SitePlan | null>(null);
  const [zoom, setZoom]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const sRes = await fetch(`/api/projects/${proj.id}/site-plans`);
      if (sRes.ok) setPlans(await sRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("discipline", uploadDisc);
      fd.append("name", uploadName || uploadFile.name);

      const res = await fetch(`/api/projects/${projectId}/site-plans`, { method: "POST", body: fd });
      if (res.ok) {
        toast.success("Site plan uploaded");
        setShowUpload(false);
        setUploadFile(null); setUploadName(""); setUploadDisc("GENERAL");
        load();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Upload failed");
      }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleDelete(plan: SitePlan) {
    if (!projectId) return;
    if (!confirm(`Delete "${plan.name}"? It will be moved to deleted history.`)) return;
    const res = await fetch(`/api/projects/${projectId}/site-plans?docId=${plan.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Delete failed");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setUploadFile(file); if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, "")); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setUploadFile(file); if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, "")); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  // Group by discipline
  const filtered = filterDisc ? plans.filter(p => p.type === `SITE_PLAN_${filterDisc}`) : plans;
  const grouped: Record<string, SitePlan[]> = {};
  filtered.forEach(p => {
    const disc = p.type.replace("SITE_PLAN_", "");
    if (!grouped[disc]) grouped[disc] = [];
    grouped[disc].push(p);
  });

  const discCounts: Record<string, number> = {};
  plans.forEach(p => {
    const disc = p.type.replace("SITE_PLAN_", "");
    discCounts[disc] = (discCounts[disc] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Site Plans</h1>
          <p className="text-slate-500 text-sm mt-1">
            {plans.length > 0 ? `${plans.length} blueprint${plans.length !== 1 ? "s" : ""} uploaded across ${Object.keys(discCounts).length} discipline${Object.keys(discCounts).length !== 1 ? "s" : ""}` : "Upload project blueprints by discipline"}
          </p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20">
          <ImagePlus className="w-4 h-4" /> Upload Blueprint
        </button>
      </div>

      {/* Discipline filter chips */}
      {plans.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          <button onClick={() => setFilterDisc("")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              !filterDisc ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:text-white")}>
            All ({plans.length})
          </button>
          {DISCIPLINES.filter(d => discCounts[d.value]).map(d => (
            <button key={d.value} onClick={() => setFilterDisc(filterDisc === d.value ? "" : d.value)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                filterDisc === d.value ? cn(d.bg, d.color, d.border, "border") : "bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:text-white")}>
              {d.label} ({discCounts[d.value]})
            </button>
          ))}
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="bg-slate-800/50 rounded-2xl border border-sky-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-sky-400" /> Upload Site Plan
            </h3>
            <button type="button" onClick={() => { setShowUpload(false); setUploadFile(null); }} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discipline *</label>
              <select value={uploadDisc} onChange={e => setUploadDisc(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 appearance-none">
                {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Plan Name</label>
              <input value={uploadName} onChange={e => setUploadName(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                placeholder="e.g., Level 1 Floor Plan" />
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              dragOver ? "border-sky-500 bg-sky-500/5" :
              uploadFile ? "border-emerald-500/50 bg-emerald-500/5" :
              "border-slate-700 hover:border-sky-500/30 bg-slate-900/30"
            )}
          >
            <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
            {uploadFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileImage className="w-8 h-8 text-emerald-400" />
                <div className="text-left">
                  <p className="text-white text-sm font-medium">{uploadFile.name}</p>
                  <p className="text-slate-500 text-xs">{formatSize(uploadFile.size)}</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                  className="ml-4 text-slate-500 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Drop blueprint image or PDF here, or click to browse</p>
                <p className="text-slate-600 text-xs mt-1">JPEG, PNG, WebP, TIFF, PDF — max 50 MB</p>
              </>
            )}
          </div>

          <button type="submit" disabled={uploading || !uploadFile}
            className="px-5 py-2 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {uploading ? "Uploading..." : "Upload Plan"}
          </button>
        </form>
      )}

      {/* Empty state */}
      {plans.length === 0 && !showUpload && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 flex items-center justify-center">
            <Map className="w-10 h-10 text-sky-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Site Plans Yet</p>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            Upload blueprint images organized by discipline — electrical, mechanical, structural, civil, and more.
          </p>
          <button onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
            <ImagePlus className="w-4 h-4" /> Upload Your First Blueprint
          </button>
        </div>
      )}

      {/* Plans grouped by discipline */}
      {Object.entries(grouped).map(([disc, items]) => {
        const cfg = getDiscipline(`SITE_PLAN_${disc}`);
        return (
          <div key={disc}>
            <h2 className={cn("text-sm font-bold uppercase tracking-wider px-1 mb-3 flex items-center gap-2", cfg.color)}>
              <Map className="w-4 h-4" /> {cfg.label}
              <span className="text-slate-600 font-normal text-xs">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(plan => {
                const isImage = plan.mimeType?.startsWith("image/");
                const url = projectId ? getFileUrl(projectId, plan.storedName) : "";
                return (
                  <div key={plan.id}
                    className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-sky-500/30 transition-all group">
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                      {isImage && url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={plan.name}
                          className="w-full h-full object-contain bg-slate-900" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FileImage className="w-12 h-12 text-slate-700" />
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button onClick={() => { setViewing(plan); setZoom(1); }}
                          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(plan)}
                          className="p-2.5 rounded-xl bg-white/10 hover:bg-red-500/30 text-white transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="px-4 py-3">
                      <p className="text-white text-sm font-medium truncate">{plan.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        {plan.fileSize && <span>{formatSize(plan.fileSize)}</span>}
                        <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ═══════ Full-screen viewer ═══════ */}
      {viewing && projectId && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          {/* Viewer header */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900/80 border-b border-slate-800">
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{viewing.name}</p>
              <p className="text-slate-500 text-xs">{getDiscipline(viewing.type).label} — {viewing.originalName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-400 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setViewing(null)}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white ml-4 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Viewer content */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {viewing.mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getFileUrl(projectId, viewing.storedName)}
                alt={viewing.name}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-w-none transition-transform"
              />
            ) : viewing.mimeType === "application/pdf" ? (
              <iframe
                src={getFileUrl(projectId, viewing.storedName)}
                className="w-full h-full rounded-lg"
                title={viewing.name}
              />
            ) : (
              <p className="text-slate-500">Preview not available for this file type.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
