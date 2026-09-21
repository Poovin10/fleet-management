"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login"); router.refresh();
  };
  return (
    <Button
      type="button"
      variant="glass"
      onClick={handleLogout}
      className="h-auto rounded-full px-5 py-2.5 text-[13px] font-medium tracking-wide"
    >
      Sign Out
    </Button>
  );
}