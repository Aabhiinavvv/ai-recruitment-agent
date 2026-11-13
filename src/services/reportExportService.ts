import { jsPDF } from 'jspdf';
import { Candidate, AuditEvent, HiringBrief, OutreachDraft, HiringStage } from '../types';

export interface ExportReportOptions {
  brief: HiringBrief | null;
  candidates: Candidate[];
  auditEvents: AuditEvent[];
  outreachQueue?: OutreachDraft[];
  cutoffScore?: number;
  reportTitle?: string;
  reportNotes?: string;
  includeAuditLogs?: boolean;
  includeOutreachStatus?: boolean;
  stageFilter?: string;
  onlyAboveCutoff?: boolean;
  generatedBy?: string;
}

export const getCandidateStage = (cand: Candidate): HiringStage => {
  if (cand.stage) return cand.stage;
  if (cand.decision_status?.includes('Not proceeding') || cand.recruiter_decision === 'reject') {
    return 'Rejected';
  }
  if (cand.decision_status?.includes('Hired')) {
    return 'Offered';
  }
  if (cand.current_round === 'coding' || cand.current_round === 'technical') {
    return 'Technical';
  }
  if (cand.current_round === 'hr') {
    return 'Interview';
  }
  return 'Screening';
};

/**
 * Escape string for RFC-4180 CSV format
 */
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Filter candidates based on export scope options
 */
const filterCandidatesForReport = (
  candidates: Candidate[],
  stageFilter?: string,
  onlyAboveCutoff?: boolean,
  cutoffScore: number = 75
): Candidate[] => {
  let list = [...candidates];
  if (onlyAboveCutoff) {
    list = list.filter((c) => c.overall_score >= cutoffScore);
  }
  if (stageFilter && stageFilter !== 'all') {
    list = list.filter((c) => getCandidateStage(c) === stageFilter);
  }
  return list;
};

/**
 * 1. Export Candidate Evaluation Summary as CSV
 */
