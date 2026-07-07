/**
 * GovTPortal v2 — Exam Engine Controller
 * Full CBT engine: navigation, state, keyboard, timer, anti-cheat
 */
(function() {
  const cfg       = Store.getConfig();
  const questions = Store.getQuestions();

  if (!questions.length) {
    window.location.href = 'exam-lobby.html';
    return;
  }

  // ── STATE ──────────────────────────────────────────────────
  let currentQ     = 0;
  const SECTIONS   = buildSections(questions);

  function buildSections(qs) {
    const map = {};
    qs.forEach((q, i) => {
      const s = q.section || 'General';
      if (!map[s]) map[s] = { name: s, indices: [] };
      map[s].indices.push(i);
    });
    return Object.values(map);
  }

  // ── RECORD SESSION START ────────────────────────────────────
  // Critical: store startTime so Analytics can compute timeTaken
  const existingSession = Store.getSession();
  if (!existingSession.startTime || existingSession.isSubmitted) {
    Store.setSession({ startTime: Date.now(), isSubmitted: false, violations: 0 });
  }

  // ── DOM REFS ───────────────────────────────────────────────
  const qText         = document.getElementById('q-text');
  const qOptions      = document.getElementById('q-options');
  const qNum          = document.getElementById('q-num');
  const qSectionBadge = document.getElementById('q-section-badge');
  const qMarksBadge   = document.getElementById('q-marks-badge');
  const qDiffBadge    = document.getElementById('q-diff-badge');
  const timerDisplay  = document.getElementById('timer-display');
  const timerRingTime = document.getElementById('timer-ring-time');
  const timerRingFill = document.getElementById('timer-ring-fill');
  const timerInfo     = document.getElementById('timer-info');
  const markLabel     = document.getElementById('mark-label');
  const candAvatar    = document.getElementById('cand-avatar');
  const candName      = document.getElementById('cand-name');
  const candId        = document.getElementById('cand-id');
  const navTitle      = document.getElementById('exam-nav-title');

  // ── INIT ───────────────────────────────────────────────────
  navTitle.textContent   = cfg.examTitle;
  candName.textContent   = cfg.candidateName || 'Candidate';
  candAvatar.textContent = (cfg.candidateName || 'C')[0].toUpperCase();
  candId.textContent     = 'ID: GTP-' + Date.now().toString(36).toUpperCase().slice(-6);
  qMarksBadge.textContent = `+${cfg.marksCorrect}/-${cfg.marksNegative}`;

  // Section tabs – only show if multiple sections
  const sectionTabsWrap = document.getElementById('section-tabs-wrap');
  if (sectionTabsWrap) sectionTabsWrap.style.display = SECTIONS.length > 1 ? '' : 'none';

  // Calculator
  if (cfg.calculator) {
    const calcBtn = document.getElementById('calc-toggle-btn');
    if (calcBtn) calcBtn.style.display = '';
    Calculator.init({
      onOpen:  () => AntiCheat.setCalculatorOpen(true),
      onClose: () => setTimeout(() => AntiCheat.setCalculatorOpen(false), 200),
    });
  }
  window.toggleCalculator = () => Calculator.toggle();

  // Mobile question-palette drawer
  window.togglePalette = function(forceState) {
    const sidebar = document.querySelector('.exam-sidebar');
    const overlay = document.getElementById('exam-sidebar-overlay');
    if (!sidebar) return;
    const open = typeof forceState === 'boolean' ? forceState : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
  };

  // Anti-cheat
  if (cfg.antiCheat) {
    AntiCheat.init({
      enabled:        true,
      warnOnly:       cfg.warnOnly,
      tabSwitchWarn:  cfg.tabSwitchWarn,
      violationLimit: cfg.violationLimit || 3,
    });
    AntiCheat.requestFullscreen().catch(() => {});
    AntiCheat.start({
      onViolation:  showViolation,
      onAutoSubmit: () => {
        toast('Auto-submitting due to repeated violations', 'danger', 3000);
        setTimeout(submitExam, 2000);
      },
    });
  }

  // ── TIMER ─────────────────────────────────────────────────
  // r=30 on 72×72 viewBox → circumference = 2π×30 ≈ 188.5
  const CIRC = 2 * Math.PI * 30;
  timerRingFill.style.strokeDasharray  = CIRC;
  timerRingFill.style.strokeDashoffset = 0;
  const totalSeconds = cfg.duration * 60;

  Timer.init({
    minutes:         cfg.duration,
    warnThreshold:   cfg.warnThreshold   || 15,
    dangerThreshold: cfg.dangerThreshold || 5,
    onTick: ({ remaining, formatted }) => {
      timerDisplay.textContent  = formatted;
      timerRingTime.textContent = formatted;
      timerRingFill.style.strokeDashoffset = CIRC * (1 - remaining / totalSeconds);
    },
    onWarn: () => {
      timerDisplay.style.color   = 'var(--c-warn)';
      timerRingFill.style.stroke = 'var(--c-warn)';
      timerRingTime.style.color  = 'var(--c-warn)';
      if (timerInfo) timerInfo.classList.add('warn');
    },
    onDanger: () => {
      timerDisplay.style.color   = 'var(--c-danger)';
      timerRingFill.style.stroke = 'var(--c-danger)';
      timerRingTime.style.color  = 'var(--c-danger)';
      if (timerInfo) { timerInfo.classList.remove('warn'); timerInfo.classList.add('danger'); }
    },
    onExpire: () => openModal('times-up-modal'),
  });
  Timer.start();

  // ── PROGRESS BAR ───────────────────────────────────────────
  function updateProgressBar() {
    const done = Object.keys(Store.getAnswers()).length;
    const pct  = Math.round((done / questions.length) * 100);
    const bar  = document.getElementById('q-progress-fill');
    if (bar) { bar.style.width = pct + '%'; }
    const text = document.getElementById('q-progress-text');
    if (text) text.textContent = `${done} / ${questions.length}`;
  }

  // ── RENDER QUESTION ────────────────────────────────────────
  function renderQuestion(index, dir) {
    const q        = questions[index];
    const ans      = Store.getAnswer(index);
    const isMarked = Store.isMarked(index);

    // Transition animation
    if (dir) {
      [qText, qOptions].forEach(el => {
        el.style.animation = 'none';
        void el.offsetWidth; // reflow
        el.style.animation = 'fadeInUp 0.22s var(--ease-out) both';
      });
    }

    qNum.textContent = `Question ${index + 1} of ${questions.length}`;
    qSectionBadge.textContent = q.section || 'General';
    qDiffBadge.textContent    = q.difficulty || 'Medium';
    qDiffBadge.className = 'badge ' + (
      (q.difficulty||'').toLowerCase() === 'hard'  ? 'badge-danger' :
      (q.difficulty||'').toLowerCase() === 'easy'  ? 'badge-success' : 'badge-neutral'
    );
    qText.textContent = q.question;

    // Options - only render non-empty options
    const keys = ['A','B','C','D'];
    qOptions.innerHTML = keys
      .filter(k => q.options && q.options[k])
      .map(k => {
        const sel = ans && ans.value === k;
        return `<div class="q-option ${sel ? 'selected' : ''}" data-key="${k}" onclick="selectOption('${k}')">
          <div class="q-option__key">${k}</div>
          <div class="q-option__text">${q.options[k]}</div>
        </div>`;
      }).join('');

    // Mark button state
    markLabel.textContent = isMarked ? 'Unmark' : 'Mark for Review';
    const markBtn = document.getElementById('btn-mark');
    if (markBtn) markBtn.className = 'btn ' + (isMarked ? 'btn-secondary' : 'btn-warn');

    // Prev button disabled state
    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) prevBtn.disabled = index === 0;

    updateProgressBar();
    renderSectionTabs();
    renderGrid();
    renderSummary();
  }

  // ── OPTION SELECT ──────────────────────────────────────────
  window.selectOption = function(key) {
    Store.setAnswer(currentQ, key);
    document.querySelectorAll('.q-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.key === key);
    });
    renderGrid();
    renderSummary();
    updateProgressBar();
  };

  // ── NAVIGATION ─────────────────────────────────────────────
  window.saveAndNext = function() {
    Timer.recordQuestion(currentQ);
    if (currentQ < questions.length - 1) goToQuestion(currentQ + 1, 'next');
    else toast('Last question — click Submit to finish.', 'info');
  };

  window.prevQuestion = function() {
    Timer.recordQuestion(currentQ);
    if (currentQ > 0) goToQuestion(currentQ - 1, 'prev');
  };

  window.nextQuestion = window.saveAndNext;

  window.goToQuestion = function(index, dir) {
    if (index === currentQ) return;
    Timer.recordQuestion(currentQ);
    currentQ = Math.max(0, Math.min(index, questions.length - 1));
    renderQuestion(currentQ, dir);
    const body = document.querySelector('.q-pane__body');
    if (body) body.scrollTop = 0;
    if (window.innerWidth <= 768) togglePalette(false);
  };

  window.toggleMark = function() {
    const was = Store.isMarked(currentQ);
    Store.setFlag(currentQ, !was);
    markLabel.textContent = !was ? 'Unmark' : 'Mark for Review';
    const markBtn = document.getElementById('btn-mark');
    if (markBtn) markBtn.className = 'btn ' + (!was ? 'btn-secondary' : 'btn-warn');
    renderGrid();
    renderSummary();
  };

  window.clearAnswer = function() {
    Store.clearAnswer(currentQ);
    document.querySelectorAll('.q-option').forEach(o => o.classList.remove('selected'));
    renderGrid();
    renderSummary();
    updateProgressBar();
  };

  // ── SECTION TABS ───────────────────────────────────────────
  function renderSectionTabs() {
    const tabEl = document.getElementById('section-tabs');
    if (!tabEl) return;
    const currentSection = questions[currentQ].section || 'General';
    tabEl.innerHTML = SECTIONS.map((s, i) => {
      const answered = s.indices.filter(idx => Store.getAnswer(idx)).length;
      return `<button class="tab-btn ${s.name===currentSection?'active':''}" onclick="jumpToSection(${i})">${s.name}<span class="badge badge-neutral" style="margin-left:4px;font-size:9px;padding:1px 6px">${answered}/${s.indices.length}</span></button>`;
    }).join('');
  }

  window.jumpToSection = function(sIdx) {
    const section = SECTIONS[sIdx];
    if (section) goToQuestion(section.indices[0]);
  };

  // ── SUMMARY STRIP ──────────────────────────────────────────
  function renderSummary() {
    const answers  = Store.getAnswers();
    const flags    = Store.getFlags();
    const answered = Object.keys(answers).length;
    const marked   = Object.keys(flags).filter(k => flags[k]).length;

    const strip = document.getElementById('q-summary');
    if (!strip) return;
    strip.innerHTML = `
      <div class="summary-stat answered"><div class="summary-stat__val">${answered}</div><div class="summary-stat__key">Done</div></div>
      <div class="summary-stat marked"><div class="summary-stat__val">${marked}</div><div class="summary-stat__key">Marked</div></div>
      <div class="summary-stat skipped"><div class="summary-stat__val">${questions.length - answered}</div><div class="summary-stat__key">Left</div></div>
      <div class="summary-stat"><div class="summary-stat__val">${questions.length}</div><div class="summary-stat__key">Total</div></div>
    `;
  }

  // ── QUESTION GRID ──────────────────────────────────────────
  function renderGrid() {
    const wrap    = document.getElementById('q-grid-wrap');
    if (!wrap) return;
    const answers = Store.getAnswers();
    const flags   = Store.getFlags();

    let html = '';
    SECTIONS.forEach(section => {
      if (SECTIONS.length > 1) html += `<div class="section-label">${section.name}</div>`;
      html += '<div class="q-grid">';
      section.indices.forEach(idx => {
        const isAnswered = !!answers[idx];
        const isMarked   = !!flags[idx];
        const isCurrent  = idx === currentQ;
        const cls =
          isCurrent              ? 'current'         :
          isMarked && isAnswered ? 'marked-answered' :
          isMarked               ? 'marked'          :
          isAnswered             ? 'answered'        : 'not-visited';
        html += `<div class="q-btn ${cls}" onclick="goToQuestion(${idx})" title="Q${idx+1}">${idx+1}</div>`;
      });
      html += '</div>';
    });

    html += `<div class="q-legend" style="margin-top:var(--sp-4)">
      <div class="q-legend-item"><div class="q-legend-dot" style="background:var(--c-success)"></div>Answered</div>
      <div class="q-legend-item"><div class="q-legend-dot" style="background:var(--c-warn)"></div>Marked</div>
      <div class="q-legend-item"><div class="q-legend-dot" style="background:var(--c-accent)"></div>M+Ans</div>
      <div class="q-legend-item"><div class="q-legend-dot" style="background:var(--c-bg-overlay);border:1px solid var(--c-border)"></div>Not Done</div>
    </div>`;

    wrap.innerHTML = html;
  }

  // ── SUBMIT ─────────────────────────────────────────────────
  window.openSubmitModal = function() {
    Timer.pause   && Timer.pause();
    AntiCheat.pause && AntiCheat.pause();
    const answers    = Store.getAnswers();
    const answered   = Object.keys(answers).length;
    const marked     = Object.keys(Store.getFlags()).filter(k => Store.getFlags()[k]).length;
    const unanswered = questions.length - answered;
    document.getElementById('submit-summary-text').innerHTML =
      `<strong style="color:var(--c-success-light)">${answered}</strong> answered &nbsp;·&nbsp;
       <strong style="color:var(--c-warn)">${marked}</strong> marked &nbsp;·&nbsp;
       <strong style="color:var(--c-text-tertiary)">${unanswered}</strong> not answered &nbsp;·&nbsp;
       <strong>${questions.length}</strong> total`;
    openModal('submit-modal');
  };

  window.cancelSubmit = function() {
    closeModal('submit-modal');
    Timer.resume   && Timer.resume();
    AntiCheat.resume && AntiCheat.resume();
  };

  window.submitExam = function() {
    Timer.recordQuestion(currentQ);
    Timer.stop();
    AntiCheat.stop          && AntiCheat.stop();
    AntiCheat.exitFullscreen && AntiCheat.exitFullscreen();

    const endTime = Date.now();
    Store.setSession({ endTime, isSubmitted: true });

    const session = Store.getSession();
    const answers = Store.getAnswers();
    const flags   = Store.getFlags();
    const qTimes  = Timer.getAllQTimes();

    const result = Analytics.compute({
      questions,
      answers,
      flags,
      qTimes,
      config:  cfg,
      session: { startTime: session.startTime, endTime },
    });

    Store.saveResult(result);
    window.location.href = 'result.html';
  };

  // ── VIOLATION OVERLAY ──────────────────────────────────────
  let violationTimer;
  function showViolation({ message, count, remaining, limit }) {
    Timer.pause   && Timer.pause();
    AntiCheat.pause && AntiCheat.pause();
    const overlay   = document.getElementById('violation-overlay');
    const msgEl     = document.getElementById('violation-msg');
    const countEl   = document.getElementById('violation-count-msg');
    const countdown = document.getElementById('violation-countdown');
    msgEl.textContent  = message;
    countEl.innerHTML  = `Violation <strong>${count}</strong> of <strong>${limit}</strong>. ${remaining > 0 ? `${remaining} more allowed before auto-submit.` : 'Auto-submitting...'}`;
    overlay.classList.remove('hidden');
    let sec = 5;
    countdown.textContent = sec;
    clearInterval(violationTimer);
    violationTimer = setInterval(() => {
      sec--;
      countdown.textContent = sec;
      if (sec <= 0) { clearInterval(violationTimer); dismissViolation(); }
    }, 1000);
  }

  window.dismissViolation = function() {
    clearInterval(violationTimer);
    document.getElementById('violation-overlay').classList.add('hidden');
    Timer.resume   && Timer.resume();
    AntiCheat.resume && AntiCheat.resume();
    if (cfg.antiCheat) AntiCheat.requestFullscreen().catch(() => {});
  };

  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────
  if (cfg.keyboardNav) {
    document.addEventListener('keydown', e => {
      // Don't trigger if anti-cheat blocked
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      if (['A','B','C','D'].includes(key)) { selectOption(key); return; }
      if (key === 'N' || e.key === 'ArrowRight') { saveAndNext(); return; }
      if (key === 'P' || e.key === 'ArrowLeft')  { prevQuestion(); return; }
      if (key === 'M') { toggleMark(); return; }
      if (key === 'S') { saveAndNext(); return; }
    });
  }

  // ── KICKOFF ────────────────────────────────────────────────
  renderQuestion(currentQ);
  renderSummary();
  renderGrid();

})();
