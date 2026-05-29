"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface Step {
  title: string;
  description: string;
  highlight?: string;
}

const DEMO_STEPS: Step[] = [
  {
    title: "Welcome to LookAhead Pro",
    description: "This platform manages 3-week lookahead schedules for construction projects. Navigate using the sidebar on the left.",
  },
  {
    title: "Upload a Schedule",
    description: "Go to Upload Lookahead to import your Excel schedule. Activities, subcontractors, and locations are auto-detected.",
    highlight: "Upload Lookahead",
  },
  {
    title: "Daily Work Plan",
    description: "See today's activities filtered by location and crew. Mark items delayed, add notes, create alerts, or move dates.",
    highlight: "Daily Work Plan",
  },
  {
    title: "Conflict Detection",
    description: "The system auto-detects trade overlaps and location stacking. Review conflicts and assign owners for resolution.",
    highlight: "Conflicts",
  },
  {
    title: "Reports & Export",
    description: "8 report views with filters. Export any report as CSV for owner meetings or weekly coordination.",
    highlight: "Reports",
  },
  {
    title: "Area Coordination",
    description: "See which crews are stacked in the same location. Warnings appear when 2+ trades overlap in one area.",
    highlight: "Locations",
  },
  {
    title: "You're Ready",
    description: "Explore the sidebar to see all features. Use the Morning Huddle for daily standups, Alerts for urgent issues, and the Audit Log to track all changes.",
  },
];

export function DemoGuide() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem("lookahead-demo-dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("lookahead-demo-dismissed", "true");
  }

  if (!visible) return null;

  const current = DEMO_STEPS[step];

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-slate-900 border border-sky-500/30 rounded-2xl shadow-2xl shadow-sky-500/10 overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-violet-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">Demo Guide</span>
          <span className="text-sky-200 text-xs">({step + 1}/{DEMO_STEPS.length})</span>
        </div>
        <button onClick={dismiss} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-lg mb-2">{current.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{current.description}</p>
        {current.highlight && (
          <p className="text-sky-400 text-xs mt-3 font-semibold">
            → Look for &quot;{current.highlight}&quot; in the sidebar
          </p>
        )}
      </div>
      <div className="px-5 pb-4 flex items-center justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 text-slate-500 hover:text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        {step < DEMO_STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={dismiss}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Got it!
          </button>
        )}
      </div>
    </div>
  );
}
