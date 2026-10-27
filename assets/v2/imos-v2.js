// IMOS facility – návrh v2. Vrstva nad exportem z Claude Design (šablony v <x-dc>, styly inline):
//  - po vykreslení označí prvky třídami g-… (vzhled řeší imos-v2.css),
//  - pohyb: Lenis (plynulý scroll à la Locomotive) + GSAP ScrollTrigger + SplitType (nadpisy po řádcích),
//  - mapa: vektorové podklady OpenFreeMap přebarvené do palety IMOS (bez API klíče, místo Snazzy Maps),
//  - kalendář dostupnosti zasedaček (výpis + detail) – obsazenost je zatím UKÁZKOVÁ, generovaná,
//  - přepínač „Nový návrh / Současný web“ vlevo dole.
// Načítá se v <head> synchronně: window.IMOS_V2 musí existovat dřív, než šablona spustí vlastní setupReveal().
(function () {
  window.IMOS_V2 = true;
  const html = document.documentElement;
  html.classList.add('v2');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]nomotion/.test(location.search);
  if (!reduce) html.classList.add('v2-motion');

  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const loaded = {};
  const load = src => loaded[src] || (loaded[src] = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
  }));
  const css = href => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };
  ['https://cdn.jsdelivr.net', 'https://tiles.openfreemap.org'].forEach(h => {
    const l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);
  });
  css('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;650;700&display=swap');

  const motionLibs = reduce ? Promise.reject() : Promise.all([
    load(CDN + 'gsap@3.12.5/dist/gsap.min.js').then(() => load(CDN + 'gsap@3.12.5/dist/ScrollTrigger.min.js')),
    load(CDN + 'lenis@1.1.13/dist/lenis.min.js'),
    load(CDN + 'split-type@0.3.4/umd/index.min.js')
  ]);
  // když se knihovny nenačtou, obsah se ukáže bez animace
  motionLibs.catch(() => html.classList.remove('v2-motion'));
  setTimeout(() => { if (!window.gsap) html.classList.remove('v2-motion'); }, 4000);

  const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  const q = new URLSearchParams(location.search);

  /* ---------- mapa v barvách IMOS ---------- */
  const GL = CDN + 'maplibre-gl@4.7.1/dist/';
  let stylePromise;
  function imosStyle() {
    return stylePromise || (stylePromise = fetch('https://tiles.openfreemap.org/styles/positron').then(r => r.json()).then(st => {
      const C = { bg: '#E8F1F6', water: '#8EC5DF', green: '#D2E7E3', resid: '#E2ECF2', bld: '#D3E1EA', bldLine: '#C3D5E0',
        casing: '#C9DCE7', road: '#FFFFFF', major: '#FFFFFF', motor: '#A9D2E8', rail: '#C5D2DA', label: '#5B7380', city: '#21414F', halo: '#F3F8FA' };
      st.layers.forEach(l => {
        const id = l.id, p = l.paint = l.paint || {};
        if (id === 'background') p['background-color'] = C.bg;
        else if (id === 'water') p['fill-color'] = C.water;
        else if (id === 'waterway') p['line-color'] = C.water;
        else if (id === 'park' || id.startsWith('landcover')) { p['fill-color'] = C.green; p['fill-opacity'] = 0.9; }
        else if (id === 'landuse_residential') p['fill-color'] = C.resid;
        else if (id === 'building') { p['fill-color'] = C.bld; p['fill-outline-color'] = C.bldLine; }
        else if (l.type === 'line' && /casing/.test(id)) p['line-color'] = C.casing;
        else if (l.type === 'line' && /motorway/.test(id)) p['line-color'] = C.motor;
        else if (l.type === 'line' && /highway|road|aeroway/.test(id)) p['line-color'] = C.road;
        else if (l.type === 'line' && /railway/.test(id)) p['line-color'] = C.rail;
        else if (l.type === 'line' && /boundary/.test(id)) p['line-color'] = '#9FB6C2';
        if (l.type === 'symbol' && l.layout && l.layout['text-field'] && !/shield/.test(id)) {
          l.layout['text-field'] = ['coalesce', ['get', 'name:cs'], ['get', 'name']];
          p['text-color'] = /city|town|country|state/.test(id) ? C.city : C.label;
          p['text-halo-color'] = C.halo;
        }
      });
      return st;
    }));
  }
  // náhrada za L.tileLayer(...) v šablonách: vrátí skupinu vrstev hned, podklad dosadí,
  // až se mapa přiblíží k viewportu (MapLibre je ~800 kB a WebGL – nemá brzdit načtení stránky)
  let webgl;
  window.IMOS_TILES = function (L, opts) {
    const g = L.layerGroup();
    const raster = () => L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' });
    if (webgl === undefined) webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
    if (!webgl) { g.addLayer(raster()); return g; }
    const start = () => {
      css(GL + 'maplibre-gl.css');
      Promise.all([load(GL + 'maplibre-gl.js').then(() => load(CDN + '@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js')), imosStyle()])
        .then(([, style]) => g.addLayer(L.maplibreGL({ style, attribution: '&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap', interactive: false })))
        .catch(() => g.addLayer(raster()));
    };
    g.once('add', () => {
      const el = g._map && g._map.getContainer();
      if (!el || !window.IntersectionObserver) return start();
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '600px 0px' });
      io.observe(el);
    });
    return g;
  };

  /* ---------- označení prvků ---------- */
  const st = el => el.getAttribute('style') || '';
  const has = (el, s) => st(el).indexOf(s) > -1;
  const WHITE = 'background: rgb(255, 255, 255)', TINT = 'background: rgb(234, 245, 251)', BLUE = 'background: rgb(7, 92, 130)';
  function tag(root) {
    root.querySelectorAll('header[data-screen-label="Header"]').forEach(h => h.classList.add('g-header'));
    root.querySelectorAll('footer').forEach(f => f.classList.add('g-footer'));
    root.querySelectorAll('section').forEach(s => { if (has(s, TINT)) s.classList.add('g-tint'); });
    root.querySelectorAll('section[data-screen-label="Hero"]').forEach(s => s.classList.add('g-hero'));
    root.querySelectorAll('main div, main a, aside, main form + div').forEach(el => {
      if (el.classList.contains('g-card')) return;
      const s = st(el);
      if (!/border-radius: 16px/.test(s)) return;
      if (s.indexOf(WHITE) > -1 || s.indexOf(TINT) > -1 || /border: 1px solid rgb\(220, 225, 228\)/.test(s)) el.classList.add('g-card');
      else if (/overflow: hidden/.test(s)) el.classList.add('g-media');
    });
    root.querySelectorAll('h2').forEach(h => { if (/font-size: (52|48|56)px/.test(st(h))) h.classList.add('g-h2'); });
    root.querySelectorAll('a, button').forEach(b => {
      const s = st(b);
      if (s.indexOf(BLUE) > -1 && /border-radius: 999px/.test(s) && /height: (52|56)px/.test(s)) b.classList.add('g-btn');
    });
    root.querySelectorAll('div').forEach(d => {
      const s = st(d);
      if (s.indexOf(BLUE) > -1 && /border-radius: 999px/.test(s) && /height: 56px/.test(s) && d.closest('a')) d.classList.add('g-tile-label');
    });
    root.querySelectorAll('span').forEach(sp => {
      const s = st(sp);
      if (!/border-radius: 999px/.test(s)) return;
      if (/width: 108px/.test(s)) { sp.classList.add('g-icon'); sp.parentElement.classList.add('g-value'); }
      else if (/position: absolute; top: (16|20)px; left: (16|20)px/.test(s)) {
        // jen bílé štítky (lokalita); barevné stavové štítky přepíná šablona za běhu, ty necháváme
        if (s.indexOf(WHITE) > -1) sp.classList.add('g-pill');
      }
    });
    const mapSec = root.querySelector('section[data-screen-label="Mapa"] [data-reveal="fade"]');
    if (mapSec) {
      if (!mapSec.classList.contains('g-mapwrap')) {
        mapSec.classList.add('g-mapwrap', 'g-mapwrap--big');
        requestAnimationFrame(() => dispatchEvent(new Event('resize')));
      }
      // popup s detailem se vykresluje až po najetí na pin, proto se označuje pokaždé
      mapSec.querySelectorAll(':scope > div').forEach(d => {
        if (/border-radius: 999px/.test(st(d))) d.classList.add('g-map-legend');
        if (/width: 360px/.test(st(d))) d.classList.add('g-map-pop');
      });
    }
    root.querySelectorAll('.leaflet-container').forEach(el => el.setAttribute('data-lenis-prevent', ''));
    menu();
  }

  /* ---------- mobilní menu: rozmazané pozadí + kontakty dole ---------- */
  function menu() {
    const hd = document.querySelector('.g-header');
    if (!hd) return;
    let scrim = document.querySelector('.v2-scrim');
    if (!scrim) {
      scrim = document.createElement('div'); scrim.className = 'v2-scrim';
      scrim.addEventListener('click', () => { const b = hd.querySelector('button[aria-label="Menu"]'); b && b.click(); });
      document.body.appendChild(scrim);
    }
    const nav = hd.querySelector(':scope > nav');
    html.classList.toggle('v2-menu-open', !!nav);
    if (window.V2_LENIS) nav ? window.V2_LENIS.stop() : window.V2_LENIS.start();
    if (nav) {
      hd.classList.remove('is-hidden');
      nav.setAttribute('data-lenis-prevent', '');
      if (!nav.querySelector('.v2-menu-foot')) {
        const f = document.createElement('div'); f.className = 'v2-menu-foot';
        f.innerHTML = '<a href="tel:+420533432111">+420 533 432 111</a><a href="mailto:spravam@imosfacility.cz">spravam@imosfacility.cz</a>';
        nav.appendChild(f);
      }
    }
  }

  /* ---------- hero ---------- */
  function hero() {
    const h = document.querySelector('.g-hero');
    if (!h || h.querySelector('.v2-hero-stats')) return;
    const box = document.createElement('div');
    box.className = 'v2-hero-stats';
    box.innerHTML = [['20+', 'let na trhu'], ['14', 'objektů v nabídce'], ['5', 'zasedacích místností']]
      .map(([b, t]) => `<div class="v2-stat"><b>${b}</b><span>${t}</span></div>`).join('');
    h.appendChild(box);
    // CTA pod perexem
    const p = h.querySelector('h1 + p');
    if (p && !h.querySelector('.v2-hero-cta')) {
      const arr = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      const cta = document.createElement('div');
      cta.className = 'v2-hero-cta';
      cta.innerHTML = `<a class="v2-cta v2-cta--primary" href="pronajem-nemovitosti.html">Prohlédnout nabídku ${arr}</a>`
        + `<a class="v2-cta v2-cta--glass" href="zasedaci-mistnosti.html">Rezervovat zasedačku ${arr}</a>`
        + `<a class="v2-cta v2-cta--link" href="#kontakt">Nezávazná poptávka</a>`;
      p.after(cta);
    }
  }

  /* ---------- hlavička: tmavá nad hero, schovat při scrollu dolů ---------- */
  // prvky se hledají při každém volání – šablona může stránku vykreslovat postupně a hero dorazit až po startu
  function headerBehaviour() {
    if (headerBehaviour.upd) return headerBehaviour.upd();
    let last = scrollY, peak = scrollY;
    const upd = headerBehaviour.upd = () => {
      const hd = document.querySelector('.g-header'), heroEl = document.querySelector('.g-hero');
      if (!hd) return;
      const y = scrollY;
      hd.classList.toggle('on-dark', !!heroEl && y < heroEl.offsetHeight - 120);
      const menuOpen = !!hd.querySelector(':scope > nav');
      // schová se při scrollu dolů a zůstane schovaná; vrátí se až při scrollu nahoru (malé doběhy plynulého scrollu stav nemění)
      if (y > last) peak = y;
      if (menuOpen || y <= 240) hd.classList.remove('is-hidden');
      else if (y > last + 2) hd.classList.add('is-hidden');
      else if (peak - y > 8) hd.classList.remove('is-hidden');
      last = y;
    };
    addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ---------- přepínač verzí ---------- */
  // „Současný web“ = kopie živého webu ve složce soucasny/ (tools/snapshot-soucasny.mjs), má stejný přepínač
  const LIVE_MAP = { index: 'index', 'pronajem-nemovitosti': 'pronajem-nemovitosti-v-brne', 'detail-nemovitosti': 'pronajem-nemovitosti-v-brne',
    'zasedaci-mistnosti': 'pronajem-zasedacich-mistnosti', 'detail-zasedaci-mistnosti': 'pronajem-zasedacich-mistnosti',
    'sprava-nemovitosti': 'sprava-nemovitosti', 'o-nas': 'o-nas', kontakt: 'kontakty' };
  function switcher() {
    if (document.querySelector('.v2-switch')) return;
    const el = document.createElement('nav');
    el.className = 'v2-switch'; el.setAttribute('aria-label', 'Přepnout verzi webu');
    el.innerHTML = `<a class="is-on" href="${location.href}" aria-current="page">Nový návrh</a>`
      + `<a href="soucasny/${LIVE_MAP[page] || 'index'}.html" data-to-old>Současný web</a>`;
    // zpět z kopie se vrátí přesně sem (i na detail s parametry)
    el.querySelector('[data-to-old]').addEventListener('click', () => { try { sessionStorage.setItem('imos-v2-from', location.href); } catch (e) {} });
    document.body.appendChild(el);
  }

  /* ---------- obsazenost zasedaček (UKÁZKA – nahradit napojením na rezervační systém) ---------- */
  const ROOMS = ['m316', 'm415a', 'm415', 'b2', 'e3'];
  const SLOTS = [['am', 'Dopoledne', '8:00 – 12:00'], ['pm', 'Odpoledne', '12:30 – 17:00'], ['day', 'Celý den', '8:00 – 17:00']];
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // víkendy a pevné státní svátky se nerezervují (Velikonoce pro jednoduchost ne)
  const HOLI = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];
  const isWeekend = d => d.getDay() === 0 || d.getDay() === 6 || HOLI.includes(iso(d).slice(5));
  function busy(room, d, slot) {
    if (slot === 'day') return busy(room, d, 'am') || busy(room, d, 'pm');
    return hash(room + iso(d) + slot) < 0.32;
  }
  const dayState = (room, d) => {
    if (d < today || isWeekend(d)) return 'off';
    const a = busy(room, d, 'am'), p = busy(room, d, 'pm');
    return a && p ? 'full' : a || p ? 'part' : 'free';
  };
  const fmt = (d, o) => d.toLocaleDateString('cs-CZ', o);
  const slotOf = k => SLOTS.find(s => s[0] === k);
  // asistent (imos-asistent.js) čte stejnou ukázkovou obsazenost
  window.IMOS_AVAIL = { busy, isWeekend, iso, today };

  function calendarDetail() {
    const sec = document.querySelector('section[data-screen-label="Rezervace"]');
    if (!sec || sec.querySelector('.v2-cal')) return;
    const room = ROOMS.includes(q.get('m')) ? q.get('m') : ROOMS[0];
    const name = (document.querySelector('main h1') || {}).textContent || 'Zasedací místnost';
    const grid = sec.querySelector(':scope > div > div:nth-child(2)');
    const cal = document.createElement('div');
    cal.className = 'v2-cal'; cal.setAttribute('data-lenis-prevent', '');
    grid.parentNode.insertBefore(cal, grid);
    const pre = q.get('d') ? new Date(q.get('d') + 'T00:00:00') : null;
    let view = new Date((pre || today).getFullYear(), (pre || today).getMonth(), 1);
    let sel = pre && dayState(room, pre) !== 'off' && dayState(room, pre) !== 'full' ? pre : null;
    let slot = sel && q.get('s') && !busy(room, sel, q.get('s')) ? q.get('s') : null;
    const maxView = new Date(today.getFullYear(), today.getMonth() + 5, 1);
    const arrow = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    function render() {
      const first = (view.getDay() + 6) % 7, days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      let cells = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(d => `<div class="v2-cal__dow">${d}</div>`).join('');
      for (let i = 0; i < first; i++) cells += '<span></span>';
      for (let n = 1; n <= days; n++) {
        const d = new Date(view.getFullYear(), view.getMonth(), n), s = dayState(room, d);
        const cls = ['v2-day', s === 'part' ? 'is-part' : '', s === 'full' ? 'is-full' : '', sel && iso(sel) === iso(d) ? 'is-sel' : '', iso(d) === iso(today) ? 'is-today' : ''].join(' ');
        const lbl = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) + ' – ' + ({ free: 'volno', part: 'částečně obsazeno', full: 'obsazeno', off: 'nelze rezervovat' })[s];
        cells += `<button type="button" class="${cls}" data-d="${iso(d)}" ${s === 'off' ? 'disabled' : ''} ${s === 'full' ? 'aria-disabled="true"' : ''} aria-label="${lbl}">${n}<i></i></button>`;
      }
      let right;
      if (!sel) right = `<p class="v2-pick">Vyberte v kalendáři den. Zelená tečka znamená volno, oranžová částečné obsazení.</p>`;
      else {
        right = `<div class="v2-slots">` + SLOTS.map(([k, t, h]) => {
          const b = busy(room, sel, k);
          return `<button type="button" class="v2-slot ${slot === k ? 'is-sel' : ''}" data-s="${k}" ${b ? 'disabled' : ''}><span>${t}<small>${h}</small></span><b>${b ? 'Obsazeno' : 'Volno'}</b></button>`;
        }).join('') + `</div>`;
        if (slot) right += `<div class="v2-pick">Vybráno: <strong>${fmt(sel, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${slotOf(slot)[2]}</strong><br><a href="#zajem" data-go>Pokračovat k rezervaci ${arrow('M5 12h14M13 6l6 6-6 6')}</a></div>`;
      }
      cal.innerHTML = `<div>
          <div class="v2-cal__head"><div><p class="g-eyebrow">Dostupnost</p><h3>Vyberte termín</h3><p class="v2-cal__month">${fmt(view, { month: 'long', year: 'numeric' })}</p></div>
            <div class="v2-cal__nav"><button type="button" data-m="-1" aria-label="Předchozí měsíc" ${view <= new Date(today.getFullYear(), today.getMonth(), 1) ? 'disabled' : ''}>${arrow('M15 18l-6-6 6-6')}</button><button type="button" data-m="1" aria-label="Další měsíc" ${view >= maxView ? 'disabled' : ''}>${arrow('M9 6l6 6-6 6')}</button></div></div>
          <div class="v2-cal__grid">${cells}</div>
          <div class="v2-cal__legend"><span><i style="background:#2F855A"></i>Volno</span><span><i style="background:#D69E2E"></i>Částečně obsazeno</span><span><i style="background:#C2CACF"></i>Obsazeno</span></div>
        </div>
        <div><p class="g-eyebrow">${sel ? fmt(sel, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Čas'}</p><h3 style="margin-bottom:20px">${sel ? 'Volné časy' : 'Nejdřív den'}</h3>${right}</div>`;
    }
    cal.addEventListener('click', e => {
      const m = e.target.closest('[data-m]'), d = e.target.closest('[data-d]'), s = e.target.closest('[data-s]'), go = e.target.closest('[data-go]');
      if (m) { view = new Date(view.getFullYear(), view.getMonth() + +m.dataset.m, 1); render(); }
      else if (d && !d.disabled && !d.classList.contains('is-full')) { sel = new Date(d.dataset.d + 'T00:00:00'); slot = null; render(); }
      else if (s && !s.disabled) { slot = s.dataset.s; render(); }
      else if (go) {
        e.preventDefault();
        const form = sec.querySelector('form');
        const ta = form && form.querySelector('textarea');
        if (ta) ta.value = `Mám zájem o rezervaci: ${name.trim()}, ${fmt(sel, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${slotOf(slot)[1].toLowerCase()} ${slotOf(slot)[2]}.`;
        const target = form || grid;
        if (window.V2_LENIS) window.V2_LENIS.scrollTo(target, { offset: -120 }); else target.scrollIntoView({ behavior: 'smooth' });
        const first = form && form.querySelector('input');
        setTimeout(() => first && first.focus({ preventScroll: true }), 900);
      }
    });
    render();
  }

  function calendarList() {
    const sec = document.querySelector('section[data-screen-label="Místnosti"]');
    if (!sec) return;
    const wrap = sec.querySelector(':scope > div');
    let bar = wrap.querySelector('.v2-when');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'v2-when';
      wrap.insertBefore(bar, wrap.firstChild);
      const days = []; for (let d = new Date(today); days.length < 15; d.setDate(d.getDate() + 1)) if (!isWeekend(d)) days.push(new Date(d));
      bar._days = days; bar._d = null; bar._s = 'day'; bar._open = false;
      bar._view = new Date(today.getFullYear(), today.getMonth(), 1);
      const first = new Date(today.getFullYear(), today.getMonth(), 1), maxView = new Date(today.getFullYear(), today.getMonth() + 11, 1);
      bar.addEventListener('click', e => {
        const d = e.target.closest('[data-d]'), pd = e.target.closest('[data-pd]'), s = e.target.closest('[data-s]'),
          m = e.target.closest('[data-pm]'), tog = e.target.closest('[data-cal]');
        if (d) bar._d = bar._d === d.dataset.d ? null : d.dataset.d;
        if (pd && !pd.disabled) { bar._d = pd.dataset.pd; bar._open = false; }
        if (s) bar._s = s.dataset.s;
        if (m) { bar._view = new Date(bar._view.getFullYear(), bar._view.getMonth() + +m.dataset.pm, 1); }
        if (tog) { bar._open = !bar._open; if (bar._d) { const x = new Date(bar._d + 'T00:00:00'); bar._view = new Date(x.getFullYear(), x.getMonth(), 1); } }
        if (d || pd || s || m || tog) { draw(); badges(); }
      });
      document.addEventListener('click', e => { if (bar._open && !e.composedPath().includes(bar)) { bar._open = false; draw(); } });
      document.addEventListener('keydown', e => { if (bar._open && e.key === 'Escape') { bar._open = false; draw(); } });
      const ico = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
      const arrow = d => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
      const pop = () => {
        const v = bar._view, lead = (v.getDay() + 6) % 7, n = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
        let cells = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(x => `<div class="v2-cal__dow">${x}</div>`).join('');
        for (let i = 0; i < lead; i++) cells += '<span></span>';
        for (let i = 1; i <= n; i++) {
          const d = new Date(v.getFullYear(), v.getMonth(), i), off = d < today || isWeekend(d);
          cells += `<button type="button" class="v2-day ${bar._d === iso(d) ? 'is-sel' : ''} ${iso(d) === iso(today) ? 'is-today' : ''}" data-pd="${iso(d)}" ${off ? 'disabled' : ''}>${i}</button>`;
        }
        return `<div class="v2-when__pop" role="dialog" aria-label="Vyberte datum">
          <div class="v2-cal__head"><p class="v2-cal__month" style="margin:0">${fmt(v, { month: 'long', year: 'numeric' })}</p>
            <div class="v2-cal__nav"><button type="button" data-pm="-1" aria-label="Předchozí měsíc" ${v <= first ? 'disabled' : ''}>${arrow('M15 18l-6-6 6-6')}</button><button type="button" data-pm="1" aria-label="Další měsíc" ${v >= maxView ? 'disabled' : ''}>${arrow('M9 6l6 6-6 6')}</button></div></div>
          <div class="v2-cal__grid">${cells}</div></div>`;
      };
      const draw = () => {
        const inStrip = bar._d && bar._days.some(d => iso(d) === bar._d);
        const calLbl = bar._d && !inStrip ? fmt(new Date(bar._d + 'T00:00:00'), { weekday: 'short', day: 'numeric', month: 'numeric' }) : 'Jiné datum';
        bar.innerHTML = `<b>Datum, kdy by se vám hodilo</b><div class="v2-when__row"><div class="v2-when__days" data-lenis-prevent>` + bar._days.map(d =>
          `<button type="button" data-d="${iso(d)}" class="${bar._d === iso(d) ? 'is-on' : ''}"><small>${fmt(d, { weekday: 'short' })}</small>${d.getDate()}.${d.getMonth() + 1}.</button>`).join('')
          + `</div><div class="v2-when__calwrap"><button type="button" class="v2-when__cal ${bar._d && !inStrip ? 'is-on' : ''}" data-cal aria-expanded="${bar._open}">${ico}<span>${calLbl}</span></button>${bar._open ? pop() : ''}</div></div>`
          + `<div class="v2-when__slots">` + SLOTS.map(([k, t]) => `<button type="button" data-s="${k}" class="${bar._s === k ? 'is-on' : ''}">${t}</button>`).join('') + `</div>`;
      };
      draw();
    }
    badges();
    function badges() {
      sec.querySelectorAll('[data-flip][data-key]').forEach(card => {
        const room = ROOMS[+card.dataset.key.slice(1)], a = card.querySelector('a'), box = a && a.firstElementChild;
        if (!room || !box) return;
        let b = box.querySelector('.v2-avail');
        if (!bar._d) { if (b) b.remove(); a.href = 'detail-zasedaci-mistnosti.html?m=' + room; return; }
        const d = new Date(bar._d + 'T00:00:00'), isBusy = busy(room, d, bar._s);
        if (!b) { b = document.createElement('span'); box.appendChild(b); }
        b.className = 'v2-avail' + (isBusy ? ' is-busy' : '');
        b.textContent = (isBusy ? 'Obsazeno · ' : 'Volno · ') + slotOf(bar._s)[1].toLowerCase();
        a.href = 'detail-zasedaci-mistnosti.html?m=' + room + '&d=' + bar._d + (isBusy ? '' : '&s=' + bar._s);
      });
    }
    calendarList.badges = badges;
  }

  /* ---------- pohyb ---------- */
  function motion() {
    motionLibs.then(() => {
      const { gsap, ScrollTrigger } = window;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new window.Lenis({ lerp: 0.14, smoothWheel: true, wheelMultiplier: 1 });
      window.V2_LENIS = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (!a || a.getAttribute('href').length < 2 || a.hasAttribute('data-go')) return;
        const t = document.querySelector(a.getAttribute('href'));
        if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -100 }); }
      });
      // šablony zamykají scroll přes body.style.overflow (přihlášení, menu)
      new MutationObserver(() => (document.body.style.overflow === 'hidden' ? lenis.stop() : lenis.start()))
        .observe(document.body, { attributes: true, attributeFilter: ['style'] });

      // hero – nadpis po řádcích hned, video s jemným parallaxem
      const h1 = document.querySelector('.g-hero h1');
      if (h1) {
        const s = new window.SplitType(h1, { types: 'lines' });
        s.lines.forEach(l => { const w = document.createElement('span'); w.className = 'split-line'; l.parentNode.insertBefore(w, l); w.appendChild(l); });
        gsap.from(s.lines, { yPercent: 115, duration: 1.3, ease: 'power4.out', stagger: 0.1, delay: 0.15 });
        const vid = document.querySelector('.g-hero video');
        if (vid) gsap.to(vid.parentElement, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.g-hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.from('.v2-stat', { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.6 });
      }
      reveal(document);
      // obrázky ve velkých blocích – parallax uvnitř rámu
      document.querySelectorAll('[data-reveal-scale]').forEach(img => gsap.fromTo(img, { yPercent: -6, scale: 1.14 }, { yPercent: 6, scale: 1.14, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      ScrollTrigger.refresh();
    }).catch(() => {});
  }
  function reveal(root) {
    const { gsap } = window;
    let n = 0;
    root.querySelectorAll('[data-reveal]').forEach(el => {
      if (el.dataset.v2r) return;
      el.dataset.v2r = 1; n++;
      if (el.closest('.g-hero')) { el.classList.add('v2-in'); return; }
      const delay = (+el.dataset.delay || 0) / 1000;
      const isHead = /^H[12]$/.test(el.tagName) && !el.querySelector('input, a');
      if (isHead && window.SplitType) {
        el.classList.add('v2-in');
        const s = new window.SplitType(el, { types: 'lines' });
        s.lines.forEach(l => { const w = document.createElement('span'); w.className = 'split-line'; l.parentNode.insertBefore(w, l); w.appendChild(l); });
        gsap.from(s.lines, { yPercent: 110, duration: 1.15, ease: 'power4.out', stagger: 0.09, delay, scrollTrigger: { trigger: el, start: 'top 88%' } });
      } else if (el.dataset.reveal === 'media') {
        gsap.fromTo(el, { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', delay,
            scrollTrigger: { trigger: el, start: 'top 92%' }, onStart: () => el.classList.add('v2-in'), onComplete: () => gsap.set(el, { clearProps: 'transform' }) });
      } else {
        gsap.fromTo(el, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', delay,
          scrollTrigger: { trigger: el, start: 'top 92%' }, onStart: () => el.classList.add('v2-in'), onComplete: () => gsap.set(el, { clearProps: 'transform' }) });
      }
    });
    return n;
  }

  /* ---------- O nás: ilustrace budov ožívá ---------- */
  function skyline() {
    const svg = document.querySelector('.g-skyline');
    if (!svg || svg.dataset.v2s) return;
    svg.dataset.v2s = 1;
    const wins = [...svg.querySelectorAll('.w')];
    const live = () => {
      // okna se náhodně rozsvěcují a zhasínají, jako v podvečer v kancelářích
      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
      wins.forEach(w => Math.random() < 0.22 && w.classList.add('on'));
      setInterval(() => {
        if (!visible || document.hidden) return;
        for (let i = 0; i < 3; i++) wins[Math.floor(Math.random() * wins.length)].classList.toggle('on');
      }, 700);
      // okna pod kurzorem se rozsvítí
      const pt = svg.createSVGPoint();
      const centers = wins.map(w => { const b = w.getBBox(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      svg.addEventListener('pointermove', e => {
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        wins.forEach((w, i) => w.classList.toggle('hot', Math.hypot(centers[i][0] - p.x, centers[i][1] - p.y) < 80));
      });
      svg.addEventListener('pointerleave', () => wins.forEach(w => w.classList.remove('hot')));
    };
    live();
    // mraky plují zleva doprava a za pravým okrajem se vrací zleva (smyčka)
    motionLibs.then(() => {
      const { gsap } = window;
      svg.querySelectorAll('.c').forEach((c, i) => {
        const bb = c.getBBox(), wrap = gsap.utils.wrap(-(bb.x + bb.width), 1600 - bb.x);
        gsap.to(c, { x: '+=' + (1600 + bb.width), duration: 70 + i * 18, ease: 'none', repeat: -1,
          modifiers: { x: v => wrap(parseFloat(v)) + 'px' } });
      });
    }).catch(() => {});
  }

  /* ---------- start po vykreslení šablony ---------- */
  function boot() {
    tag(document); hero(); headerBehaviour(); switcher(); calendarDetail(); calendarList(); motion(); skyline();
    load('assets/v2/imos-asistent.js').catch(() => {});
    // šablona překresluje části stránky (filtry, menu, popup na mapě) – nové prvky dooznačit
    let t;
    const own = n => n.nodeType !== 1 || n.closest('.leaflet-container, .v2-cal, .v2-when, .split-line, .v2-avail, .v2-ai, .v2-dog, .v2-dogband');
    new MutationObserver(list => {
      if (list.every(m => own(m.target))) return;
      clearTimeout(t);
      t = setTimeout(() => {
        tag(document); hero(); headerBehaviour(); calendarDetail(); skyline();
        if (window.IMOS_MODULY) window.IMOS_MODULY.dog.band();
        if (calendarList.badges) calendarList.badges(); else calendarList();
        if (window.gsap && window.ScrollTrigger) { if (reveal(document)) window.ScrollTrigger.refresh(); }
        else if (reduce || !html.classList.contains('v2-motion')) document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('v2-in'));
      }, 80);
    }).observe(document.body, { childList: true, subtree: true });
    if (reduce) document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('v2-in'));
  }
  const ready = () => document.querySelector('header[data-screen-label] ~ main, main') && document.querySelector('footer');
  const wait = setInterval(() => { if (ready()) { clearInterval(wait); requestAnimationFrame(boot); } }, 30);
})();
