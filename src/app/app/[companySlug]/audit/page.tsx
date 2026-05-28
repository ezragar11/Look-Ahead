"use client";
import { ScrollText } from "lucide-react";

export default function CompanyAuditPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Company Audit Log</h1>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-10 text-center">
        <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Company-wide audit log coming soon.</p>
      </div>
    </div>
  );
}
