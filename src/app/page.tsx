"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootRedirect() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((companies) => {
        if (companies.length > 0) {
          router.replace(`/app/${companies[0].slug}`);
        } else {
          // No companies — show setup prompt
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-2">No company workspace found.</p>
          <a href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Go to Login →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );
}
