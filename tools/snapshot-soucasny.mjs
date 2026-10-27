// Kopie současného webu www.imos-facility.cz → web/soucasny/ (jen 6 hlavních stránek).
// Účel: přepínač „Nový návrh / Současný web“ zůstane vidět i na současné verzi.
// Obrázky, styly a skripty se dál načítají ze živého webu (absolutní URL), stahuje se jen HTML.
// Odstraní se měření (GTM), cookie lišta a Turnstile captcha (na cizí doméně stejně nefungují).
// Použití: node tools/snapshot-soucasny.mjs
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://www.imos-facility.cz';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'web', 'soucasny');

// živá cesta → soubor v kopii
const PAGES = {
  '/': 'index.html',
  '/pronajem-nemovitosti-v-brne': 'pronajem-nemovitosti-v-brne.html',
  '/pronajem-zasedacich-mistnosti': 'pronajem-zasedacich-mistnosti.html',
  '/sprava-nemovitosti': 'sprava-nemovitosti.html',
  '/o-nas': 'o-nas.html',
  '/kontakty': 'kontakty.html'
};

fs.mkdirSync(path.join(OUT, 'assets', 'fonts'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets', 'css'), { recursive: true });
const get = async url => { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error(r.status + ' ' + url); return r; };

// Styly se stahují k sobě: fonty z cizí domény prohlížeč blokuje (CORS), proto jdou do assets/fonts,
// obrázky v CSS zůstávají na živém webu (absolutní URL).
const cssDone = new Map();
async function localCss(href) {
  if (cssDone.has(href)) return cssDone.get(href);
  const abs = new URL(href, ORIGIN).href, name = path.basename(new URL(abs).pathname);
  let css = await (await get(abs)).text();
  const urls = [...new Set([...css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)].map(m => m[2]).filter(u => !u.startsWith('data:')))];
  for (const u of urls) {
    const full = new URL(u, abs).href, clean = new URL(full).pathname;
    if (/\.(woff2?|ttf|otf|eot)$/i.test(clean)) {
      const fname = path.basename(clean), dest = path.join(OUT, 'assets', 'fonts', fname);
      if (!fs.existsSync(dest)) { try { fs.writeFileSync(dest, Buffer.from(await (await get(full)).arrayBuffer())); } catch (e) { console.warn('font', e.message); continue; } }
      css = css.split(u).join('../fonts/' + fname + (u.match(/[?#].*$/) || [''])[0]);
    } else if (!/\.svg#/i.test(u)) css = css.split(`(${u})`).join(`(${full})`).split(`('${u}')`).join(`('${full}')`).split(`("${u}")`).join(`("${full}")`);
  }
  fs.writeFileSync(path.join(OUT, 'assets', 'css', name), css);
  cssDone.set(href, 'assets/css/' + name);
  console.log('css', name, urls.length, 'url');
  return 'assets/css/' + name;
}

for (const [live, file] of Object.entries(PAGES)) {
  const r = await fetch(ORIGIN + live, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(r.status + ' ' + live);
  let html = await r.text();

  // měření, cookie lišta, captcha
  html = html.replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/g, '');
  html = html.replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '');
  html = html.replace(/<script[^>]*CookieBar[^>]*><\/script>/g, '');
  html = html.replace(/<script[^>]*challenges\.cloudflare\.com\/turnstile[^>]*><\/script>/g, '');
  html = html.replace(/<div class="cf-turnstile"[^>]*><\/div>/g, '');
  html = html.replace(/<meta name="facebook-domain-verification"[^>]*>/g, '');
  html = html.replace(/<link rel="canonical"[^>]*>/g, '');
  html = html.replace(/<link rel="manifest"[^>]*>/g, '');

  // vlastní kopie stylů (kvůli fontům)
  for (const [tag, href] of [...html.matchAll(/<link rel="stylesheet" href="(\/[^"]+\.css[^"]*)"[^>]*>/g)]) {
    html = html.replace(tag, tag.replace(href, await localCss(href)));
  }
  html = html.replace(/<link rel="preload" href="\/[^"]+\.css[^"]*"[^>]*>/g, '');

  // líně načítané obrázky (data-src plní skript živého webu) → rovnou src
  html = html.replace(/\sdata-src=""/g, '');
  html = html.replace(/<img\b([^>]*?)\sdata-src="/g, '<img$1 src="');

  // kořenové cesty (/www/...) → absolutní na živý web
  html = html.replace(/(\s(?:src|href|action|data-src|data-srcset|srcset|poster|content)=")\/(?!\/)/g, `$1${ORIGIN}/`);
  html = html.replace(/url\((['"]?)\/(?!\/)/g, `url($1${ORIGIN}/`);
  // srcset s více položkami: další položky za čárkou
  html = html.replace(/(srcset="[^"]*)/g, m => m.replace(/,\s*\/(?!\/)/g, `, ${ORIGIN}/`));

  // SVG ikony si UIkit (data-uk-svg) stahuje přes XHR – z cizí domény to CORS zablokuje, proto lokálně
  fs.mkdirSync(path.join(OUT, 'assets', 'img'), { recursive: true });
  for (const u of new Set([...html.matchAll(new RegExp(`${ORIGIN.replace(/\./g, '\\.')}/[^"' )]+\\.svg`, 'g'))].map(m => m[0]))) {
    const fname = new URL(u).pathname.replace(/^\/www\//, '').replace(/\//g, '_'), dest = path.join(OUT, 'assets', 'img', fname);
    if (!fs.existsSync(dest)) { try { fs.writeFileSync(dest, Buffer.from(await (await get(u)).arrayBuffer())); } catch (e) { console.warn('svg', e.message); continue; } }
    html = html.split(u).join('assets/img/' + fname);
  }

  // odkazy na zkopírované stránky → lokální soubory
  for (const [p, f] of Object.entries(PAGES)) {
    const re = new RegExp(`href="${ORIGIN.replace(/\./g, '\\.')}${p === '/' ? '/?' : p}(#[^"]*)?"`, 'g');
    html = html.replace(re, (m, hash) => `href="${f}${hash || ''}"`);
  }

  // přepínač verzí + noindex
  html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n<link rel="stylesheet" href="switch.css">\n<script src="switch.js" defer></script>\n</head>');

  fs.writeFileSync(path.join(OUT, file), html);
  console.log('ok', file, (html.length / 1024).toFixed(0) + ' kB');
}
