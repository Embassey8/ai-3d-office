import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings — Embassey AI HQ" };

export default function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/");
  return <SettingsClient />;
}
