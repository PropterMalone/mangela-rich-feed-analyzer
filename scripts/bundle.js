import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

const isWatch = process.argv.includes('--watch');

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir);

// Copy static files
const staticFiles = ['manifest.json'];
for (const file of staticFiles) {
  const src = join(rootDir, file);
  if (existsSync(src)) {
    cpSync(src, join(distDir, file));
  }
}

// Copy icons directory
const iconsDir = join(rootDir, 'icons');
if (existsSync(iconsDir)) {
  cpSync(iconsDir, join(distDir, 'icons'), { recursive: true });
}

// Copy HTML files from src
const htmlFiles = ['popup/popup.html', 'dashboard/dashboard.html', 'options/options.html'];
for (const file of htmlFiles) {
  const src = join(srcDir, file);
  if (existsSync(src)) {
    const destDir = dirname(join(distDir, file));
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    cpSync(src, join(distDir, file));
  }
}

// Build configuration
const buildOptions = {
  entryPoints: [
    join(srcDir, 'background/index.ts'),
    join(srcDir, 'content/index.ts'),
    join(srcDir, 'popup/popup.ts'),
    join(srcDir, 'dashboard/dashboard.ts'),
    join(srcDir, 'options/options.ts'),
  ].filter((f) => existsSync(f)),
  bundle: true,
  outdir: distDir,
  format: 'esm',
  target: 'chrome120',
  sourcemap: true,
  minify: !isWatch,
  entryNames: '[dir]/[name]',
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete!');
}