export const exportCandidateEvaluationCSV = (options: ExportReportOptions): void => {
  const { candidates, brief, cutoffScore = 75, stageFilter, onlyAboveCutoff } = options;
  const filtered = filterCandidatesForReport(candidates, stageFilter, onlyAboveCutoff, cutoffScore);

  const headers = [
    'Candidate ID',
    'Candidate Name',
    'Email',
    'Phone',
    'Role',
    'Overall Match Score (%)',
    'Meets Cutoff (>=75%)',
    'Stage',
    'Decision Status',
    'Recruiter Decision',
    'Technical Score (%)',
    'Experience Score (%)',
    'Education Score (%)',
    'Projects Score (%)',
    'Domain Score (%)',
    'Communication Score (%)',
    'Verified Strengths',
    'Missing Skills / Gaps',
    'Top Skill Ratings',
    'Persona Archetype',
    'Labels',
    'Processed Date',
    'Private Notes',
  ];

  const rows = filtered.map((c) => [
    escapeCSV(c.candidate_id),
    escapeCSV(c.name),
    escapeCSV(c.email),
    escapeCSV(c.phone || ''),
    escapeCSV(c.role || brief?.job_title || 'N/A'),
    c.overall_score,
    c.overall_score >= cutoffScore ? 'YES' : 'NO',
    escapeCSV(getCandidateStage(c)),
    escapeCSV(c.decision_status),
    escapeCSV(c.recruiter_decision || 'pending'),
    c.dimension_scores?.technical ?? 0,
    c.dimension_scores?.experience ?? 0,
    c.dimension_scores?.education ?? 0,
    c.dimension_scores?.projects ?? 0,
    c.dimension_scores?.domain ?? 0,
    c.dimension_scores?.communication ?? 0,
    escapeCSV((c.strengths || []).join('; ')),
    escapeCSV((c.missing_skills || []).join('; ')),
    escapeCSV(
      Object.entries(c.skill_scores || {})
        .map(([k, v]) => `${k}:${v}/10`)
        .join('; ')
    ),
    escapeCSV(c.persona?.archetype || 'N/A'),
    escapeCSV((c.custom_tags || []).join('; ')),
    escapeCSV(c.processed_at ? new Date(c.processed_at).toLocaleString() : 'Initial Import'),
    escapeCSV(c.private_notes || ''),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const roleSlug = (brief?.job_title || 'talent').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `candidate-evaluations-${roleSlug}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * 2. Export Workflow Audit Logs as CSV
 */
export const exportAuditLogsCSV = (options: ExportReportOptions): void => {
  const { auditEvents, brief } = options;

  const headers = [
    'Log ID',
    'Timestamp',
    'Actor',
    'Action Taken',
    'Subject / Target Candidate',
    'Job Role Context',
    'Company Context',
  ];

  const rows = auditEvents.map((evt, idx) => [
    idx + 1,
    escapeCSV(evt.timestamp),
    escapeCSV(evt.actor),
    escapeCSV(evt.action),
    escapeCSV(evt.subject),
    escapeCSV(brief?.job_title || 'N/A'),
    escapeCSV(brief?.company_name || 'N/A'),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const roleSlug = (brief?.job_title || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `recruitment-audit-logs-${roleSlug}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * 3. Export Combined Executive HR Records Package as CSV
 */
export const exportCombinedHRReportCSV = (options: ExportReportOptions): void => {
  const { candidates, auditEvents, outreachQueue = [], brief, cutoffScore = 75, reportTitle, reportNotes } = options;
  const filtered = filterCandidatesForReport(candidates, options.stageFilter, options.onlyAboveCutoff, cutoffScore);

  const lines: string[] = [];

  // Section 1: Executive Metadata
  lines.push('========================================================================');
  lines.push('TALENT ACQUISITION WORKFLOW & AUDIT COMPLIANCE REPORT');
  lines.push('========================================================================');
  lines.push(`Report Title: ,${escapeCSV(reportTitle || 'Candidate Evaluation Summary & Audit Trail')}`);
  lines.push(`Generated Date: ,${escapeCSV(new Date().toLocaleString())}`);
  lines.push(`Company: ,${escapeCSV(brief?.company_name || 'Organization')}`);
  lines.push(`Target Role: ,${escapeCSV(brief?.job_title || 'Engineering Role')}`);
  lines.push(`Headcount / Budget: ,${escapeCSV(`${brief?.headcount || 1} positions · ${brief?.salary_budget || 'Competitive'}`)}`);
  lines.push(`Advisory Cutoff Bar: ,${cutoffScore}%`);
  lines.push(`Total Candidates Evaluated: ,${filtered.length}`);
  lines.push(`Total Audit Events Logged: ,${auditEvents.length}`);
  if (reportNotes) {
    lines.push(`HR Notes / Sign-Off: ,${escapeCSV(reportNotes)}`);
  }
  lines.push('');

  // Section 2: Candidate Evaluation Summary
  lines.push('------------------------------------------------------------------------');
  lines.push('SECTION 1: CANDIDATE EVALUATION SUMMARY');
  lines.push('------------------------------------------------------------------------');
  const candidateHeaders = [
    'Candidate ID',
    'Candidate Name',
    'Email',
    'Overall Score (%)',
    'Meets Cutoff',
    'Stage',
    'Decision Status',
    'Technical (%)',
    'Experience (%)',
    'Education (%)',
    'Projects (%)',
    'Domain (%)',
    'Communication (%)',
    'Verified Strengths',
    'Skill Gaps',
    'Archetype',
  ];
  lines.push(candidateHeaders.join(','));

  filtered.forEach((c) => {
    lines.push(
      [
        escapeCSV(c.candidate_id),
        escapeCSV(c.name),
        escapeCSV(c.email),
        c.overall_score,
        c.overall_score >= cutoffScore ? 'YES' : 'NO',
        escapeCSV(getCandidateStage(c)),
        escapeCSV(c.decision_status),
        c.dimension_scores?.technical ?? 0,
        c.dimension_scores?.experience ?? 0,
        c.dimension_scores?.education ?? 0,
        c.dimension_scores?.projects ?? 0,
        c.dimension_scores?.domain ?? 0,
        c.dimension_scores?.communication ?? 0,
        escapeCSV((c.strengths || []).join('; ')),
        escapeCSV((c.missing_skills || []).join('; ')),
        escapeCSV(c.persona?.archetype || 'N/A'),
      ].join(',')
    );
  });
  lines.push('');

  // Section 3: Recruitment Workflow Audit Logs
  lines.push('------------------------------------------------------------------------');
  lines.push('SECTION 2: RECRUITMENT WORKFLOW AUDIT LOGS & COMPLIANCE TRAIL');
  lines.push('------------------------------------------------------------------------');
  const auditHeaders = ['Log ID', 'Timestamp', 'Actor', 'Action Taken', 'Subject / Target Candidate'];
  lines.push(auditHeaders.join(','));

  auditEvents.forEach((evt, i) => {
    lines.push(
      [
        i + 1,
        escapeCSV(evt.timestamp),
        escapeCSV(evt.actor),
        escapeCSV(evt.action),
        escapeCSV(evt.subject),
      ].join(',')
    );
  });
  lines.push('');

  // Section 4: Outreach & Follow-Up Reminders
  if (outreachQueue.length > 0) {
    lines.push('------------------------------------------------------------------------');
    lines.push('SECTION 3: OUTREACH & AUTOMATED FOLLOW-UP REMINDERS STATUS');
    lines.push('------------------------------------------------------------------------');
    lines.push('Draft ID,Candidate,Email,Status,Sent Date,Reminder Rule (Days),Response Status,Follow-Up Reminders Sent');
    outreachQueue.forEach((d) => {
      lines.push(
        [
          escapeCSV(d.id),
          escapeCSV(d.candidate_name),
          escapeCSV(d.candidate_email),
          escapeCSV(d.status),
          escapeCSV(d.sent_at || 'Not sent'),
          d.reminder_days || 3,
          escapeCSV(d.response_status || 'waiting'),
          d.follow_up_sent_count || 0,
        ].join(',')
      );
    });
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const roleSlug = (brief?.job_title || 'hr-record').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `complete-hr-records-${roleSlug}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * 4. Export Formatted Executive PDF Report via jsPDF
 */
export const exportFormattedPDFReport = (options: ExportReportOptions): void => {
  const {
    brief,
    candidates,
    auditEvents,
    outreachQueue = [],
    cutoffScore = 75,
    reportTitle = 'Candidate Evaluation Summary & Workflow Audit Report',
    reportNotes,
    includeAuditLogs = true,
    includeOutreachStatus = true,
    stageFilter,
    onlyAboveCutoff,
    generatedBy = 'HR Talent Acquisition System',
  } = options;

  const filtered = filterCandidatesForReport(candidates, stageFilter, onlyAboveCutoff, cutoffScore);

  // Initialize jsPDF document (A4, portrait, pt units)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const usableWidth = pageWidth - marginX * 2;
  let currentY = 40;

  const totalPagesExp = '{total_pages_count_string}';

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 45) {
      doc.addPage();
      currentY = 40;
      return true;
    }
    return false;
  };

  // ----------------------------------------------------
  // HEADER BANNER
  // ----------------------------------------------------
  // Primary brand accent top bar
  doc.setFillColor(103, 67, 238); // #6743ee
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(reportTitle.toUpperCase(), marginX, currentY + 12);
  currentY += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Role: ${brief?.job_title || 'AI/ML Engineer'}   |   Company: ${brief?.company_name || 'Anthropic Tech'}   |   Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    marginX,
    currentY
  );
  currentY += 16;

  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(1);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 16;

  // ----------------------------------------------------
  // EXECUTIVE SUMMARY KPI CARDS
  // ----------------------------------------------------
  const avgScore =
    filtered.length > 0
      ? (filtered.reduce((acc, c) => acc + c.overall_score, 0) / filtered.length).toFixed(1)
      : '0.0';
  const passCount = filtered.filter((c) => c.overall_score >= cutoffScore).length;
  const passRate = filtered.length > 0 ? Math.round((passCount / filtered.length) * 100) : 0;

  const kpiBoxWidth = (usableWidth - 30) / 4;
  const kpiBoxHeight = 44;

  const kpis = [
    { label: 'EVALUATED', value: `${filtered.length} Candidates`, sub: `of ${candidates.length} total in pool` },
    { label: 'COHORT MEAN', value: `${avgScore}%`, sub: `Target Cutoff: ${cutoffScore}%` },
    { label: 'QUALIFIED RATE', value: `${passRate}%`, sub: `${passCount} of ${filtered.length} met bar` },
    { label: 'WORKFLOW AUDIT', value: `${auditEvents.length} Events`, sub: 'Compliance verified' },
  ];

  kpis.forEach((kpi, idx) => {
    const boxX = marginX + idx * (kpiBoxWidth + 10);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(boxX, currentY, kpiBoxWidth, kpiBoxHeight, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, currentY, kpiBoxWidth, kpiBoxHeight, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, boxX + 8, currentY + 12);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, boxX + 8, currentY + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, boxX + 8, currentY + 38);
  });

  currentY += kpiBoxHeight + 18;

  // Optional HR Notes
  if (reportNotes) {
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(marginX, currentY, usableWidth, 26, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('HR NOTES / AUDIT MEMO: ', marginX + 8, currentY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(reportNotes, usableWidth - 140)[0] || '', marginX + 130, currentY + 16);
    currentY += 34;
  }

  // ----------------------------------------------------
  // SECTION 1: CANDIDATE EVALUATION SUMMARY TABLE
  // ----------------------------------------------------
  checkPageBreak(120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. CANDIDATE EVALUATION SUMMARY (6-DIMENSION RUBRIC)', marginX, currentY);
  currentY += 14;

  // Table Columns
  // Total width: 515 pt
  const colWidths = {
    id: 55,
    name: 110,
    overall: 45,
    tech: 32,
    exp: 32,
    edu: 30,
    proj: 32,
    stage: 65,
    status: 114,
  };

  // Table Header Row
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(marginX, currentY, usableWidth, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let cellX = marginX + 4;
  doc.text('ID', cellX, currentY + 12);
  cellX += colWidths.id;
  doc.text('CANDIDATE', cellX, currentY + 12);
  cellX += colWidths.name;
  doc.text('SCORE', cellX, currentY + 12);
  cellX += colWidths.overall;
  doc.text('TECH', cellX, currentY + 12);
  cellX += colWidths.tech;
  doc.text('EXP', cellX, currentY + 12);
  cellX += colWidths.exp;
  doc.text('EDU', cellX, currentY + 12);
  cellX += colWidths.edu;
  doc.text('PROJ', cellX, currentY + 12);
  cellX += colWidths.proj;
  doc.text('STAGE', cellX, currentY + 12);
  cellX += colWidths.stage;
  doc.text('DECISION STATUS', cellX, currentY + 12);

  currentY += 18;

  // Table Body Rows
  filtered.forEach((cand, idx) => {
    checkPageBreak(38);

    const isEven = idx % 2 === 0;
    const rowHeight = 30;

    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(marginX, currentY, usableWidth, rowHeight, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, currentY + rowHeight, marginX + usableWidth, currentY + rowHeight);

    // Candidate primary row
    cellX = marginX + 4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cand.candidate_id, cellX, currentY + 12);

    cellX += colWidths.id;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cand.name, cellX, currentY + 12);

    // Sub-email
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cand.email, cellX, currentY + 22);

    // Score with color highlight
    cellX += colWidths.name;
    const meets = cand.overall_score >= cutoffScore;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (meets) {
      doc.setTextColor(13, 148, 136); // teal-600
    } else {
      doc.setTextColor(225, 29, 72); // rose-600
    }
    doc.text(`${cand.overall_score}%`, cellX, currentY + 12);

    // Dimensions
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    cellX += colWidths.overall;
    doc.text(`${cand.dimension_scores?.technical ?? 0}%`, cellX, currentY + 12);

    cellX += colWidths.tech;
    doc.text(`${cand.dimension_scores?.experience ?? 0}%`, cellX, currentY + 12);

    cellX += colWidths.exp;
    doc.text(`${cand.dimension_scores?.education ?? 0}%`, cellX, currentY + 12);

    cellX += colWidths.edu;
    doc.text(`${cand.dimension_scores?.projects ?? 0}%`, cellX, currentY + 12);

    cellX += colWidths.proj;
    doc.setFont('helvetica', 'bold');
    doc.text(getCandidateStage(cand), cellX, currentY + 12);

    cellX += colWidths.stage;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const statusText = cand.decision_status.length > 25
      ? `${cand.decision_status.slice(0, 25)}...`
      : cand.decision_status;
    doc.text(statusText, cellX, currentY + 12);

    // Strengths snippet
    const strengthsSnippet = (cand.strengths || []).slice(0, 2).join(' · ');
    if (strengthsSnippet) {
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Strengths: ${doc.splitTextToSize(strengthsSnippet, usableWidth - 120)[0] || ''}`,
        cellX,
        currentY + 22
      );
    }

    currentY += rowHeight;
  });

  currentY += 18;

  // ----------------------------------------------------
  // SECTION 2: WORKFLOW AUDIT LOGS & COMPLIANCE TRAIL
  // ----------------------------------------------------
  if (includeAuditLogs && auditEvents.length > 0) {
    checkPageBreak(80);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. RECRUITMENT WORKFLOW AUDIT TRAIL & COMPLIANCE LOGS', marginX, currentY);
    currentY += 14;

    const auditColWidths = {
      time: 65,
      actor: 85,
      action: 215,
      subject: 150,
    };

    // Header
    doc.setFillColor(51, 65, 85); // slate-700
    doc.rect(marginX, currentY, usableWidth, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let auditX = marginX + 4;
    doc.text('TIMESTAMP', auditX, currentY + 11);
    auditX += auditColWidths.time;
    doc.text('ACTOR', auditX, currentY + 11);
    auditX += auditColWidths.actor;
    doc.text('ACTION TAKEN', auditX, currentY + 11);
    auditX += auditColWidths.action;
    doc.text('SUBJECT / CANDIDATE', auditX, currentY + 11);

    currentY += 16;

    // Rows
    auditEvents.forEach((evt, i) => {
      checkPageBreak(18);

      const isEven = i % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(marginX, currentY, usableWidth, 16, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, currentY + 16, marginX + usableWidth, currentY + 16);

      auditX = marginX + 4;
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(evt.timestamp, auditX, currentY + 11);

      auditX += auditColWidths.time;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(evt.actor, auditX, currentY + 11);

      auditX += auditColWidths.actor;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      const actionText = evt.action.length > 52 ? `${evt.action.slice(0, 52)}...` : evt.action;
      doc.text(actionText, auditX, currentY + 11);

      auditX += auditColWidths.action;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const subjectText = evt.subject.length > 36 ? `${evt.subject.slice(0, 36)}...` : evt.subject;
      doc.text(subjectText, auditX, currentY + 11);

      currentY += 16;
    });

    currentY += 18;
  }

  // ----------------------------------------------------
  // SECTION 3: OUTREACH & AUTOMATED REMINDERS (OPTIONAL)
  // ----------------------------------------------------
  if (includeOutreachStatus && outreachQueue.length > 0) {
    checkPageBreak(70);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3. OUTREACH & FOLLOW-UP REMINDER QUEUE STATUS', marginX, currentY);
    currentY += 14;

    doc.setFillColor(71, 85, 105);
    doc.rect(marginX, currentY, usableWidth, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    doc.text('CANDIDATE', marginX + 4, currentY + 11);
    doc.text('STATUS', marginX + 130, currentY + 11);
    doc.text('DISPATCHED', marginX + 240, currentY + 11);
    doc.text('RESPONSE', marginX + 330, currentY + 11);
    doc.text('REMINDER RULE', marginX + 420, currentY + 11);

    currentY += 16;

    outreachQueue.forEach((draft, i) => {
      checkPageBreak(16);

      const isEven = i % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(marginX, currentY, usableWidth, 16, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, currentY + 16, marginX + usableWidth, currentY + 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(draft.candidate_name, marginX + 4, currentY + 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(draft.status.slice(0, 24), marginX + 130, currentY + 11);
      doc.text(draft.sent_at ? new Date(draft.sent_at).toLocaleDateString() : 'Draft', marginX + 240, currentY + 11);
      doc.text(draft.response_status === 'responded' ? '✓ Responded' : 'Awaiting', marginX + 330, currentY + 11);
      doc.text(`${draft.reminder_days || 3} days`, marginX + 420, currentY + 11);

      currentY += 16;
    });

    currentY += 18;
  }

  // ----------------------------------------------------
  // FOOTER & PAGE NUMBERING (ALL PAGES)
  // ----------------------------------------------------
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      'CONFIDENTIAL HR RECORD — For Internal Hiring & Regulatory Compliance Audit Only',
      marginX,
      pageHeight - 20
    );
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginX - 50, pageHeight - 20);
  }

  // Save PDF file to client browser
  const roleSlug = (brief?.job_title || 'candidate-evaluation').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`hr-report-${roleSlug}-${Date.now()}.pdf`);
};
