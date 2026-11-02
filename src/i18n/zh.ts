export const zh = {
  'nav.home': '首页',
  'nav.topics': '栏目',
  'topic.back': '返回栏目',
  'topic.nav': '分类',
  'drawer.open': '目录',
  'drawer.close': '关闭目录',
  'drawer.toc': '本文',
  'drawer.topics': '栏目',
  'list.empty': '暂无文章',
  'list.uncategorized': '随笔',
  'post.back': '返回首页',
  'notFound.title': '页面不存在',
  'lang.zh': '中文',
  'lang.en': 'English',
} as const;

export type MessageKey = keyof typeof zh;
