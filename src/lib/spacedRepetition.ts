// Spaced repetition engine for StudyTrack
// Calculates next revision due date based on revision number, confidence, recall rating, and difficulty.

export function getNextAvailableRevisionDate(
  proposedDate: Date,
  scheduledDates: string[],
  dailyLimit = 2
): Date {
  const counts = new Map<string, number>();
  for (const date of scheduledDates) counts.set(date, (counts.get(date) ?? 0) + 1);
  const candidate = new Date(proposedDate);
  candidate.setHours(12, 0, 0, 0);
  for (let attempts = 0; attempts < 366; attempts += 1) {
    const key = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
    if ((counts.get(key) ?? 0) < dailyLimit) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const BASE_INTERVALS = [2, 7, 14, 30, 60, 90, 120];

export function calculateNextInterval(
  revisionNumber: number,
  confidence: number,
  recallRating: number | null,
  isDifficult: boolean
): number {
  let baseInterval: number;

  if (revisionNumber <= 0) {
    baseInterval = BASE_INTERVALS[0];
  } else if (revisionNumber - 1 < BASE_INTERVALS.length) {
    baseInterval = BASE_INTERVALS[revisionNumber - 1];
  } else {
    const lastInterval = BASE_INTERVALS[BASE_INTERVALS.length - 1];
    const extraSteps = revisionNumber - BASE_INTERVALS.length;
    baseInterval = Math.round(lastInterval * Math.pow(1.5, extraSteps));
  }

  const effectiveConfidence = recallRating ?? confidence;

  if (effectiveConfidence <= 2) {
    baseInterval = Math.max(1, Math.round(baseInterval * 0.4));
  } else if (effectiveConfidence === 3) {
    baseInterval = Math.round(baseInterval * 0.75);
  } else if (effectiveConfidence === 5) {
    baseInterval = Math.round(baseInterval * 1.25);
  }

  if (isDifficult) {
    baseInterval = Math.max(1, Math.round(baseInterval * 0.7));
  }

  return Math.max(1, baseInterval);
}

export function getNextDueDate(
  fromDate: Date,
  revisionNumber: number,
  confidence: number,
  recallRating: number | null,
  isDifficult: boolean
): Date {
  const interval = calculateNextInterval(revisionNumber, confidence, recallRating, isDifficult);
  const due = new Date(fromDate);
  due.setDate(due.getDate() + interval);
  return due;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function isThisWeek(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = today.getDay();
  startOfWeek.setDate(today.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function relativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = daysUntil(d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff < 7) return `In ${diff} days`;
  return formatShortDate(d);
}

export function confidenceLabel(rating: number): string {
  return ['', 'Very unsure', 'Unsure', 'Okay', 'Confident', 'Very confident'][rating] ?? 'Unknown';
}

export const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Very unsure', color: '#ef4444' },
  { value: 2, label: 'Unsure', color: '#f97316' },
  { value: 3, label: 'Okay', color: '#eab308' },
  { value: 4, label: 'Confident', color: '#22c55e' },
  { value: 5, label: 'Very confident', color: '#10b981' },
];

export const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export const TASK_STATUSES = [
  { value: 'todo', label: 'To Do', color: '#64748b' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'completed', label: 'Completed', color: '#22c55e' },
  { value: 'on_hold', label: 'On Hold', color: '#eab308' },
];

export const SUBJECT_COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#f59e0b',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#eab308', '#f43f5e',
];

export const EVENT_TYPES = [
  { value: 'study', label: 'Study', color: '#3b82f6' },
  { value: 'revision', label: 'Revision', color: '#8b5cf6' },
  { value: 'lesson', label: 'Lesson', color: '#22c55e' },
  { value: 'homework', label: 'Homework', color: '#f97316' },
  { value: 'coursework', label: 'Coursework', color: '#06b6d4' },
  { value: 'exam', label: 'Exam', color: '#ef4444' },
  { value: 'personal', label: 'Personal', color: '#64748b' },
];

export const EDUCATION_LEVELS = [
  'GCSE / National 5',
  'A-Level / Higher / IB',
  'BTEC / Vocational',
  'Foundation / Access',
  'Undergraduate',
  'Postgraduate',
  'Other',
];

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
