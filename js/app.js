(function () {
  "use strict";

  const STORAGE_KEY = "travelTrackerData";

  const state = {
    countries: new Set(), // visited
    plannedCountries: new Set(),
    states: new Set(), // visited
    plannedStates: new Set(),
  };

  function loadStoredData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      (parsed.countries || []).forEach((id) => state.countries.add(String(id)));
      (parsed.plannedCountries || []).forEach((id) => state.plannedCountries.add(String(id)));
      (parsed.states || []).forEach((id) => state.states.add(String(id)));
      (parsed.plannedStates || []).forEach((id) => state.plannedStates.add(String(id)));
    } catch (err) {
      console.warn("Could not read saved travel data:", err);
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        countries: Array.from(state.countries),
        plannedCountries: Array.from(state.plannedCountries),
        states: Array.from(state.states),
        plannedStates: Array.from(state.plannedStates),
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
  // Each region cycles through three states on click: none -> visited -> planned -> none.
  function buildRegionMap({
    svgSelector,
    listSelector,
    searchSelector,
    countEl,
    plannedCountEl,
    pctEl,
    progressVisitedEl,
    progressPlannedEl,
    visitedSet,
    plannedSet,
    features,
    projection,
    getId,
    getName,
    getGroup,
    getFlag,
    groupOrder,
    zoomControls,
  }) {
    const svg = d3.select(svgSelector);
    const list = document.getElementById(listSelector);
    const search = document.getElementById(searchSelector);
    const tooltip = document.getElementById("tooltip");
    const mapG = svg.append("g").attr("class", "map-g");

    const items = features
      .map((f) => ({
        id: getId(f),
        name: getName(f),
        group: getGroup ? getGroup(f) : null,
        flag: getFlag ? getFlag(f) : "",
        feature: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const groups = groupOrder || Array.from(new Set(items.map((it) => it.group))).sort();

    function statusOf(id) {
      if (visitedSet.has(id)) return "visited";
      if (plannedSet.has(id)) return "planned";
      return "none";
    }

    function cycle(id) {
      const status = statusOf(id);
      if (status === "none") {
        visitedSet.add(id);
      } else if (status === "visited") {
        visitedSet.delete(id);
        plannedSet.add(id);
      } else {
        plannedSet.delete(id);
      }
      persist();
      refresh();
    }

    function refresh() {
      svg.selectAll("path.region").each(function (d) {
        const status = statusOf(getId(d));
        d3.select(this).classed("visited", status === "visited").classed("planned", status === "planned");
      });
      list.querySelectorAll("li.place").forEach((li) => {
        const status = statusOf(li.dataset.id);
        li.classList.toggle("visited", status === "visited");
        li.classList.toggle("planned", status === "planned");
      });
      list.querySelectorAll("li.group-header").forEach((li) => {
        const groupItems = items.filter((it) => it.group === li.dataset.group);
        const visitedInGroup = groupItems.filter((it) => statusOf(it.id) === "visited").length;
        li.querySelector(".group-count").textContent = `${visitedInGroup}/${groupItems.length}`;
      });

      const total = items.length;
      const visited = items.filter((it) => statusOf(it.id) === "visited").length;
      const planned = items.filter((it) => statusOf(it.id) === "planned").length;
      const pct = total ? Math.round((visited / total) * 100) : 0;
      countEl.textContent = `${visited} / ${total}`;
      plannedCountEl.textContent = String(planned);
      pctEl.textContent = `${pct}%`;
      progressVisitedEl.style.width = `${total ? (visited / total) * 100 : 0}%`;
      progressPlannedEl.style.width = `${total ? (planned / total) * 100 : 0}%`;
    }

    // Draw paths
    mapG
      .selectAll("path.region")
      .data(features)
      .enter()
      .append("path")
      .attr("class", "region")
      .attr("d", d3.geoPath(projection))
      .on("click", (event, d) => cycle(getId(d)))
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

    // Zoom / pan
    const zoom = d3
      .zoom()
      .scaleExtent([1, 10])
      .on("zoom", (event) => {
        mapG.attr("transform", event.transform);
      });
    svg.call(zoom).on("dblclick.zoom", null);

    if (zoomControls) {
      const zoomBy = (factor) => svg.transition().duration(200).call(zoom.scaleBy, factor);
      zoomControls.querySelector('[data-zoom-action="in"]').addEventListener("click", () => zoomBy(1.5));
      zoomControls.querySelector('[data-zoom-action="out"]').addEventListener("click", () => zoomBy(1 / 1.5));
      zoomControls.querySelector('[data-zoom-action="reset"]').addEventListener("click", () => {
        svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
      });
    }

    // Build list, grouped
    const frag = document.createDocumentFragment();
    groups.forEach((groupName) => {
      const groupItems = items.filter((it) => it.group === groupName);
      if (!groupItems.length) return;

      const header = document.createElement("li");
      header.className = "group-header";
      header.dataset.group = groupName;
      header.innerHTML = `<span>${groupName}</span><span class="group-count">0/${groupItems.length}</span>`;
      frag.appendChild(header);

      groupItems.forEach((it) => {
        const li = document.createElement("li");
        li.className = "place";
        li.dataset.id = it.id;
        li.innerHTML = it.flag
          ? `<span class="flag">${it.flag}</span><span class="place-name">${it.name}</span>`
          : `<span class="dot"></span><span class="place-name">${it.name}</span>`;
        li.addEventListener("click", () => cycle(it.id));
        frag.appendChild(li);
      });
    });
    list.appendChild(frag);

    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll("li.place").forEach((li) => {
        const name = li.querySelector(".place-name").textContent.toLowerCase();
        li.classList.toggle("hidden", q.length > 0 && !name.includes(q));
      });
      list.querySelectorAll("li.group-header").forEach((header) => {
        let sibling = header.nextElementSibling;
        let groupHasVisible = false;
        while (sibling && sibling.classList.contains("place")) {
          if (!sibling.classList.contains("hidden")) groupHasVisible = true;
          sibling = sibling.nextElementSibling;
        }
        header.classList.toggle("hidden", !groupHasVisible);
      });
    });

    refresh();
    return { refresh, items, statusOf };
  }

  const controllers = {};

  const CONTINENT_ORDER = [
    "Africa",
    "Antarctica",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
  ];

  const US_REGIONS = {
    Alabama: "South",
    Alaska: "West",
    Arizona: "West",
    Arkansas: "South",
    California: "West",
    Colorado: "West",
    Connecticut: "Northeast",
    Delaware: "South",
    "District of Columbia": "South",
    Florida: "South",
    Georgia: "South",
    Hawaii: "West",
    Idaho: "West",
    Illinois: "Midwest",
    Indiana: "Midwest",
    Iowa: "Midwest",
    Kansas: "Midwest",
    Kentucky: "South",
    Louisiana: "South",
    Maine: "Northeast",
    Maryland: "South",
    Massachusetts: "Northeast",
    Michigan: "Midwest",
    Minnesota: "Midwest",
    Mississippi: "South",
    Missouri: "Midwest",
    Montana: "West",
    Nebraska: "Midwest",
    Nevada: "West",
    "New Hampshire": "Northeast",
    "New Jersey": "Northeast",
    "New Mexico": "West",
    "New York": "Northeast",
    "North Carolina": "South",
    "North Dakota": "Midwest",
    Ohio: "Midwest",
    Oklahoma: "South",
    Oregon: "West",
    Pennsylvania: "Northeast",
    "Rhode Island": "Northeast",
    "South Carolina": "South",
    "South Dakota": "Midwest",
    Tennessee: "South",
    Texas: "South",
    Utah: "West",
    Vermont: "Northeast",
    Virginia: "South",
    Washington: "West",
    "West Virginia": "South",
    Wisconsin: "Midwest",
    Wyoming: "West",
  };
  const US_REGION_ORDER = ["Northeast", "Midwest", "South", "West"];

  function initWorldMap(topology, countryMeta) {
    const geo = topojson.feature(topology, topology.objects.countries);
    const projection = d3.geoNaturalEarth1().fitSize([960, 500], geo);
    const getId = (d) => (d.id != null ? String(d.id) : d.properties.name);

    controllers.world = buildRegionMap({
      svgSelector: "#world-map",
      listSelector: "world-list",
      searchSelector: "world-search",
      countEl: document.getElementById("world-count"),
      plannedCountEl: document.getElementById("world-planned-count"),
      pctEl: document.getElementById("world-pct"),
      progressVisitedEl: document.getElementById("world-progress"),
      progressPlannedEl: document.getElementById("world-progress-planned"),
      visitedSet: state.countries,
      plannedSet: state.plannedCountries,
      features: geo.features,
      projection,
      getId,
      getName: (d) => d.properties.name,
      getGroup: (d) => (countryMeta[getId(d)] || {}).continent || "Other",
      getFlag: (d) => (countryMeta[getId(d)] || {}).flag || "",
      groupOrder: CONTINENT_ORDER,
      zoomControls: document.querySelector("#panel-world .zoom-controls"),
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
      plannedCountEl: document.getElementById("usa-planned-count"),
      pctEl: document.getElementById("usa-pct"),
      progressVisitedEl: document.getElementById("usa-progress"),
      progressPlannedEl: document.getElementById("usa-progress-planned"),
      visitedSet: state.states,
      plannedSet: state.plannedStates,
      features: geo.features,
      projection,
      getId: (d) => String(d.id),
      getName: (d) => d.properties.name,
      getGroup: (d) => US_REGIONS[d.properties.name] || "Other",
      groupOrder: US_REGION_ORDER,
      zoomControls: document.querySelector("#panel-usa .zoom-controls"),
    });
  }

  // ---- Export / Import / Reset ----
  document.getElementById("export-btn").addEventListener("click", () => {
    const namesOf = (controller, set) =>
      controller ? controller.items.filter((it) => set.has(it.id)).map((it) => it.name) : [];

    const payload = {
      countries: Array.from(state.countries),
      plannedCountries: Array.from(state.plannedCountries),
      states: Array.from(state.states),
      plannedStates: Array.from(state.plannedStates),
      countryNames: namesOf(controllers.world, state.countries),
      plannedCountryNames: namesOf(controllers.world, state.plannedCountries),
      stateNames: namesOf(controllers.usa, state.states),
      plannedStateNames: namesOf(controllers.usa, state.plannedStates),
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
        state.plannedCountries = new Set((parsed.plannedCountries || []).map(String));
        state.states = new Set((parsed.states || []).map(String));
        state.plannedStates = new Set((parsed.plannedStates || []).map(String));
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
    if (!confirm("Clear all visited and planned countries and states?")) return;
    state.countries.clear();
    state.plannedCountries.clear();
    state.states.clear();
    state.plannedStates.clear();
    persist();
    if (controllers.world) controllers.world.refresh();
    if (controllers.usa) controllers.usa.refresh();
  });

  // ---- Boot ----
  loadStoredData();

  Promise.all([
    fetch("data/countries-50m.json").then((r) => r.json()),
    fetch("data/us-states-albers-10m.json").then((r) => r.json()),
    fetch("data/country-meta.json").then((r) => r.json()),
  ])
    .then(([worldTopo, usaTopo, countryMeta]) => {
      initWorldMap(worldTopo, countryMeta);
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
