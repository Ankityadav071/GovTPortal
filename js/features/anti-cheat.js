/**
 * GovTPortal v2 — Anti-Cheat System
 * Tab switch detection, fullscreen enforcement, keyboard blocking.
 */
window.AntiCheat = (function() {
  let _enabled       = false;
  let _warnOnly      = false;
  let _tabWarn       = true;
  let _limit         = 3;
  let _count         = 0;
  let _paused        = false;
  let _calcOpen      = false;

  let _onViolation   = null;
  let _onAutoSubmit  = null;

  // Event handler refs for cleanup
  const _handlers = {};

  // Mobile/touch devices: the Fullscreen API is unsupported or unreliable
  // (notably iOS Safari has no fullscreen support for arbitrary elements),
  // and window-blur fires constantly from normal mobile behavior — the
  // virtual keyboard opening, browser chrome, notification shade, app
  // switches. Enforcing fullscreen and blur-based violations there produces
  // false positives that repeatedly pause the timer, effectively freezing
  // it. Tab-switch detection (visibilitychange) is comparatively reliable
  // and stays enabled everywhere.
  function _isMobile() {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  // Blocked keys during exam
  const BLOCKED_KEYS = new Set([
    'F12','F5',
    'PrintScreen',
  ]);
  const BLOCKED_CTRL = new Set(['c','v','x','a','p','s','u','i','j','F12']);

  function _triggerViolation(message) {
    if (_paused || !_enabled) return;
    _count++;
    Store.setSession({ violations: _count });

    const remaining = _limit - _count;

    if (_onViolation) {
      _onViolation({ message, count: _count, remaining, limit: _limit });
    }

    if (!_warnOnly && _count >= _limit && _onAutoSubmit) {
      setTimeout(_onAutoSubmit, 2000);
    }
  }

  return {
    setCalculatorOpen(val) { _calcOpen = val; },

    init({ enabled, warnOnly, tabSwitchWarn, violationLimit }) {
      _enabled  = !!enabled;
      _warnOnly = !!warnOnly;
      _tabWarn  = tabSwitchWarn !== false;
      _limit    = violationLimit || 3;
      _count    = Store.getSession().violations || 0;
    },

    start({ onViolation, onAutoSubmit }) {
      if (!_enabled) return;
      _onViolation  = onViolation;
      _onAutoSubmit = onAutoSubmit;
      const mobile = _isMobile();

      // ── Visibility change (tab switch) ──
      _handlers.visChange = () => {
        if (!_tabWarn || _paused || _calcOpen) return;
        if (document.hidden) {
          _triggerViolation('Tab switch detected! Do not leave the exam window.');
        }
      };
      document.addEventListener('visibilitychange', _handlers.visChange);

      // ── Window blur (switched app/tab) — desktop only, see _isMobile() note ──
      if (!mobile) {
        _handlers.blur = () => {
          if (_paused || _calcOpen) return;
          _triggerViolation('Window focus lost! Stay on the exam at all times.');
        };
        window.addEventListener('blur', _handlers.blur);
      }

      // ── Fullscreen exit — desktop only, see _isMobile() note ──
      if (!mobile) {
        _handlers.fsChange = () => {
          if (_paused || _calcOpen) return;
          if (!document.fullscreenElement) {
            _triggerViolation('Fullscreen exited! Please stay in fullscreen during the exam.');
          }
        };
        document.addEventListener('fullscreenchange', _handlers.fsChange);
      }

      // ── Keyboard blocking ──
      _handlers.keydown = (e) => {
        if (_paused || _calcOpen) return;
        const key = e.key;
        if (BLOCKED_KEYS.has(key)) { e.preventDefault(); return; }
        if ((e.ctrlKey || e.metaKey) && BLOCKED_CTRL.has(key.toLowerCase())) {
          e.preventDefault();
          return;
        }
        // Right-click
        if (e.key === 'ContextMenu') e.preventDefault();
      };
      document.addEventListener('keydown', _handlers.keydown);

      // ── Right-click disable ──
      _handlers.contextmenu = (e) => { if (!_paused) e.preventDefault(); };
      document.addEventListener('contextmenu', _handlers.contextmenu);
    },

    stop() {
      document.removeEventListener('visibilitychange', _handlers.visChange);
      window.removeEventListener('blur', _handlers.blur);
      document.removeEventListener('fullscreenchange', _handlers.fsChange);
      document.removeEventListener('keydown', _handlers.keydown);
      document.removeEventListener('contextmenu', _handlers.contextmenu);
      _enabled = false;
    },

    pause() { _paused = true; },
    resume() { _paused = false; },

    requestFullscreen() {
      const el = document.documentElement;
      if (el.requestFullscreen)             return el.requestFullscreen();
      if (el.webkitRequestFullscreen)       return el.webkitRequestFullscreen();
      if (el.mozRequestFullScreen)          return el.mozRequestFullScreen();
      return Promise.resolve();
    },

    exitFullscreen() {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
        return Promise.resolve();
      }
      if (document.exitFullscreen)           return document.exitFullscreen();
      if (document.webkitExitFullscreen)     return document.webkitExitFullscreen();
      if (document.mozCancelFullScreen)      return document.mozCancelFullScreen();
      return Promise.resolve();
    },

    getCount() { return _count; },
  };
})();
