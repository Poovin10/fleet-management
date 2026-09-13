import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InfoIcon } from "lucide-react";
import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    redirect("/auth/login");
  }

  return (
    <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto bg-[#12141C] text-slate-200">
      {JSON.stringify(data.session.user, null, 2)}
    </pre>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12 p-6 bg-[#050507] text-white min-h-screen">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center border border-[#222634] bg-[#12141C]">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated user
        </div>
      </div>
      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
        <Suspense fallback={<div className="text-xs text-slate-500 font-mono">Loading user session...</div>}>
          <UserDetails />
        </Suspense>
      </div>
      <div>
        <h2 className="font-bold text-2xl mb-4">Next steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
