import type { InterviewQuestion } from './extractQuestions';

export type Level = 'junior' | 'mid' | 'senior';
export type Track = 'frontend' | 'backend' | 'architect' | 'ai';

export const LEVELS: Level[] = ['junior', 'mid', 'senior'];
export const TRACKS: Track[] = ['frontend', 'backend', 'architect', 'ai'];

/** Category (top-level folder under content/posts) → interview track. */
const CATEGORY_TRACK: Record<string, Track> = {
  react: 'frontend',
  typescript: 'frontend',
  frontend: 'frontend',
  java: 'backend',
  spring: 'backend',
  mysql: 'backend',
  redis: 'backend',
  mq: 'backend',
  python: 'backend',
  backend: 'backend',
  'design-patterns': 'architect',
  architect: 'architect',
  ai: 'ai',
  llm: 'ai',
};

export function trackOf(category: string | undefined): Track | undefined {
  return category ? CATEGORY_TRACK[category.trim()] : undefined;
}

/**
 * Parse levels from a heading like「1. 为什么快？（初级～中级）」or「(中高级)」.
 * Only looks inside the last bracket group, so question text is not misread.
 */
export function parseLevels(heading: string): Level[] {
  const bare = heading.trim().match(/^(初级|中级|高级)$/);
  if (bare) {
    return [({ 初级: 'junior', 中级: 'mid', 高级: 'senior' } as const)[bare[1] as '初级' | '中级' | '高级']];
  }
  const groups = heading.match(/[（(]([^（）()]*)[）)]/g);
  if (!groups) return [];
  const inner = groups[groups.length - 1];
  if (!/[初中高]/.test(inner) || !/(级|初|中|高)/.test(inner)) return [];
  const out: Level[] = [];
  if (inner.includes('初')) out.push('junior');
  if (inner.includes('中')) out.push('mid');
  if (inner.includes('高')) out.push('senior');
  // 「初级～高级」 spans the middle too
  if (out.includes('junior') && out.includes('senior') && !out.includes('mid')) {
    out.splice(1, 0, 'mid');
  }
  return out;
}

export function primaryLevel(q: Pick<InterviewQuestion, 'levels'>): Level | undefined {
  return q.levels?.[0];
}
