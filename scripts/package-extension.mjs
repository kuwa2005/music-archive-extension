import { mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const root = process.cwd();
const outDir = join(root, 'release');
const stageDir = join(outDir, 'music-archive-extension');

console.log('building...');
execSync('npm run build', { stdio: 'inherit', cwd: root });

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const zipName = `music-archive-extension-v${version}.zip`;
const zipPath = join(outDir, zipName);

for (const name of ['dist', 'icons', 'ui', 'manifest.json']) {
  cpSync(join(root, name), join(stageDir, name), { recursive: true });
}

const sw = readFileSync(join(stageDir, 'dist', 'service-worker.js'), 'utf8');
if (!sw.includes('previewCleanup') || !sw.includes('getExtensionInfo') || !sw.includes('onConnect')) {
  throw new Error('dist/service-worker.js is missing cleanup handlers. Run npm run build first.');
}

if (process.platform === 'win32') {
  rmSync(zipPath, { force: true });
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd "${outDir}" && zip -r "${zipName}" music-archive-extension`, { stdio: 'inherit' });
}

console.log(`created ${zipPath}`);
