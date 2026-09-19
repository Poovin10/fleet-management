"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 rounded-lg bg-white/[0.03] hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/30 text-white/60 hover:text-rose-400 text-sm font-mono transition-all backdrop-blur-xl"
    >
      TERMINATE SESSION
    </button>
  );
}
