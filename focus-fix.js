/**
 * focus-fix.js — Non-invasive fix for input focus issues in World Builder
 *
 * Problem: renderUI() rebuilds the DOM via innerHTML, destroying any focused
 * input. Canvas mouse/touch handlers also steal focus. The body-level
 * user-select:none and touch-action:none block text selection in inputs.
 *
 * Solution: MutationObserver detects when inputs are replaced and restores
 * focus + cursor position. Canvas pointer events are intercepted to prevent
 * blurring active inputs.
 *
 * Loaded BEFORE app.js (as a regular script, not module) so it's ready
 * when the app initializes.
 */
;(function() {
  'use strict'

  // Track the currently focused input state
  let savedFocus = null

  // Save focus state before any DOM mutation
  function saveFocusState() {
    const el = document.activeElement
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) {
      savedFocus = null
      return
    }
    savedFocus = {
      tag: el.tagName,
      id: el.id || '',
      name: el.name || '',
      className: el.className || '',
      placeholder: el.placeholder || '',
      value: el.value || '',
      selectionStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
      selectionEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null
    }
  }

  // Restore focus after DOM mutation
  function restoreFocusState() {
    if (!savedFocus) return
    const s = savedFocus

    // Try to find the replacement element
    let target = null
    if (s.id) {
      target = document.getElementById(s.id)
    }
    if (!target && s.name) {
      target = document.querySelector(`${s.tag.toLowerCase()}[name="${CSS.escape(s.name)}"]`)
    }
    if (!target && s.className) {
      const candidates = document.querySelectorAll(`${s.tag.toLowerCase()}.${s.className.split(' ').filter(Boolean).map(c => CSS.escape(c)).join('.')}`)
      if (candidates.length === 1) target = candidates[0]
    }
    if (!target && s.placeholder) {
      target = document.querySelector(`${s.tag.toLowerCase()}[placeholder="${CSS.escape(s.placeholder)}"]`)
    }

    if (!target) {
      savedFocus = null
      return
    }

    // Restore value, focus, and cursor position
    if (target.value !== s.value) {
      target.value = s.value
    }
    target.focus({ preventScroll: true })
    if (s.selectionStart !== null && s.selectionEnd !== null) {
      try {
        target.setSelectionRange(s.selectionStart, s.selectionEnd)
      } catch(e) { /* ignore for non-text inputs */ }
    }
    savedFocus = null
  }

  // Watch for DOM mutations on #app that might destroy focused inputs
  function setupObserver() {
    const appEl = document.getElementById('app')
    if (!appEl) {
      // Retry until #app exists
      requestAnimationFrame(setupObserver)
      return
    }

    const observer = new MutationObserver((mutations) => {
      // If we had a saved focus, try to restore it after the mutation
      if (savedFocus) {
        // Use microtask to ensure DOM is settled
        queueMicrotask(restoreFocusState)
      }
    })

    observer.observe(appEl, {
      childList: true,
      subtree: true
    })
  }

  // Intercept innerHTML setter on #app to save focus before it's destroyed
  function patchInnerHTML() {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
    if (!originalDescriptor) return

    Object.defineProperty(Element.prototype, 'innerHTML', {
      set(value) {
        // Only intercept if this element is #app or contains the focused input
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          if (this.contains(activeEl) || this === activeEl) {
            saveFocusState()
          }
        }
        originalDescriptor.set.call(this, value)
        // Restore after the innerHTML is set
        if (savedFocus) {
          queueMicrotask(restoreFocusState)
        }
      },
      get() {
        return originalDescriptor.get.call(this)
      },
      configurable: true
    })
  }

  // Prevent canvas from stealing focus when user is typing
  function setupCanvasGuard() {
    document.addEventListener('pointerdown', (e) => {
      const active = document.activeElement
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return

      const target = e.target
      if (target && (target.tagName === 'CANVAS' || target.classList.contains('game-canvas'))) {
        // Don't let the canvas steal focus from an active input
        // We allow the canvas interaction but refocus the input afterward
        requestAnimationFrame(() => {
          const currentActive = document.activeElement
          if (currentActive && currentActive.tagName === 'CANVAS') {
            active.focus({ preventScroll: true })
          }
        })
      }
    }, true) // capture phase

    // Also handle touchstart for mobile
    document.addEventListener('touchstart', (e) => {
      const active = document.activeElement
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return

      const target = e.target
      if (target && (target.tagName === 'CANVAS' || target.classList.contains('game-canvas'))) {
        requestAnimationFrame(() => {
          const currentActive = document.activeElement
          if (!currentActive || currentActive.tagName === 'CANVAS' || currentActive === document.body) {
            active.focus({ preventScroll: true })
          }
        })
      }
    }, { capture: true, passive: true })
  }

  // Additional: clicking on an input should always work
  document.addEventListener('click', (e) => {
    const target = e.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      // Ensure the input actually gets focus
      setTimeout(() => {
        if (document.activeElement !== target) {
          target.focus()
        }
      }, 10)
    }
  }, true)

  // Initialize
  patchInnerHTML()
  setupCanvasGuard()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver)
  } else {
    setupObserver()
  }

  console.log('[focus-fix] Input focus protection active')
})()
