import { writeFileSync, mkdirSync } from 'fs';

// Minimal valid 16x16 purple PNG
const PNG_16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJ0A/1Z0HfOAAAAAElFTkSuQmCC',
  'base64',
);

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`icons/icon${size}.png`, PNG_16);
}
console.log('icons generated');
