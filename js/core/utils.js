/**
 * GovTPortal v2 — Shared Utilities
 * DOM helpers, time formatting, toast, counters, reveal animations
 */

// ── Time Format ─────────────────────────────────────────────────────────────
window.formatTime = function(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

window.formatMMSS = function(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

// ── Toast ────────────────────────────────────────────────────────────────────
window.toast = function(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    danger:  '❌',
    warn:    '⚠️',
    info:    'ℹ️',
  };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast__icon">${icons[type] || 'ℹ️'}</span><span class="toast__msg">${message}</span>`;
  container.appendChild(el);

  // Remove after duration
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }, duration);
};

// ── Copy Text ────────────────────────────────────────────────────────────────
window.copyText = function(text, successMsg = 'Copied!') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast(successMsg, 'success')).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
};

function fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast(msg, 'success'); } catch { toast('Copy failed — please select and copy manually', 'warn'); }
  document.body.removeChild(ta);
}

// ── Animate Counter ──────────────────────────────────────────────────────────
window.animateCount = function(el, from, to, duration = 1200, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const step = ts => {
    const pct = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = Math.round(from + (to - from) * ease) + suffix;
    if (pct < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

// ── Navbar Scroll ────────────────────────────────────────────────────────────
window.initNavbarScroll = function() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const handler = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', handler, { passive: true });
  handler();
};

// ── Mobile Nav Drawer ────────────────────────────────────────────────────────
window.initMobileNav = function() {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('main-nav-links');
  const overlay = document.getElementById('nav-overlay');
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.classList.toggle('open', open);
    links.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  if (overlay) overlay.addEventListener('click', () => setOpen(false));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  // Close drawer if resized back to desktop width
  window.addEventListener('resize', () => { if (window.innerWidth > 768) setOpen(false); });
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
  initMobileNav();
}

// ── Reveal on Scroll ─────────────────────────────────────────────────────────
window.initReveal = function() {
  const els = document.querySelectorAll('.reveal, .stagger');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
};
// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReveal);
} else {
  initReveal();
}

// ── Modal Helpers ────────────────────────────────────────────────────────────
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};
// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.add('hidden');
  }
});

// ── File Download ────────────────────────────────────────────────────────────
window.downloadFile = function(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
