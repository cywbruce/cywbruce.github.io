import { describe, expect, it } from 'vitest';
import { parseLevels, trackOf } from './tracks';

describe('parseLevels', () => {
  it('parses single and ranged levels', () => {
    expect(parseLevels('1. 为什么快？（初级）')).toEqual(['junior']);
    expect(parseLevels('2. 选型（初级～中级）')).toEqual(['junior', 'mid']);
    expect(parseLevels('6. 一致性（中高级）')).toEqual(['mid', 'senior']);
    expect(parseLevels('10. 热 Key（高）')).toEqual(['senior']);
    expect(parseLevels('高级')).toEqual(['senior']);
    expect(parseLevels(' 初级 ')).toEqual(['junior']);
    expect(parseLevels('全链路（初级～高级）')).toEqual(['junior', 'mid', 'senior']);
  });
  it('returns empty when no level marker', () => {
    expect(parseLevels('HashMap 原理')).toEqual([]);
    expect(parseLevels('Promise（手写）')).toEqual([]);
  });
});

describe('trackOf', () => {
  it('maps categories to tracks', () => {
    expect(trackOf('react')).toBe('frontend');
    expect(trackOf('redis')).toBe('backend');
    expect(trackOf('architect')).toBe('architect');
    expect(trackOf('ai')).toBe('ai');
    expect(trackOf(undefined)).toBeUndefined();
  });
});
