# Lernteufel 😈

Eine Karteikarten-Lern-PWA mit Dunkelmodus — und einem eingebauten Frust-Ventil:
Wenn du keinen Bock mehr aufs Lernen hast, wirf einen Blick auf den **Level-Devil**-Modus,
ein kleiner Troll-Plattformer, bei dem der Level absichtlich gegen dich spielt.

Läuft als statische Seite ohne Build-Schritt direkt auf GitHub Pages. Alle Pfade sind relativ,
funktioniert also auch im Repo-Unterordner (`https://<user>.github.io/<repo>/`).

## Funktionen

- **Karteikarten lernen** — Decks anlegen, Karten bearbeiten, Karte umdrehen, „Gewusst" / „Nochmal".
  Nicht-gewusste Karten kommen am Ende der Runde noch mal.
- **Dunkel- & Hellmodus** — Umschalter oben rechts; Auswahl wird gespeichert, Standard folgt dem System.
- **Level Devil** — über „Keine Lust mehr?". Erreiche die Tür, während Böden wegbrechen,
  Spikes hochschießen, Decken fallen und eine Tür vor dir flieht. Tastatur und Touch.
- **Offline-fähig & installierbar** als PWA. Deine Decks liegen lokal im Browser (`localStorage`).

## Dateien

```
.
├── index.html
├── css/style.css
├── js/app.js              Lernlogik, Decks, Navigation, Theme
├── js/game.js             Level-Devil-Spiel
├── manifest.webmanifest
├── sw.js                  Service Worker (Offline-Cache)
├── .nojekyll
└── icons/
```

## Auf GitHub Pages veröffentlichen

1. Neues Repository anlegen.
2. Den **Inhalt** dieses Ordners ins Repo-Root legen und pushen (oder per Drag-and-drop in die GitHub-Weboberfläche).
3. **Settings → Pages → Build and deployment → Source: „Deploy from a branch"**, Branch `main`, Ordner `/ (root)`, **Save**.
4. Nach ein bis zwei Minuten erscheint die URL oben auf der Pages-Seite.

Pages liefert HTTPS — das braucht der Service Worker.

## Anpassen

- **Eigene Inhalte:** Im Editor lassen sich Decks und Karten direkt in der App pflegen.
  Möchtest du Decks fest vorgeben, ändere die Funktion `seed()` in `js/app.js`.
- **Farben/Theme:** Die Design-Tokens stehen oben in `css/style.css` (`--accent`, `--devil`, …),
  getrennt nach `:root[data-theme="dark"]` und `…="light"`.
- **Level Devil erweitern:** Neue Level in `js/game.js` in `levelDefs()` ergänzen.
  Plattform-Typen: `solid`, `fall` (bricht nach kurzem Stehen), `fake` (verschwindet bei Berührung),
  `rise` (erscheint ab `trig`). Dazu `spikes` (mit `hidden`/`trig`), `blocks` (fallende Decken)
  und `door` (optional `fake` oder `flees` mit `stops`).

## Wichtig: nach Änderungen den Cache erneuern

Der Service Worker liefert gecachte Dateien. Nach Änderungen in `sw.js` die Version hochzählen
(`'lernteufel-v1'` → `'lernteufel-v2'`), damit Nutzer das Update bekommen. Beim Entwickeln in den
DevTools unter **Application → Service Workers** den Haken **„Update on reload"** setzen.

## Lokal testen

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```
(Service Worker brauchen `http(s)`, nicht `file://`.)

## Steuerung Level Devil

- **Laufen:** ← → oder A / D
- **Springen:** ↑, W oder Leertaste (kurz/lang für niedrigen/hohen Sprung)
- **Touch:** Buttons unten links/rechts
