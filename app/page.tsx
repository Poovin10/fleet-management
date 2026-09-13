
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";

async function DashboardWrapper() {
  const supabase = await createClient();
  return <Dashboard />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507]" />}>
      <DashboardWrapper />
    </Suspense>
  );
}
