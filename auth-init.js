import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
const STORAGE_KEY = 'sb-xhhmxabftbyxrirvvihn-auth-token'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY
  }
})

window.__worldBuilderSupabase = supabase

try {
  await clearInvalidRefreshState()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    console.log('[auth-init] Existing session found, uid:', session.user.id)
  } else {
    console.log('[auth-init] No valid session -- showing auth overlay')
    await showAuthOverlay()
  }
} catch (e) {
  console.error('[auth-init] Auth bootstrap error:', e.message)
  await clearInvalidRefreshState()
  await showAuthOverlay()
}

async function clearInvalidRefreshState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    const hasRefreshToken = !!parsed?.refresh_token || !!parsed?.currentSession?.refresh_token
    if (!hasRefreshToken) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY)
  }

  try {
    const { error } = await supabase.auth.getSession()
    if (error && /refresh_token_not_found|invalid refresh token|refresh token/i.test(String(error.message || error.code || ''))) {
      localStorage.removeItem(STORAGE_KEY)
      await supabase.auth.signOut({ scope: 'local' })
    }
  } catch (error) {
    if (/refresh_token_not_found|invalid refresh token|refresh token/i.test(String(error?.message || error?.code || ''))) {
      localStorage.removeItem(STORAGE_KEY)
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (_) {}
    }
  }
}

function friendlyError(msg) {
  const t = String(msg || '')
  if (/invalid login credentials/i.test(t)) return 'Incorrect email or password.'
  if (/email not confirmed/i.test(t)) return 'Please check your email and click the confirmation link first.'
  if (/already been registered|user already registered/i.test(t)) return 'An account with this email already exists. Try signing in.'
  if (/email rate limit/i.test(t)) return 'Too many attempts. Please wait a moment.'
  if (/network/i.test(t)) return 'Network error. Check your connection and try again.'
  return t || 'Something went wrong.'
}

