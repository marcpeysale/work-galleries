import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';

const handlers = ['users', 'projects', 'media', 'zip'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await Promise.all(
  handlers.map((handler) =>
    build({
      entryPoints: [`src/handlers/${handler}.ts`],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      outfile: `dist/${handler}.js`,
      sourcemap: false,
      minify: false,
      external: [],
    }).then(() => console.log(`✓ ${handler}.js`)),
  ),
);

console.log('Bundle complet → dist/');
