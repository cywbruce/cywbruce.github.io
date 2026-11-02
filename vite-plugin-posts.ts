import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { loadPosts } from './src/content/loadPosts';

const VIRTUAL_ID = 'virtual:posts';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

export function postsPlugin(postsDir = resolve('content/posts')): Plugin {
  return {
    name: 'virtual-posts',
    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) {
        return undefined;
      }
      const posts = loadPosts(postsDir);
      return `export const posts = ${JSON.stringify(posts, null, 2)};\n`;
    },
    configureServer(server) {
      server.watcher.add(postsDir);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(postsDir)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    },
  };
}
