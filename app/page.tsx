import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";

async function DashboardWrapper() {
  const supabase = await createClient();
  
  // The server securely checks the cookie before loading the dashboard
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <Dashboard />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507]" />}>
      <DashboardWrapper />
    </Suspense>
  );
}
