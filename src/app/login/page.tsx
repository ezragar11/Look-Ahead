"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Eye, EyeOff, Lock, Mail, User, Building2 } from "lucide-react";

function LoginForm() {
  const router      = useRouter();
  const params      = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [mode, setMode]           = useState<"login" | "setup">("login");
  const [loading, setLoading]     = useState(false);
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [noUsers, setNoUsers]     = useState(false);

  // Form state
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [name, setName]           = useState("");
  const [company, setCompany]     = useState("");

  // Check if this is bootstrap mode (no users yet)
  useEffect(() => {
    fetch("/api/auth/register", { method: "HEAD" })
      .then(() => {/* route exists */})
      .catch(() => {});

    fetch("/api/users/count")
      .then((r) => r.json())
      .then((d) => {
        if (d.count === 0) {
          setNoUsers(true);
          setMode("setup");
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      // If callbackUrl is just "/" or the old root, redirect to user's company instead
      if (!callbackUrl || callbackUrl === "/") {
        try {
          const cRes = await fetch("/api/companies");
          if (cRes.ok) {
            const companies = await cRes.json();
            if (companies.length > 0) {
              router.push(`/app/${companies[0].slug}`);
              router.refresh();
              return;
            }
          }
        } catch { /* fall through */ }
      }
      router.push(callbackUrl || "/");
      router.refresh();
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, password, company }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed");
        setLoading(false);
        return;
      }
      // Auto sign-in after setup
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        setError("Account created — please sign in.");
        setMode("login");
      } else {
        // Redirect to the auto-created company workspace
        const dest = data.companySlug ? `/app/${data.companySlug}` : "/";
        router.push(dest);
        router.refresh();
      }
    } catch {
      setError("Setup failed. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <HardHat className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">LookAhead Pro</h1>
          <p className="text-slate-400 text-sm mt-1">Construction Scheduling Platform</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-7">
          {noUsers && (
            <div className="mb-5 bg-blue-900/40 border border-blue-700 rounded-lg px-4 py-3 text-blue-300 text-sm">
              <strong>Welcome!</strong> No accounts exist yet. Create the first admin account to get started.
            </div>
          )}

          <h2 className="text-lg font-semibold text-white mb-5">
            {mode === "setup" ? "Create Admin Account" : "Sign In"}
          </h2>

          <form onSubmit={mode === "setup" ? handleSetup : handleLogin} className="space-y-4">
            {mode === "setup" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="John Smith"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Company (optional)</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Construction Co."
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={mode === "setup" ? "Minimum 8 characters" : "••••••••"}
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1"
            >
              {loading
                ? mode === "setup" ? "Creating account…" : "Signing in…"
                : mode === "setup" ? "Create Admin Account" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">
          LookAhead Pro · Construction Schedule Management
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
