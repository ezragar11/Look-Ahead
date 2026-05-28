"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Brain, Loader2, Play, AlertTriangle, Lightbulb, Target, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Analysis {
  id: string;
  title: string;
  analysisType: string;
  status: string;
  resultJson: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface AnalysisResult {
  summary?: string;
  risks?: string[];
  recommendations?: string[];
  conflicts?: string[];
  scheduleHealth?: string;
}

export default function AnalysisPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const aRes = await fetch(`/api/analyses?projectId=${proj.id}`);
    if (aRes.ok) setAnalyses(await aRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function runAnalysis() {
    if (!projectId) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
      if (res.ok) { toast.success("Analysis complete"); load(); }
      else { const d = await res.json(); toast.error(d.error ?? "Analysis failed"); }
    } catch { toast.error("Analysis failed"); }
    finally { setRunning(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">Powered by Claude - automated schedule intelligence</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-fuchsia-500/20"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {running ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {analyses.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 flex items-center justify-center">
            <Brain className="w-12 h-12 text-fuchsia-400" />
          </div>
          <p className="text-white text-xl font-bold">AI Schedule Analysis</p>
          <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
            Claude will analyze your schedule for risks, conflicts, optimization opportunities, and provide actionable recommendations.
          </p>
          <button
            onClick={runAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 mt-6 px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-fuchsia-500/20"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {running ? "Analyzing..." : "Run First Analysis"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {analyses.map((a) => {
            let result: AnalysisResult = {};
            try { result = a.resultJson ? JSON.parse(a.resultJson) : {}; } catch {}

            return (
              <div key={a.id} className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                {/* Analysis header */}
                <div className="px-6 py-4 bg-gradient-to-r from-fuchsia-500/5 to-violet-500/5 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{a.title}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(a.createdAt).toLocaleString()}</span>
                        {a.model && <span>{a.model}</span>}
                        {a.inputTokens && <span>{(a.inputTokens + (a.outputTokens ?? 0)).toLocaleString()} tokens</span>}
                      </div>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full border",
                    a.status === "COMPLETE" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" :
                    a.status === "FAILED" ? "text-red-300 bg-red-500/15 border-red-500/30" :
                    "text-amber-300 bg-amber-500/15 border-amber-500/30"
                  )}>{a.status}</span>
                </div>

                <div className="p-6 space-y-5">
                  {result.summary && (
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-sky-400" /> Summary
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
                    </div>
                  )}

                  {result.risks && result.risks.length > 0 && (
                    <div>
                      <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Risks ({result.risks.length})
                      </h4>
                      <div className="space-y-2">
                        {result.risks.map((r, i) => (
                          <div key={i} className="flex gap-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                            <span className="text-red-400 font-bold text-sm mt-0.5">!</span>
                            <p className="text-slate-300 text-sm">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.recommendations && result.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sky-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Lightbulb className="w-3.5 h-3.5" /> Recommendations ({result.recommendations.length})
                      </h4>
                      <div className="space-y-2">
                        {result.recommendations.map((r, i) => (
                          <div key={i} className="flex gap-3 p-3 bg-sky-500/5 rounded-xl border border-sky-500/10">
                            <span className="text-sky-400 font-bold text-sm mt-0.5">{i + 1}.</span>
                            <p className="text-slate-300 text-sm">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
