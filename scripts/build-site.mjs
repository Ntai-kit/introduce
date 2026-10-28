// 公開する形のサイトを _site に作る。GitHub Actions（.github/workflows/deploy.yml）が公開のたびに動かす。
// - CSS と JS は、コメントと空白を削って小さくする（リポジトリのファイルはコメント付きのまま）
// - ページで使う字だけのフォントを作る（scripts/subset-fonts.py）
//
// 手元で動かすとき: node scripts/build-site.mjs のあと、_site をローカルのサーバーで開く。
// Python に fonttools と brotli が要る（版は scripts/subset-fonts.py の先頭）。別の Python を使うときは PYTHON=パス を付ける

import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../_site/', import.meta.url));
// 版を固定し、知らない版が動かないようにする。上げるときは出てから2週間ほどたった版にする
const ESBUILD = 'esbuild@0.28.2';
const PYTHON = process.env.PYTHON ?? 'python';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const path of ['index.html', 'images', 'data']) {
  await cp(ROOT + path, OUT + path, { recursive: true });
}

// --charset=utf8 は、日本語を \uXXXX にせずそのまま残す（そのほうが小さく、使う字も拾える）
// npx は Windows ではシェルを通さないと動かないので、引数を固定した1つのコマンドとして渡す
const esbuild = (args) => execSync(`npx --yes ${ESBUILD} ${args} --minify --charset=utf8 --log-level=warning`, { cwd: ROOT, stdio: 'inherit' });
esbuild('css/base.css css/theme.css --outdir=_site/css');
esbuild('js/main.js --outdir=_site/js');

// フォントに入れる字。ページの文、JS が出す文言、Steam のゲーム名と、英数字と記号のすべて
const html = (await readFile(ROOT + 'index.html', 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
const js = await readFile(OUT + 'js/main.js', 'utf8');
const { games } = JSON.parse(await readFile(ROOT + 'data/steam-games.json', 'utf8'));
let ascii = '';
for (let code = 0x20; code < 0x7f; code++) ascii += String.fromCharCode(code);
const chars = [...new Set(html + js + games.map((game) => game.name).join('') + ascii)].filter((char) => char >= ' ');
const textFile = OUT + 'font-text.txt';
await writeFile(textFile, chars.join(''));
execFileSync(PYTHON, ['scripts/subset-fonts.py', textFile, OUT + 'fonts'], { cwd: ROOT, stdio: 'inherit' });
await rm(textFile);

// フォントの中身が変わったら URL も変え、キャッシュに残った古いフォント（足りない字がある）を使わせない
const themeFile = OUT + 'css/theme.css';
let theme = await readFile(themeFile, 'utf8');
theme = theme.replace(/\.\.\/(fonts\/[\w-]+\.woff2)/g, (match, path) => {
  return `${match}?v=${createHash('sha256').update(readFileSync(OUT + path)).digest('hex').slice(0, 8)}`;
});
await writeFile(themeFile, theme);

console.log(`${chars.length} 字のフォントで _site を作りました`);
