export type PlanKey = 'free' | 'plus' | 'pro';

export const FREE_TUTOR_SUBJECTS = ['Math', 'English', 'History'];
export const FREE_EXAM_SUBJECTS  = ['Math', 'Chemistry'];

export const PLAN_LIMITS = {
  free: {
    sessionsPerMonth: 2,
    sessionMinutes: 5,
    dashboardHistory: 1,
    tutorSubjects: FREE_TUTOR_SUBJECTS,
    examSubjects:  FREE_EXAM_SUBJECTS,
    examMaxQuestions: 5,
    examsPerMonth: 1,
    allowHardDifficulty: false,
  },
  plus: {
    sessionsPerMonth: 30,
    sessionMinutes: 30,
    dashboardHistory: Infinity,
    tutorSubjects: null,
    examSubjects:  null,
    examMaxQuestions: null,
    examsPerMonth: 30,
    allowHardDifficulty: true,
  },
  pro: {
    sessionsPerMonth: Infinity,
    sessionMinutes: Infinity,
    dashboardHistory: Infinity,
    tutorSubjects: null,
    examSubjects:  null,
    examMaxQuestions: null,
    examsPerMonth: Infinity,
    allowHardDifficulty: true,
  },
} as const;

export const PLAN_BADGE: Record<PlanKey, { label: string; bg: string; color: string; isGradient?: boolean }> = {
  free: { label: 'Free',    bg: '#F0EDF9', color: '#6B5DB0' },
  plus: { label: 'Plus',    bg: '#E0F5EE', color: '#1D9E75' },
  pro:  { label: 'Pro ✦',  bg: 'linear-gradient(135deg,#D85A30,#EF9F27)', color: '#FFFBF7', isGradient: true },
};

export function getPlanFromHas(has: (params: { plan: string }) => boolean): PlanKey {
  if (has({ plan: 'pro' }))  return 'pro';
  if (has({ plan: 'plus' })) return 'plus';
  return 'free';
}
