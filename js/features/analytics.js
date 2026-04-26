/**
 * GovTPortal v2 — Analytics Engine
 * Computes all result metrics from exam state.
 */
window.Analytics = (function() {

  const GRADE_SCALE = [
    { min: 90, grade: 'A+', message: 'Outstanding! You are exam-ready.' },
    { min: 75, grade: 'A',  message: 'Excellent! Keep this up.' },
    { min: 60, grade: 'B+', message: 'Good work — a bit more practice on weak areas.' },
    { min: 50, grade: 'B',  message: 'Above average — focus on wrong answers.' },
    { min: 40, grade: 'C',  message: 'Average — review fundamentals and retry.' },
    { min: 25, grade: 'D',  message: 'Needs improvement — revise thoroughly.' },
    { min: 0,  grade: 'F',  message: 'Keep going — every attempt is a learning step.' },
  ];

  function getGrade(pct) {
    for (const g of GRADE_SCALE) {
      if (pct >= g.min) return g;
    }
    return GRADE_SCALE[GRADE_SCALE.length - 1];
  }

  return {
    compute({ questions, answers, flags, qTimes, config, session }) {
      const cfg = config || {};
      const marksCorrect  = parseFloat(cfg.marksCorrect)  || 4;
      const marksNegative = parseFloat(cfg.marksNegative) || 1;
      const totalQ        = questions.length;

      let correct = 0, wrong = 0, skipped = 0;
      let totalScore = 0;
      const sectionMap = {};

      questions.forEach((q, idx) => {
        const ans    = answers[idx];
        const userAns = ans ? ans.value : null;
        const sec    = q.section || 'General';

        if (!sectionMap[sec]) {
          sectionMap[sec] = { name: sec, correct: 0, wrong: 0, skipped: 0, total: 0 };
        }
        sectionMap[sec].total++;

        if (!userAns) {
          skipped++;
          sectionMap[sec].skipped++;
        } else if (userAns === q.correct) {
          correct++;
          totalScore += marksCorrect;
          sectionMap[sec].correct++;
        } else {
          wrong++;
          totalScore -= marksNegative;
          sectionMap[sec].wrong++;
        }
      });

      // Score can't go below 0
      totalScore = Math.max(0, totalScore);
      const maxPossible = totalQ * marksCorrect;
      const totalMarks  = cfg.totalMarks || maxPossible;
      const percentage  = totalMarks ? Math.round((totalScore / totalMarks) * 100) : 0;
      const accuracy    = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
      const attemptRate = totalQ ? Math.round(((correct + wrong) / totalQ) * 100) : 0;

      // Time
      const timeTaken = session && session.startTime && session.endTime
        ? Math.round((session.endTime - session.startTime) / 1000)
        : 0;

      // Per-question average time
      const qtArr = Object.values(qTimes || {});
      const avgQTime = qtArr.length ? qtArr.reduce((a, b) => a + b, 0) / qtArr.length : 0;

      // Grade
      const gradeObj = getGrade(percentage);

      // Sections array
      const sections = Object.values(sectionMap);

      // Weak areas (< 50% accuracy)
      const weakAreas = sections
        .filter(s => s.total > 0 && (s.correct / s.total) < 0.5)
        .map(s => ({
          section: s.name,
          correct: s.correct,
          total:   s.total,
          pct:     Math.round((s.wrong / s.total) * 100), // wrong rate
        }))
        .sort((a, b) => b.pct - a.pct);

      // Recommendations
      const recommendations = [];
      if (accuracy < 60) recommendations.push('Focus on accuracy — attempt questions only when reasonably sure to avoid negative marking.');
      if (attemptRate < 70) recommendations.push('Work on speed — you left many questions unattempted. Use mock tests to improve time management.');
      if (weakAreas.length) recommendations.push(`Your weakest sections are: ${weakAreas.slice(0, 3).map(w => w.section).join(', ')}. Revise these topics first.`);
      if (percentage >= 60 && avgQTime > 120) recommendations.push('Good score, but you are spending too long per question. Practice quick elimination strategies.');
      if (percentage < 40) recommendations.push('Start with easier topics first to build confidence. Use the AI tool to generate topic-specific practice sets.');
      if (!recommendations.length) recommendations.push('Excellent performance! Try a harder paper or simulate full exam conditions for advanced practice.');

      return {
        score:          parseFloat(totalScore.toFixed(1)),
        totalMarks:     totalMarks,
        maxPossible:    maxPossible,
        percentage,
        correct,
        wrong,
        skipped,
        accuracy,
        attemptRate,
        timeTaken,
        avgQTime:       parseFloat(avgQTime.toFixed(1)),
        grade:          gradeObj.grade,
        gradeMessage:   gradeObj.message,
        sections,
        weakAreas,
        recommendations,
        qTimes:         qTimes || {},
        startTime:      session ? session.startTime : null,
        endTime:        session ? session.endTime   : null,
        examTitle:      cfg.examTitle || 'Practice Exam',
        candidateName:  cfg.candidateName || '',
      };
    },
  };
})();
