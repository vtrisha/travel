(function () {
  "use strict";

  const STORAGE_KEY = "travelTrackerData";

  const state = {
    countries: new Set(),
    states: new Set(),
  };

  function loadStoredData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      (parsed.countries || []).forEach((id) => state.countries.add(String(id)));
      (parsed.states || []).forEach((id) => state.states.add(String(id)));
    } catch (err) {
      console.warn("Could not read saved travel data:", err);
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        countries: Array.from(state.countries),
        states: Array.from(state.states),
      })
    );
    flashSaveNote("Saved");
  }

  let saveNoteTimer;
  function flashSaveNote(text) {
    const note = document.getElementById("save-note");
    note.textContent = text;
    clearTimeout(saveNoteTimer);
    saveNoteTimer = setTimeout(() => (note.textContent = ""), 1800);
  }

  // ---- Tabs ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      const target = btn.dataset.tab;
      document.querySelectorAll(".panel").forEach((p) => {
        p.classList.toggle("active", p.dataset.panel === target);
      });
    });
  });

  // ---- Generic region renderer ----
  function buildRegionMap({
    svgSelector,
    listSelector,
    searchSelector,
    countEl,
    pctEl,
    progressEl,
    dataSet,
    features,
    projection,
    getId,
    getName,
  }) {
    const svg = d3.select(svgSelector);
    const list = document.getElementById(listSelector);
    const search = document.getElementById(searchSelector);
    const tooltip = document.getElementById("tooltip");

    const items = features
      .map((f) => ({ id: getId(f), name: getName(f), feature: f }))
      .sort((a, b) => a.name.localeCompare(b.name));

    function isVisited(id) {
      return dataSet.has(id);
    }

    function toggle(id) {
      if (dataSet.has(id)) {
        dataSet.delete(id);
      } else {
        dataSet.add(id);
      }
      persist();
      refresh();
    }

    function refresh() {
      svg.selectAll("path.region").classed("visited", (d) => isVisited(getId(d)));
      list.querySelectorAll("li").forEach((li) => {
        li.classList.toggle("visited", isVisited(li.dataset.id));
      });
      const total = items.length;
      const visited = items.filter((it) => isVisited(it.id)).length;
      const pct = total ? Math.round((visited / total) * 100) : 0;
      countEl.textContent = `${visited} / ${total}`;
      pctEl.textContent = `${pct}%`;
      progressEl.style.width = `${pct}%`;
    }

    // Draw paths
    svg
      .selectAll("path.region")
      .data(features)
      .enter()
      .append("path")
      .attr("class", "region")
      .attr("d", d3.geoPath(projection))
      .on("click", (event, d) => toggle(getId(d)))
      .on("mousemove", (event, d) => {
        tooltip.hidden = false;
        tooltip.textContent = getName(d);
        tooltip.style.left = event.clientX + 12 + "px";
        tooltip.style.top = event.clientY + 12 + "px";
      })
      .on("mouseleave", () => {
        tooltip.hidden = true;
      })
      .append("title")
      .text((d) => getName(d));

    // Build list
    const frag = document.createDocumentFragment();
    items.forEach((it) => {
      const li = document.createElement("li");
      li.dataset.id = it.id;
      li.innerHTML = `<span class="dot"></span><span>${it.name}</span>`;
      li.addEventListener("click", () => toggle(it.id));
      frag.appendChild(li);
    });
    list.appendChild(frag);

    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll("li").forEach((li) => {
        const name = li.textContent.toLowerCase();
        li.classList.toggle("hidden", q.length > 0 && !name.includes(q));
      });
    });

    refresh();
    return { refresh, items };
  }

  const controllers = {};

  function initWorldMap(topology) {
    const geo = topojson.feature(topology, topology.objects.countries);
    const projection = d3.geoNaturalEarth1().fitSize([960, 500], geo);

    controllers.world = buildRegionMap({
      svgSelector: "#world-map",
      listSelector: "world-list",
      searchSelector: "world-search",
      countEl: document.getElementById("world-count"),
      pctEl: document.getElementById("world-pct"),
      progressEl: document.getElementById("world-progress"),
      dataSet: state.countries,
      features: geo.features,
      projection,
      getId: (d) => String(d.id),
      getName: (d) => d.properties.name,
    });
  }

  function initUsaMap(topology) {
    const geo = topojson.feature(topology, topology.objects.states);
    const projection = d3.geoIdentity().fitSize([960, 600], geo);

    controllers.usa = buildRegionMap({
      svgSelector: "#usa-map",
      listSelector: "usa-list",
      searchSelector: "usa-search",
      countEl: document.getElementById("usa-count"),
      pctEl: document.getElementById("usa-pct"),
      progressEl: document.getElementById("usa-progress"),
      dataSet: state.states,
      features: geo.features,
      projection,
      getId: (d) => String(d.id),
      getName: (d) => d.properties.name,
    });
  }

  // ---- Export / Import / Reset ----
  document.getElementById("export-btn").addEventListener("click", () => {
    const worldNames = controllers.world
      ? controllers.world.items.filter((it) => state.countries.has(it.id)).map((it) => it.name)
      : [];
    const usaNames = controllers.usa
      ? controllers.usa.items.filter((it) => state.states.has(it.id)).map((it) => it.name)
      : [];

    const payload = {
      countries: Array.from(state.countries),
      states: Array.from(state.states),
      countryNames: worldNames,
      stateNames: usaNames,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "travel-data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state.countries = new Set((parsed.countries || []).map(String));
        state.states = new Set((parsed.states || []).map(String));
        persist();
        if (controllers.world) controllers.world.refresh();
        if (controllers.usa) controllers.usa.refresh();
        flashSaveNote("Imported");
      } catch (err) {
        alert("Could not read that file as travel-tracker JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (!confirm("Clear all visited countries and states?")) return;
    state.countries.clear();
    state.states.clear();
    persist();
    if (controllers.world) controllers.world.refresh();
    if (controllers.usa) controllers.usa.refresh();
  });

  // ---- Boot ----
  loadStoredData();

  Promise.all([
    fetch("data/countries-50m.json").then((r) => r.json()),
    fetch("data/us-states-albers-10m.json").then((r) => r.json()),
  ])
    .then(([worldTopo, usaTopo]) => {
      initWorldMap(worldTopo);
      initUsaMap(usaTopo);
    })
    .catch((err) => {
      console.error("Failed to load map data:", err);
      document.querySelectorAll(".map-wrap").forEach((el) => {
        el.innerHTML =
          '<p style="color:#c0392b">Could not load map data. If you opened this file directly, serve it from a local web server instead (see README).</p>';
      });
    });
})();
