import { InterviewerMember, AISlotSuggestion, ScheduledInterview, RoundType, InterviewFormatType } from '../types';

/**
 * Pre-configured hiring team panel members with realistic working hours,
 * timezones, roles, and scheduled conflict commitments.
 */
export const DEFAULT_INTERVIEWERS: InterviewerMember[] = [
  {
    id: 'int-1',
    name: 'Sarah Lin',
    role: 'VP of Engineering / Hiring Manager',
    email: 'sarah.lin@anthropictech.io',
    avatarColor: 'bg-indigo-600',
    timezone: 'America/Los_Angeles (PST)',
    workingHours: { start: '09:00', end: '17:30' },
    busySlots: [
      { dayOffset: 1, startTime: '09:30', endTime: '10:30', title: 'Eng Leadership Sync' },
      { dayOffset: 1, startTime: '12:00', endTime: '13:00', title: 'Lunch' },
      { dayOffset: 1, startTime: '15:00', endTime: '16:00', title: 'Product Roadmap Review' },
      { dayOffset: 2, startTime: '10:00', endTime: '11:00', title: '1:1 with Staff Eng' },
      { dayOffset: 2, startTime: '14:00', endTime: '15:00', title: 'Executive Staff Meeting' },
      { dayOffset: 3, startTime: '11:00', endTime: '12:00', title: 'Architecture Board' },
      { dayOffset: 3, startTime: '16:00', endTime: '17:00', title: 'Sprint Retrospective' },
      { dayOffset: 4, startTime: '09:00', endTime: '10:00', title: 'Weekly All Hands' },
      { dayOffset: 4, startTime: '13:30', endTime: '14:30', title: 'Investor Briefing' },
      { dayOffset: 5, startTime: '10:30', endTime: '11:30', title: 'Hiring Committee Wrap' }
    ]
  },
  {
    id: 'int-2',
    name: 'David Chen',
    role: 'Staff ML Engineer / Technical Lead',
    email: 'david.chen@anthropictech.io',
    avatarColor: 'bg-emerald-600',
    timezone: 'America/New_York (EST)',
    workingHours: { start: '09:00', end: '18:00' },
    busySlots: [
      { dayOffset: 1, startTime: '10:00', endTime: '11:30', title: 'LLM Fine-tuning Pipeline Sync' },
      { dayOffset: 1, startTime: '13:00', endTime: '14:00', title: 'Lunch' },
      { dayOffset: 2, startTime: '11:00', endTime: '12:30', title: 'GPU Cluster Capacity Planning' },
      { dayOffset: 2, startTime: '16:00', endTime: '17:00', title: 'Code Review Block' },
      { dayOffset: 3, startTime: '09:30', endTime: '10:30', title: 'MLOps On-Call Handoff' },
      { dayOffset: 3, startTime: '14:30', endTime: '15:30', title: 'Model Evaluation Deep Dive' },
      { dayOffset: 4, startTime: '11:00', endTime: '12:00', title: 'Distributed Training Demo' },
      { dayOffset: 5, startTime: '14:00', endTime: '15:30', title: 'Weekly Research Reading Group' }
    ]
  },
  {
    id: 'int-3',
    name: 'Priya Sharma',
    role: 'Principal Distributed Systems Architect',
    email: 'priya.sharma@anthropictech.io',
    avatarColor: 'bg-purple-600',
    timezone: 'America/New_York (EST)',
    workingHours: { start: '08:30', end: '17:00' },
    busySlots: [
      { dayOffset: 1, startTime: '11:00', endTime: '12:00', title: 'Latency SLA Taskforce' },
      { dayOffset: 1, startTime: '14:00', endTime: '15:00', title: 'Cross-Service Design Review' },
      { dayOffset: 2, startTime: '09:00', endTime: '10:00', title: 'Infra Incident Post-Mortem' },
      { dayOffset: 2, startTime: '13:00', endTime: '14:00', title: 'Lunch' },
      { dayOffset: 3, startTime: '13:00', endTime: '14:30', title: 'Multi-Region Failover Drill' },
      { dayOffset: 4, startTime: '10:00', endTime: '11:00', title: 'Security Architecture Audit' },
      { dayOffset: 5, startTime: '11:30', endTime: '12:30', title: 'Systems Tech Talk' }
    ]
  },
  {
    id: 'int-4',
    name: 'Elena Rostova',
    role: 'Senior Talent Partner & Bar Raiser',
    email: 'elena.rostova@anthropictech.io',
    avatarColor: 'bg-teal-600',
    timezone: 'America/New_York (EST)',
    workingHours: { start: '09:00', end: '17:00' },
    busySlots: [
      { dayOffset: 1, startTime: '09:00', endTime: '10:00', title: 'Talent Pipeline Review' },
      { dayOffset: 1, startTime: '14:30', endTime: '15:30', title: 'Executive Offer Calibration' },
      { dayOffset: 2, startTime: '11:30', endTime: '12:30', title: 'Diversity & Inclusion Panel' },
      { dayOffset: 3, startTime: '10:00', endTime: '11:00', title: 'Recruiting Weekly Ops' },
      { dayOffset: 4, startTime: '15:00', endTime: '16:00', title: 'Candidate Experience Debrief' }
    ]
  }
];

