import { desc, eq, asc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditEvents,
  candidates,
  hiringBriefs,
  outreachDrafts,
  scheduledInterviews,
} from './schema.ts';
import type {
  AuditEvent,
  Candidate,
  HiringBrief,
  OutreachDraft,
  ScheduledInterview,
} from '../types/index.ts';

export interface WorkspacePayload {
  initialized: boolean;
  brief: HiringBrief | null;
  candidates: Candidate[];
  scheduledInterviews: ScheduledInterview[];
  outreachQueue: OutreachDraft[];
  events: AuditEvent[];
}

export async function loadWorkspaceRecords(userId: number): Promise<WorkspacePayload> {
  try {
    const [briefRows, candidateRows, interviewRows, draftRows, eventRows] =
      await Promise.all([
        db
          .select()
          .from(hiringBriefs)
          .where(eq(hiringBriefs.userId, userId))
          .limit(1),
        db
          .select()
          .from(candidates)
          .where(eq(candidates.userId, userId))
          .orderBy(desc(candidates.updatedAt), desc(candidates.id)),
        db
          .select()
          .from(scheduledInterviews)
          .where(eq(scheduledInterviews.userId, userId))
          .orderBy(desc(scheduledInterviews.createdAt), desc(scheduledInterviews.id)),
        db
          .select()
          .from(outreachDrafts)
          .where(eq(outreachDrafts.userId, userId))
          .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.id)),
        db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.userId, userId))
          .orderBy(asc(auditEvents.id)),
      ]);

    const hasAnyData =
      briefRows.length > 0 ||
      candidateRows.length > 0 ||
      interviewRows.length > 0 ||
      draftRows.length > 0 ||
      eventRows.length > 0;

    const briefRow = briefRows[0];
    const brief: HiringBrief | null = briefRow
      ? {
          company_name: briefRow.companyName,
          job_title: briefRow.jobTitle,
          location: briefRow.location,
          headcount: briefRow.headcount,
          salary_budget: briefRow.salaryBudget,
          timeline: briefRow.timeline,
          requirements: briefRow.requirements,
          jd: briefRow.jd,
          status: briefRow.status as HiringBrief['status'],
          evaluation_rubric: briefRow.evaluationRubric || undefined,
        }
      : null;

    return {
      initialized: hasAnyData,
      brief,
      candidates: candidateRows.map((row) => row.payload),
      scheduledInterviews: interviewRows.map((row) => row.payload),
      outreachQueue: draftRows.map((row) => row.payload),
      events: eventRows.map((row) => ({
        timestamp: row.timestamp,
        actor: row.actor,
        action: row.action,
        subject: row.subject,
      })),
    };
  } catch (error) {
    console.error('Database query failed in loadWorkspaceRecords:', error);
    throw new Error('Failed to load workspace records.', { cause: error });
  }
}

