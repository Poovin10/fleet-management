"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login"); router.refresh();
  };
  return (
    <button onClick={handleLogout} className="px-5 py-2.5 rounded-full btn-glass text-[13px] tracking-wide font-medium">
      Sign Out
    </button>
  );
}