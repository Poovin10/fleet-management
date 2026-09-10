import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LiveAlertsWidget } from "@/components/LiveAlertsWidget";
import { SetupModule } from "@/components/SetupModule";

// 1. We move the database fetching logic into its own async component
async function DashboardContent() {
  const supabase = await createClient();

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const alerts: any[] = [];

  const { data: drivers } = await supabase
    .from('drivers')
    .select('driver_code, full_name, license_expiry_date')
    .eq('is_active', true);

  if (drivers) {
    drivers.forEach((d: any) => {
      if (d.license_expiry_date && new Date(d.license_expiry_date) <= thirtyDaysFromNow) {
        alerts.push({ 
          name: `${d.driver_code} - ${d.full_name}`, 
          doc: "Driving License", 
          date: d.license_expiry_date 
        });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <SetupModule />
      </div>
      <div>
        <LiveAlertsWidget />
      </div>
    </div>
  );
}

// 2. The main page renders instantly and wraps the database content in <Suspense>
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-white p-6 md:p-10 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#272B36] pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">KSS Roadways ERP</h1>
          <p className="text-xs text-slate-400 font-bold mt-1">Fleet Management & Operational Control Center</p>
        </div>
      </header>

      {/* Next.js 15+ requirement: Wrap dynamic data in Suspense */}
      <Suspense fallback={
        <div className="text-slate-400 font-bold p-8 text-center animate-pulse">
          Loading dashboard data...
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
