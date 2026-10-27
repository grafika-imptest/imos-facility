// Přepínač verzí v kopii současného webu: „Současný web“ je aktivní, „Nový návrh“ vede na odpovídající stránku návrhu.
(function () {
  const MAP = { index: 'index', 'pronajem-nemovitosti-v-brne': 'pronajem-nemovitosti', 'pronajem-zasedacich-mistnosti': 'zasedaci-mistnosti',
    'sprava-nemovitosti': 'sprava-nemovitosti', 'o-nas': 'o-nas', kontakty: 'kontakt' };
  const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  let target = '../' + (MAP[page] || 'index') + '.html';
  // když sem návštěvník přišel z návrhu (třeba z detailu), vrátí se přesně tam
  try {
    const from = sessionStorage.getItem('imos-v2-from');
    if (from) {
      const fp = (new URL(from).pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
      const back = { 'detail-nemovitosti': 'pronajem-nemovitosti', 'detail-zasedaci-mistnosti': 'zasedaci-mistnosti' }[fp] || fp;
      if (back === (MAP[page] || 'index')) target = from;
    }
  } catch (e) {}
  const el = document.createElement('nav');
  el.className = 'v2-switch'; el.setAttribute('aria-label', 'Přepnout verzi webu');
  el.innerHTML = `<a href="${target}">Nový návrh</a><a class="is-on" href="${location.href}" aria-current="page">Současný web</a>`;
  document.body.appendChild(el);
  // formuláře by odeslaly poptávku do ostrého systému klienta – v kopii jsou vypnuté
  document.addEventListener('submit', e => {
    e.preventDefault(); e.stopImmediatePropagation();
    alert('Toto je kopie současného webu pro porovnání s návrhem. Odeslání formuláře je vypnuté.');
  }, true);
})();
