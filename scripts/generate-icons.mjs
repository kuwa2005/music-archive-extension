import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const iconDir = join(process.cwd(), 'icons');
const source = join(process.cwd(), 'assets', 'app-icon-source.png');
const sizes = [16, 32, 48, 128];

if (!existsSync(source)) {
  throw new Error(`Missing icon source: ${source}`);
}

if (process.platform !== 'win32') {
  throw new Error('Icon generation currently uses Windows System.Drawing. Run on Windows or replace icons manually.');
}

mkdirSync(iconDir, { recursive: true });

const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = '${source.replaceAll("'", "''")}'
$iconDir = '${iconDir.replaceAll("'", "''")}'
$sizes = @(${sizes.join(', ')})

$image = [System.Drawing.Image]::FromFile($source)
try {
  $side = [Math]::Min($image.Width, $image.Height)
  $x = [Math]::Floor(($image.Width - $side) / 2)
  $y = [Math]::Floor(($image.Height - $side) / 2)
  $srcRect = New-Object System.Drawing.Rectangle($x, $y, $side, $side)

  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
        $graphics.DrawImage($image, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
      } finally {
        $graphics.Dispose()
      }
      $out = Join-Path $iconDir "icon$size.png"
      $bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $image.Dispose()
}
`;

execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
  stdio: 'inherit',
});

console.log(`icons generated: ${sizes.map((size) => `icon${size}.png`).join(', ')}`);
