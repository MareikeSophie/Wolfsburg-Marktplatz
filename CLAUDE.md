# Westhagen Plays!

Thesis-Projekt (Urban Design, Bauhaus-Universität Weimar, englischsprachiges Programm) zur partizipativen Gestaltung des Westhagen Marktplatzes in Wolfsburg. Demonstriert KI-gestützte Nachbarschafts-Mitgestaltung anhand einer fiktiven WhatsApp-Gruppe.

## Outputs

Es gibt **drei unabhängige Demos**:

### Demo 1: WesthagenGrows (aktiv weiterentwickelt)
1. **`demo/WesthagenGrows_Demo.html`** – animierte 16:9-Präsentation (~17 MB, standalone HTML/CSS/JS, kein Build-Prozess, alles inline). Zeigt eine WhatsApp-Chat-Simulation im Phone-Mockup (rechts), links eine Design-Spalte (Titel "westhagen plays", aktueller Decision Tree, mittig 6-Monats-Kalender). Vollständig fertig (Stand 2026-06-25).
2. **`docs/WesthagenGrows_Chat.docx`** – Chat-Skript Teil 1: Spielplatzentwurf, Stages 1–8, April–Juli 2026.
3. **`docs/WesthagenFest_Chat.docx`** – Chat-Skript Teil 2: Erntefest WesthagenFest, Stages 9–17, August–September 2026.

### Demo 2: WesthagenMarktplatz (älteres/separates Demo, Autoplay)
4. **`demo/WesthagenMarktplatz_Demo.html`** – älteres Demo (~64,8 MB), 150 MESSAGES, 9 Tage (Wochentage ohne vollständiges Datum), keine Stages/Decision Trees, Message-Typen: `date`, `system`, `msg`, `poll`, `transition`, `image`, `file`, `fastForward`, `event`. Struktur deutlich einfacher als Demo 1. Die 65 MB kommen fast vollständig aus einem `STAGES`-Array (13 Einträge × `iso`+`materials`, base64), das dieselben Bilder erneut einbettet, die bereits unter `assets/Renderings/` und `assets/Materials/` liegen.

### Demo 3: WesthagenMarktplatz Interactive (in Arbeit, siehe unten)
5. **`demo/WesthagenMarktplatz_Interactive/`** (`index.html` + `style.css` + `story.js` + `engine.js`) – echte scrollbare/interaktive Website statt Autoplay-Slide, basiert 1:1 auf dem Content von Demo 2, layoutet für iPad 11" Querformat (Kiosk-artig, volle Browserhöhe). Kein Base64: Bilder werden per `<img>` direkt aus `assets/Renderings/` und `assets/Materials/` referenziert.
   - `story.js` (generiert): `STORY`-Objekt, Nodes keyed by `id` (`m1`…`m150`) mit `next`-Zeiger statt Array-Index — vorbereitet für spätere `type:"choice"`/`type:"ending"`-Nodes (Branching noch nicht befüllt, s. "Aktueller Stand").
   - `engine.js`: scroll-getriebenes Nachladen (kein Timer/Autoplay), scripted Intro (7 Nachrichten) + "Scroll to continue"-Hinweis, "tippt..."-Indikator vor jeder Nachricht, klickbare Polls (Ergebnis + eigene Stimme via `localStorage` gespeichert), rechts fest positionierter Phone-Screen (19,5:9, volle Zeilenhöhe), links eine schwarze Kamera-Box mit echtem Live-Kamerazugriff (`getUserMedia`, Hauptkamera/`facingMode:"environment"`) statt der alten Design-Fortschritts-Anzeige.
   - **Cache-Busting:** `index.html` referenziert `style.css?v=N` / `story.js?v=N` / `engine.js?v=N` — GitHub Pages sendet `Cache-Control: max-age=600`, und iOS Safaris normaler Reload umgeht das nicht zuverlässig. **`N` bei jeder CSS/JS-Änderung hochzählen**, sonst wirken Fixes auf Geräten so, als seien sie nie angekommen.

**Wichtig:** Inhaltliche Änderungen am Chatverlauf müssen in HTML-Demo UND entsprechendem .docx gleichzeitig nachgezogen werden. Das gilt aktuell nicht für Demo 3, solange dort nur 1:1 portierter Content ohne eigenes Wording steht.

## Struktur der HTML-Demo

