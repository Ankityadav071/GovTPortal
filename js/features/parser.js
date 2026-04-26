/**
 * GovTPortal v2 — Parser
 * Parses CSV and JSON question files with validation.
 */
window.Parser = (function() {

  const CSV_TEMPLATE =
`id,question,optionA,optionB,optionC,optionD,correct,explanation,section,difficulty
1,"Which planet is known as the Red Planet?","Mars","Venus","Jupiter","Saturn","A","Mars appears red due to iron oxide on its surface.","Science","Easy"
2,"Who wrote the Indian National Anthem?","Rabindranath Tagore","Bankim Chandra","Sarojini Naidu","Subramania Bharati","A","Jana Gana Mana was written by Rabindranath Tagore in 1911.","History","Easy"
3,"What is the capital of India?","Mumbai","Kolkata","New Delhi","Chennai","C","New Delhi is the capital and seat of government of India.","Geography","Easy"`;

  const JSON_TEMPLATE =
`[
  {
    "id": 1,
    "question": "Which planet is known as the Red Planet?",
    "options": {
      "A": "Mars",
      "B": "Venus",
      "C": "Jupiter",
      "D": "Saturn"
    },
    "correct": "A",
    "explanation": "Mars appears red due to iron oxide on its surface.",
    "section": "Science",
    "difficulty": "Easy"
  },
  {
    "id": 2,
    "question": "Who wrote the Indian National Anthem?",
    "options": {
      "A": "Rabindranath Tagore",
      "B": "Bankim Chandra",
      "C": "Sarojini Naidu",
      "D": "Subramania Bharati"
    },
    "correct": "A",
    "explanation": "Jana Gana Mana was written by Rabindranath Tagore in 1911.",
    "section": "History",
    "difficulty": "Easy"
  }
]`;

  /**
   * Detect format from raw string content.
   */
  function detectFormat(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
    return 'csv';
  }

  /**
   * Parse CSV content into question objects.
   */
  function parseCSV(raw) {
    const lines   = raw.trim().split(/\r?\n/);
    const errors  = [];
    const warnings = [];
    const questions = [];

    if (lines.length < 2) {
      errors.push('CSV must have a header row and at least one data row');
      return { questions, errors, warnings };
    }

    // Parse header
    const header = splitCSVRow(lines[0]).map(h => h.trim().toLowerCase());

    // Map column indices
    const col = {
      id:          findCol(header, ['id','#','num','number']),
      question:    findCol(header, ['question','q','ques','quest']),
      optionA:     findCol(header, ['optiona','option_a','a','opt_a','choice_a','choicea']),
      optionB:     findCol(header, ['optionb','option_b','b','opt_b','choice_b','choiceb']),
      optionC:     findCol(header, ['optionc','option_c','c','opt_c','choice_c','choicec']),
      optionD:     findCol(header, ['optiond','option_d','d','opt_d','choice_d','choiced']),
      correct:     findCol(header, ['correct','answer','ans','key','correct_answer','correctanswer']),
      explanation: findCol(header, ['explanation','exp','expl','reason','solution','hint']),
      section:     findCol(header, ['section','topic','subject','category','part']),
      difficulty:  findCol(header, ['difficulty','diff','level','hard']),
    };

    if (col.question === -1) {
      errors.push('Missing "question" column in CSV header');
      return { questions, errors, warnings };
    }
    if (col.optionA === -1 || col.optionB === -1) {
      errors.push('Missing option columns (optionA, optionB at minimum) in CSV header');
      return { questions, errors, warnings };
    }
    if (col.correct === -1) {
      errors.push('Missing "correct" (answer key) column in CSV header');
      return { questions, errors, warnings };
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cells = splitCSVRow(line);

      const q = {
        id:          col.id          !== -1 ? cells[col.id]?.trim()          : String(i),
        question:    col.question    !== -1 ? cells[col.question]?.trim()     : '',
        options: {
          A: col.optionA !== -1 ? (cells[col.optionA]?.trim() || '') : '',
          B: col.optionB !== -1 ? (cells[col.optionB]?.trim() || '') : '',
          C: col.optionC !== -1 ? (cells[col.optionC]?.trim() || '') : '',
          D: col.optionD !== -1 ? (cells[col.optionD]?.trim() || '') : '',
        },
        correct:     (col.correct !== -1 ? cells[col.correct]?.trim() : '').toUpperCase(),
        explanation: col.explanation !== -1 ? (cells[col.explanation]?.trim() || '') : '',
        section:     col.section !== -1     ? (cells[col.section]?.trim()     || 'General') : 'General',
        difficulty:  col.difficulty !== -1  ? (cells[col.difficulty]?.trim()  || 'Medium') : 'Medium',
      };

      // Validate
      if (!q.question) { warnings.push(`Row ${i+1}: Empty question — skipped`); continue; }
      if (!q.options.A || !q.options.B) { warnings.push(`Row ${i+1}: Missing options A or B — skipped`); continue; }
      if (!['A','B','C','D'].includes(q.correct)) {
        warnings.push(`Row ${i+1}: Invalid correct answer "${q.correct}" — defaulting to A`);
        q.correct = 'A';
      }

      questions.push(q);
    }

    return { questions, errors, warnings };
  }

  /**
   * Parse JSON content into question objects.
   */
  function parseJSON(raw) {
    const errors  = [];
    const warnings = [];
    const questions = [];

    let data;
    try {
      data = JSON.parse(raw);
    } catch(e) {
      errors.push('Invalid JSON: ' + e.message);
      return { questions, errors, warnings };
    }

    const arr = Array.isArray(data) ? data : (data.questions || data.mcqs || data.data || []);
    if (!arr.length) {
      errors.push('No question array found in JSON. Expected root array or { questions: [...] }');
      return { questions, errors, warnings };
    }

    arr.forEach((item, i) => {
      // Normalize options — accept { A, B, C, D } or [optA, optB, ...]
      let opts = { A: '', B: '', C: '', D: '' };
      if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
        opts = {
          A: String(item.options.A || item.options.a || item.options['1'] || ''),
          B: String(item.options.B || item.options.b || item.options['2'] || ''),
          C: String(item.options.C || item.options.c || item.options['3'] || ''),
          D: String(item.options.D || item.options.d || item.options['4'] || ''),
        };
      } else if (Array.isArray(item.options)) {
        const KEYS = ['A','B','C','D'];
        item.options.forEach((v, j) => { if (KEYS[j]) opts[KEYS[j]] = String(v); });
      } else {
        // Try flat format: optionA, optionB...
        opts = {
          A: String(item.optionA || item.option_a || item.choiceA || item.a || ''),
          B: String(item.optionB || item.option_b || item.choiceB || item.b || ''),
          C: String(item.optionC || item.option_c || item.choiceC || item.c || ''),
          D: String(item.optionD || item.option_d || item.choiceD || item.d || ''),
        };
      }

      const correct = String(item.correct || item.answer || item.ans || item.key || '').trim().toUpperCase();
      const question = String(item.question || item.q || item.text || '').trim();

      if (!question) { warnings.push(`Item ${i+1}: Missing question text — skipped`); return; }
      if (!opts.A || !opts.B) { warnings.push(`Item ${i+1}: Missing options — skipped`); return; }

      questions.push({
        id:          String(item.id || (i+1)),
        question,
        options:     opts,
        correct:     ['A','B','C','D'].includes(correct) ? correct : 'A',
        explanation: String(item.explanation || item.exp || item.reason || item.solution || ''),
        section:     String(item.section || item.topic || item.subject || item.category || 'General'),
        difficulty:  String(item.difficulty || item.level || item.diff || 'Medium'),
      });
    });

    return { questions, errors, warnings };
  }

  /**
   * Split a CSV row respecting quoted fields.
   */
  function splitCSVRow(row) {
    const cells = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        if (inQuote && row[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        cells.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur);
    return cells;
  }

  function findCol(header, aliases) {
    for (const alias of aliases) {
      const idx = header.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  return {
    CSV_TEMPLATE,
    JSON_TEMPLATE,

    parse(raw, hint) {
      if (!raw || !raw.trim()) return { questions: [], errors: ['Empty input'], warnings: [] };
      const fmt = hint || detectFormat(raw);
      return fmt === 'json' ? parseJSON(raw) : parseCSV(raw);
    },

    getSections(questions) {
      const seen = new Set();
      return questions.reduce((acc, q) => {
        const s = q.section || 'General';
        if (!seen.has(s)) { seen.add(s); acc.push(s); }
        return acc;
      }, []);
    },
  };
})();
