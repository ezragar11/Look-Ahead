"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  projectId:      string;
  lookaheadId:    string;
  projectName:    string;
  activityCount:  number;
  occurrenceCount: number;
  message:        string;
}

export default function UploadPage() {
  const router = useRouter();
  const [state, setState]       = useState<UploadState>("idle");
  const [file, setFile]         = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult]     = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(f);
    setState("idle");
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 300);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        setErrorMsg(data.error ?? "Upload failed");
        setState("error");
        toast.error(data.error ?? "Upload failed");
        return;
      }

      setResult(data);
      setState("success");
      toast.success(`Imported ${data.activityCount} activities!`);
    } catch (err) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Upload failed";
      setErrorMsg(msg);
      setState("error");
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Lookahead</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a 3-week lookahead Excel file to import activities into the scheduling system.
        </p>
      </div>

      {/* Format note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <FileSpreadsheet className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Expected Format</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Upload standard construction 3-week lookahead Excel files — with project header,
            week groups, activity rows, subcontractor column, location column, and X-marked date columns.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
          dragging
            ? "border-blue-500 bg-blue-50"
            : file
            ? "border-emerald-400 bg-emerald-50"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("fileInput")?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <p className="text-xs text-gray-400">Click to choose a different file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Drop your Excel file here</p>
              <p className="text-sm text-gray-400 mt-0.5">or click to browse</p>
            </div>
            <p className="text-xs text-gray-300">.xlsx or .xls files only</p>
          </div>
        )}
      </div>

      {/* Upload button */}
      {file && state !== "success" && (
        <button
          onClick={handleUpload}
          disabled={state === "uploading"}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors",
            state === "uploading"
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 shadow-sm"
          )}
        >
          {state === "uploading" ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Parsing & importing…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Import Lookahead
            </>
          )}
        </button>
      )}

      {/* Progress bar */}
      {state === "uploading" && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Import failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Success */}
      {state === "success" && result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800">Import successful!</p>
              <p className="text-sm text-emerald-600">{result.message}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Project",    value: result.projectName },
              { label: "Activities", value: result.activityCount },
              { label: "Work Days",  value: result.occurrenceCount },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg border border-emerald-100 p-3 text-center">
                <p className="text-lg font-bold text-emerald-700">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setFile(null); setState("idle"); setResult(null); }}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Upload Another
            </button>
            <button
              onClick={() => router.push("/schedule")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              View Schedule <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
