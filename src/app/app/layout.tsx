/**
 * The /app route group has its own sidebar system (company & project layouts).
 * This layout is intentionally bare — no AppShell wrapper.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
