"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the session fresh while a tab is open: the browser client refreshes the token before it expires,
 * so the server rarely has to (server-side refreshes racing each other is what logs people out).
 */
export function SessionKeeper() {
  useEffect(() => {
    const sb = createClient();
    void sb.auth.startAutoRefresh();
    const { data } = sb.auth.onAuthStateChange(() => {});
    return () => { data.subscription.unsubscribe(); void sb.auth.stopAutoRefresh(); };
  }, []);
  return null;
}
