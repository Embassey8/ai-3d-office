/**
 * Supabase configuration. When these variables are absent the app runs in local demo mode
 * (seed employees, nothing persisted) and says so in the UI.
 * Only the public URL and publishable (anon) key are ever used in the browser.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export const isSupabaseConfigured = () => getSupabaseEnv() !== null;
