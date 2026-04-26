/**
 * GovTPortal v2 — Scientific Calculator
 * Draggable floating overlay with keyboard support.
 */
window.Calculator = (function() {
  let _el       = null;
  let _onOpen   = null;
  let _onClose  = null;
  let expr      = '';
  let lastResult = '';
  let memory    = 0;
  let isDeg     = true; // degrees vs radians
  let isVisible = false;

  function $(id) { return document.getElementById(id); }

  const TEMPLATE = `
  <div class="calc-wrap" id="calc-wrap" style="display:none">
    <div class="calc-handle" id="calc-handle">
      <div class="calc-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="3"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
        Calculator
      </div>
      <div class="calc-header-actions">
        <button class="calc-mode-btn" id="calc-deg-btn" title="Toggle degrees/radians">DEG</button>
        <button class="calc-close-btn" onclick="Calculator.hide()">✕</button>
      </div>
    </div>
    <div class="calc-display">
      <div class="calc-expr" id="calc-expr"></div>
      <div class="calc-result" id="calc-result">0</div>
    </div>
    <div class="calc-sci-row">
      <button class="calc-sci-btn" onclick="Calculator.sci('sin')">sin</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('cos')">cos</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('tan')">tan</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('log')">log</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('ln')">ln</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('sqrt')">√</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('sq')">x²</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('pi')">π</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('e')">e</button>
      <button class="calc-sci-btn" onclick="Calculator.sci('inv')">1/x</button>
    </div>
    <div class="calc-keys">
      <button class="calc-key calc-key-mem" onclick="Calculator.mem('MC')">MC</button>
      <button class="calc-key calc-key-mem" onclick="Calculator.mem('MR')">MR</button>
      <button class="calc-key calc-key-mem" onclick="Calculator.mem('M+')">M+</button>
      <button class="calc-key calc-key-mem" onclick="Calculator.mem('M-')">M-</button>
      <button class="calc-key calc-key-fn" onclick="Calculator.press('AC')">AC</button>

      <button class="calc-key" onclick="Calculator.press('(')">(</button>
      <button class="calc-key" onclick="Calculator.press(')')">)</button>
      <button class="calc-key" onclick="Calculator.press('%')">%</button>
      <button class="calc-key" onclick="Calculator.press('**')">^</button>
      <button class="calc-key calc-key-fn" onclick="Calculator.press('DEL')">⌫</button>

      <button class="calc-key" onclick="Calculator.press('7')">7</button>
      <button class="calc-key" onclick="Calculator.press('8')">8</button>
      <button class="calc-key" onclick="Calculator.press('9')">9</button>
      <button class="calc-key" onclick="Calculator.press('/')" style="color:var(--c-primary)">÷</button>
      <button class="calc-key" onclick="Calculator.press('!')" style="color:var(--c-accent)">n!</button>

      <button class="calc-key" onclick="Calculator.press('4')">4</button>
      <button class="calc-key" onclick="Calculator.press('5')">5</button>
      <button class="calc-key" onclick="Calculator.press('6')">6</button>
      <button class="calc-key" onclick="Calculator.press('*')" style="color:var(--c-primary)">×</button>
      <button class="calc-key" onclick="Calculator.press('+/-')" style="color:var(--c-accent)">±</button>

      <button class="calc-key" onclick="Calculator.press('1')">1</button>
      <button class="calc-key" onclick="Calculator.press('2')">2</button>
      <button class="calc-key" onclick="Calculator.press('3')">3</button>
      <button class="calc-key" onclick="Calculator.press('-')" style="color:var(--c-primary)">−</button>
      <button class="calc-key calc-key-eq" onclick="Calculator.press('=')" style="grid-row:span 2">=</button>

      <button class="calc-key" onclick="Calculator.press('0')" style="grid-column:span 2">0</button>
      <button class="calc-key" onclick="Calculator.press('.')">.</button>
      <button class="calc-key" onclick="Calculator.press('+')" style="color:var(--c-primary)">+</button>
    </div>
  </div>`;

  function updateDisplay() {
    const exprEl   = document.getElementById('calc-expr');
    const resultEl = document.getElementById('calc-result');
    if (exprEl)   exprEl.textContent   = expr;
    if (resultEl) resultEl.textContent = lastResult || expr || '0';
  }

  function factorial(n) {
    n = Math.floor(Math.abs(n));
    if (n > 20) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function safeEval(e) {
    try {
      // Replace display operators
      let cleaned = e
        .replace(/\^/g, '**')
        .replace(/÷/g, '/')
        .replace(/×/g, '*')
        .replace(/−/g, '-')
        .replace(/π/g, String(Math.PI))
        .replace(/e(?![0-9])/g, String(Math.E))
        // Factorial: 5! → factorial(5)
        .replace(/(\d+(\.\d+)?)!/g, (_, n) => `(${factorial(parseFloat(n))})`);

      // Use Function constructor for safety
      const result = new Function('"use strict"; return (' + cleaned + ')')();
      if (!isFinite(result)) return 'Error';
      // Format nicely
      return parseFloat(result.toPrecision(12)).toString();
    } catch { return 'Error'; }
  }

  function makeDraggable(el, handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0;
    handle.addEventListener('mousedown', e => {
      sx = e.clientX - el.offsetLeft;
      sy = e.clientY - el.offsetTop;
      const move = ev => { el.style.left = (ev.clientX - sx) + 'px'; el.style.top = (ev.clientY - sy) + 'px'; };
      const up   = ()  => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  return {
    init({ onOpen, onClose } = {}) {
      _onOpen  = onOpen;
      _onClose = onClose;

      // Inject if not present
      if (!document.getElementById('calc-wrap')) {
        const div = document.createElement('div');
        div.innerHTML = TEMPLATE;
        document.body.appendChild(div.firstElementChild.parentNode || div);
        // Actually need to append the inner wrap:
        document.body.appendChild(document.createRange().createContextualFragment(TEMPLATE));
      }

      _el = document.getElementById('calc-wrap');
      const handle = document.getElementById('calc-handle');
      if (_el && handle) makeDraggable(_el, handle);

      const degBtn = document.getElementById('calc-deg-btn');
      if (degBtn) degBtn.addEventListener('click', () => {
        isDeg = !isDeg;
        degBtn.textContent = isDeg ? 'DEG' : 'RAD';
      });
    },

    show() {
      _el = document.getElementById('calc-wrap');
      if (!_el) this.init();
      _el = document.getElementById('calc-wrap');
      if (_el) { _el.style.display = ''; isVisible = true; }
      if (_onOpen) _onOpen();
    },

    hide() {
      _el = document.getElementById('calc-wrap');
      if (_el) { _el.style.display = 'none'; isVisible = false; }
      if (_onClose) _onClose();
    },

    toggle() {
      isVisible ? this.hide() : this.show();
    },

    press(key) {
      if (key === 'AC') { expr = ''; lastResult = ''; }
      else if (key === 'DEL') { expr = expr.slice(0, -1); }
      else if (key === '=') {
        const r = safeEval(expr);
        lastResult = r;
        if (r !== 'Error') expr = r;
      }
      else if (key === '+/-') {
        if (expr && !isNaN(parseFloat(expr))) expr = String(-parseFloat(expr));
        else expr = '-' + (expr.startsWith('-') ? expr.slice(1) : expr);
      }
      else if (key === '!') { expr += '!'; }
      else { expr += key; }

      // Live preview
      if (key !== '=' && expr) {
        const preview = safeEval(expr);
        if (preview !== 'Error') lastResult = preview;
      }

      updateDisplay();
    },

    sci(fn) {
      const toRad = v => isDeg ? v * Math.PI / 180 : v;
      const curr  = parseFloat(lastResult || expr) || 0;
      let result;
      switch(fn) {
        case 'sin':  result = Math.sin(toRad(curr)); break;
        case 'cos':  result = Math.cos(toRad(curr)); break;
        case 'tan':  result = Math.tan(toRad(curr)); break;
        case 'log':  result = Math.log10(curr); break;
        case 'ln':   result = Math.log(curr); break;
        case 'sqrt': result = Math.sqrt(curr); break;
        case 'sq':   result = curr * curr; break;
        case 'pi':   expr += 'π'; updateDisplay(); return;
        case 'e':    expr += 'e'; updateDisplay(); return;
        case 'inv':  result = 1 / curr; break;
        default: return;
      }
      lastResult = parseFloat(result.toPrecision(10)).toString();
      expr = lastResult;
      updateDisplay();
    },

    mem(op) {
      const curr = parseFloat(lastResult || expr) || 0;
      switch(op) {
        case 'MC': memory = 0; break;
        case 'MR': expr = String(memory); lastResult = String(memory); break;
        case 'M+': memory += curr; break;
        case 'M-': memory -= curr; break;
      }
      updateDisplay();
    },
  };
})();
