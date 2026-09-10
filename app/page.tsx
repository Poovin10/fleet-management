import { createClient } from "@/lib/supabase/server";
import { LiveAlertsWidget } from "@/components/LiveAlertsWidget";
import { SetupModule } from "@/components/SetupModule";

export default async function DashboardPage() {
  // FIX: Await the server client creation so we can call .from() on it
  const supabase = await createClient();

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const alerts: any[] = [];

  // Querying license_expiry_date matching the verified drivers schema
  const { data: drivers } = await supabase
    .from('drivers')
    .select('driver_code, full_name, license_expiry_date')
    .eq('is_active', true);

  if (drivers) {
    // FIX: Explicitly set 'd' as 'any' to satisfy strict TypeScript rules
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
    <div className="min-h-screen bg-[#0F1117] text-white p-6 md:p-10 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#272B36] pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">KSS Roadways ERP</h1>
          <p className="text-xs text-slate-400 font-bold mt-1">Fleet Management & Operational Control Center</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <SetupModule />
        </div>
        <div>
          <LiveAlertsWidget />
        </div>
      </div>
    </div>
  );
}
