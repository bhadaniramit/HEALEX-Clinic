import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { todayDateIst } from "@/lib/date-ist";
import { ReportExport } from "./report-export";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const profile = await requireStaff();
  if (profile.role !== "super_admin" && profile.role !== "admin") {
    redirect("/patients");
  }

  const todayYmd = todayDateIst();

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader profile={profile} title="Report" activeTab="report" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm text-stone-600">
          Download patient payment reports for a date range (IST).
        </p>
        <ReportExport defaultFrom={todayYmd} defaultTo={todayYmd} />
      </main>
    </div>
  );
}
