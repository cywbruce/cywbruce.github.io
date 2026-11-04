import type { Post } from './types';
import { parseLevels, trackOf, type Level, type Track } from './tracks';

export type InterviewQuestion = {
  /** Stable key within the site: `${slug}#${headingId}-${index}` */
  id: string;
  /** Display text of the main question (主问). */
  question: string;
  /** Heading text of the section that contains this question. */
  heading: string;
  headingId: string;
  slug: string;
  postTitle: string;
  category?: string;
  /** Parsed from heading suffix like（初级）/（中高级）. Empty = 未分级. */
  levels?: Level[];
  track?: Track;
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function readIdAttr(attrs: string): string | undefined {
  const match = attrs.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) {
    return undefined;
  }
  return match[1] ?? match[2] ?? match[3];
}

/** Pull plain text after a 「主问：」 label inside a strong/b tag. */
function extractZhuwenTexts(sectionHtml: string): string[] {
  const texts: string[] = [];
  const re =
    /<(?:strong|b)[^>]*>\s*主问[：:]\s*<\/(?:strong|b)>\s*([^<]*(?:<(?!\/?p\b)[^>]*>[^<]*)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sectionHtml)) !== null) {
    const text = stripTags(match[1] ?? '');
    if (text) {
      texts.push(text);
    }
  }
  return texts;
}

/**
 * Extract interview questions from post HTML that already has heading ids.
 * A question is any 「主问：」 under an h2/h3 section; links use that heading's id.
 */
export function extractQuestionsFromHtml(
  html: string,
  meta: Pick<Post, 'slug' | 'title' | 'category'>,
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];
  const headingRe = /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  const headings: { index: number; end: number; id: string; text: string }[] =
    [];

  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(html)) !== null) {
    const attrs = match[2] ?? '';
    const id = readIdAttr(attrs);
    const text = stripTags(match[3] ?? '');
    if (!id || !text) {
      continue;
    }
    headings.push({
      index: match.index,
      end: match.index + match[0].length,
      id,
      text,
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const sectionStart = heading.end;
    const sectionEnd =
      i + 1 < headings.length ? headings[i + 1].index : html.length;
    const sectionHtml = html.slice(sectionStart, sectionEnd);
    const zhuwenList = extractZhuwenTexts(sectionHtml);

    zhuwenList.forEach((question, index) => {
      questions.push({
        id: `${meta.slug}#${heading.id}-${index}`,
        question,
        heading: heading.text,
        headingId: heading.id,
        slug: meta.slug,
        postTitle: meta.title,
        ...(meta.category ? { category: meta.category } : {}),
        levels: parseLevels(heading.text),
        ...(trackOf(meta.category) ? { track: trackOf(meta.category) } : {}),
      });
    });
  }

  return questions;
}

export function extractInterviewQuestions(posts: Post[]): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  for (const post of posts) {
    if (!post.html.includes('主问')) {
      continue;
    }
    out.push(
      ...extractQuestionsFromHtml(post.html, {
        slug: post.slug,
        title: post.title,
        category: post.category,
      }),
    );
  }
  return out;
}

export function interviewQuestionHref(q: InterviewQuestion): string {
  return `/posts/${q.slug}/?from=interview#${q.headingId}`;
}
