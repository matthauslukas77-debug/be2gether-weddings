# be2gether CMS — Integration Guide

Client-side CMS für statische HTML-Seiten. Kein Backend nötig.

## 📦 Was ist enthalten

```
cms-export/
├── admin/          → Admin-Panel (Login, Editor)
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── data/           → Content als JSON (eine Datei pro Seite)
│   ├── site.json        (globale Inhalte: Logo, Kontakt, Footer)
│   ├── index.json       (Startseite)
│   ├── leistungen.json
│   ├── impressionen.json
│   ├── blog.json
│   └── kontakt.json
├── js/
│   └── cms-loader.js    (Runtime: lädt JSON → HTML)
└── INSTALL.md      (dieses Dokument)
```

---

## 🚀 Integration — in 3 Schritten

### Schritt 1 — Ordner kopieren

Kopiere aus `cms-export/` in den Projekt-Root:
- `admin/` → `/admin/`
- `data/` → `/data/`
- `js/cms-loader.js` → `/js/cms-loader.js` (zu bestehendem js-Ordner hinzufügen)

### Schritt 2 — HTML-Seiten verknüpfen

Pro Seite **2 Dinge** ändern:

**(a)** `<body>` Tag erweitern um `data-cms-page="..."`:

```html
<!-- Startseite -->
<body data-cms-page="index">

<!-- Leistungen -->
<body class="page-light" data-cms-page="leistungen">

<!-- Impressionen -->
<body class="page-light" data-cms-page="impressionen">

<!-- Blog -->
<body class="page-light" data-cms-page="blog">

<!-- Kontakt -->
<body class="page-light" data-cms-page="kontakt">
```

**(b)** Script-Tag **vor** `main.js` einfügen (kurz vor `</body>`):

```html
<script src="js/cms-loader.js"></script>
<script src="js/main.js"></script>
</body>
```

### Schritt 3 — `data-cms` Attribute an Elemente setzen

Damit der CMS weiß welches HTML-Element welchem JSON-Feld entspricht.

**Basis-Pattern (Text):**
```html
<h1 data-cms="hero.title">Euer perfekter Tag.</h1>
<p data-cms="hero.subtitle">Hochzeitsplanung…</p>
```

**Bilder:**
```html
<img data-cms-src="hero.image" src="images/foto.jpg" alt="">
```

**Links (href):**
```html
<a data-cms-href="site.social.instagram" href="https://instagram.com/...">Instagram</a>
```

**Alt-Text:**
```html
<img data-cms-alt="gallery.0.alt" src="…" alt="Fallback">
```

**Arrays (z.B. 4 Service-Cards):**
```html
<h3 data-cms="services.items.0.title">Komplettplanung</h3>
<h3 data-cms="services.items.1.title">Teilplanung</h3>
<h3 data-cms="services.items.2.title">Tagesbegleitung</h3>
```

→ Die Pfade (`hero.title`, `services.items.0.title`) stehen in `data/<page>.json`. Dort ist die „Quelle der Wahrheit" für alle Content-Felder.

---

## 🔑 Admin-Panel öffnen

Nach Integration:

```
http://<dein-server>/admin/
```

- **Demo-Passwort:** `miriam2026`
- **Passwort ändern:** `admin/admin.js` Zeile 8 → `const PASSWORD = '...'`

---

## 💡 Wie das Ganze funktioniert

1. Beim Laden einer Seite holt `cms-loader.js` die passende `data/<page>.json`
2. Jedes HTML-Element mit `data-cms="…"` wird mit dem JSON-Wert befüllt
3. Änderungen im Admin-Panel werden in `localStorage` gespeichert und überschreiben die JSON — **sofort live**
4. Export-Button speichert alle Änderungen als `.json` Datei → der Entwickler committed sie in die echten `data/*.json` Dateien

**Production-Pfad:** Admin speichert in localStorage (Demo). Wenn die Kundin zufrieden ist → Export → JSON-Dateien ersetzen → deployen. So werden die Änderungen permanent.

---

## 🔧 Neue Felder hinzufügen

1. Neues Feld in `data/<page>.json` hinzufügen, z.B.
   ```json
   "neuesFeld": "Text hier"
   ```
2. HTML anpassen:
   ```html
   <p data-cms="neuesFeld">Fallback-Text</p>
   ```
3. Fertig — erscheint automatisch im Admin-Panel mit Input-Feld.

## 🔧 Neue Seite hinzufügen

1. `data/meineseite.json` anlegen
2. `<body data-cms-page="meineseite">` setzen
3. In `admin/admin.js` die `PAGES` Konstante (oben, Zeile ~12) erweitern:
   ```js
   { id: 'meineseite', label: 'Meine Seite', icon: 'ph-star',
     preview: '../meineseite.html', section: 'pages' },
   ```

---

## ⚠️ Wichtig

- **localStorage-Limit:** ca. 5-10 MB. Hochgeladene Bilder werden als base64 gespeichert → schnell voll. Für große Bilder lieber URL/Pfad verwenden.
- **Kein Backend = keine Multi-User-Sync:** Änderungen liegen lokal im Browser. Wer woanders reinschaut, sieht sie nicht, bis die JSON-Datei committed ist.
- **Upgrade-Pfad zu echtem CMS:** gleiche JSON-Struktur funktioniert mit Decap CMS (Git-basiert, kostenlos) oder Node-Backend ohne Umbau.

---

## 🗂 Felder-Referenz (wichtigste Pfade)

### site.json (global, wirkt auf alle Seiten)
- `site.brand.logo`, `site.brand.tagline`
- `site.contact.name`, `site.contact.phone`, `site.contact.email`
- `site.social.instagram`, `site.social.facebook`
- `site.footer.copyright`, `site.footer.seo`

### index.json
- `hero.label`, `hero.title`, `hero.subtitle`, `hero.ctaText`
- `challenges.title`, `challenges.problems[]`, `challenges.solutions[]`
- `services.items[]` (4 Cards: `image`, `title`, `text`)
- `steps.items[]` (4 Schritte)
- `about.*`, `about.funFacts[]`
- `testimonials.items[]`
- `faq.items[]` (question + answer)
- `ctaBanner1`, `ctaBanner2`

### leistungen.json
- `hero.*`
- `services[]` (4 Leistungen: `title`, `label`, `paragraph1`, `paragraph2`, `image`)
- `promise.*`

### impressionen.json
- `hero.*`
- `gallery[]` (11 Bilder: `image`, `alt`)
- `credits`, `ctaBanner.*`

### blog.json
- `hero.*`
- `posts[]` (10 Artikel: `link`, `image`, `date`, `title`, `excerpt`)

### kontakt.json
- `hero.*`, `form.*`, `info.*`
