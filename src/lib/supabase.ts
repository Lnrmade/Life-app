import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True once both variables are set. Without them the app runs as before: no accounts, data stays on the device. */
export const cloudEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Links in emails (reset password) must work in whichever browser opens them. On an iPhone
        // that is Safari, not the installed app, so the sign-in cannot depend on state stored in the app.
        flowType: "implicit",
      },
    })
  : null;

/** Header that proves to our own API routes who is asking. Empty when accounts are off. */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
