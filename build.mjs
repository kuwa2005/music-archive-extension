import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'fs';

mkdirSync('dist', { recursive: true });
rmSync('_locales', { recursive: true, force: true });
cpSync('src/_locales', '_locales', { recursive: true });

const shared = {
  bundle: true,
  sourcemap: true,
  target: ['chrome120'],
  logLevel: 'info',
};

const entries = [
  { in: 'src/background/service-worker.js', out: 'dist/service-worker.js', format: 'esm' },
  { in: 'src/content/dialog-host.js', out: 'dist/dialog-host.js', format: 'iife' },
  { in: 'src/content/suno-song.js', out: 'dist/suno-song.js', format: 'iife' },
  { in: 'src/content/suno-list.js', out: 'dist/suno-list.js', format: 'iife' },
  { in: 'src/content/ai-chat.js', out: 'dist/ai-chat.js', format: 'iife' },
  { in: 'src/ui/popup/popup.js', out: 'dist/popup.js', format: 'iife' },
  { in: 'src/ui/dashboard/dashboard.js', out: 'dist/dashboard.js', format: 'iife' },
];

const buildAll = async () => {
  await Promise.all(
    entries.map(({ in: input, out, format }) =>
      esbuild.build({
        ...shared,
        entryPoints: [input],
        outfile: out,
        format,
        platform: 'browser',
      }),
    ),
  );
};

const watch = process.argv.includes('--watch');

if (watch) {
  const contexts = await Promise.all(
    entries.map(({ in: input, out, format }) =>
      esbuild.context({
        ...shared,
        entryPoints: [input],
        outfile: out,
        format,
        platform: 'browser',
      }),
    ),
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('watching...');
} else {
  await buildAll();
}
