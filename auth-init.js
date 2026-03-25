/**
 * auth-init.js -- Anonymous authentication bootstrap for World Builder
 *
 * Runs BEFORE app.js (top-level await in ES module).
 * Signs the user in anonymously so Supabase RLS policies
 * (which require auth.uid()) are satisfied for all DB operations.
 *
 * Supabase persists sessions in localStorage, so when app.js
 * creates its own client with the same URL/key, it picks up
 * the anonymous session automatically.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

try {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('[auth-init] Anonymous sign-in failed:', error.message)
    } else {
      console.log('[auth-init] Anonymous session created, uid:', data?.user?.id)
    }
  } else {
    console.log('[auth-init] Existing session found, uid:', session.user?.id)
  }
} catch (e) {
  console.error('[auth-init] Auth bootstrap error:', e.message)
}
