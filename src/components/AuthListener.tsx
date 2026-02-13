"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Placed in the landing page — listens for login from another tab
export default function AuthListener() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.push("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return null; // purely logic, no UI
}