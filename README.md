# IMOS facility – web

Statický web (export z Claude Design), stažený 26. 10. 2026 z
https://grafika.imptest.cz/imos-facility/.

- `web/` – přesně to, co se nahrává na server (obsah složky `imos-facility/`).
- `serve.mjs` – lokální náhled: `node serve.mjs` → http://localhost:5340

Nasazení: ručně, nahrát obsah `web/` na grafika.imptest.cz/imos-facility/.
Fotky z imos-facility.cz se načítají přímo z jejich webu (nejsou v `web/assets`).

## GitHub Pages

Veřejný náhled: https://grafika-imptest.github.io/imos-facility/
(repo grafika-imptest/imos-facility, Pages z větve `gh-pages` = obsah `web/`).

Aktualizace po změnách:

    git subtree split --prefix web -b gh-pages && git push -f origin gh-pages && git branch -D gh-pages

## Kopie současného webu (`web/soucasny/`)

Přepínač „Nový návrh / Současný web“ vede na kopii 6 hlavních stránek www.imos-facility.cz,
ve které je stejný přepínač. Kopie se obnoví příkazem `node tools/snapshot-soucasny.mjs`
(stáhne HTML a styly, fonty a SVG ikony uloží lokálně, fotky bere ze živého webu,
odstraní měření GTM, cookie lištu a captchu; formuláře jsou v kopii vypnuté).
