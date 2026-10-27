// IMOS facility – návrh v2, UKÁZKOVÉ moduly (nic neodesílají):
//  1) řízený asistent vpravo dole – rychlé volby místo volného chatu, odpovídá jen z dat webu,
//     poptávku vytřídí (typ, lokalita, termín) a předá kontakt správnému oddělení,
//  2) hlídací pes – zájemce si uloží, co hledá, a v ostrém provozu dostane e-mail, až se prostor uvolní.
// V ostrém provozu: OBJ/ROOMS z administrace, odeslání do CRM / e-mailu obchodního oddělení.
(function () {
  const A = window.IMOS_AVAIL || null;

  /* ---------- data webu (stejná jako výpis nemovitostí a zasedaček) ---------- */
  const K = { k: 'Kanceláře', c: 'Komerční prostory', s: 'Sklady a výroba', b: 'Byty', o: 'Parkování a ostatní' };
  const DET = { babak: 'babak', osada: 'nova-osada', morava: 'palac-morava' };
  const OBJ = [
    ['Areál Jana Babáka', 'Jana Babáka 11, Brno - Královo Pole', 1, 'kcs', DET.babak],
    ['Parkovací dům Rozmarýn', 'Kounicova 1007, Brno-střed', 1, 'kco'],
    ['Palác Morava', 'Malinovského nám. 603/4, Brno-střed', 1, 'kc', DET.morava],
    ['Areál Bohunická', 'Bohunická 50, Brno-jih', 0, 'k'],
    ['Areál Vídeňská Tulip', 'Vídeňská 99, Brno - Štýřice', 1, 'ks'],
    ['Polyfunkční dům Nová Osada', 'Gajdošova 4392/7, Brno-Židenice', 1, 'kc', DET.osada],
    ['Areál Valchařská', 'Valchařská 36, Brno - Husovice', 1, 'ks'],
    ['Nový Obzor', 'Fillova 1, Brno-sever', 0, 'c'],
    ['Skladové centrum Řípská', 'Řipská 9a, Brno - Slatina', 0, 'ks'],
    ['Hala Kuřim', 'Knínická 1, Kuřim', 0, 's'],
    ['Pardubice – kanceláře, sklady, výroba', 'Jana Palacha 515, Pardubice', 1, 'ks'],
    ['Areál Hudcova', 'Hudcova 70a, Brno-Medlánky', 0, 's'],
    ['Komerční prostory Kozí', 'Dvořákova 1, Brno-střed', 0, 'c'],
    ['Leitnerova – rezidenční parkování', 'Hybešova 41, Brno-střed', 0, 'o'],
    ['Královo Pole – Mojmírovo náměstí', 'Mojmírovo nám. 22, Brno-Královo Pole', 0, 'c'],
    ['Tenisová hala Sprint', 'Sportovní 2A, Brno-Královo Pole', 0, 'so'],
    ['Areál Dolní Lhota', 'Dolní Lhota 76 a 82, Blansko', 0, 'ks']
  ].map(r => ({ name: r[0], addr: r[1], free: !!r[2], cats: r[3], href: r[4] ? 'detail-nemovitosti.html?o=' + r[4] : 'pronajem-nemovitosti.html',
    loc: /Brno-střed/.test(r[1]) ? 'centrum' : /Brno/.test(r[1]) ? 'brno' : 'mimo' }));
  const LOC = { centrum: 'Brno – centrum', brno: 'Brno – ostatní čtvrti', mimo: 'Mimo Brno', any: 'Kdekoli' };
  const ROOMS = [
    ['m316', 'Palác Morava', 'Zasedací místnost č. 316', 56, 64], ['m415a', 'Palác Morava', 'Zasedací místnost č. 415A', 28, 40],
    ['m415', 'Palác Morava', 'Zasedací místnost č. 415', 22, 23], ['b2', 'Babák office', 'Zasedačka v 2. NP budovy B', 24, 24],
    ['e3', 'Babák office', 'Zasedačka v 3. NP budovy E', 16, 20]
  ].map(r => ({ id: r[0], place: r[1], name: r[2], min: r[3], max: r[4] }));
  // kontakty jsou převzaté ze stránky Kontakty na imos-facility.cz
  const PEOPLE = {
    pronajem: ['Marcela Dubrovayová', 'vedoucí obchodního oddělení pronájmů', '+420 602 188 375', 'dubrovayova@imosfacility.cz'],
    sprava: ['Ing. Ivan Pejta', 'vedoucí správy nemovitostí', '+420 724 946 604', 'pejta@imosfacility.cz'],
    hlavni: ['IMOS facility, a.s.', 'recepce a obecné dotazy', '+420 533 432 111', 'spravam@imosfacility.cz']
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ico = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>', check: '<path d="M5 12l5 5 9-10"/>'
  };
  const store = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const person = p => `<div class="v2-ai-person"><b>${p[0]}</b><span>${p[1]}</span>
    <a href="tel:${p[2].replace(/\s/g, '')}">${ico(I.phone)}${p[2]}</a><a href="mailto:${p[3]}">${ico(I.mail)}${p[3]}</a></div>`;
  const ticket = () => 'IMOS-' + String(Date.now()).slice(-5);

  /* ================= 2) HLÍDACÍ PES ================= */
  const DOG_KEY = 'imos-hlidac';
  const dog = {
    el: null,
    open(pre) {
      pre = pre || {};
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'v2-dog'; this.el.setAttribute('data-lenis-prevent', '');
        document.body.appendChild(this.el);
        this.el.addEventListener('click', e => { if (e.target === this.el || e.target.closest('[data-dog-close]')) this.close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.el.classList.contains('is-open')) this.close(); });
      }
      const saved = store.get(DOG_KEY) || {};
      const cats = pre.cats || saved.cats || [], loc = pre.loc || saved.loc || 'any';
      const chip = (name, val, label, on) => `<label class="v2-chip"><input type="${name === 'loc' ? 'radio' : 'checkbox'}" name="${name}" value="${val}"${on ? ' checked' : ''}><span>${label}</span></label>`;
      this.el.innerHTML = `<form class="v2-dog__box" novalidate>
        <button type="button" class="v2-dog__x" data-dog-close aria-label="Zavřít">${ico(I.close)}</button>
        <span class="v2-dog__badge">${ico(I.bell)}</span>
        <h3>Hlídací pes volných prostor</h3>
        <p class="v2-dog__lead">Řekněte nám, co hledáte. Jakmile se uvolní prostor, který odpovídá, pošleme vám e-mail dřív, než ho zveřejníme.</p>
        <fieldset><legend>Typ prostoru</legend><div class="v2-chips">${Object.keys(K).map(c => chip('cat', c, K[c], cats.includes(c))).join('')}</div></fieldset>
        <fieldset><legend>Lokalita</legend><div class="v2-chips">${Object.keys(LOC).map(l => chip('loc', l, LOC[l], l === loc)).join('')}</div></fieldset>
        <div class="v2-dog__row">
          <label>Plocha od (m²)<input name="from" type="number" min="0" inputmode="numeric" placeholder="např. 50" value="${esc(saved.from || '')}"></label>
          <label>do (m²)<input name="to" type="number" min="0" inputmode="numeric" placeholder="např. 200" value="${esc(saved.to || '')}"></label>
        </div>
        <label class="v2-dog__mail">E-mail pro upozornění<input name="mail" type="email" required placeholder="vas@email.cz" value="${esc(saved.mail || '')}"></label>
        <p class="v2-dog__err" hidden>Vyberte aspoň jeden typ prostoru a vyplňte platný e-mail.</p>
        <button class="v2-dog__go" type="submit">Spustit hlídání ${ico(I.arrow)}</button>
        <p class="v2-demo">Ukázka návrhu – formulář nic neodesílá. V ostrém provozu přijde potvrzovací e-mail a hlídání jde jedním klikem zrušit.</p>
      </form>`;
      this.el.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target, d = {
          cats: [...f.querySelectorAll('[name=cat]:checked')].map(i => i.value), loc: (f.querySelector('[name=loc]:checked') || {}).value || 'any',
          from: f.from.value, to: f.to.value, mail: f.mail.value.trim(), since: new Date().toISOString().slice(0, 10)
        };
        if (!d.cats.length || !/^\S+@\S+\.\S+$/.test(d.mail)) { f.querySelector('.v2-dog__err').hidden = false; return; }
        store.set(DOG_KEY, d);
        f.innerHTML = `<button type="button" class="v2-dog__x" data-dog-close aria-label="Zavřít">${ico(I.close)}</button>
          <span class="v2-dog__badge is-ok">${ico(I.check)}</span><h3>Hlídání je spuštěné</h3>
          <p class="v2-dog__lead">${esc(dog.summary(d))}. Upozornění pošleme na <b>${esc(d.mail)}</b>.</p>
          <p class="v2-dog__lead">${(n => n === 1 ? 'Teď odpovídá <b>1</b> volná nabídka – najdete ji ve výpisu.' : n > 1 && n < 5 ? `Teď odpovídají <b>${n}</b> volné nabídky – najdete je ve výpisu.`
            : n ? `Teď odpovídá <b>${n}</b> volných nabídek – najdete je ve výpisu.` : 'Teď nic volného neodpovídá, ozveme se, až se to změní.')(dog.matches(d).length)}</p>
          <button type="button" class="v2-dog__go" data-dog-close>Hotovo</button>
          <p class="v2-demo">Ukázka návrhu – nic se neodeslalo, nastavení zůstává jen v tomto prohlížeči.</p>`;
        dog.band();
      });
      requestAnimationFrame(() => this.el.classList.add('is-open'));
      html.classList.add('v2-dog-open');
    },
    close() { if (this.el) this.el.classList.remove('is-open'); html.classList.remove('v2-dog-open'); },
    summary: d => d.cats.map(c => K[c]).join(', ') + ' · ' + LOC[d.loc] + (d.from || d.to ? ` · ${d.from || 0}–${d.to || '∞'} m²` : ''),
    matches: d => OBJ.filter(o => o.free && d.cats.some(c => o.cats.includes(c)) && (d.loc === 'any' || o.loc === d.loc)),
    // pruh pod výpisem nemovitostí (šablona ho může překreslit – volá se znovu z MutationObserveru)
    band() {
      const sec = document.querySelector('section[data-screen-label="Výpis"]');
      if (!sec) return;
      let b = sec.querySelector('.v2-dogband');
      if (!b) { b = document.createElement('div'); b.className = 'v2-dogband'; sec.firstElementChild.appendChild(b); }
      const d = store.get(DOG_KEY);
      const html = d ? `<span class="v2-dogband__ico is-on">${ico(I.bell)}</span>
          <div><b>Hlídání je aktivní</b><p>${esc(dog.summary(d))} → ${esc(d.mail)}</p></div>
          <button type="button" data-dog-open>Upravit hlídání</button>`
        : `<span class="v2-dogband__ico">${ico(I.bell)}</span>
          <div><b>Nenašli jste, co hledáte?</b><p>Nastavte si hlídacího psa – jakmile se uvolní vhodný prostor, dáme vám vědět e-mailem jako prvním.</p></div>
          <button type="button" data-dog-open>Hlídat volné prostory ${ico(I.arrow)}</button>`;
      if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; }
    }
  };
  const html = document.documentElement;
  document.addEventListener('click', e => { if (e.target.closest('[data-dog-open]')) dog.open(); });

  /* ================= 1) ŘÍZENÝ ASISTENT ================= */
  const ai = { root: null, log: null, opts: null, ctx: {}, history: [] };

  function build() {
    const r = document.createElement('div');
    r.className = 'v2-ai'; r.setAttribute('data-lenis-prevent', '');
    r.innerHTML = `<button class="v2-ai__fab" type="button" aria-expanded="false" aria-controls="v2-ai-panel">
        <span class="v2-ai__pulse"></span>${ico(I.chat)}<span class="v2-ai__fab-txt">Rychlá pomoc</span></button>
      <div class="v2-ai__panel" id="v2-ai-panel" role="dialog" aria-label="Asistent IMOS facility">
        <div class="v2-ai__head">
          <span class="v2-ai__avatar">${ico(I.chat)}</span>
          <div><b>Asistent IMOS</b><small><i></i>Odpovídá z aktuální nabídky</small></div>
          <button type="button" class="v2-ai__icon" data-ai="restart" aria-label="Začít znovu" title="Začít znovu">${ico('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>')}</button>
          <button type="button" class="v2-ai__icon" data-ai="close" aria-label="Zavřít">${ico(I.close)}</button>
        </div>
        <div class="v2-ai__log" aria-live="polite"></div>
        <div class="v2-ai__opts"></div>
        <div class="v2-ai__foot">Ukázka návrhu · nic se neodesílá</div>
      </div>`;
    document.body.appendChild(r);
    ai.root = r; ai.log = r.querySelector('.v2-ai__log'); ai.opts = r.querySelector('.v2-ai__opts');
    r.querySelector('.v2-ai__fab').addEventListener('click', () => toggle());
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-ai]');
      if (!b) return;
      const a = b.dataset.ai;
      if (a === 'close') toggle(false);
      else if (a === 'restart') { ai.log.innerHTML = ''; start(); }
      else if (a === 'dog') dog.open(ai.ctx.dog);
      else if (STEP[a]) { user(b.dataset.label || b.textContent.trim()); STEP[a](b.dataset.v); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && r.classList.contains('is-open') && !html.classList.contains('v2-dog-open')) toggle(false); });
    // první návštěva: po chvíli nabídne pomoc bublinou (jen jednou za relaci)
    try {
      if (!sessionStorage.getItem('imos-ai-hint')) setTimeout(() => {
        if (r.classList.contains('is-open')) return;
        r.classList.add('has-hint'); sessionStorage.setItem('imos-ai-hint', 1);
        setTimeout(() => r.classList.remove('has-hint'), 7000);
      }, 6000);
    } catch (e) {}
  }
  function toggle(on) {
    on = on === undefined ? !ai.root.classList.contains('is-open') : on;
    ai.root.classList.toggle('is-open', on); ai.root.classList.remove('has-hint');
    html.classList.toggle('v2-ai-open', on);
    ai.root.querySelector('.v2-ai__fab').setAttribute('aria-expanded', on);
    if (on && !ai.log.children.length) start();
  }
  const scroll = () => requestAnimationFrame(() => ai.log.scrollTo({ top: ai.log.scrollHeight, behavior: 'smooth' }));
  function bot(htmlText, delay) {
    const m = document.createElement('div');
    m.className = 'v2-ai__msg is-bot is-typing'; m.innerHTML = '<span class="v2-ai__dots"><i></i><i></i><i></i></span>';
    ai.log.appendChild(m); scroll();
    return new Promise(ok => setTimeout(() => { m.classList.remove('is-typing'); m.innerHTML = htmlText; scroll(); ok(m); }, delay === undefined ? 520 : delay));
  }
  function user(t) {
    const m = document.createElement('div'); m.className = 'v2-ai__msg is-user'; m.textContent = t;
    ai.log.appendChild(m); scroll();
  }
  // volby jako tlačítka: [akce, popisek, hodnota]
  function opts(list) {
    ai.opts.innerHTML = list.map(([a, label, v]) => `<button type="button" data-ai="${a}"${v !== undefined ? ` data-v="${esc(v)}"` : ''}>${label}</button>`).join('');
  }
  async function say(texts, list) {
    ai.opts.innerHTML = '';
    for (const t of [].concat(texts)) await bot(t);
    if (list) opts(list);
  }
  const again = ['start', 'Zpět na začátek'];

  // ---- formulář pro kontakt uvnitř konverzace ----
  function leadForm(kind, note) {
    ai.opts.innerHTML = '';
    bot(`<form class="v2-ai__form" novalidate>
        <label>Jméno a příjmení<input name="n" required autocomplete="name"></label>
        <label>Telefon nebo e-mail<input name="c" required autocomplete="email"></label>
        ${kind === 'zavada' ? '<label>Adresa / budova a místo<input name="w" required placeholder="např. Gajdošova 7, 3. NP"></label><label>Popis<textarea name="d" rows="2" placeholder="Co se stalo, od kdy…"></textarea></label>' : '<label>Zpráva (nepovinné)<textarea name="d" rows="2"></textarea></label>'}
        <button type="submit">Odeslat ${ico(I.arrow)}</button>
      </form>`).then(m => {
      const f = m.querySelector('form');
      f.addEventListener('submit', e => {
        e.preventDefault();
        if ([...f.querySelectorAll('[required]')].some(i => !i.value.trim())) { f.classList.add('is-err'); return; }
        const name = f.n.value.trim().split(' ')[0];
        f.querySelectorAll('input,textarea,button').forEach(i => (i.disabled = true));
        const who = kind === 'zavada' || kind === 'sprava' ? PEOPLE.sprava : kind === 'obecne' ? PEOPLE.hlavni : PEOPLE.pronajem;
        const msg = kind === 'zavada'
          ? `Děkujeme, ${esc(name)}. Požadavek <b>#${ticket()}</b> jsme předali technikům správy. Stav uvidíte v e-mailu.`
          : `Děkujeme, ${esc(name)}. Poptávku jsme předali – ozve se vám <b>${who[0]}</b> (${who[1]}).${note ? ' ' + note : ''}`;
        say([msg, '<span class="v2-demo">Ukázka návrhu – nic se neodeslalo. V ostrém provozu poptávka dorazí do e-mailu nebo CRM příslušného oddělení i s vybranými údaji z konverzace.</span>'], [again]);
      });
    });
  }

  // ---- kroky konverzace ----
  const STEP = {
    start() { start(); },
    // pronájem
    rent() { ai.ctx = {}; say('Jaký typ prostoru hledáte?', Object.keys(K).map(c => ['rentType', K[c], c])); },
    rentType(c) { ai.ctx.cat = c; say('A kde by to mělo být?', Object.keys(LOC).map(l => ['rentLoc', LOC[l], l])); },
    rentLoc(l) {
      const c = ai.ctx.cat; ai.ctx.loc = l; ai.ctx.dog = { cats: [c], loc: l };
      const all = OBJ.filter(o => o.cats.includes(c) && (l === 'any' || o.loc === l));
      const free = all.filter(o => o.free), busy = all.filter(o => !o.free);
      const card = o => `<a class="v2-ai__card" href="${o.href}"><span class="v2-ai__st${o.free ? ' is-free' : ''}">${o.free ? 'Volné' : 'Obsazené'}</span><b>${esc(o.name)}</b><small>${esc(o.addr)}</small></a>`;
      if (free.length) {
        say([`Mám pro vás <b>${free.length}</b> ${free.length === 1 ? 'volnou nabídku' : free.length < 5 ? 'volné nabídky' : 'volných nabídek'}:`,
          `<div class="v2-ai__cards">${free.map(card).join('')}</div>`],
        [['viewing', 'Domluvit prohlídku'], ['dog', `${ico(I.bell)} Hlídat další`], again]);
      } else {
        say([`Teď tu nemám nic volného${busy.length ? `, ale ${busy.length === 1 ? 'tenhle objekt se' : 'tyto objekty se'} průběžně uvolňují:` : '.'}`,
          ...(busy.length ? [`<div class="v2-ai__cards">${busy.slice(0, 4).map(card).join('')}</div>`] : []),
          'Nastavte si hlídacího psa – dáme vám vědět e-mailem, jakmile se něco uvolní.'],
        [['dog', `${ico(I.bell)} Nastavit hlídání`], ['viewing', 'Nechat kontakt'], again]);
      }
    },
    viewing() { leadForm('pronajem', 'Domluví s vámi termín prohlídky.'); },
    // zasedačky
    room() {
      ai.ctx = {};
      say('Kolik vás na schůzce bude?', [['roomCap', 'do 20 osob', '1-20'], ['roomCap', '21–30 osob', '21-30'], ['roomCap', '31–40 osob', '31-40'], ['roomCap', 'víc než 40', '41-999']]);
    },
    roomCap(n) {
      ai.ctx.cap = n;
      if (!A) return say('Kalendář se nepodařilo načíst. Volné termíny najdete na stránce zasedacích místností.', [['link', 'Zasedací místnosti', 'zasedaci-mistnosti.html'], again]);
      const days = []; const d = new Date(A.today);
      while (days.length < 5) { d.setDate(d.getDate() + 1); if (!A.isWeekend(d)) days.push(new Date(d)); }
      say('Na který den?', days.map(x => ['roomDay', x.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }), A.iso(x)]).concat([['link', 'Jiné datum v kalendáři', 'zasedaci-mistnosti.html']]));
    },
    roomDay(iso) {
      const d = new Date(iso + 'T00:00:00'), cap = ai.ctx.cap, [lo, hi] = cap.split('-').map(Number);
      const fit = ROOMS.filter(r => r.max >= lo && r.min <= hi);
      const rows = fit.map(r => {
        const am = !A.busy(r.id, d, 'am'), pm = !A.busy(r.id, d, 'pm');
        const slot = am && pm ? 'day' : am ? 'am' : pm ? 'pm' : null;
        const txt = am && pm ? 'volno celý den' : am ? 'volno dopoledne' : pm ? 'volno odpoledne' : 'obsazeno';
        return slot ? `<a class="v2-ai__card" href="detail-zasedaci-mistnosti.html?m=${r.id}&d=${iso}&s=${slot}"><span class="v2-ai__st is-free">${txt}</span><b>${r.name}</b><small>${r.place} · ${r.min === r.max ? r.max : r.min + '–' + r.max} osob</small></a>`
          : `<div class="v2-ai__card is-off"><span class="v2-ai__st">${txt}</span><b>${r.name}</b><small>${r.place}</small></div>`;
      });
      const any = rows.some(x => x.startsWith('<a'));
      say([any ? `Na ${d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })} je volno tady – kliknutím otevřete rezervaci s vybraným termínem:`
        : 'Ten den je všechno obsazené. Zkuste jiný den:', `<div class="v2-ai__cards">${rows.join('')}</div>`],
      [['roomCap', 'Jiný den', cap], again]);
    },
    // správa
    manage() {
      ai.ctx = {};
      say(['Spravujeme bytové domy, kancelářské budovy i areály – technickou správu, ekonomiku, úklid a služby pod jednou smlouvou.',
        `Rád vás spojím s vedoucím správy:${person(PEOPLE.sprava)}`],
      [['manageLead', 'Chci nabídku správy'], ['link', 'Více o správě', 'sprava-nemovitosti.html'], again]);
    },
    manageLead() { leadForm('sprava', 'Připraví nabídku podle typu a velikosti nemovitosti.'); },
    // závada
    fault() {
      ai.ctx = {};
      say('Co potřebujete nahlásit?', [['faultType', 'Voda, topení, odpad'], ['faultType', 'Elektřina, osvětlení'], ['faultType', 'Výtah, vstup, zámky'], ['faultType', 'Úklid a okolí'], ['faultType', 'Něco jiného']]);
    },
    faultType() {
      say('Vyplňte prosím, kde se to stalo. Při havárii (voda, elektřina) volejte rovnou <a href="tel:+420533432111">+420 533 432 111</a>.');
      setTimeout(() => leadForm('zavada'), 600);
    },
    // kontakt
    human() {
      ai.ctx = {};
      say(['Kontakty na jednotlivá oddělení:', person(PEOPLE.pronajem) + person(PEOPLE.sprava) + person(PEOPLE.hlavni)], [['humanLead', 'Ať se mi ozvou'], again]);
    },
    humanLead() { leadForm('obecne'); },
    link(href) { location.href = href; }
  };
  function start() {
    ai.ctx = {};
    const d = store.get(DOG_KEY);
    say(['Dobrý den 👋 Pomohu vám rychle najít, co potřebujete. Vyberte, s čím přicházíte:'].concat(d ? [`Máte aktivní hlídání: <b>${esc(dog.summary(d))}</b>.`] : []), [
      ['rent', 'Hledám prostory k pronájmu'], ['room', 'Potřebuji zasedačku'], ['manage', 'Správa mé nemovitosti'],
      ['fault', 'Jsem nájemník – hlásím závadu'], ['human', 'Spojit se s člověkem']
    ]);
  }

  function boot() {
    if (!document.querySelector('.v2-ai')) build();
    dog.band();
  }
  window.IMOS_MODULY = { boot, dog };
  boot();
})();