- `MESSAGES` – Array aller Chat-Einträge (aktuell 186), chronologisch. `type`-Werte: `msg`, `image`, `file`, `poll`, `system`, `event`, `date`, `transition`, `stage`, `calendarFlip`.
- `TREES[0..16]` – 17 base64-eingebettete Decision Tree PNGs (aus `assets/Decision Tree_Gardening/1.png`–`17.png`).
- `CHAT_IMGS` – Objekt mit base64-eingebetteten Chat-Fotos: Keys `buildday`, `tomato`, `winefest`.
- `entry.stage` / `type:"stage"` – setzt den angezeigten Decision Tree links.
- `type:"calendarFlip"` – springt der Kalender-Markierung auf neuen Monat (calendarFlips: May:11, June:11, August:3).
- `type:"system"` – nur noch Poll-Benachrichtigungen ("Poll is open until..."); keine Zeitübergangs-Texte.
- `type:"transition"` – unsichtbarer Tageswechsel: animiert Poll-Votes, setzt Uhrzeit-Anzeige, kein visueller Übergang im Chat.
- `type:"date"` – Datums-Separator im Chat, Format "Monday, April 20".

### Kalender (Jahr-Ansicht, 2×3-Grid)
- Monate: April, May, June, July, August, September (alle gleichzeitig sichtbar, Oktober in Daten aber nicht angezeigt).
- `buildAllMonths()` – einmaliger Build beim Init.
- `updateCalendar(day, monthKey)` – setzt `.mcell.active` (grünes Rechteck), kein DOM-Rebuild.
- `flipCalendarTo(monthKey, day)` – ruft nur `updateCalendar` auf (kein Flip-Anim, da alle Monate sichtbar).

### Layout (linke Design-Spalte + Mitte)
- `.design-card { aspect-ratio: 3/4 }` – Breite wird aus Höhe abgeleitet, kein intrinsic-size Overflow.
- `.mid-col { margin-left: calc(-1 * clamp(20px,3vw,44px)) }` – Kalender flush an Decision Tree.
- `.months-grid { height: 88% }` + `justify-content: center` – vertikal zentriert.

## Designsprache

- Farben: Terracotta `#c0505d`, Sonnenblumengelb `#dbbb43`, Salbeigrün `#57756d`.
- Schrift: **BB Torsos Pro** (Display/Headlines), serifenlos für Fließtext/Chat.
- Design-Spalte linksbündig auf gleicher Kante.

## Spielplatzentwurf (Inhalt)

90 m² Hauptspielfläche, 11 m² Sandkasten (Kleinkinder), 20 m² "Jenga"-Sitzbereich, zwei Tischtennisplatten, geschwungene Paletten-Backstein-Bänke, Palettenpflanzkübel mit Bäumen.

## Validierung

`validate.js` ist auf Linux-Pfad `/home/claude/demo.html` hardcoded und läuft **nicht** direkt auf Windows. Stattdessen Inline-Validierung per Node.js:

```js
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Users/marei/.../demo/WesthagenGrows_Demo.html', 'utf8');
const m = html.match(/const MESSAGES = (\[\\s\\S]*?\]);\s*\n/);
const msgs = eval(m[1]);
const counts = {};
msgs.forEach(m => { counts[m.type] = (counts[m.type]||0)+1; });
console.log('MESSAGES:', msgs.length, JSON.stringify(counts));
"
```

Nach jeder Änderung ausführen, bevor sie als erledigt gilt.

## Arbeitsweise mit der großen Datei

Die HTML-Datei ist ~17 MB – das Edit-Tool schlägt bei Midfile-Einfügungen fehl. Workflow:
1. Patch-Skript mit dem **Write-Tool** in eine temp `.js`-Datei schreiben.
2. `node "C:/Users/.../patch_xyz.js"` ausführen.
3. Skript danach mit `rm` löschen.
4. Niemals Node.js-Skripte inline in Bash schreiben (Escaping bricht bei verschachtelten Anführungszeichen).

## Arbeitsweise / Erwartungen

- Iterativ: bei größeren Strukturänderungen vorher kurz Plan beschreiben.
- Bei Unsicherheit über Bild-Zuordnung, Zeitangaben oder Tagesnummern nachfragen — die Chronologie muss exakt stimmen.
- Methodische Transparenz: Limitationen ehrlich benennen.
- Finale Lieferobjekte (Word, Bilder) auf Englisch, Projektkommunikation auf Deutsch.

## Aktueller Stand (2026-06-25)

