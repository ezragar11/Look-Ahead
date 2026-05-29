"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Settings, Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProjectSettings {
  id: string;
  projectName: string;
  client: string | null;
  contractor: string | null;
  location: string | null;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export default function ProjectSettingsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (pRes.ok) setProject(await pRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.projectName,
          client: project.client,
          contractor: project.contractor,
          location: project.location,
          description: project.description,
          status: project.status,
        }),
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Save failed");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm("Are you sure? This will delete the project and all its data.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted");
        router.push(`/app/${companySlug}`);
      } else toast.error("Delete failed");
    } catch { toast.error("Delete failed"); }
    finally { setDeleting(false); }
  }

  if (loading || !project) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  function update(key: keyof ProjectSettings, val: string) {
    setProject((p) => p ? { ...p, [key]: val } : p);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure project details and preferences</p>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 space-y-5">
        <h2 className="text-white font-semibold text-lg">General</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Project Name", key: "projectName" as const, val: project.projectName },
            { label: "Client", key: "client" as const, val: project.client ?? "" },
            { label: "Contractor", key: "contractor" as const, val: project.contractor ?? "" },
            { label: "Location", key: "location" as const, val: project.location ?? "" },
          ].map(({ label, key, val }) => (
            <div key={key}>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">{label}</label>
              <input
                type="text"
                value={val}
                onChange={(e) => update(key, e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Status</label>
            <select
              value={project.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 appearance-none"
            >
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            value={project.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 resize-none transition-all"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-sky-500/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-6">
        <h2 className="text-red-400 font-semibold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Danger Zone</h2>
        <p className="text-slate-500 text-sm mt-2">Deleting this project will permanently remove all lookaheads, activities, documents, and analysis data.</p>
        <button onClick={handleDelete} disabled={deleting}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Project
        </button>
      </div>
    </div>
  );
}
