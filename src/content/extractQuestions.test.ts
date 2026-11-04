import { describe, expect, it } from 'vitest';
import { decorateHeadingIds } from './toc';
import {
  extractInterviewQuestions,
  extractQuestionsFromHtml,
  interviewQuestionHref,
} from './extractQuestions';
import type { Post } from './types';

describe('extractQuestionsFromHtml', () => {
  it('extracts 主问 under h3 and links via heading id', () => {
    const raw = `
<h2>一、基础</h2>
<h3>1. 为什么快？（初级）</h3>
<p><strong>主问：</strong> Redis 为什么性能高？</p>
<p><strong>参考答案：</strong> 内存操作。</p>
<h3>2. 过期策略</h3>
<p><strong>主问：</strong> Key 过期后是立刻删吗？</p>
`;
    const html = decorateHeadingIds(raw);
    const questions = extractQuestionsFromHtml(html, {
      slug: 'redis/redis-interview',
      title: 'Redis 面试',
      category: 'redis',
    });

    expect(questions).toHaveLength(2);
    expect(questions[0].question).toBe('Redis 为什么性能高？');
    expect(questions[0].heading).toBe('1. 为什么快？（初级）');
    expect(questions[0].headingId).toBe('toc-2');
    expect(questions[0].category).toBe('redis');
    expect(questions[1].question).toBe('Key 过期后是立刻删吗？');
  });

  it('collects multiple 主问 under the same heading', () => {
    const raw = `
<h3>HashMap 原理</h3>
<p><strong>主问：</strong> put 流程？</p>
<p><strong>主问：</strong> 何时树化？</p>
`;
    const html = decorateHeadingIds(raw);
    const questions = extractQuestionsFromHtml(html, {
      slug: 'java/java-interview',
      title: 'Java 面试',
      category: 'java',
    });
    expect(questions).toHaveLength(2);
    expect(questions[0].headingId).toBe(questions[1].headingId);
    expect(questions[0].id).not.toBe(questions[1].id);
  });

  it('skips sections without 主问', () => {
    const raw = `<h2>怎么定级</h2><p>说明文字</p><h3>有题</h3><p><strong>主问：</strong> 有吗？</p>`;
    const html = decorateHeadingIds(raw);
    const questions = extractQuestionsFromHtml(html, {
      slug: 'x',
      title: 'X',
    });
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('有吗？');
  });
});

describe('extractInterviewQuestions', () => {
  it('only scans posts that mention 主问', () => {
    const posts: Post[] = [
      {
        slug: 'a',
        title: 'A',
        date: '2026-01-01',
        html: decorateHeadingIds(
          '<h3>Q</h3><p><strong>主问：</strong> 题一？</p>',
        ),
        category: 'java',
      },
      {
        slug: 'b',
        title: 'B',
        date: '2026-01-02',
        html: decorateHeadingIds('<h2>笔记</h2><p>无面试题</p>'),
      },
    ];
    const questions = extractInterviewQuestions(posts);
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('题一？');
  });
});

describe('interview opt-out', () => {
  it('skips posts with interview: false', () => {
    const posts: Post[] = [
      {
        slug: 'a',
        title: 'A',
        date: '2026-01-01',
        html: decorateHeadingIds('<h3>Q</h3><p><strong>主问：</strong> 题一？</p>'),
        interview: false,
      },
    ];
    expect(extractInterviewQuestions(posts)).toHaveLength(0);
  });
});

describe('interviewQuestionHref', () => {
  it('includes from=interview and heading hash', () => {
    expect(
      interviewQuestionHref({
        id: 'redis/redis-interview#toc-1-0',
        question: 'q',
        heading: 'h',
        headingId: 'toc-1',
        slug: 'redis/redis-interview',
        postTitle: 'Redis',
      }),
    ).toBe('/posts/redis/redis-interview/?from=interview#toc-1');
  });
});
