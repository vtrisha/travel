# Travel Tracker

A small, static website for tracking which countries (and territories) and
which US states you've visited — with a clickable world map and a clickable
US states map.

## Features

- Interactive world map (241 countries/territories) and US map (50 states + DC)
- Click a region on the map, or an item in the search list, to toggle it visited
- The country list is grouped by continent and the state list by US Census region, each with a live visited-count badge
- Live stats: count and percentage of places visited
- Search box to quickly find and toggle a place (narrows within each group)
- Data is saved automatically in your browser (`localStorage`)
- Export your data to a JSON file for backup, or to move it to another browser/device
- Import a previously exported JSON file
- Works fully offline — the map libraries and map data are bundled in this repo, no external network calls at runtime
- Light/dark mode, follows your system theme

## Running it locally

Because the map data is loaded with `fetch()`, most browsers won't let you
just double-click `index.html` (the `file://` origin blocks it). Serve the
folder with any local static server instead, for example:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or, if you have Node:

```bash
npx serve .
```

## Deploying with GitHub Pages

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. In the repo settings, go to **Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   pick this branch, and folder `/ (root)`.
4. Save — GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/`.

## Keeping your data around

Your visited places are saved to `localStorage` in whatever browser you use
the site in, so they'll disappear if you clear site data or switch browsers.
To keep a durable copy:

1. Click **Export data** at the bottom of the page — this downloads
   `travel-data.json`.
2. Commit that file into the repo (e.g. as `data/my-travel-data.json`) so it's
   version-controlled.
3. On a new device/browser, click **Import data** and pick that file to
   restore your progress.

## Project structure

```
index.html                     Main page
css/style.css                  Styling
js/app.js                      App logic (rendering, toggling, persistence)
js/vendor/d3.min.js            D3.js (map projections/paths) — MIT licensed
js/vendor/topojson-client.min.js  TopoJSON → GeoJSON conversion — ISC licensed
data/countries-50m.json        World country boundaries (Natural Earth, via world-atlas)
data/us-states-albers-10m.json US state boundaries (US Census, via us-atlas)
data/country-meta.json         Continent + flag emoji per country (from world-countries), used for sidebar grouping
```

The map data comes from the [`world-atlas`](https://github.com/topojson/world-atlas)
and [`us-atlas`](https://github.com/topojson/us-atlas) projects (both ISC
licensed); see the `*.LICENSE` files next to the data for details.

## Customizing

- Colors and layout live in `css/style.css` (CSS variables at the top).
- The world map only includes places present in the underlying Natural Earth
  dataset (241 countries/territories) — some micro-territories may be
  grouped with a larger neighbor.
