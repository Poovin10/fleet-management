import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";

export default async function Page() {
  const supabase = await createClient();

  return <Dashboard />;
}
