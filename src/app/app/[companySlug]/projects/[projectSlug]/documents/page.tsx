"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Loader2, Upload, Trash2, File, FileSpreadsheet, FileImage, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Doc {
  id: string;
  name: string;
  originalName: string;
  type: string;
  mimeType: string | null;
  fileSize: number | null;
  pageCount: number | null;
  createdAt: string;
}

function getFileIcon(mime: string | null) {
  if (!mime) return File;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("image")) return FileImage;
  return File;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  CONTRACT: { bg: "bg-violet-500/15", text: "text-violet-300" },
  DRAWING: { bg: "bg-sky-500/15", text: "text-sky-300" },
  SPEC: { bg: "bg-emerald-500/15", text: "text-emerald-300" },
  SUBMITTAL: { bg: "bg-amber-500/15", text: "text-amber-300" },
  SCHEDULE: { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  OTHER: { bg: "bg-slate-500/15", text: "text-slate-300" },
};

export default function DocumentsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [docs, setDocs]         = useState<Doc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const dRes = await fetch(`/api/projects/${proj.id}/documents`);
    if (dRes.ok) setDocs(await dRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(file: File) {
    if (!projectId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
      if (res.ok) { toast.success("Document uploaded"); load(); }
      else { const d = await res.json(); toast.error(d.error ?? "Upload failed"); }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); setDocs((d) => d.filter((x) => x.id !== docId)); }
    else toast.error("Delete failed");
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">{docs.length} document{docs.length !== 1 ? "s" : ""} uploaded</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload Document
        </button>
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>

      {docs.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-sky-500/10 flex items-center justify-center">
            <FileText className="w-10 h-10 text-cyan-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Documents</p>
          <p className="text-slate-500 text-sm mt-2">Upload project documents like drawings, specs, submittals, and contracts.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {docs.map((d) => {
            const Icon = getFileIcon(d.mimeType);
            const tc = TYPE_COLORS[d.type] ?? TYPE_COLORS.OTHER;
            return (
              <div key={d.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/20 transition-all p-4 flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-sky-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{d.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span className={cn("font-semibold px-2 py-0.5 rounded-full", tc.bg, tc.text)}>{d.type}</span>
                    {d.fileSize && <span>{formatSize(d.fileSize)}</span>}
                    {d.pageCount && <span>{d.pageCount} pages</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-2 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
