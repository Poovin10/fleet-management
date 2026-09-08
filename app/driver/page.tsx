import { DriverPortal } from "@/components/DriverPortal";

export default function DriverPage() {
  return (
    <div className="min-h-screen bg-slate-900 py-6 px-4" style={{ colorScheme: 'light' }}>
      <div className="max-w-md mx-auto mb-6 text-center">
        <h1 className="text-xl font-black text-white">KSS Roadways</h1>
        <p className="text-xs text-[#FF5A00] uppercase tracking-widest font-bold">Driver Highway Portal</p>
      </div>
      <DriverPortal />
    </div>
  );
}