"use client";
import { redirect } from "next/navigation";
import { useParams } from "next/navigation";

// /projects/[slug]/dashboard redirects to /projects/[slug] (the main project page IS the dashboard)
export default function DashboardRedirect() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  redirect(`/app/${companySlug}/projects/${projectSlug}`);
}
