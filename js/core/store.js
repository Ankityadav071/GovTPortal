/**
 * GovTPortal v2 — Store (State Manager)
 * Provides namespaced localStorage access for all exam data.
 */
window.Store = (function() {
  const NS = 'GTP_';
  const KEYS = {
    CONFIG:    NS + 'CONFIG',
    QUESTIONS: NS + 'QUESTIONS',
    ANSWERS:   NS + 'ANSWERS',
    FLAGS:     NS + 'FLAGS',
    SESSION:   NS + 'SESSION',
    RESULT:    NS + 'RESULT',
    RESULTS:   NS + 'RESULTS',
    Q_TIMES:   NS + 'QTIMES',
  };

  function _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function _set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {
      console.warn('Store._set failed:', key, e);
    }
  }

  const DEFAULT_CONFIG = {
    examTitle:     'Practice Exam',
    duration:      60,
    marksCorrect:  4,
    marksNegative: 1,
    totalMarks:    100,
    category:      '',
    year:          '',
    source:        'custom',
    antiCheat:     true,
    tabSwitchWarn: true,
    calculator:    false,
    keyboardNav:   true,
    warnOnly:      false,
    violationLimit:3,
    warnThreshold: 15,
    candidateName: '',
  };

  return {
    // ── Config ──────────────────────────────────────────────
    getConfig() {
      const saved = _get(KEYS.CONFIG) || {};
      return Object.assign({}, DEFAULT_CONFIG, saved);
    },
    setConfig(partial) {
      const current = this.getConfig();
      _set(KEYS.CONFIG, Object.assign(current, partial));
    },

    // ── Questions ────────────────────────────────────────────
    getQuestions() {
      return _get(KEYS.QUESTIONS) || [];
    },
    setQuestions(qs) {
      _set(KEYS.QUESTIONS, qs);
    },
    clearQuestions() {
      localStorage.removeItem(KEYS.QUESTIONS);
    },

    // ── Answers (per question index) ─────────────────────────
    getAnswers() {
      return _get(KEYS.ANSWERS) || {};
    },
    getAnswer(idx) {
      const ans = this.getAnswers();
      return ans[idx] || null;
    },
    setAnswer(idx, value) {
      const ans = this.getAnswers();
      ans[idx] = { value, ts: Date.now() };
      _set(KEYS.ANSWERS, ans);
    },
    clearAnswer(idx) {
      const ans = this.getAnswers();
      delete ans[idx];
      _set(KEYS.ANSWERS, ans);
    },
    clearAllAnswers() {
      localStorage.removeItem(KEYS.ANSWERS);
    },

    // ── Flags (mark for review) ──────────────────────────────
    getFlags() {
      return _get(KEYS.FLAGS) || {};
    },
    isMarked(idx) {
      return !!(this.getFlags()[idx]);
    },
    setFlag(idx, val) {
      const flags = this.getFlags();
      if (val) flags[idx] = true; else delete flags[idx];
      _set(KEYS.FLAGS, flags);
    },
    clearAllFlags() {
      localStorage.removeItem(KEYS.FLAGS);
    },

    // ── Session ──────────────────────────────────────────────
    getSession() {
      return _get(KEYS.SESSION) || {};
    },
    setSession(partial) {
      const current = this.getSession();
      _set(KEYS.SESSION, Object.assign(current, partial));
    },

    // ── Results ──────────────────────────────────────────────
    getResult() {
      return _get(KEYS.RESULT);
    },
    saveResult(result) {
      _set(KEYS.RESULT, result);
      // Also push to history
      const history = _get(KEYS.RESULTS) || [];
      history.unshift(result); // newest first
      if (history.length > 50) history.length = 50; // cap at 50
      _set(KEYS.RESULTS, history);
    },
    getAllResults() {
      return _get(KEYS.RESULTS) || [];
    },
    deleteResult(idx) {
      const history = this.getAllResults();
      history.splice(idx, 1);
      _set(KEYS.RESULTS, history);
    },
    clearAllResults() {
      localStorage.removeItem(KEYS.RESULTS);
      localStorage.removeItem(KEYS.RESULT);
    },

    // ── Question Times ───────────────────────────────────────
    getQTimes() {
      return _get(KEYS.Q_TIMES) || {};
    },
    setQTimes(times) {
      _set(KEYS.Q_TIMES, times);
    },

    // ── Reset ────────────────────────────────────────────────
    clearExamState() {
      localStorage.removeItem(KEYS.ANSWERS);
      localStorage.removeItem(KEYS.FLAGS);
      localStorage.removeItem(KEYS.SESSION);
      localStorage.removeItem(KEYS.Q_TIMES);
    },
  };
})();
