"use client";
import { useParams } from "next/navigation";
import { BarChart3 } from "lucide-react";

export default function CompanyReportsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Company Reports</h1>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-10 text-center">
        <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Company-wide reports across all projects coming soon.</p>
      </div>
    </div>
  );
}