export const ROUND_CONFIGS = [
  {
    key: 'coding' as RoundType,
    name: 'Technical Live Coding Round',
    defaultDuration: 45,
    recommendedInterviewers: ['int-2'], // David Chen
    description: 'Algorithmic problem-solving, code structure, edge cases, and real-time live coding exercise.',
    agenda: '1. Introductions (5 min)\n2. Live Coding Challenge & Problem Solving (30 min)\n3. Complexity Analysis & Questions (10 min)'
  },
  {
    key: 'technical' as RoundType,
    name: 'System Architecture & Deep Dive',
    defaultDuration: 60,
    recommendedInterviewers: ['int-2', 'int-3'], // David Chen & Priya Sharma
    description: 'High-level system design, scalability, distributed data flow, tradeoffs, and domain expertise.',
    agenda: '1. Architecture Requirements & Constraints (10 min)\n2. Component Design & Data Flow (35 min)\n3. Bottlenecks, Fault Tolerance & Candidate Q&A (15 min)'
  },
  {
    key: 'hr' as RoundType,
    name: 'Values, Culture Fit & Bar Raiser',
    defaultDuration: 45,
    recommendedInterviewers: ['int-1', 'int-4'], // Sarah Lin & Elena Rostova
    description: 'Behavioral scenarios, leadership, collaboration style, and organizational culture alignment.',
    agenda: '1. Background & Key Project Highlight (10 min)\n2. Situational Scenarios & Team Collaboration (25 min)\n3. Compensation Expectations & Questions for Panel (10 min)'
  }
];

/**
 * Converts "HH:MM" to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to "HH:MM"
 */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats "HH:MM" to "h:mm AM/PM"
 */
export function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Calculates candidate time in PST/EST for clear timezone alignment
 */
export function formatTimezoneDual(timeStr: string, durationMinutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const startMins = h * 60 + m;
  const endMins = startMins + durationMinutes;

  const startEst = formatTime12h(minutesToTime(startMins));
  const endEst = formatTime12h(minutesToTime(endMins));

  // PST is 3 hours behind EST
  const startPstMins = (startMins - 180 + 1440) % 1440;
  const endPstMins = (endMins - 180 + 1440) % 1440;
  const startPst = formatTime12h(minutesToTime(startPstMins));
  const endPst = formatTime12h(minutesToTime(endPstMins));

  return `${startEst} – ${endEst} EST (${startPst} – ${endPst} PST)`;
}

/**
 * Generates AI-suggested interview time slots based on the hiring team's shared calendar availability.
 */
