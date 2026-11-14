import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  Candidate,
  EvaluationRubric,
  OutreachDraft,
  ScheduledInterview,
} from '../types/index.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const hiringBriefs = pgTable('hiring_briefs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  companyName: text('company_name').notNull(),
  jobTitle: text('job_title').notNull(),
  location: text('location').notNull(),
  headcount: integer('headcount').notNull().default(1),
  salaryBudget: text('salary_budget').notNull(),
  timeline: text('timeline').notNull(),
  requirements: text('requirements').notNull(),
  jd: text('jd').notNull(),
  status: text('status').notNull(),
  evaluationRubric: jsonb('evaluation_rubric').$type<EvaluationRubric | null>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const candidates = pgTable(
  'candidates',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    candidateId: text('candidate_id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    phone: text('phone'),
    role: text('role').notNull(),
    detectedTitle: text('detected_title'),
    location: text('location'),
    educationSummary: text('education_summary'),
    experienceYears: text('experience_years'),
    summaryExcerpt: text('summary_excerpt'),
    sourceFileName: text('source_file_name'),
    overallScore: integer('overall_score').notNull(),
    stage: text('stage').notNull().default('Screening'),
    decisionStatus: text('decision_status').notNull(),
    currentRound: text('current_round').notNull().default('coding'),
    payload: jsonb('payload').$type<Candidate>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('candidates_user_candidate_id_idx').on(table.userId, table.candidateId),
  ]
);

export const scheduledInterviews = pgTable(
  'scheduled_interviews',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    interviewId: text('interview_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    candidateName: text('candidate_name').notNull(),
    candidateEmail: text('candidate_email').notNull().default(''),
    jobTitle: text('job_title').notNull(),
    companyName: text('company_name').notNull(),
    roundName: text('round_name').notNull(),
    roundType: text('round_type').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    format: text('format').notNull(),
    meetingLink: text('meeting_link').notNull(),
    zoomMeetingId: text('zoom_meeting_id'),
    zoomPasscode: text('zoom_passcode'),
    dateStr: text('date_str').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    timezone: text('timezone').notNull(),
    status: text('status').notNull().default('Confirmed'),
    payload: jsonb('payload').$type<ScheduledInterview>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('scheduled_interviews_user_interview_id_idx').on(
      table.userId,
      table.interviewId
    ),
  ]
);

export const outreachDrafts = pgTable(
  'outreach_drafts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    draftId: text('draft_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    candidateName: text('candidate_name').notNull(),
    candidateEmail: text('candidate_email').notNull().default(''),
    type: text('type').notNull(),
    subject: text('subject').notNull(),
    status: text('status').notNull(),
    payload: jsonb('payload').$type<OutreachDraft>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('outreach_drafts_user_draft_id_idx').on(table.userId, table.draftId),
  ]
);

export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  timestamp: text('timestamp').notNull(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  subject: text('subject').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  hiringBrief: one(hiringBriefs, {
    fields: [users.id],
    references: [hiringBriefs.userId],
  }),
  candidates: many(candidates),
  scheduledInterviews: many(scheduledInterviews),
  outreachDrafts: many(outreachDrafts),
  auditEvents: many(auditEvents),
}));

export const hiringBriefsRelations = relations(hiringBriefs, ({ one }) => ({
  owner: one(users, {
    fields: [hiringBriefs.userId],
    references: [users.id],
  }),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
  owner: one(users, {
    fields: [candidates.userId],
    references: [users.id],
  }),
}));

export const scheduledInterviewsRelations = relations(scheduledInterviews, ({ one }) => ({
  owner: one(users, {
    fields: [scheduledInterviews.userId],
    references: [users.id],
  }),
}));

export const outreachDraftsRelations = relations(outreachDrafts, ({ one }) => ({
  owner: one(users, {
    fields: [outreachDrafts.userId],
    references: [users.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  owner: one(users, {
    fields: [auditEvents.userId],
    references: [users.id],
  }),
}));