Demo ist vollständig fertig:
- 186 MESSAGES, 17 Stages (Decision Trees 1–17), 18 Tage, 6 Polls
- April 20 – Juli 11 (WesthagenGrows) + August 24 – September 13 (WesthagenFest)
- 3 Chat-Fotos eingebettet: buildday, tomato, winefest (WINE FEST SCENE.png)
- Zeitübergangs-Benachrichtigungen ("Two weeks later" etc.) entfernt
- Kalender: 6-Monats-Jahr-Ansicht April–September
- Demo-Laufzeit: ~4,6 min (1×) / ~3,1 min (1,5×) / ~2,3 min (2×)

## Demo 3 — Aktueller Stand (2026-07-02)

Gerüst + 1:1-Content-Port + iPad-Layout + Live-Kamera-Platzhalter sind fertig, gepusht (GitHub Pages, `MareikeSophie/Wolfsburg-Marktplatz`) und auf einem echten iPad 11" verifiziert. Noch offen, bewusst nicht Teil dieser Iteration:
- Platzierung und Wording der Branch-Punkte (`type:"choice"`) und der 3 Endings (`type:"ending"`) — Content-Design, gemeinsam mit Nutzerin zu erarbeiten.
- `.docx`-Skript für Demo 3, sobald der Branch-Content feststeht.

**iPad-Safari-spezifische Bugs, die diese Session gefunden/gefixt hat** (relevant für jede künftige Layout-Änderung an dieser Demo):
- `100vh`/`100dvh`/`100svh` auf `body` sind auf iPad Safari unzuverlässig (Toolbar-Ein-/Ausblenden ändert die tatsächlich sichtbare Höhe). Fix: `body.style.height` wird per JS aus `window.visualViewport.height` gesetzt (mehrere Retries kurz nach Load + bei `resize`/`orientationchange`).
- **Niemals auf `window.visualViewport`s eigenes `"resize"`-Event reagieren**, wenn im Chat gescrollt wird — internes Scrollen lässt Safaris kompakte Toolbar animieren, was dieses Event auslöst und bei Reaktion das ganze Layout mitten im Scrollen zerreißt. Nur Load-Retries + `resize`/`orientationchange` triggern ein Re-Measure; der `window`-eigene `resize`-Listener zusätzlich nur bei echter Breitenänderung reagieren lassen (Toolbar ändert nur die Höhe).
- CSS Container Queries (`cqw`) für die Chat-Skalierung: iPadOS Safari löst die Container-Breite beim allerersten Rendern manchmal falsch/zu groß auf. Ersetzt durch `--chat-scale`, eine CSS-Custom-Property, die per JS aus `getBoundingClientRect()` gesetzt wird (`em`-Einheiten statt `cqw`), zusätzlich per `ResizeObserver` (nicht nur Timeouts) aktuell gehalten.
- Prozentuale `padding` auf einem Element mit `width:auto` + `aspect-ratio` (Phone-Bezel) wird von Safari falsch/zu dick berechnet — Reihenfolge-Problem, da die Breite erst aus `aspect-ratio` abgeleitet werden muss. Fix: feste `px`-Werte statt `%`.
- **Größter Bug:** Ein verschachtelter Flex-Container (`.phone-wrap`, `flex:0 0 auto`) dessen einziges Kind `aspect-ratio` + `height:100%` nutzt, wurde von iPad Safari mit einer absurd falschen Breite berechnet (862px in einem 840px breiten Viewport!) — dadurch bekam die Kamera-Spalte daneben 0px Breite. Nur auf iPad/WebKit reproduzierbar, Laptop-Browser zeigten es korrekt. Fix: Wrapper entfernt, `.phone-frame` ist jetzt direktes Flex-Item von `.layout`.
- **Cache:** iOS Safaris Reload-Button umgeht `Cache-Control`-Header nicht zuverlässig — mehrere „der Fix kommt nicht an“-Meldungen waren tatsächlich Cache, kein Code-Fehler. Siehe `?v=N`-Hinweis oben.

**Debugging-Technik, die sich bewährt hat:** Bei „sieht auf dem Gerät falsch aus"-Reports, die sich nicht durch Screenshots allein klären lassen, ein **temporäres Diagnose-Overlay** einbauen (`getBoundingClientRect()` der betroffenen Elemente + `visualViewport`/`innerWidth`/`devicePixelRatio` als Text direkt auf der Seite anzeigen), Nutzerin um einen Screenshot davon bitten, danach Overlay wieder entfernen. Deutlich schneller als mehrere Blind-Fix-Runden mit Deploy-Wartezeit.

Lokal testen: einfacher HTTP-Server (z.B. `npx serve .` im Projektroot, dann `/demo/WesthagenMarktplatz_Interactive/`), damit die relativen `../../assets/...`-Bildpfade genauso aufgelöst werden wie online.