export function generateAISlotSuggestions(
  selectedInterviewers: InterviewerMember[],
  durationMinutes: number = 45,
  daysAhead: number = 5
): AISlotSuggestion[] {
  const suggestions: AISlotSuggestion[] = [];
  const today = new Date();

  // Potential slot start times throughout the workday in EST (10:00, 11:30, 13:30, 14:30, 15:30, 16:30)
  const candidateSlotTimes = [
    '10:00',
    '11:00',
    '13:30',
    '14:00',
    '15:00',
    '15:30',
    '16:30'
  ];

  // Evaluate slots across upcoming business days
  let businessDayCount = 0;
  for (let offset = 1; offset <= 10 && businessDayCount < daysAhead; offset++) {
    const slotDate = new Date(today);
    slotDate.setDate(today.getDate() + offset);

    // Skip weekends (0 = Sunday, 6 = Saturday)
    const dayOfWeek = slotDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    businessDayCount++;

    const dateStr = slotDate.toISOString().split('T')[0];
    const dayName = slotDate.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayLabel = `${dayName}, ${monthDay}`;

    for (const startTime of candidateSlotTimes) {
      const startMins = timeToMinutes(startTime);
      const endMins = startMins + durationMinutes;
      const endTime = minutesToTime(endMins);

      // Check each interviewer's availability
      let totalConflicts = 0;
      let minBuffer = 60;
      const interviewerStatuses = selectedInterviewers.map(interviewer => {
        // Working hours check in EST
        const isSarah = interviewer.timezone.includes('PST');
        const effectiveStart = isSarah ? timeToMinutes('11:30') : timeToMinutes(interviewer.workingHours.start);
        const effectiveEnd = isSarah ? timeToMinutes('20:30') : timeToMinutes(interviewer.workingHours.end);

        if (startMins < effectiveStart || endMins > effectiveEnd) {
          totalConflicts++;
          return {
            interviewerId: interviewer.id,
            interviewerName: interviewer.name,
            isAvailable: false,
            bufferMinutes: 0
          };
        }

        // Check busy meetings on this day offset
        const busyMeetings = interviewer.busySlots.filter(s => s.dayOffset === businessDayCount);
        let hasConflict = false;
        let interviewerBuffer = 45;

        for (const meeting of busyMeetings) {
          const mStart = timeToMinutes(meeting.startTime);
          const mEnd = timeToMinutes(meeting.endTime);

          // Overlap check
          if (startMins < mEnd && endMins > mStart) {
            hasConflict = true;
            totalConflicts++;
            interviewerBuffer = 0;
            break;
          }

          // Buffer calculation
          const beforeBuffer = Math.abs(startMins - mEnd);
          const afterBuffer = Math.abs(mStart - endMins);
          const localBuffer = Math.min(beforeBuffer, afterBuffer);
          if (localBuffer < interviewerBuffer) {
            interviewerBuffer = localBuffer;
          }
        }

        if (interviewerBuffer < minBuffer) {
          minBuffer = interviewerBuffer;
        }

        return {
          interviewerId: interviewer.id,
          interviewerName: interviewer.name,
          isAvailable: !hasConflict,
          bufferMinutes: interviewerBuffer
        };
      });

      // We only suggest slots where ALL selected interviewers are 100% free
      if (totalConflicts === 0) {
        // Compute heuristic match score
        let matchScore = 90;
        let recommendationTag: AISlotSuggestion['recommendationTag'] = 'Optimal Team Focus';
        let rationale = '';

        if (businessDayCount <= 2 && startMins >= timeToMinutes('13:30')) {
          matchScore = 98;
          recommendationTag = 'Rapid Progression';
          rationale = 'Earliest mutual opening for candidate momentum. All selected interviewers are 100% free with buffer.';
        } else if (startMins >= timeToMinutes('14:00') && startMins <= timeToMinutes('16:00')) {
          matchScore = 96;
          recommendationTag = 'Timezone Harmony';
          rationale = 'Optimal cross-coastal overlap between East & West coast panel interviewers during peak cognitive hours.';
        } else if (minBuffer >= 30) {
          matchScore = 94;
          recommendationTag = 'Zero Fatigue Slot';
          rationale = 'Guaranteed 30+ min uninterrupted buffer before and after the interview for interviewer prep and feedback entry.';
        } else {
          matchScore = 89;
          recommendationTag = 'Optimal Team Focus';
          rationale = 'Adjacent meeting clustering to preserve uninterrupted morning engineering focus blocks.';
        }

        suggestions.push({
          id: `slot-${dateStr}-${startTime}`,
          dateStr,
          dayLabel,
          startTime,
          endTime,
          durationMinutes,
          matchScore,
          recommendationTag,
          rationale,
          interviewerAvailability: interviewerStatuses
        });
      }
    }
  }

  // Sort by match score descending, then by date
  return suggestions.sort((a, b) => b.matchScore - a.matchScore).slice(0, 6);
}

/**
 * Creates standard RFC 5545 iCalendar (.ics) content for email invites or calendar import.
 */
