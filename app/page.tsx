import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  return <Dashboard />;
}