function showAuthOverlay() {
  return new Promise((resolve) => {
    const existingStyle = document.getElementById('wb-auth-style')
    if (existingStyle) existingStyle.remove()

    const styleEl = document.createElement('style')
    styleEl.id = 'wb-auth-style'
    styleEl.textContent = `
      #wb-auth-overlay {
        position: fixed; inset: 0; z-index: 9999;
        display: grid; place-items: center;
        background:
          radial-gradient(circle at 30% 20%, rgba(99,102,241,0.25), transparent 40%),
          radial-gradient(circle at 70% 80%, rgba(139,92,246,0.2), transparent 40%),
          #0a0e1a;
        font-family: 'Inter', system-ui, sans-serif;
        color: #f0f4ff;
      }
      #wb-auth-card {
        width: min(420px, calc(100% - 32px));
        background: rgba(17, 24, 39, 0.95);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 36px 28px;
        text-align: center;
        box-shadow: 0 16px 48px rgba(0,0,0,0.4);
      }
      #wb-auth-card .wb-logo { font-size: 2.5rem; margin-bottom: 12px; display: block; }
      #wb-auth-card h1 {
        font-family: 'Press Start 2P', monospace;
        font-size: 1.2rem; margin: 0 0 8px;
        background: linear-gradient(135deg, #6366f1, #f472b6);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      #wb-auth-card p.wb-sub { color: #8b95b0; line-height: 1.6; margin: 0 0 24px; }
      #wb-auth-card .wb-form-group { margin-bottom: 14px; text-align: left; }
      #wb-auth-card label {
        display: block; margin-bottom: 6px; font-size: 0.82rem;
        text-transform: uppercase; letter-spacing: 0.1em;
        color: #8b95b0; font-weight: 700;
      }
      #wb-auth-card input {
        width: 100%; padding: 14px 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        color: #f0f4ff; font-size: 1rem; outline: none;
        box-sizing: border-box;
      }
      #wb-auth-card input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.2);
      }
      #wb-auth-card .wb-error {
        color: #f87171; min-height: 20px; text-align: center;
        font-size: 0.88rem; margin-bottom: 10px;
      }
      #wb-auth-card .wb-btn-primary {
        width: 100%; padding: 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none; border-radius: 14px;
        color: white; font-weight: 800; font-size: 1rem;
        cursor: pointer; margin-bottom: 12px;
        box-shadow: 0 8px 24px rgba(99,102,241,0.3);
      }
      #wb-auth-card .wb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      #wb-auth-card .wb-switch {
        background: none; border: none;
        color: #8b95b0; cursor: pointer; font-size: 0.9rem;
      }
      #wb-auth-card .wb-switch strong { color: #fbbf24; }
      #wb-auth-card .wb-btn-secondary {
        width: 100%; padding: 14px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        color: #f0f4ff; font-weight: 700; font-size: 0.95rem;
        cursor: pointer;
      }
    `
    document.head.appendChild(styleEl)

    let mode = 'signin'
    let pendingEmail = ''
    let busy = false

    function getOverlay() {
      return document.getElementById('wb-auth-overlay')
    }

    function cleanup() {
      const overlay = getOverlay()
      if (overlay) overlay.remove()
      const style = document.getElementById('wb-auth-style')
      if (style) style.remove()
    }

    function renderAuthUI() {
      let overlay = getOverlay()
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'wb-auth-overlay'
        document.body.appendChild(overlay)
      }

      if (mode === 'check-email') {
        overlay.innerHTML = `
          <div id="wb-auth-card">
            <span class="wb-logo"><i class="fa-solid fa-envelope-open-text"></i></span>
            <h1>Check your email</h1>
            <p class="wb-sub">We sent a confirmation link to <strong>${pendingEmail}</strong>. Click the link, then come back and sign in.</p>
            <button class="wb-btn-secondary" id="wb-goto-signin">Go to Sign In</button>
          </div>
        `
        document.getElementById('wb-goto-signin').addEventListener('click', () => {
          mode = 'signin'
          renderAuthUI()
        })
        return
      }

      const isSignup = mode === 'signup'
      overlay.innerHTML = `
        <div id="wb-auth-card">
          <span class="wb-logo"><i class="fa-solid fa-cubes"></i></span>
          <h1>World Builder</h1>
          <p class="wb-sub">${isSignup ? 'Create an account to start building.' : 'Sign in with your email and password to open the world builder.'}</p>
          <form id="wb-auth-form">
            <div class="wb-form-group">
              <label>Email</label>
              <input type="email" id="wb-email" required autocomplete="email">
            </div>
            <div class="wb-form-group">
              <label>Password</label>
              <input type="password" id="wb-password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
            </div>
            <div class="wb-error" id="wb-error"></div>
            <button class="wb-btn-primary" type="submit" id="wb-submit">${isSignup ? 'Create account' : 'Sign in'}</button>
          </form>
          <button class="wb-switch" id="wb-switch">${isSignup ? 'Already have an account? <strong>Sign in</strong>' : "Don't have an account? <strong>Sign up</strong>"}</button>
        </div>
      `

      document.getElementById('wb-switch').addEventListener('click', () => {
        mode = isSignup ? 'signin' : 'signup'
        renderAuthUI()
      })

      document.getElementById('wb-auth-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        if (busy) return
        busy = true

        const email = document.getElementById('wb-email').value.trim().toLowerCase()
        const password = document.getElementById('wb-password').value
        const errorEl = document.getElementById('wb-error')
        const submitBtn = document.getElementById('wb-submit')
        errorEl.textContent = ''
        submitBtn.disabled = true
        submitBtn.textContent = isSignup ? 'Creating account...' : 'Signing in...'

        try {
          if (isSignup) {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: 'https://sling-gogiapp.web.app/email-confirmed.html' }
            })

            if (error) {
              if (/already been registered|user already registered/i.test(error.message)) {
                const signIn = await supabase.auth.signInWithPassword({ email, password })
                if (signIn.error) {
                  errorEl.textContent = friendlyError(signIn.error.message)
                  return
                }
                cleanup()
                resolve(signIn.data.session)
                return
              }
              errorEl.textContent = friendlyError(error.message)
              return
            }

            if (data?.session?.user) {
              cleanup()
              resolve(data.session)
              return
            }

            pendingEmail = email
            mode = 'check-email'
            renderAuthUI()
            return
          }

          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) {
            errorEl.textContent = friendlyError(error.message)
            return
          }

          cleanup()
          resolve(data.session)
        } catch (error) {
          errorEl.textContent = friendlyError(error?.message)
        } finally {
          busy = false
          const nextSubmitBtn = document.getElementById('wb-submit')
          if (nextSubmitBtn) {
            nextSubmitBtn.disabled = false
            nextSubmitBtn.textContent = isSignup ? 'Create account' : 'Sign in'
          }
        }
      })
    }

    renderAuthUI()
  })
}