export function generateICalendarFile(interview: ScheduledInterview): string {
  const formatDateToICS = (dateStr: string, timeStr: string) => {
    const cleanDate = dateStr.replace(/-/g, '');
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  };

  const dtStart = formatDateToICS(interview.dateStr, interview.startTime);
  const dtEnd = formatDateToICS(interview.dateStr, interview.endTime);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const attendeeLines = interview.panelInterviewerNames
    .map((name, i) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${name}:mailto:panel${i + 1}@anthropictech.io`)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Anthropic Tech//AI Recruitment Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${interview.id}@anthropictech.io`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Interview: ${interview.roundName} - ${interview.candidateName} (${interview.companyName})`,
    `DESCRIPTION:Interview with ${interview.candidateName} for the ${interview.jobTitle} position at ${interview.companyName}.\\n\\nMeeting Link: ${interview.meetingLink}\\n\\nAgenda: Technical evaluation, coding exercise, and team discussion.`,
    `LOCATION:${interview.meetingLink}`,
    `ORGANIZER;CN=Recruitment Team:mailto:recruiting@anthropictech.io`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${interview.candidateName}:mailto:${interview.candidateEmail}`,
    attendeeLines,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Generates an instant 1-click Google Calendar web event URL.
 */
export function generateGoogleCalendarUrl(interview: ScheduledInterview): string {
  const formatDateForGoogle = (dateStr: string, timeStr: string) => {
    return dateStr.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '') + '00';
  };

  const startIso = formatDateForGoogle(interview.dateStr, interview.startTime);
  const endIso = formatDateForGoogle(interview.dateStr, interview.endTime);

  const title = encodeURIComponent(`Interview: ${interview.roundName} - ${interview.candidateName} (${interview.companyName})`);
  const details = encodeURIComponent(
    `Position: ${interview.jobTitle} at ${interview.companyName}\n` +
    `Candidate: ${interview.candidateName} (${interview.candidateEmail})\n` +
    `Panel: ${interview.panelInterviewerNames.join(', ')}\n\n` +
    `Video Meeting Link: ${interview.meetingLink}\n\n` +
    `Agenda: Multi-axial competency evaluation, problem-solving, and Q&A.`
  );
  const location = encodeURIComponent(interview.meetingLink);
  const addAttendees = encodeURIComponent(`${interview.candidateEmail}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}&add=${addAttendees}`;
}

/**
 * Triggers a browser download of the standard .ics calendar invite file.
 */
export function downloadICSFile(interview: ScheduledInterview): void {
  const icsData = generateICalendarFile(interview);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = `interview-${interview.candidateName.toLowerCase().replace(/\s+/g, '-')}-${interview.roundType}.ics`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a realistic Google Meet URL for the interview.
 */
export function generateMeetingLink(candidateName: string): string {
  const clean = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'eval';
  return `https://meet.google.com/${clean}-eval-recr`;
}

/**
 * Generates comprehensive calendar confirmation email text.
 */
export function generateInterviewEmailConfirmation(interview: ScheduledInterview): {
  subject: string;
  body: string;
} {
  const formattedDualTime = formatTimezoneDual(interview.startTime, interview.durationMinutes);

  const subject = `Confirmed: ${interview.roundName} with ${interview.companyName} on ${interview.dateStr}`;
  const body = `Dear ${interview.candidateName},

We are pleased to confirm your upcoming ${interview.roundName} for the ${interview.jobTitle} position at ${interview.companyName}!

========================================
📅 INTERVIEW DETAILS
========================================
• Date: ${interview.dateStr}
• Time: ${formattedDualTime}
• Duration: ${interview.durationMinutes} minutes
• Meeting Format: Google Meet Video Conference
• Video Link: ${interview.meetingLink}
• Interview Panel: ${interview.panelInterviewerNames.join(', ')}

========================================
💡 WHAT TO EXPECT & PREPARATION
========================================
1. Please join the video room 2-3 minutes early to verify audio and video connections.
2. The session will include a technical deep dive, problem-solving evaluation, and an open Q&A segment with the panel.
3. Have your development environment or code editor open if you'd like to share practical examples.

A calendar invitation (.ics) has been dispatched and attached for your convenience.

We look forward to speaking with you!

Warm regards,
Recruitment & Talent Team
${interview.companyName}`;

  return { subject, body };
}
