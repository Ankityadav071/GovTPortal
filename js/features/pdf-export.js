/**
 * GovTPortal v2 — PDF Export
 * Generates a professional result report using jsPDF
 */
window.PDFExport = (function() {

  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  function loadjsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) { resolve(window.jspdf); return; }
      const script = document.createElement('script');
      script.src = CDN;
      script.onload = () => resolve(window.jspdf);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return {
    async generate({ result, cfg, questions, answers, flags, qTimes }) {
      toast('Generating PDF...', 'info', 4000);

      let jspdf;
      try { jspdf = await loadjsPDF(); }
      catch { toast('Could not load jsPDF library. Check your internet connection.', 'danger'); return; }

      const { jsPDF } = jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210, H = 297;
      const margin = 18;
      let y = margin;

      // Helper
      const nl = (n = 6) => { y += n; };
      const text = (t, x, size = 10, style = 'normal', color = [220, 220, 230]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
        doc.text(String(t), x, y);
      };
      const hline = (col = [50, 50, 70]) => {
        doc.setDrawColor(...col);
        doc.setLineWidth(0.4);
        doc.line(margin, y, W - margin, y);
        nl(5);
      };
      const rect = (x, ry, w, h, fill = [24, 26, 34]) => {
        doc.setFillColor(...fill);
        doc.rect(x, ry, w, h, 'F');
      };

      // ── PAGE 1: COVER ──────────────────────────────────────────
      // Background
      rect(0, 0, W, H, [13, 15, 22]);

      // Header bar
      rect(0, 0, W, 40, [22, 35, 68]);

      // Brand
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('GovTPortal', margin, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 170, 210);
      doc.text('Exam Performance Report', margin, 26);

      // Tricolor bar
      doc.setFillColor(255, 153, 51);
      doc.rect(0, 38, W, 1.5, 'F');
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 39.5, W, 1.5, 'F');
      doc.setFillColor(19, 136, 8);
      doc.rect(0, 41, W, 1.5, 'F');

      y = 60;

      // Exam title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(cfg.examTitle || 'Practice Exam', margin, y);
      nl(10);

      // Score ring (simulated as circle)
      const cx = W - margin - 25, cy = y + 5;
      const pct = result.percentage;
      const r = 22;
      doc.setDrawColor(40, 50, 80);
      doc.setLineWidth(4);
      doc.circle(cx, cy, r, 'S');
      const scoreColor = pct >= 60 ? [34, 197, 110] : pct >= 40 ? [250, 173, 20] : [224, 62, 62];
      doc.setDrawColor(...scoreColor);
      doc.circle(cx, cy - 1, r - 0.5, 'S'); // approximate fill
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...scoreColor);
      doc.text(pct + '%', cx - 7, cy + 4);

      // Grade badge
      const gradeColors = { 'A+': [34, 197, 110], 'A': [34, 197, 110], 'B+': [59, 130, 246], 'B': [59, 130, 246], 'C': [250, 173, 20], 'D': [224, 62, 62], 'F': [224, 62, 62] };
      const gc = gradeColors[result.grade] || [120, 120, 180];
      rect(cx - 12, cy + 14, 24, 10, gc);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Grade ' + (result.grade || '—'), cx - 9, cy + 21);

      // Meta info
      const meta = [
        ['Candidate',    cfg.candidateName || 'Candidate'],
        ['Score',        result.score + ' / ' + result.totalMarks],
        ['Correct',      String(result.correct)],
        ['Wrong',        String(result.wrong)],
        ['Skipped',      String(result.skipped)],
        ['Accuracy',     result.accuracy + '%'],
        ['Attempt Rate', result.attemptRate + '%'],
        ['Time Taken',   typeof formatTime === 'function' ? formatTime(result.timeTaken) : result.timeTaken + 's'],
        ['Date',         result.endTime ? new Date(result.endTime).toLocaleString('en-IN') : '—'],
      ];

      meta.forEach(([label, val]) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 150, 190);
        doc.text(label + ':', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 220, 235);
        doc.text(val, margin + 38, y);
        nl(8);
      });

      // Motivational message
      nl(5);
      rect(margin, y - 3, W - margin * 2, 14, [25, 40, 70]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(180, 190, 220);
      doc.text('"' + (result.gradeMessage || '') + '"', margin + 5, y + 5);
      nl(18);

      // ── PAGE 2: SECTION ANALYSIS ──────────────────────────────
      doc.addPage();
      rect(0, 0, W, H, [13, 15, 22]);
      y = margin;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Section-wise Analysis', margin, y);
      nl(3);
      hline();

      (result.sections || []).forEach(sec => {
        const pctSec = sec.total ? Math.round((sec.correct / sec.total) * 100) : 0;
        const barColor = pctSec >= 60 ? [34, 197, 110] : pctSec >= 40 ? [250, 173, 20] : [224, 62, 62];

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 220, 235);
        doc.text(sec.name, margin, y);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 150, 190);
        doc.text(`${sec.correct}/${sec.total} correct · ${sec.wrong} wrong · ${sec.skipped} skipped`, margin, y + 5);

        // Progress bar
        const barW = W - margin * 2 - 25;
        rect(margin, y + 8, barW, 4, [35, 40, 60]);
        rect(margin, y + 8, barW * pctSec / 100, 4, barColor);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...barColor);
        doc.text(pctSec + '%', W - margin - 18, y + 11);

        nl(20);
        if (y > H - 30) { doc.addPage(); rect(0, 0, W, H, [13, 15, 22]); y = margin; }
      });

      // Recommendations
      nl(4);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Improvement Recommendations', margin, y);
      nl(3);
      hline();

      (result.recommendations || []).forEach((rec, i) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 190, 220);
        const lines = doc.splitTextToSize('• ' + rec, W - margin * 2);
        doc.text(lines, margin, y);
        nl(lines.length * 5 + 3);
        if (y > H - 20) { doc.addPage(); rect(0, 0, W, H, [13, 15, 22]); y = margin; }
      });

      // ── PAGE 3: QUESTION REVIEW ───────────────────────────────
      doc.addPage();
      rect(0, 0, W, H, [13, 15, 22]);
      y = margin;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Question-by-Question Review', margin, y);
      nl(3);
      hline();

      questions.forEach((q, idx) => {
        if (y > H - 35) { doc.addPage(); rect(0, 0, W, H, [13, 15, 22]); y = margin; }

        const ans    = answers[idx];
        const userA  = ans ? ans.value : null;
        const correct = userA === q.correct;
        const skipped = !userA;
        const statusColor = skipped ? [120, 130, 160] : correct ? [34, 197, 110] : [224, 62, 62];
        const statusLabel = skipped ? 'SKIP' : correct ? '✓' : '✗';
        const tSpent = qTimes && qTimes[idx] ? qTimes[idx] + 's' : '—';

        // Row bg
        rect(margin, y - 3, W - margin * 2, 14, [20, 24, 36]);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 190, 210);
        doc.text('Q' + (idx + 1), margin + 2, y + 4);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 235);
        const qLine = doc.splitTextToSize(q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question, W - margin * 2 - 40);
        doc.text(qLine, margin + 12, y + 4);

        // Status
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...statusColor);
        doc.text(statusLabel, W - margin - 18, y + 4);

        // Time & ans
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 140, 170);
        doc.text(`Yours: ${userA || '—'}  Correct: ${q.correct}  Time: ${tSpent}`, margin + 12, y + 9);

        nl(18);
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 90, 120);
        doc.text(`GovTPortal · ${cfg.examTitle || ''} · Page ${p}/${pageCount}`, margin, H - 8);
      }

      // Save
      const filename = `GovTPortal_${(cfg.examTitle || 'Result').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      doc.save(filename);
      toast('PDF downloaded!', 'success');
    },
  };
})();
