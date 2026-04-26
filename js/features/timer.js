/**
 * GovTPortal v2 — Timer
 * Countdown timer with per-question time tracking and pause/resume.
 */
window.Timer = (function() {
  let totalSeconds = 0;
  let remaining    = 0;
  let intervalId   = null;
  let isPaused     = false;
  let isExpired    = false;

  // Per-question stopwatch
  let qStartTime   = 0;
  const qTimes     = {}; // { index: totalSeconds }

  // Callbacks
  let _onTick    = null;
  let _onWarn    = null;
  let _onDanger  = null;
  let _onExpire  = null;

  // Thresholds
  let warnPct   = 15; // % remaining → warn
  let dangerPct = 5;  // % remaining → danger

  let warnFired   = false;
  let dangerFired = false;

  return {
    init({ minutes, onTick, onWarn, onDanger, onExpire, warnThreshold, dangerThreshold }) {
      totalSeconds = (minutes || 60) * 60;
      remaining    = totalSeconds;
      _onTick      = onTick    || null;
      _onWarn      = onWarn    || null;
      _onDanger    = onDanger  || null;
      _onExpire    = onExpire  || null;
      warnPct      = warnThreshold   || 15;
      dangerPct    = dangerThreshold || 5;
      warnFired    = false;
      dangerFired  = false;

      // Restore from store if session interrupted
      const session = Store.getSession();
      if (session.startTime && !session.isSubmitted) {
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        remaining = Math.max(totalSeconds - elapsed, 0);
      }
      if (session.qTimes) Object.assign(qTimes, session.qTimes);
    },

    start() {
      if (intervalId) clearInterval(intervalId);
      qStartTime = Date.now();

      intervalId = setInterval(() => {
        if (isPaused) return;
        remaining = Math.max(remaining - 1, 0);

        const pct = (remaining / totalSeconds) * 100;
        const formatted = formatMMSS(remaining);

        if (_onTick) _onTick({ remaining, pct, formatted });

        if (!warnFired && pct <= warnPct) {
          warnFired = true;
          if (_onWarn) _onWarn();
        }
        if (!dangerFired && pct <= dangerPct) {
          dangerFired = true;
          if (_onDanger) _onDanger();
        }

        if (remaining <= 0 && !isExpired) {
          isExpired = true;
          clearInterval(intervalId);
          if (_onExpire) _onExpire();
        }
      }, 1000);
    },

    pause() { isPaused = true; },
    resume() { isPaused = false; },

    stop() {
      clearInterval(intervalId);
      intervalId = null;
    },

    getRemaining() { return remaining; },
    getElapsed()   { return totalSeconds - remaining; },

    /**
     * Record time spent on a question before leaving it.
     */
    recordQuestion(index) {
      if (!qStartTime) { qStartTime = Date.now(); return; }
      const elapsed = Math.round((Date.now() - qStartTime) / 1000);
      qTimes[index] = (qTimes[index] || 0) + elapsed;
      qStartTime = Date.now();
      // Persist to Store
      Store.setQTimes(qTimes);
    },

    getQTime(index) {
      return qTimes[index] || 0;
    },

    getAllQTimes() {
      return { ...qTimes };
    },
  };
})();