export async function upsertHiringBrief(
  userId: number,
  brief: HiringBrief
): Promise<void> {
  try {
    await db
      .insert(hiringBriefs)
      .values({
        userId,
        companyName: brief.company_name,
        jobTitle: brief.job_title,
        location: brief.location,
        headcount: brief.headcount || 1,
        salaryBudget: brief.salary_budget,
        timeline: brief.timeline,
        requirements: brief.requirements,
        jd: brief.jd,
        status: brief.status,
        evaluationRubric: brief.evaluation_rubric || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: hiringBriefs.userId,
        set: {
          companyName: brief.company_name,
          jobTitle: brief.job_title,
          location: brief.location,
          headcount: brief.headcount || 1,
          salaryBudget: brief.salary_budget,
          timeline: brief.timeline,
          requirements: brief.requirements,
          jd: brief.jd,
          status: brief.status,
          evaluationRubric: brief.evaluation_rubric || null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Database write failed in upsertHiringBrief:', error);
    throw new Error('Failed to save hiring brief.', { cause: error });
  }
}

export async function upsertCandidates(
  userId: number,
  items: Candidate[]
): Promise<void> {
  if (!items.length) return;
  try {
    for (const cand of items) {
      await db
        .insert(candidates)
        .values({
          userId,
          candidateId: cand.candidate_id,
          name: cand.name,
          email: cand.email || '',
          phone: cand.phone || null,
          role: cand.role,
          detectedTitle: cand.detected_title || null,
          location: cand.location || null,
          educationSummary: cand.education_summary || null,
          experienceYears: cand.experience_years || null,
          summaryExcerpt: cand.summary_excerpt || null,
          sourceFileName: cand.source_file_name || null,
          overallScore: Math.round(cand.overall_score || 0),
          stage: cand.stage || 'Screening',
          decisionStatus: cand.decision_status,
          currentRound: cand.current_round || 'coding',
          payload: cand,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [candidates.userId, candidates.candidateId],
          set: {
            name: cand.name,
            email: cand.email || '',
            phone: cand.phone || null,
            role: cand.role,
            detectedTitle: cand.detected_title || null,
            location: cand.location || null,
            educationSummary: cand.education_summary || null,
            experienceYears: cand.experience_years || null,
            summaryExcerpt: cand.summary_excerpt || null,
            sourceFileName: cand.source_file_name || null,
            overallScore: Math.round(cand.overall_score || 0),
            stage: cand.stage || 'Screening',
            decisionStatus: cand.decision_status,
            currentRound: cand.current_round || 'coding',
            payload: cand,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.error('Database write failed in upsertCandidates:', error);
    throw new Error('Failed to save candidate records.', { cause: error });
  }
}

export async function upsertScheduledInterview(
  userId: number,
  interview: ScheduledInterview
): Promise<void> {
  try {
    await db
      .insert(scheduledInterviews)
      .values({
        userId,
        interviewId: interview.id,
        candidateId: interview.candidateId,
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail || '',
        jobTitle: interview.jobTitle,
        companyName: interview.companyName,
        roundName: interview.roundName,
        roundType: interview.roundType,
        durationMinutes: interview.durationMinutes,
        format: interview.format,
        meetingLink: interview.meetingLink,
        zoomMeetingId: interview.zoomMeetingId || null,
        zoomPasscode: interview.zoomPasscode || null,
        dateStr: interview.dateStr,
        startTime: interview.startTime,
        endTime: interview.endTime,
        timezone: interview.timezone,
        status: interview.status,
        payload: interview,
      })
      .onConflictDoUpdate({
        target: [scheduledInterviews.userId, scheduledInterviews.interviewId],
        set: {
          candidateId: interview.candidateId,
          candidateName: interview.candidateName,
          candidateEmail: interview.candidateEmail || '',
          jobTitle: interview.jobTitle,
          companyName: interview.companyName,
          roundName: interview.roundName,
          roundType: interview.roundType,
          durationMinutes: interview.durationMinutes,
          format: interview.format,
          meetingLink: interview.meetingLink,
          zoomMeetingId: interview.zoomMeetingId || null,
          zoomPasscode: interview.zoomPasscode || null,
          dateStr: interview.dateStr,
          startTime: interview.startTime,
          endTime: interview.endTime,
          timezone: interview.timezone,
          status: interview.status,
          payload: interview,
        },
      });
  } catch (error) {
    console.error('Database write failed in upsertScheduledInterview:', error);
    throw new Error('Failed to save scheduled interview.', { cause: error });
  }
}

export async function upsertOutreachDrafts(
  userId: number,
  drafts: OutreachDraft[]
): Promise<void> {
  if (!drafts.length) return;
  try {
    for (const draft of drafts) {
      await db
        .insert(outreachDrafts)
        .values({
          userId,
          draftId: draft.id,
          candidateId: draft.candidate_id,
          candidateName: draft.candidate_name,
          candidateEmail: draft.candidate_email || '',
          type: draft.type,
          subject: draft.subject,
          status: draft.status,
          payload: draft,
        })
        .onConflictDoUpdate({
          target: [outreachDrafts.userId, outreachDrafts.draftId],
          set: {
            candidateId: draft.candidate_id,
            candidateName: draft.candidate_name,
            candidateEmail: draft.candidate_email || '',
            type: draft.type,
            subject: draft.subject,
            status: draft.status,
            payload: draft,
          },
        });
    }
  } catch (error) {
    console.error('Database write failed in upsertOutreachDrafts:', error);
    throw new Error('Failed to save outreach drafts.', { cause: error });
  }
}

export async function insertAuditEvent(
  userId: number,
  evt: AuditEvent
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      userId,
      timestamp: evt.timestamp,
      actor: evt.actor,
      action: evt.action,
      subject: evt.subject,
    });
  } catch (error) {
    console.error('Database write failed in insertAuditEvent:', error);
    throw new Error('Failed to save audit log event.', { cause: error });
  }
}

export async function seedWorkspaceRecords(
  userId: number,
  data: {
    brief: HiringBrief | null;
    candidates: Candidate[];
    scheduledInterviews: ScheduledInterview[];
    outreachQueue: OutreachDraft[];
    events: AuditEvent[];
  },
  resetExisting: boolean = false
): Promise<void> {
  try {
    if (resetExisting) {
      await db.delete(candidates).where(eq(candidates.userId, userId));
      await db
        .delete(scheduledInterviews)
        .where(eq(scheduledInterviews.userId, userId));
      await db.delete(outreachDrafts).where(eq(outreachDrafts.userId, userId));
      await db.delete(auditEvents).where(eq(auditEvents.userId, userId));
      await db.delete(hiringBriefs).where(eq(hiringBriefs.userId, userId));
    }

    if (data.brief) {
      await upsertHiringBrief(userId, data.brief);
    }
    if (data.candidates.length > 0) {
      await upsertCandidates(userId, data.candidates);
    }
    for (const interview of data.scheduledInterviews) {
      await upsertScheduledInterview(userId, interview);
    }
    if (data.outreachQueue.length > 0) {
      await upsertOutreachDrafts(userId, data.outreachQueue);
    }
    if (data.events.length > 0) {
      await db.insert(auditEvents).values(
        data.events.map((evt) => ({
          userId,
          timestamp: evt.timestamp,
          actor: evt.actor,
          action: evt.action,
          subject: evt.subject,
        }))
      );
    }
  } catch (error) {
    console.error('Database write failed in seedWorkspaceRecords:', error);
    throw new Error('Failed to seed workspace records.', { cause: error });
  }
}
