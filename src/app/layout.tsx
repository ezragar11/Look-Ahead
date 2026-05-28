import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers }        from "@/components/providers/SessionProvider";
import { CompanyProvider }   from "@/contexts/CompanyContext";
import { ProjectProvider }   from "@/contexts/ProjectContext";

export const metadata: Metadata = {
  title: "LookAhead Pro — Construction Scheduling Platform",
  description: "Multi-company construction 3-week lookahead planning and scheduling platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <CompanyProvider>
            <ProjectProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  style: { borderRadius: "8px", background: "#1e293b", color: "#f8fafc", fontSize: "13px" },
                }}
              />
            </ProjectProvider>
          </CompanyProvider>
        </Providers>
      </body>
    </html>
  );
}
