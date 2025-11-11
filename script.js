// --- image size in pixels (match your Photoshop export) ---
const mapWidth = 2835;
const mapHeight = 2835;

// bounds for Leaflet's pixel-based coordinates (CRS.Simple uses [y, x])
const bounds = [[0, 0], [mapHeight, mapWidth]];

// create the map
const map = L.map('map', {
  crs: L.CRS.Simple,
  maxZoom: 2,
  zoomControl: true,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0,
  tapTolerance: 18
});
window.map = map;

// add your background
L.imageOverlay('images/aegir-sector.png', bounds).addTo(map);
map.setMaxBounds(bounds);
const fitZoom = map.getBoundsZoom(bounds, true);
const minZoom = Math.max(fitZoom - 2, -5);
const initialZoom = minZoom;
map.setMinZoom(minZoom);
map.setView([mapHeight / 2, mapWidth / 2], initialZoom, { animate: false });

const ensureMapSize = () => map.invalidateSize();
const scheduleMapResize = (delay = 0) => window.setTimeout(ensureMapSize, delay);

map.whenReady(() => {
  scheduleMapResize(0);
  scheduleMapResize(250);
});
window.addEventListener('load', () => scheduleMapResize(150));
window.addEventListener('resize', () => scheduleMapResize(100));
window.addEventListener('orientationchange', () => scheduleMapResize(300));

// ---------- global registries ----------
const SYS = {};                               // systems by unique id
const laneLayer  = L.layerGroup().addTo(map); // hyperlanes
const labelLayer = L.layerGroup().addTo(map); // permanent labels

const DOT_RADIUS_PX = 5.5;       // increase click/tap target for system dots
const DOT_STROKE_WEIGHT = 1.1;
window.SYS = SYS;

// ---------- system detail modal wiring ----------
const modalEl = document.getElementById('system-modal');
const modalBackdropEl = modalEl ? modalEl.querySelector('.system-modal-backdrop') : null;
const modalCardEl = modalEl ? modalEl.querySelector('.system-modal-card') : null;
const modalCloseBtn = document.getElementById('system-modal-close');
const modalTitleEl = document.getElementById('system-modal-title');
const modalFactionEl = document.getElementById('system-modal-faction');
const modalMediaEl = modalEl ? modalEl.querySelector('.system-modal-media') : null;
const modalImageEl = document.getElementById('system-modal-image');
const modalImageFallbackEl = document.getElementById('system-modal-image-fallback');
const modalBodyEl = document.getElementById('system-modal-body');

let activeModalSystem = null;

function closeSystemModal() {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  modalEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  activeModalSystem = null;
}

function openSystemModal(uid) {
  if (!modalEl) return;
  const s = SYS[uid];
  if (!s) return;

  activeModalSystem = uid;
  modalTitleEl.textContent = s.name;

  if (s.faction) {
    modalFactionEl.textContent = s.faction;
    modalFactionEl.style.display = '';
  } else {
    modalFactionEl.textContent = '';
    modalFactionEl.style.display = 'none';
  }

  const imageSrc = s.imageLarge || s.image || null;
  if (modalMediaEl) {
    modalMediaEl.classList.remove('has-image', 'no-image');
    modalMediaEl.classList.add(imageSrc ? 'has-image' : 'no-image');
  }

  if (imageSrc && modalImageEl) {
    modalImageEl.src = imageSrc;
    modalImageEl.alt = `${s.name} system visualization`;
  } else if (modalImageEl) {
    modalImageEl.removeAttribute('src');
    modalImageEl.alt = '';
  }

  if (modalImageFallbackEl && !imageSrc) {
    modalImageFallbackEl.textContent = 'No image available yet.';
  }

  if (modalBodyEl) {
    const bodyFragments = [];
    if (s.tagline) {
      bodyFragments.push(`<div class="system-modal-tagline">${s.tagline}</div>`);
    } else {
      bodyFragments.push('<div class="system-modal-placeholder">No additional intel available yet.</div>');
    }
    if (typeof s.xPct === 'number' && typeof s.yPct === 'number') {
      bodyFragments.push(
        `<div class="system-modal-coords">Coordinates: ${s.xPct.toFixed(2)}% · ${s.yPct.toFixed(2)}%</div>`
      );
    }
    modalBodyEl.innerHTML = bodyFragments.join('');
  }

  modalEl.classList.add('active');
  modalEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  if (modalCloseBtn) {
    setTimeout(() => modalCloseBtn.focus(), 0);
  }
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeSystemModal);
if (modalBackdropEl) modalBackdropEl.addEventListener('click', closeSystemModal);
if (modalEl) {
  modalEl.addEventListener('click', evt => {
    if (evt.target === modalEl) closeSystemModal();
  });
}
if (modalCardEl) {
  modalCardEl.addEventListener('click', evt => evt.stopPropagation());
}
document.addEventListener('keydown', evt => {
  if (evt.key === 'Escape' && modalEl && modalEl.classList.contains('active')) {
    closeSystemModal();
  }
});

// ---------- helpers ----------
function pctToPx(xPct, yPct) {
  const xPx = (xPct / 100) * mapWidth;
  const yPx = (1 - yPct / 100) * mapHeight; // flip Y so north is up
  return [xPx, yPx];
}
function makeId(name, fallback) {
  return (fallback || name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function addLabel(uid) {
  const s = SYS[uid];
  if (!s) return;
  const tt = L.tooltip({
    permanent: true,
    direction: 'top',
    offset: [0, -10],
    opacity: 1,
    className: 'sys-label'
  }).setLatLng(s.latlng).setContent(s.name);
  tt.addTo(labelLayer);
}
function setLabelsVisible(flag) {
  labelLayer.clearLayers();
  if (flag) Object.keys(SYS).forEach(addLabel);
}
function setHyperlanesVisible(flag) {
  if (flag) laneLayer.addTo(map); else map.removeLayer(laneLayer);
}
function focusSystemByNameFragment(frag) {
  const entries = Object.values(SYS);
  const hit = entries.find(s => s.name.toLowerCase().includes(String(frag).toLowerCase()));
  if (!hit) return alert('Not found.');
  map.setView(hit.latlng, map.getZoom() + 1);
  const blink = L.circleMarker(hit.latlng, { radius: 6, color: '#fff', weight: 2, fillOpacity: 0 }).addTo(map);
  setTimeout(() => blink.remove(), 800);
}

function updateSystemPopup(uid, html) {
  const s = SYS[uid];
  if (!s || !s.marker) return;
  s.popupHtml = html;
  s.marker.bindPopup(html);
}

// DOT marker (for planets) with optional image in popup
function addSystemDotPct(name, xPct, yPct, color = "#e5e7eb", imageUrl = null, id = null, faction = null) {
  const uid = makeId(name, id);
  const [xPx, yPx] = pctToPx(xPct, yPct);
  const latlng = [yPx, xPx];

  const overrideImage = SYSTEM_IMAGE_OVERRIDES[uid];
  const finalImage = overrideImage || imageUrl;

  const marker = L.circleMarker(latlng, {
    radius: DOT_RADIUS_PX,
    weight: DOT_STROKE_WEIGHT,
    color,
    fillColor: color,
    fillOpacity: 0.9,
  });

  let html = `<b>${name}</b>`;
  if (faction) html += `<div style="font-size:12px;color:#9aa7c1">Faction: ${faction}</div>`;
  if (finalImage) html += `<br/><img src="${finalImage}" width="220" style="margin-top:6px;border-radius:8px;">`;

  marker
    .bindTooltip(name, { direction: "top", offset: [0, -8] })
    .bindPopup(html)
    .addTo(map);

  const record = {
    id: uid,
    name,
    faction,
    latlng,
    xPct,
    yPct,
    xPx,
    yPx,
    color,
    image: finalImage || null,
    imageLarge: overrideImage || finalImage || null,
    marker,
    popupHtml: html,
    tagline: null,
  };

  SYS[uid] = record;

  if (modalEl) {
    marker.on('popupopen', () => {
      openSystemModal(uid);
      marker.closePopup();
    });
  }

  return uid;
}

// ICON marker (for factions/capitals) + optional large image in popup
function addSystemIconPct(name, xPct, yPct, iconUrl, size = 36, popupImageUrl = null, id = null, faction = null) {
  const uid = makeId(name, id);
  const [xPx, yPx] = pctToPx(xPct, yPct);
  const latlng = [yPx, xPx];

  const hasIcon = Boolean(iconUrl);
  const resolvedIconUrl = hasIcon ? iconUrl : null;
  const icon = resolvedIconUrl
    ? L.icon({
        iconUrl: resolvedIconUrl,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: "system-icon"
      })
    : new L.Icon.Default();

  const overrideImage = SYSTEM_IMAGE_OVERRIDES[uid];
  const finalImage = overrideImage || popupImageUrl || resolvedIconUrl || null;
  const html = `<b>${name}</b>`
    + (faction ? `<div style="font-size:12px;color:#9aa7c1">Faction: ${faction}</div>` : "")
    + (finalImage ? `<br/><img src="${finalImage}" width="${Math.round(size * 2.5)}" style="margin-top:6px;border-radius:8px;">` : "");

  const marker = L.marker(latlng, { icon })
    .bindTooltip(name, { direction: "top", offset: [0, -8] })
    .bindPopup(html)
    .addTo(map);

  SYS[uid] = {
    id: uid,
    name,
    faction,
    latlng,
    xPct,
    yPct,
    xPx,
    yPx,
    icon: resolvedIconUrl,
    image: finalImage,
    imageLarge: overrideImage || finalImage,
    marker,
    popupHtml: html,
    tagline: null,
  };

  if (modalEl) {
    marker.on('popupopen', () => {
      openSystemModal(uid);
      marker.closePopup();
    });
  }

  return uid;
}

// ---- hyperlane helper ----
function addLaneByIds(aId, bId, color = "#9bd3ff") {
  const A = SYS[aId], B = SYS[bId];
  if (!A || !B) {
    console.warn("Lane skipped (unknown id):", aId, bId);
    return;
  }
  L.polyline([A.latlng, B.latlng], { color, weight: 1.2, opacity: 0.85 }).addTo(laneLayer);
  const node = { radius: 1.8, weight: 0, fillOpacity: 1, color, fillColor: color };
  L.circleMarker(A.latlng, node).addTo(laneLayer);
  L.circleMarker(B.latlng, node).addTo(laneLayer);
}

// --- decorate an existing system with a small overlay icon + new popup + optional color ---
function tagSystem(uid, { iconUrl, popupText, dotColor = null, iconSize = 20 }) {
  const s = SYS[uid];
  if (!s || !s.marker) return console.warn("tagSystem: missing", uid);

  // recolor the circle marker if requested
  if (dotColor && s.marker.setStyle) {
    s.marker.setStyle({ color: dotColor, fillColor: dotColor });
    s.color = dotColor;
  }

  // popup content (title + subtitle line)
  const html = `<b>${s.name}</b><div style="margin-top:4px;color:#ffddaa">${popupText}</div>`;
  s.tagline = popupText;
  updateSystemPopup(uid, html);

  // tiny badge icon centered on the dot (non-interactive)
  const icon = L.icon({
    iconUrl,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    className: "system-icon"
  });

  if (s.badge) map.removeLayer(s.badge);
  s.badge = L.marker(s.latlng, { icon, interactive: false }).addTo(map);
}

// ---------- colors ----------
const C = {
  BASE: "#60a5fa",
  YAMATO: "#f9a8d4",
  NOVA: "#8b5cf6",
  CRIMSON: "#ef4444",
  ORION: "#7dd3fc",
  EAGLE: "#84cc16",
  FED: "#60a5fa",
  DOMINION: "#a855f7",
  NEUTRAL: "#e5e7eb"
};

// ---------- local emblem icon paths ----------
const ICONS = {
  AEGIR:     "images/icons/AEGIR.png",
  YAMATO:    "images/icons/YAMATO.png",
  NOVA:      "images/icons/nova.png",
  CRIMSON:   "images/icons/CRIMSON.png",
  ORION:     "images/icons/Orion.png",
  EAGLE:     "images/icons/Eagle rep.png"
};
// add these two files to your /images/icons/ folder:
ICONS.FED      = "images/icons/Federation.png";
ICONS.DOMINION = "images/icons/Dominion.png";

// ---------- EXTRA RESOURCE ICONS ----------
ICONS.PIRATES = "images/icons/Pirates.png"; // ensure these files exist
ICONS.AFM     = "images/icons/AFM.png";
ICONS.GGP     = "images/icons/GGP.png";

// ---------- local star system artwork overrides ----------
const SYSTEM_IMAGE_OVERRIDES = {
  aegir_outpost: "Star Systems/Solara -Ys.jpg",
  thalyron: "Star Systems/Thalyron.jpg",
  serothis_nova: "Star Systems/Serothis.jpg",
  aelyth_prime: "Star Systems/Aelyth Prime.jpg",
  anvyr: "Star Systems/Anvyr.png",
  ax: "Star Systems/Ax.png",
  caoh: "Star Systems/Caoh.png",
  ceythros: "Star Systems/Ceythros.png",
  cynar: "Star Systems/Cynar.png",
  eryndor: "Star Systems/Eryndor.png",
  fido: "Star Systems/Fido.jpg",
  orpheas: "Star Systems/Orpheas.jpg",
  veyra_null: "Star Systems/Veyra Null.jpg",
  netra: "Star Systems/Netra.jpg",
  alctor: "Star Systems/Alctor.jpg",
  aliti: "Star Systems/Aliti.jpg",
  egos_v: "Star Systems/Egos V.png",
  irri: "Star Systems/Irri.png",
  phaex: "Star Systems/Phaex.jpg",
  phosyr: "Star Systems/Phosyr.jpg",
  veil_orion: "Star Systems/Veil.jpg",
  akrion_eagle: "Star Systems/Akrion.jpg",
  ormun: "Star Systems/Ormun.jpg",
  kharon_capital: "Star Systems/Kharon.png",
  joris: "Star Systems/Joris.png",
  kentauros: "Star Systems/Kentauros.png",
  korneth: "Star Systems/Korneth.jpg",
  mikro: "Star Systems/Mikro.png",
  moki: "Star Systems/Moki.png",
  nyren: "Star Systems/Nyren.jpg",
  nytheris: "Star Systems/Nytheris.png",
  okoro: "Star Systems/Okoro.png",
  oryx: "Star Systems/Oryx.png",
  oraethos: "Star Systems/Oraethos.jpg",
  ozyrane: "Star Systems/Ozyrane.png",
  pyr: "Star Systems/Pyr.png",
  serothis_core: "Star Systems/Serohis.png",
  seren: "Star Systems/Seren.jpg",
  shathros: "Star Systems/Shathros.jpg",
  defok: "Star Systems/Defok.jpg",
  polirsh: "Star Systems/Polirsh.jpg",
  taireb: "Star Systems/Taireb.png",
  threnos: "Star Systems/Threnos.png",
  drelith: "Star Systems/Drelith.jpg",
  vayth: "Star Systems/Vayth.png",
  haron: "Star Systems/Haron.jpg",
  vazour: "Star Systems/Vazour.png",
  pone_v: "Star Systems/Pone V.jpg",
  tavro_v: "Star Systems/Tavro V.jpg",
  olk_prime: "Star Systems/Olk Prime.jpg",
  arrakan: "Star Systems/Arrakan.jpg",
  kho: "Star Systems/Kho.jpg",
  voruthen: "Star Systems/Voruthen.png",
  zhaen: "Star Systems/Zhaen.png",
};

// ---------- EXISTING FACTION EMBLEMS ----------
const aegir_outpost   = addSystemIconPct("Aegir Outpost",                 68.58, 75.46, ICONS.AEGIR,   40, null, "aegir_outpost", "AEGIR");
const thalyron        = addSystemIconPct("Thalyron — Yamato Syndicate",   67.08, 82.97, ICONS.YAMATO,  36, null, "thalyron", "Yamato Syndicate");
const serothis_nova   = addSystemIconPct("Serothis — Nova Confederation", 81.11, 92.58, ICONS.NOVA,    36, null, "serothis_nova", "Nova Confederation");
const ormun_crimson = addSystemIconPct("Ormun — Crimson Collective Capital",  50.84, 90.73, ICONS.CRIMSON, 36, null, "ormun", "Crimson Collective");
const veil_orion      = addSystemIconPct("Veil — Orion Industries",       47.48, 81.72, ICONS.ORION,   36, null, "veil_orion", "Orion Industries");
const akrion_eagle    = addSystemIconPct(
  "Akrion — Eagle Republic",
  22.80,
  86.64,
  ICONS.EAGLE,
  36,
  "https://i.imgur.com/mAtJMgC.jpeg",
  "akrion_eagle",
  "Eagle Republic"
);

// ---------- CAPITAL ICON MARKERS ----------
const eryndor = addSystemIconPct(
  "Eryndor — Federation Capital",
  40.08, 55.81,
  ICONS.FED,
  40,
  null,
  "eryndor",
  "Federation"
);

const kharon_cap = addSystemIconPct(
  "Kharon — Dominion Capital",
  89.70, 63.46,
  ICONS.DOMINION,
  40,
  null,
  "kharon_capital",
  "Dominion"
);

// ---------- EARLIER DOTS ----------
const calisa      = addSystemDotPct("Calisa",      44.98, 65.60, C.NEUTRAL, "https://i.imgur.com/cMnHiUs.png", "calisa");
const kaldur      = addSystemDotPct("Kaldur",      33.74, 68.15, C.NEUTRAL, "https://i.imgur.com/RL66SJO.png", "kaldur");
const razathaar   = addSystemDotPct("Razathaar",   55.59, 73.33, C.NEUTRAL, "https://i.imgur.com/DTxUwRY.png", "razathaar");
const veyra_null  = addSystemDotPct("Veyra-Null",  66.43, 73.91, C.NEUTRAL, null, "veyra_null");
const haron       = addSystemDotPct("Haron",        68.97, 81.81, C.NEUTRAL, null, "haron");
const orpheas     = addSystemDotPct("Orpheas",     70.45, 77.09, C.NEUTRAL, null, "orpheas");

// NEW DOTS (previous batch)
const pone_v   = addSystemDotPct("Pone V", 67.20, 77.66, C.NEUTRAL, null, "pone_v");
const ozyrane  = addSystemDotPct("Ozyrane", 67.14, 80.64, C.NEUTRAL, null, "ozyrane");
const aelyth   = addSystemDotPct("Aelyth Prime", 71.13, 74.33, C.NEUTRAL, null, "aelyth_prime");
const nytheris = addSystemDotPct("Nytheris", 69.28, 83.59, C.NEUTRAL, null, "nytheris");
const tavro_v  = addSystemDotPct("Tavro V", 80.82, 88.36, C.NEUTRAL, null, "tavro_v");
const voruthen = addSystemDotPct("Voruthen", 84.78, 91.76, C.NEUTRAL, null, "voruthen");
const kho      = addSystemDotPct("Kho", 76.59, 90.10, C.NEUTRAL, null, "kho");
const sgd      = addSystemDotPct("Sgd", 77.13, 93.06, C.NEUTRAL, null, "sgd");
const nyren    = addSystemDotPct("Nyren", 63.44, 79.90, C.NEUTRAL, null, "nyren");
const vexar    = addSystemDotPct("Vexar", 62.55, 83.57, C.NEUTRAL, null, "vexar");
const cynar    = addSystemDotPct("Cynar", 46.67, 79.08, C.ORION, null, "cynar", "Orion Industries");
const serohis  = addSystemDotPct("Serohis", 48.97, 79.43, C.NEUTRAL, null, "serothis_core");
const korneth  = addSystemDotPct("Korneth", 50.83, 83.88, C.ORION, null, "korneth", "Orion Industries");
const seren    = addSystemDotPct("Seren", 43.27, 82.36, C.NEUTRAL, null, "seren");
const vayth    = addSystemDotPct("Vayth", 53.46, 89.65, C.NEUTRAL, null, "vayth");
const drelith  = addSystemDotPct("Drelith", 52.00, 92.71, C.NEUTRAL, null, "drelith", "Crimson Collective");
const zhaen    = addSystemDotPct("Zhaen", 53.80, 92.00, C.NEUTRAL, null, "zhaen");
const olk      = addSystemDotPct("Olk Prime", 56.93, 94.04, C.NEUTRAL, null, "olk_prime");
const col      = addSystemDotPct("Col", 55.73, 96.94, C.NEUTRAL, null, "col");
const oryx     = addSystemDotPct("Oryx", 46.57, 90.95, C.NEUTRAL, null, "oryx");
const aliti    = addSystemDotPct("Aliti", 46.50, 92.35, C.NEUTRAL, null, "aliti");
const joris    = addSystemDotPct("Joris", 41.88, 84.04, C.NEUTRAL, null, "joris");
const okoro    = addSystemDotPct("Okoro", 24.50, 84.45, C.NEUTRAL, null, "okoro");
const taireb   = addSystemDotPct("Taireb", 25.98, 84.95, C.NEUTRAL, null, "taireb");
const pyr      = addSystemDotPct("Pyr", 24.08, 82.16, C.NEUTRAL, null, "pyr");
const ax       = addSystemDotPct("Ax", 24.42, 81.21, C.NEUTRAL, null, "ax");
const ceythros = addSystemDotPct("Ceythros", 24.10, 88.76, C.NEUTRAL, null, "ceythros");
const kentauros= addSystemDotPct("Kentauros", 20.07, 86.74, C.NEUTRAL, null, "kentauros");
const arrakan  = addSystemDotPct("Arrakan", 17.57, 88.87, C.NEUTRAL, null, "arrakan");
const trata    = addSystemDotPct("Trata", 15.03, 90.48, C.NEUTRAL, null, "trata");
const jola     = addSystemDotPct("Jola", 14.91, 85.30, C.NEUTRAL, null, "jola");
const panag    = addSystemDotPct("Panag", 14.32, 79.76, C.NEUTRAL, null, "panag");
const koki     = addSystemDotPct("Koki Prime", 16.21, 78.35, C.NEUTRAL, null, "koki_prime");
const phaex    = addSystemDotPct("Phaex", 77.87, 75.25, C.NEUTRAL, null, "phaex");
const ho_nass  = addSystemDotPct("Ho Nass", 76.66, 72.00, C.NEUTRAL, null, "ho_nass");
const alctor   = addSystemDotPct("Alctor", 76.56, 70.42, C.NEUTRAL, null, "alctor");
const netra    = addSystemDotPct("Netra", 73.10, 70.55, C.NEUTRAL, null, "netra");
const egos_v   = addSystemDotPct("Egos V", 79.02, 70.16, C.NEUTRAL, null, "egos_v");
const mikro    = addSystemDotPct("Mikro", 61.45, 75.76, C.NEUTRAL, null, "mikro");
const toko     = addSystemDotPct("Toko", 60.37, 77.03, C.NEUTRAL, null, "toko");
const dofo     = addSystemDotPct("Dofo", 58.96, 74.47, C.NEUTRAL, null, "dofo");
const volur    = addSystemDotPct("Volur", 57.50, 77.86, C.NEUTRAL, null, "volur");

// ---------- BRAND-NEW DOTS FROM YOUR LIST ----------
const unnamed_5_39 = addSystemDotPct("Unnamed-5_39", 5.39, 99.56, C.NEUTRAL, null, "unnamed_5_39");

const zofos_prime = addSystemDotPct("Zofos Prime", 5.32, 99.56, C.NEUTRAL, null, "zofos_prime");
const actim       = addSystemDotPct("Actim", 2.83, 91.69, C.NEUTRAL, null, "actim");
const simon       = addSystemDotPct("Simon", 7.47, 91.50, C.NEUTRAL, null, "simon");
const trata2      = addSystemDotPct("Trata", 15.02, 90.54, C.NEUTRAL, null, "trata_2");
const isvo        = addSystemDotPct("Isvo", 3.55, 85.63, C.NEUTRAL, null, "isvo");
const vrill       = addSystemDotPct("Vrill", 6.72, 84.56, C.NEUTRAL, null, "vrill");
const panag2      = addSystemDotPct("Panag", 14.32, 79.77, C.NEUTRAL, null, "panag_2");
const vieno       = addSystemDotPct("Vieno", 10.86, 76.52, C.NEUTRAL, null, "vieno");
const xtc         = addSystemDotPct("Xtc", 10.99, 75.53, C.NEUTRAL, null, "xtc");
const osf         = addSystemDotPct("Osf", 13.88, 74.61, C.NEUTRAL, null, "osf");
const atokaka     = addSystemDotPct("Atokaka", 4.58, 75.11, C.NEUTRAL, null, "atokaka");
const kraw        = addSystemDotPct("Kraw", 19.66, 73.97, C.NEUTRAL, null, "kraw");
const anto        = addSystemDotPct("Anto", 22.72, 72.31, C.NEUTRAL, null, "anto");
const moira       = addSystemDotPct("Moira", 9.27, 70.09, C.NEUTRAL, null, "moira");
const aplas       = addSystemDotPct("Aplas", 4.06, 71.23, C.NEUTRAL, null, "aplas");
const kroka       = addSystemDotPct("Kroka", 11.12, 67.30, C.NEUTRAL, null, "kroka");
const tetra_prime = addSystemDotPct("Tetra Prime", 12.04, 64.10, C.NEUTRAL, null, "tetra_prime");
const poly        = addSystemDotPct("Poly", 17.92, 64.35, C.NEUTRAL, null, "poly");
const asvo        = addSystemDotPct("Asvo", 20.03, 63.54, C.NEUTRAL, null, "asvo");
const riki        = addSystemDotPct("Riki", 22.95, 61.41, C.NEUTRAL, null, "riki");
const iraklo      = addSystemDotPct("Iraklo", 19.63, 59.14, C.NEUTRAL, null, "iraklo");
const dolca       = addSystemDotPct("Dolca", 13.70, 52.63, C.NEUTRAL, null, "dolca");
const knatz       = addSystemDotPct("Knatz", 16.93, 60.36, C.NEUTRAL, null, "knatz");

const oraethos    = addSystemDotPct("Oraethos", 85.61, 88.79, C.NEUTRAL, null, "oraethos");
const artemis     = addSystemDotPct("Artemis", 94.41, 91.97, C.NEUTRAL, null, "artemis");
const ika         = addSystemDotPct("Ika", 96.83, 93.42, C.NEUTRAL, null, "ika");
const paxi        = addSystemDotPct("Paxi", 95.63, 94.51, C.NEUTRAL, null, "paxi");
const mazo        = addSystemDotPct("Mazo", 98.57, 87.24, C.NEUTRAL, null, "mazo");
const penta       = addSystemDotPct("Penta", 84.02, 83.36, C.NEUTRAL, null, "penta");
const penta2      = addSystemDotPct("Penta II", 87.36, 83.16, C.NEUTRAL, null, "penta_ii");
const oip         = addSystemDotPct("Oip", 91.37, 82.02, C.NEUTRAL, null, "oip");
const eythim      = addSystemDotPct("Eythim", 93.52, 82.20, C.NEUTRAL, null, "eythim");

const xaplas      = addSystemDotPct("Xaplas", 73.45, 94.92, C.NEUTRAL, null, "xaplas");
const ricta       = addSystemDotPct("Ricta", 71.28, 94.34, C.NEUTRAL, null, "ricta");
const laertis     = addSystemDotPct("Laertis", 69.02, 92.14, C.NEUTRAL, null, "laertis");
const merath      = addSystemDotPct("Merath", 73.91, 87.94, C.NEUTRAL, null, "merath");
const yz          = addSystemDotPct("Yz", 71.59, 88.22, C.NEUTRAL, null, "yz");
const anvyr       = addSystemDotPct("Anvyr", 72.54, 86.12, C.NEUTRAL, null, "anvyr");
const coda        = addSystemDotPct("Coda", 64.95, 88.00, C.NEUTRAL, null, "coda");
const tessar      = addSystemDotPct("Tessar", 73.66, 83.50, C.NEUTRAL, null, "tessar");
const loret       = addSystemDotPct("Loret", 74.39, 81.38, C.NEUTRAL, null, "loret");
const yarin       = addSystemDotPct("Yarin", 76.41, 82.43, C.NEUTRAL, null, "yarin");
const erethis     = addSystemDotPct("Erethis", 73.01, 79.94, C.NEUTRAL, null, "erethis");
const hat         = addSystemDotPct("Hat", 78.30, 79.12, C.NEUTRAL, null, "hat");
const bris        = addSystemDotPct("Bris", 76.92, 77.48, C.NEUTRAL, null, "bris");
const vazour      = addSystemDotPct("Vazour", 81.86, 78.24, C.NEUTRAL, null, "vazour");
const paxi_prime  = addSystemDotPct("Paxi Prime", 85.55, 76.34, C.NEUTRAL, null, "paxi_prime");
const ris         = addSystemDotPct("Ris", 82.02, 74.75, C.NEUTRAL, null, "ris");
const leo         = addSystemDotPct("Leo", 84.04, 72.57, C.NEUTRAL, null, "leo");
const spyr        = addSystemDotPct("Spyr", 84.38, 71.00, C.NEUTRAL, null, "spyr");
const xavouz      = addSystemDotPct("Xavouz", 85.60, 70.77, C.NEUTRAL, null, "xavouz");
const racko       = addSystemDotPct("Racko", 87.73, 72.25, C.NEUTRAL, null, "racko");
const craf        = addSystemDotPct("Craf", 88.58, 74.81, C.NEUTRAL, null, "craf");
const phour       = addSystemDotPct("Phour", 91.83, 75.25, C.NEUTRAL, null, "phour");
const jns         = addSystemDotPct("Jns", 93.64, 74.05, C.NEUTRAL, null, "jns");
const xably       = addSystemDotPct("Xably", 93.65, 72.27, C.NEUTRAL, null, "xably");
const phila       = addSystemDotPct("Phila", 89.37, 67.69, C.NEUTRAL, null, "phila");
const ho_prime    = addSystemDotPct("Ho Prime", 85.19, 66.60, C.NEUTRAL, null, "ho_prime");
const ifo         = addSystemDotPct("Ifo", 92.50, 60.97, C.NEUTRAL, null, "ifo");
const aka         = addSystemDotPct("Aka", 93.23, 61.32, C.NEUTRAL, null, "aka");
const zorg        = addSystemDotPct("Zorg", 93.25, 59.48, C.NEUTRAL, null, "zorg");
const aq          = addSystemDotPct("Aq", 92.05, 59.79, C.NEUTRAL, null, "aq");
const lob         = addSystemDotPct("Lob", 97.26, 61.09, C.NEUTRAL, null, "lob");
const orhax       = addSystemDotPct("Orhax", 99.27, 64.87, C.NEUTRAL, null, "orhax");
const hexon       = addSystemDotPct("Hexon", 96.62, 57.67, C.NEUTRAL, null, "hexon");
const decrix      = addSystemDotPct("Decrix", 94.43, 55.28, C.NEUTRAL, null, "decrix");
const byz         = addSystemDotPct("Byz", 78.70, 66.50, C.NEUTRAL, null, "byz");
const otip        = addSystemDotPct("Otip", 77.22, 66.47, C.NEUTRAL, null, "otip");
const vica        = addSystemDotPct("Vica", 78.00, 65.40, C.NEUTRAL, null, "vica");
const delos       = addSystemDotPct("Delos", 71.12, 67.10, C.NEUTRAL, null, "delos");
const ix4         = addSystemDotPct("Ix 4", 71.74, 65.90, C.NEUTRAL, null, "ix4");
const kata        = addSystemDotPct("Kata", 59.02, 71.41, C.NEUTRAL, null, "kata");
const ermis       = addSystemDotPct("Ermis", 61.20, 69.90, C.NEUTRAL, null, "ermis");
const dosa        = addSystemDotPct("Dosa", 57.87, 70.28, C.NEUTRAL, null, "dosa");
const vessu       = addSystemDotPct("Vessu", 55.21, 70.25, C.NEUTRAL, null, "vessu");
const omega       = addSystemDotPct("Omega", 54.23, 66.15, C.NEUTRAL, null, "omega");
const otik        = addSystemDotPct("Otik", 65.03, 68.01, C.NEUTRAL, null, "otik");

const threnos     = addSystemDotPct("Threnos", 52.72, 85.25, C.NEUTRAL, null, "threnos");
const shathros    = addSystemDotPct("Shathros", 53.70, 82.55, C.NEUTRAL, null, "shathros");
const irri        = addSystemDotPct("Irri", 58.74, 85.02, C.NEUTRAL, null, "irri");
const polydrax    = addSystemDotPct("Polydrax", 59.80, 84.03, C.NEUTRAL, null, "polydrax");
const xang        = addSystemDotPct("Xang", 52.77, 78.72, C.NEUTRAL, null, "xang");
const defok       = addSystemDotPct("Defok", 51.01, 77.15, C.NEUTRAL, null, "defok");
const polirsh     = addSystemDotPct("Polirsh", 48.12, 77.16, C.ORION, null, "polirsh", "Orion Industries");
const moki        = addSystemDotPct("Moki", 45.97, 74.96, C.NEUTRAL, null, "moki");
const lo          = addSystemDotPct("Lo", 43.18, 73.54, C.NEUTRAL, null, "lo");
const wof         = addSystemDotPct("Wof", 40.50, 73.71, C.NEUTRAL, null, "wof");
const tsan        = addSystemDotPct("Tsan", 40.47, 75.15, C.NEUTRAL, null, "tsan");
const krow_d      = addSystemDotPct("Krow D", 35.69, 75.05, C.NEUTRAL, null, "krow_d");
const philop      = addSystemDotPct("Philop", 31.68, 72.80, C.NEUTRAL, null, "philop");
const rem_s       = addSystemDotPct("Rem S", 30.83, 76.13, C.NEUTRAL, null, "rem_s");
const vosa        = addSystemDotPct("Vosa", 29.77, 78.48, C.NEUTRAL, null, "vosa");
const alexa       = addSystemDotPct("Alexa", 26.05, 75.17, C.NEUTRAL, null, "alexa");
const dorak       = addSystemDotPct("Dorak", 28.47, 80.54, C.NEUTRAL, null, "dorak");
const toyako      = addSystemDotPct("Toyako", 31.39, 81.43, C.NEUTRAL, null, "toyako");
const trysin      = addSystemDotPct("Trysin", 29.38, 82.07, C.NEUTRAL, null, "trysin");
const okoi        = addSystemDotPct("Okoi", 34.99, 81.79, C.NEUTRAL, null, "okoi");

const azib        = addSystemDotPct("Azib", 36.36, 81.10, C.NEUTRAL, null, "azib");
const skol        = addSystemDotPct("Skol", 35.67, 84.24, C.NEUTRAL, null, "skol");
const corrn       = addSystemDotPct("Corrn", 33.94, 86.53, C.NEUTRAL, null, "corrn");
const ypo         = addSystemDotPct("Ypo", 40.48, 87.39, C.NEUTRAL, null, "ypo");
const moka2       = addSystemDotPct("Moka", 38.59, 87.87, C.NEUTRAL, null, "moka_2");
const vhalor      = addSystemDotPct("Vhalor", 37.41, 89.00, C.NEUTRAL, null, "vhalor");
const ioq         = addSystemDotPct("Ioq", 40.86, 88.46, C.NEUTRAL, null, "ioq");
const caoh        = addSystemDotPct("Caoh", 31.77, 89.78, C.NEUTRAL, null, "caoh");
const phosyr      = addSystemDotPct("Phosyr", 29.74, 92.31, C.NEUTRAL, null, "phosyr");
const hxs         = addSystemDotPct("Hxs", 27.59, 95.71, C.NEUTRAL, null, "hxs");
const papas       = addSystemDotPct("Papas", 27.27, 98.24, C.NEUTRAL, null, "papas");
const kol         = addSystemDotPct("Kol", 29.32, 98.95, C.NEUTRAL, null, "kol");
const tromp       = addSystemDotPct("Tromp", 28.19, 59.75, C.NEUTRAL, null, "tromp");
const gona        = addSystemDotPct("Gona", 33.66, 61.92, C.NEUTRAL, null, "gona");
const kozan       = addSystemDotPct("Kozan", 33.56, 64.56, C.NEUTRAL, null, "kozan");
const bet         = addSystemDotPct("Bet", 33.13, 66.27, C.NEUTRAL, null, "bet");
const emiprime    = addSystemDotPct("Emi Prime", 27.57, 66.11, C.NEUTRAL, null, "emiprime");
const naok        = addSystemDotPct("Naok", 38.64, 64.38, C.NEUTRAL, null, "naok");
const zofos       = addSystemDotPct("Zofos", 5.40, 95.60, C.NEUTRAL, null, "zofos");
const arilas      = addSystemDotPct("Arilas", 2.46, 96.49, C.NEUTRAL, null, "arilas");
const nokii       = addSystemDotPct("Noki II", 42.26, 61.12, C.NEUTRAL, null, "nokii");
const colo        = addSystemDotPct("Colo", 43.94, 66.34, C.NEUTRAL, null, "colo");
const laka        = addSystemDotPct("Laka", 45.33, 66.81, C.NEUTRAL, null, "laka");
const ver         = addSystemDotPct("Ver", 47.65, 69.64, C.NEUTRAL, null, "ver");
const nica        = addSystemDotPct("Nica", 48.95, 68.33, C.NEUTRAL, null, "nica");
const seres       = addSystemDotPct("Seres", 49.39, 70.49, C.NEUTRAL, null, "seres");
const pao7        = addSystemDotPct("Pao 7", 48.72, 71.90, C.NEUTRAL, null, "pao7");
const okarin      = addSystemDotPct("Okarin", 50.98, 72.43, C.NEUTRAL, null, "okarin");
const ioso        = addSystemDotPct("Ioso", 45.84, 71.37, C.NEUTRAL, null, "ioso");
const toda        = addSystemDotPct("Toda", 43.88, 62.07, C.NEUTRAL, null, "toda");
const fisu        = addSystemDotPct("Fisu", 70.31, 88.86, C.NEUTRAL, null, "fisu");
const penta3      = addSystemDotPct("Penta III", 87.91, 85.78, C.NEUTRAL, null, "penta3");
const xdat        = addSystemDotPct("Xdat", 91.22, 63.80, C.NEUTRAL, null, "xdat");

const rova        = addSystemDotPct("Rova", 97.93, 82.00, C.NEUTRAL, null, "rova");

// ---------- NEW DOTS ----------
const fido  = addSystemDotPct("Fido", 44.48, 83.61, C.NEUTRAL, null, "fido");
const okoi2 = addSystemDotPct("Okoi II", 37.85, 81.00, C.NEUTRAL, null, "okoi2");

// ---------- NEW DOT ----------
const xsa   = addSystemDotPct("Xsa", 57.70, 98.39, C.NEUTRAL, null, "xsa");

// ---------- NEW: Astar ----------
const astar = addSystemDotPct("Astar", 80.81, 79.55, C.NEUTRAL, null, "astar");

const sma    = addSystemDotPct("Sma", 39.94, 93.02, C.NEUTRAL, null, "sma");
const wondir = addSystemDotPct("Wondir", 42.00, 95.18, C.NEUTRAL, null, "wondir");
const otha   = addSystemDotPct("Otha", 41.70, 97.86, C.NEUTRAL, null, "otha");

// ---------- NEW SYSTEMS: FEDERATION EXPANSION ----------
const otheu   = addSystemDotPct("Otheu",   37.10, 63.49, C.NEUTRAL, null, "otheu");
const dram    = addSystemDotPct("Dram",    36.87, 61.25, C.NEUTRAL, null, "dram");
const kolkas  = addSystemDotPct("Kolkas",  35.53, 58.45, C.NEUTRAL, null, "kolkas");
const tifli   = addSystemDotPct("Tifli",   39.62, 57.60, C.NEUTRAL, null, "tifli");
const noki_iv = addSystemDotPct("Noki IV", 43.73, 60.43, C.NEUTRAL, null, "noki_iv");
const xaxan   = addSystemDotPct("Xaxan",   44.87, 61.42, C.NEUTRAL, null, "xaxan");
const aslopo  = addSystemDotPct("Aslopo",  44.59, 57.32, C.NEUTRAL, null, "aslopo");
const koretor = addSystemDotPct("Koretor", 44.66, 55.51, C.NEUTRAL, null, "koretor");
const fesao   = addSystemDotPct("Fesao",   49.96, 57.69, C.NEUTRAL, null, "fesao");
const ikopoc  = addSystemDotPct("Ikopoc",  50.09, 53.68, C.NEUTRAL, null, "ikopoc");
const iso9    = addSystemDotPct("Iso9",    52.03, 53.72, C.NEUTRAL, null, "iso9");
const vazompa = addSystemDotPct("Vazompa", 54.49, 58.11, C.NEUTRAL, null, "vazompa");
const kpax    = addSystemDotPct("Kpax",    53.48, 60.37, C.NEUTRAL, null, "kpax");
const akonto  = addSystemDotPct("Akonto",  52.32, 61.37, C.NEUTRAL, null, "akonto");
const naerk   = addSystemDotPct("Naerk",   51.40, 64.75, C.NEUTRAL, null, "naerk");
const pokaki  = addSystemDotPct("Pokaki",  56.37, 64.92, C.NEUTRAL, null, "pokaki");
const odjo    = addSystemDotPct("Odjo",    59.48, 63.54, C.NEUTRAL, null, "odjo");
const ert     = addSystemDotPct("Ert",     59.67, 69.46, C.NEUTRAL, null, "ert");
const massa   = addSystemDotPct("Massa",   63.29, 65.20, C.NEUTRAL, null, "massa");
const verga   = addSystemDotPct("Verga",   62.19, 66.91, C.NEUTRAL, null, "verga");

// Coordinates inferred from neighbouring lanes pending official survey data
const consa   = addSystemDotPct("Consa",   51.64, 55.80, C.NEUTRAL, null, "consa");
const toss    = addSystemDotPct("Toss",    53.43, 59.95, C.NEUTRAL, null, "toss");
const ganapo  = addSystemDotPct("Ganapo",  59.17, 66.09, C.NEUTRAL, null, "ganapo");

// ---------- NEW SYSTEMS: FRONTIER EXPANSION ----------
const ipsak    = addSystemDotPct("Ipsak",    6.02, 58.91, C.NEUTRAL, null, "ipsak");
const toxxo    = addSystemDotPct("Toxxo",    9.34, 57.99, C.NEUTRAL, null, "toxxo");
const xoxk     = addSystemDotPct("Xoxk",     6.24, 55.04, C.NEUTRAL, null, "xoxk");
const sotir    = addSystemDotPct("Sotir",    4.87, 52.39, C.NEUTRAL, null, "sotir");
const josokuk  = addSystemDotPct("Josokuk", 10.35, 51.68, C.NEUTRAL, null, "josokuk");
const pakama   = addSystemDotPct("Pakama",  11.60, 47.69, C.NEUTRAL, null, "pakama");
const opostoki = addSystemDotPct("Opostoki", 15.99, 41.74, C.NEUTRAL, null, "opostoki");
const megalok  = addSystemDotPct("Megalok",   9.49, 43.95, C.NEUTRAL, null, "megalok");

// ---------- NEW SYSTEMS: DOMINION EXPANSION ----------
const o_dominion  = addSystemDotPct("O",       70.10, 66.31, C.NEUTRAL, null, "o_dominion");
const xisaki      = addSystemDotPct("Xisaki",  73.02, 63.58, C.NEUTRAL, null, "xisaki");
const riril       = addSystemDotPct("Riril",   71.75, 62.83, C.NEUTRAL, null, "riril");
const edox        = addSystemDotPct("Edox",    73.80, 61.93, C.NEUTRAL, null, "edox");
const xex         = addSystemDotPct("Xex",     74.16, 60.53, C.NEUTRAL, null, "xex");
const zo_dominion = addSystemDotPct("Zo",      75.06, 61.67, C.NEUTRAL, null, "zo_dominion");
const zokra      = addSystemDotPct("Zokra",   68.55, 58.38, C.NEUTRAL, null, "zokra");
const zao        = addSystemDotPct("Zao",     66.04, 58.73, C.NEUTRAL, null, "zao");
const miskran    = addSystemDotPct("Miskran", 67.03, 57.25, C.NEUTRAL, null, "miskran");
const krixa      = addSystemDotPct("Krixa",   72.17, 57.52, C.NEUTRAL, null, "krixa");
const zandarki   = addSystemDotPct("Zandarki",74.83, 52.42, C.NEUTRAL, null, "zandarki");

// ---------- RECOLOR EXISTING DOTS ----------
function setDotColor(uid, color) {
  const s = SYS[uid];
  if (!s || !s.marker || !s.marker.setStyle) return;
  s.marker.setStyle({ color, fillColor: color });
  s.color = color;
}

// --- Dominion systems (DOTS only; capitals are icon markers) ---
const DOMINION_DOTS = [
  'alctor', 'ho_nass', 'egos_v', 'byz', 'otip', 'vica',
  'delos', 'ix4', 'ho_prime', 'phaex', 'ris', 'leo',
  'spyr', 'xavouz', 'racko', 'xdat', 'ifo',
  'aka', 'zorg', 'aq', 'lob', 'orhax', 'hexon', 'decrix',
  'paxi_prime', 'o_dominion', 'xisaki', 'riril', 'edox',
  'xex', 'zo_dominion', 'zokra', 'zao', 'miskran', 'krixa', 'zandarki'
];
DOMINION_DOTS.forEach(id => setDotColor(id, C.DOMINION));

// --- Federation systems (DOTS only; capital is an icon marker) ---
const FEDERATION_DOTS = [
  'otik','ermis','kata','dosa','vessu','omega','okarin','pao7',
  'seres','ver','ioso','nica','laka','calisa','colo','toda','nokii','naok',
  'otheu','dram','kolkas','tifli','noki_iv','xaxan','aslopo','koretor','fesao',
  'ikopoc','iso9','vazompa','kpax','akonto','naerk','pokaki','odjo','ert','massa','verga',
  'consa','toss','ganapo'
];
FEDERATION_DOTS.forEach(id => setDotColor(id, C.FED));

// ---------- SHOW FACTION IN POPUPS FOR COLORED DOTS ----------
function setFactionAndPopup(uid, faction) {
  const s = SYS[uid];
  if (!s || !s.marker) return;
  s.faction = faction;
  const imgHtml = s.image ? `<br/><img src="${s.image}" width="200" style="margin-top:6px;border-radius:8px;">` : "";
  const factionLine = `<div style="font-size:12px;color:#9aa7c1">Faction: ${faction}</div>`;
  const html = `<b>${s.name}</b>${factionLine}${imgHtml}`;
  updateSystemPopup(uid, html);
}
DOMINION_DOTS.forEach(id => setFactionAndPopup(id, "Dominion"));
FEDERATION_DOTS.forEach(id => setFactionAndPopup(id, "Federation"));

function setTagline(uid, text) {
  const s = SYS[uid];
  if (!s) return;
  s.tagline = text;
  const factionLine = s.faction ? `<div style="font-size:12px;color:#9aa7c1">Faction: ${s.faction}</div>` : "";
  const taglineLine = text ? `<div style="margin-top:4px;color:#ffddaa">${text}</div>` : "";
  const imgHtml = s.image ? `<br/><img src="${s.image}" width="200" style="margin-top:6px;border-radius:8px;">` : "";
  const html = `<b>${s.name}</b>${factionLine}${taglineLine}${imgHtml}`;
  updateSystemPopup(uid, html);
}

['paxi_prime', 'ho_prime'].forEach(uid => setTagline(uid, 'Dominion Crucible Citadel (Megastructure)'));
setTagline('veil_orion', 'The Veil System serves as the heart of Orion Industries, with Ida as its homeworld and Naruul as the second inhabited world, established under the leadership of Alpheus Cirie.');
setTagline('korneth', 'Cbo is an inhabited world, established under the leadership of Ashford Cirie, for Orion Industries');
setTagline('cynar', "Jampro is an inhabited world, established under the leadership of Leo O’neill, for Orion Industries");
setTagline('polirsh', "Togogh is an inhabited world, established under the leadership of Wulfhelm Mannering for Orion Industries");

// ---------- HYPERLANES — REMADE WITH YOUR CORRECTIONS ----------
// Solara-Ys (Aegir Outpost) → Aelyth Prime, Pone V, Veyra Null
addLaneByIds(aegir_outpost, aelyth);
addLaneByIds(aegir_outpost, pone_v);
addLaneByIds(aegir_outpost, veyra_null);

// Aelyth Prime → Solara-Ys (Aegir Outpost), Netra, Orpheas
addLaneByIds(aelyth, aegir_outpost);
addLaneByIds(aelyth, netra);
addLaneByIds(aelyth, orpheas);

// Orpheas → Solara-Ys (Aegir Outpost), Aelyth Prime, Erethis, Pone V
addLaneByIds(orpheas, aegir_outpost);
addLaneByIds(orpheas, aelyth);
addLaneByIds(orpheas, erethis);
addLaneByIds(orpheas, pone_v);

// Pone V → Solara-Ys (Aegir Outpost), Orpheas, Ozyrane
addLaneByIds(pone_v, aegir_outpost);
addLaneByIds(pone_v, orpheas);
addLaneByIds(pone_v, ozyrane);

// Veyra Null → Solara-Ys (Aegir Outpost), Otik, Mikro
addLaneByIds(veyra_null, aegir_outpost);
addLaneByIds(veyra_null, otik);
addLaneByIds(veyra_null, mikro);

// Ozyrane → Pone V, Haron, Nyren
addLaneByIds(ozyrane, pone_v);
addLaneByIds(ozyrane, haron);
addLaneByIds(ozyrane, nyren);

// Haron → Ozyrane, Nytheris
addLaneByIds(haron, ozyrane);
addLaneByIds(haron, nytheris);

// Loret → Tessar, Erethis, Yarin
addLaneByIds(loret, tessar);
addLaneByIds(loret, erethis);
addLaneByIds(loret, yarin);

// Erethis → Loret, Orpheas
addLaneByIds(erethis, loret);
addLaneByIds(erethis, orpheas);

// Netra → Aelyth Prime, Ix 4, Alctor, Ho Nass, Otip
addLaneByIds(netra, aelyth);
addLaneByIds(netra, ix4);
addLaneByIds(netra, alctor);
addLaneByIds(netra, ho_nass);
addLaneByIds(netra, otip);

// Nyren → Ozyrane, Volur, Vexar
addLaneByIds(nyren, ozyrane);
addLaneByIds(nyren, volur);
addLaneByIds(nyren, vexar);

// Alctor → Netra, Ho Nass, Egos V
addLaneByIds(alctor, netra);
addLaneByIds(alctor, ho_nass);
addLaneByIds(alctor, egos_v);

// Ho Nass → Alctor, Netra, Egos V
addLaneByIds(ho_nass, alctor);
addLaneByIds(ho_nass, netra);
addLaneByIds(ho_nass, egos_v);

// Egos V → Alctor, Byz, Ho Nass, Ho Prime
addLaneByIds(egos_v, alctor);
addLaneByIds(egos_v, byz);
addLaneByIds(egos_v, ho_nass);
addLaneByIds(egos_v, ho_prime);

// Byz → Egos V, Ho Prime, Vica, Otip
addLaneByIds(byz, egos_v);
addLaneByIds(byz, ho_prime);
addLaneByIds(byz, vica);
addLaneByIds(byz, otip);

// Thalyron → Ozyrane, Nytheris
addLaneByIds(thalyron, ozyrane);
addLaneByIds(thalyron, nytheris);

// Nytheris → Thalyron, Haron, Anvyr
addLaneByIds(nytheris, thalyron);
addLaneByIds(nytheris, haron);
addLaneByIds(nytheris, anvyr);

// ---------- EXTRA HYPERLANES (new batch) ----------
// Anvyr ↔ Tessar, Fisu
addLaneByIds(anvyr, tessar);
addLaneByIds(anvyr, fisu);

// Tessar ↔ Loret, Yarin
addLaneByIds(tessar, loret);
addLaneByIds(tessar, yarin);

// Fisu ↔ Yz, Laertis
addLaneByIds(fisu, yz);
addLaneByIds(fisu, laertis);

// Yz ↔ Merath
addLaneByIds(yz, merath);

// Laertis ↔ Merath, Ricta
addLaneByIds(laertis, merath);
addLaneByIds(laertis, ricta);

// Merath ↔ Kho
addLaneByIds(merath, kho);

// Ricta ↔ Xaplas
addLaneByIds(ricta, xaplas);

// Xaplas ↔ Sgd
addLaneByIds(xaplas, sgd);

// Sgd ↔ Kho
addLaneByIds(sgd, kho);

// Kho ↔ Tavro V
addLaneByIds(kho, tavro_v);

// Serothis — Nova Confederation ↔ Tavro V, Voruthen
addLaneByIds(serothis_nova, tavro_v);
addLaneByIds(serothis_nova, voruthen);

// Tavro V ↔ Oraethos
addLaneByIds(tavro_v, oraethos);

// Voruthen ↔ Oraethos
addLaneByIds(voruthen, oraethos);

// Oraethos ↔ Penta III, Artemis
addLaneByIds(oraethos, penta3);
addLaneByIds(oraethos, artemis);

// Penta III ↔ Penta II
addLaneByIds(penta3, penta2);

// Penta II ↔ Penta
addLaneByIds(penta2, penta);

// Penta ↔ Astar
addLaneByIds(penta, astar);

// ---------- NEW HYPERLANES (Artemis–Rova–Paxi corridor) ----------

// Artemis ↔ Paxi, Ika, Oraethos, Mazo
addLaneByIds(artemis, paxi);
addLaneByIds(artemis, ika);
addLaneByIds(artemis, oraethos);
addLaneByIds(artemis, mazo);

// Paxi ↔ Artemis, Ika
addLaneByIds(paxi, artemis);
addLaneByIds(paxi, ika);

// Ika ↔ Artemis, Paxi
addLaneByIds(ika, artemis);
addLaneByIds(ika, paxi);

// Mazo ↔ Artemis, Rova
addLaneByIds(mazo, artemis);
addLaneByIds(mazo, rova);

// Rova ↔ Mazo, Eythim
addLaneByIds(rova, mazo);
addLaneByIds(rova, eythim);

// Eythim ↔ Oip, Rova
addLaneByIds(eythim, oip);
addLaneByIds(eythim, rova);

// Oip ↔ Eythim, Phour
addLaneByIds(oip, eythim);
addLaneByIds(oip, phour);

// Phour ↔ Oip, Jns
addLaneByIds(phour, oip);
addLaneByIds(phour, jns);

// Jns ↔ Phour, Xably
addLaneByIds(jns, phour);
addLaneByIds(jns, xably);

// Xably ↔ Jns, Craf
addLaneByIds(xably, jns);
addLaneByIds(xably, craf);

// Craf ↔ Xably, Racko
addLaneByIds(craf, xably);
addLaneByIds(craf, racko);

// Racko ↔ Craf, Xavouz
addLaneByIds(racko, craf);
addLaneByIds(racko, xavouz);

// Xavouz ↔ Racko, Spyr, Phila, Ho Prime
addLaneByIds(xavouz, racko);
addLaneByIds(xavouz, spyr);
addLaneByIds(xavouz, phila);
addLaneByIds(xavouz, ho_prime);

// Spyr ↔ Xavouz, Leo
addLaneByIds(spyr, xavouz);
addLaneByIds(spyr, leo);

// Leo ↔ Spyr, Paxi Prime
addLaneByIds(leo, spyr);
addLaneByIds(leo, paxi_prime);

// Paxi Prime ↔ Leo, Ris
addLaneByIds(paxi_prime, leo);
addLaneByIds(paxi_prime, ris);

// Ris ↔ Paxi Prime, Phaex
addLaneByIds(ris, paxi_prime);
addLaneByIds(ris, phaex);

// Delos ↔ Ix 4
addLaneByIds(delos, ix4);
addLaneByIds(ix4, delos);

// Ermis ↔ Kata
addLaneByIds(ermis, kata);
addLaneByIds(kata, ermis);

// Eryndor — Federation Capital ↔ Noki II
addLaneByIds(eryndor, nokii);
addLaneByIds(nokii, eryndor);

// ---------- NEW HYPERLANES (Federation expansion) ----------
addLaneByIds(otheu, naok);
addLaneByIds(naok, otheu);

addLaneByIds(otheu, dram);
addLaneByIds(dram, otheu);

addLaneByIds(dram, kolkas);
addLaneByIds(kolkas, dram);

addLaneByIds(dram, nokii);
addLaneByIds(nokii, dram);

addLaneByIds(kolkas, tifli);
addLaneByIds(tifli, kolkas);

addLaneByIds(tifli, eryndor);
addLaneByIds(eryndor, tifli);

addLaneByIds(noki_iv, nokii);
addLaneByIds(nokii, noki_iv);

addLaneByIds(noki_iv, xaxan);
addLaneByIds(xaxan, noki_iv);

addLaneByIds(xaxan, toda);
addLaneByIds(toda, xaxan);

addLaneByIds(xaxan, aslopo);
addLaneByIds(aslopo, xaxan);

addLaneByIds(xaxan, akonto);
addLaneByIds(akonto, xaxan);

addLaneByIds(aslopo, koretor);
addLaneByIds(koretor, aslopo);

addLaneByIds(koretor, eryndor);
addLaneByIds(eryndor, koretor);

addLaneByIds(koretor, fesao);
addLaneByIds(fesao, koretor);

addLaneByIds(fesao, ikopoc);
addLaneByIds(ikopoc, fesao);

addLaneByIds(ikopoc, iso9);
addLaneByIds(iso9, ikopoc);

addLaneByIds(ikopoc, vazompa);
addLaneByIds(vazompa, ikopoc);

addLaneByIds(ikopoc, consa);
addLaneByIds(consa, ikopoc);

addLaneByIds(iso9, vazompa);
addLaneByIds(vazompa, iso9);

addLaneByIds(vazompa, kpax);
addLaneByIds(kpax, vazompa);

addLaneByIds(vazompa, toss);
addLaneByIds(toss, vazompa);

addLaneByIds(kpax, akonto);
addLaneByIds(akonto, kpax);

addLaneByIds(kpax, toss);
addLaneByIds(toss, kpax);

addLaneByIds(akonto, toss);
addLaneByIds(toss, akonto);

addLaneByIds(akonto, naerk);
addLaneByIds(naerk, akonto);

addLaneByIds(naerk, calisa);
addLaneByIds(calisa, naerk);

addLaneByIds(naerk, nica);
addLaneByIds(nica, naerk);

addLaneByIds(naerk, pokaki);
addLaneByIds(pokaki, naerk);

addLaneByIds(pokaki, omega);
addLaneByIds(omega, pokaki);

addLaneByIds(odjo, omega);
addLaneByIds(omega, odjo);

addLaneByIds(odjo, ert);
addLaneByIds(ert, odjo);

addLaneByIds(odjo, massa);
addLaneByIds(massa, odjo);

addLaneByIds(odjo, ganapo);
addLaneByIds(ganapo, odjo);

addLaneByIds(ert, omega);
addLaneByIds(omega, ert);

addLaneByIds(ert, ermis);
addLaneByIds(ermis, ert);

addLaneByIds(ert, kata);
addLaneByIds(kata, ert);

addLaneByIds(massa, otik);
addLaneByIds(otik, massa);

addLaneByIds(massa, verga);
addLaneByIds(verga, massa);

addLaneByIds(verga, otik);
addLaneByIds(otik, verga);

addLaneByIds(verga, ermis);
addLaneByIds(ermis, verga);

// ---------- NEW HYPERLANES (Frontier expansion) ----------
addLaneByIds(ipsak, toxxo);
addLaneByIds(toxxo, ipsak);

addLaneByIds(ipsak, tetra_prime);
addLaneByIds(tetra_prime, ipsak);

addLaneByIds(ipsak, xoxk);
addLaneByIds(xoxk, ipsak);

addLaneByIds(toxxo, xoxk);
addLaneByIds(xoxk, toxxo);

addLaneByIds(xoxk, sotir);
addLaneByIds(sotir, xoxk);

addLaneByIds(xoxk, josokuk);
addLaneByIds(josokuk, xoxk);

addLaneByIds(josokuk, dolca);
addLaneByIds(dolca, josokuk);

addLaneByIds(pakama, dolca);
addLaneByIds(dolca, pakama);

addLaneByIds(pakama, opostoki);
addLaneByIds(opostoki, pakama);

addLaneByIds(opostoki, megalok);
addLaneByIds(megalok, opostoki);

// ---------- NEW HYPERLANES (Dominion expansion) ----------
addLaneByIds(o_dominion, ix4);
addLaneByIds(ix4, o_dominion);

addLaneByIds(o_dominion, delos);
addLaneByIds(delos, o_dominion);

addLaneByIds(o_dominion, otik);
addLaneByIds(otik, o_dominion);

addLaneByIds(xisaki, ix4);
addLaneByIds(ix4, xisaki);

addLaneByIds(xisaki, edox);
addLaneByIds(edox, xisaki);

addLaneByIds(xisaki, riril);
addLaneByIds(riril, xisaki);

addLaneByIds(xisaki, zo_dominion);
addLaneByIds(zo_dominion, xisaki);

addLaneByIds(riril, zokra);
addLaneByIds(zokra, riril);

addLaneByIds(edox, zo_dominion);
addLaneByIds(zo_dominion, edox);

addLaneByIds(edox, xex);
addLaneByIds(xex, edox);

addLaneByIds(edox, zokra);
addLaneByIds(zokra, edox);

addLaneByIds(xex, zo_dominion);
addLaneByIds(zo_dominion, xex);

addLaneByIds(zo_dominion, vica);
addLaneByIds(vica, zo_dominion);

addLaneByIds(zokra, zao);
addLaneByIds(zao, zokra);

addLaneByIds(zokra, miskran);
addLaneByIds(miskran, zokra);

addLaneByIds(zokra, krixa);
addLaneByIds(krixa, zokra);

addLaneByIds(krixa, zandarki);
addLaneByIds(zandarki, krixa);

// Kharon — Dominion Capital ↔ Xdat, Ifo
addLaneByIds(kharon_cap, xdat);
addLaneByIds(kharon_cap, ifo);

// Xdat ↔ Kharon — Dominion Capital, Phila
addLaneByIds(xdat, kharon_cap);
addLaneByIds(xdat, phila);

// Ifo ↔ Kharon — Dominion Capital, Aka, Zorg
addLaneByIds(ifo, kharon_cap);
addLaneByIds(ifo, aka);
addLaneByIds(ifo, zorg);

// Aka ↔ Ifo
addLaneByIds(aka, ifo);

// Zorg ↔ Ifo, Aq, Lob, Decrix
addLaneByIds(zorg, ifo);
addLaneByIds(zorg, aq);
addLaneByIds(zorg, lob);
addLaneByIds(zorg, decrix);

// Aq ↔ Zorg
addLaneByIds(aq, zorg);

// Lob ↔ Zorg, Hexon, Orhax
addLaneByIds(lob, zorg);
addLaneByIds(lob, hexon);
addLaneByIds(lob, orhax);

// Orhax ↔ Lob
addLaneByIds(orhax, lob);

// Hexon ↔ Lob, Decrix
addLaneByIds(hexon, lob);
addLaneByIds(hexon, decrix);

// Decrix ↔ Zorg, Hexon
addLaneByIds(decrix, zorg);
addLaneByIds(decrix, hexon);

// ---------- NEW HYPERLANES (Phaex–Astar cluster) ----------
addLaneByIds(phaex, ris);
addLaneByIds(phaex, bris);

addLaneByIds(bris, phaex);
addLaneByIds(bris, hat);
addLaneByIds(bris, vazour);

addLaneByIds(hat, bris);
addLaneByIds(hat, yarin);
addLaneByIds(hat, astar);

addLaneByIds(astar, hat);
addLaneByIds(astar, vazour);

addLaneByIds(vazour, bris);
addLaneByIds(vazour, astar);

// ---------- NEW HYPERLANES (Volur–Otha cluster) ----------
addLaneByIds(volur, toko);
addLaneByIds(volur, dofo);
addLaneByIds(volur, nyren);
addLaneByIds(volur, xang);

addLaneByIds(toko, mikro);
addLaneByIds(toko, volur);

addLaneByIds(dofo, mikro);
addLaneByIds(dofo, razathaar);
addLaneByIds(dofo, volur);

addLaneByIds(razathaar, dosa);
addLaneByIds(razathaar, dofo);

addLaneByIds(dosa, razathaar);
addLaneByIds(dosa, kata);
addLaneByIds(dosa, vessu);

addLaneByIds(xang, volur);
addLaneByIds(xang, defok);

addLaneByIds(defok, xang);
addLaneByIds(defok, polirsh);

addLaneByIds(polirsh, defok);
addLaneByIds(polirsh, serohis);
addLaneByIds(polirsh, cynar);
addLaneByIds(polirsh, moki);
addLaneByIds(polirsh, okarin);

addLaneByIds(cynar, polirsh);
addLaneByIds(cynar, veil_orion);

addLaneByIds(serohis, polirsh);
addLaneByIds(serohis, veil_orion);

addLaneByIds(veil_orion, cynar);
addLaneByIds(veil_orion, seren);
addLaneByIds(veil_orion, korneth);
addLaneByIds(veil_orion, shathros);
addLaneByIds(veil_orion, serohis);

addLaneByIds(korneth, veil_orion);
addLaneByIds(korneth, shathros);
addLaneByIds(korneth, threnos);

addLaneByIds(threnos, korneth);
addLaneByIds(threnos, vayth);

addLaneByIds(vayth, threnos);
addLaneByIds(vayth, ormun_crimson);
addLaneByIds(vayth, zhaen);
addLaneByIds(vayth, irri);

addLaneByIds(irri, polydrax);
addLaneByIds(irri, coda);

addLaneByIds(polydrax, irri);
addLaneByIds(polydrax, vexar);

addLaneByIds(vexar, polydrax);
addLaneByIds(vexar, nyren);

addLaneByIds(coda, irri);
addLaneByIds(coda, laertis);

addLaneByIds(ormun_crimson, vayth);
addLaneByIds(ormun_crimson, drelith);
addLaneByIds(ormun_crimson, oryx);

addLaneByIds(drelith, ormun_crimson);
addLaneByIds(drelith, zhaen);

addLaneByIds(zhaen, drelith);
addLaneByIds(zhaen, vayth);
addLaneByIds(zhaen, olk);

addLaneByIds(olk, zhaen);
addLaneByIds(olk, col);

addLaneByIds(col, olk);
addLaneByIds(col, xsa);

addLaneByIds(xsa, col);

addLaneByIds(oryx, aliti);
addLaneByIds(oryx, ormun_crimson);
addLaneByIds(oryx, joris);

addLaneByIds(aliti, oryx);

addLaneByIds(joris, fido);
addLaneByIds(joris, oryx);
addLaneByIds(joris, ioq);
addLaneByIds(joris, okoi);

addLaneByIds(fido, joris);
addLaneByIds(fido, seren);

addLaneByIds(seren, fido);
addLaneByIds(seren, veil_orion);

addLaneByIds(sma, ioq);
addLaneByIds(sma, wondir);

addLaneByIds(wondir, sma);
addLaneByIds(wondir, otha);

addLaneByIds(otha, wondir);

// --- Okoi–Kentauros–Zofos corridor (corrected) ---
addLaneByIds(okoi, azib);
addLaneByIds(okoi, joris);
addLaneByIds(okoi, skol);
addLaneByIds(okoi, toyako);

addLaneByIds(azib, okoi);
addLaneByIds(azib, okoi2);

addLaneByIds(okoi2, azib);

addLaneByIds(skol, okoi);
addLaneByIds(skol, moka2);

addLaneByIds(moka2, skol);
addLaneByIds(moka2, ypo);

addLaneByIds(ypo, moka2);
addLaneByIds(ypo, ioq);

addLaneByIds(vhalor, ioq);
addLaneByIds(vhalor, corrn);

addLaneByIds(corrn, trysin);
addLaneByIds(corrn, caoh);

addLaneByIds(caoh, corrn);
addLaneByIds(caoh, phosyr);

addLaneByIds(phosyr, hxs);
addLaneByIds(phosyr, taireb);

addLaneByIds(hxs, phosyr);
addLaneByIds(hxs, papas);

addLaneByIds(papas, hxs);
addLaneByIds(papas, kol);

addLaneByIds(kol, papas);

addLaneByIds(taireb, phosyr);
addLaneByIds(taireb, okoro);
addLaneByIds(taireb, akrion_eagle);
addLaneByIds(taireb, ceythros);

addLaneByIds(okoro, pyr);
addLaneByIds(okoro, taireb);
addLaneByIds(okoro, akrion_eagle);

addLaneByIds(akrion_eagle, okoro);
addLaneByIds(akrion_eagle, taireb);
addLaneByIds(akrion_eagle, ceythros);
addLaneByIds(akrion_eagle, kentauros);

addLaneByIds(kentauros, akrion_eagle);
addLaneByIds(kentauros, ceythros);
addLaneByIds(kentauros, arrakan);
addLaneByIds(kentauros, jola);

addLaneByIds(arrakan, kentauros);
addLaneByIds(arrakan, trata);

addLaneByIds(trata, jola);
addLaneByIds(trata, arrakan);

addLaneByIds(jola, vrill);
addLaneByIds(jola, trata);
addLaneByIds(jola, kentauros);

addLaneByIds(vrill, jola);
addLaneByIds(vrill, isvo);
addLaneByIds(vrill, simon);

addLaneByIds(isvo, vrill);
addLaneByIds(isvo, simon);
addLaneByIds(isvo, actim);

addLaneByIds(simon, vrill);
addLaneByIds(simon, isvo);
addLaneByIds(simon, actim);
addLaneByIds(simon, zofos);

addLaneByIds(actim, simon);
addLaneByIds(actim, isvo);

addLaneByIds(zofos, simon);
addLaneByIds(zofos, arilas);
addLaneByIds(zofos, zofos_prime);

addLaneByIds(arilas, zofos);
addLaneByIds(arilas, zofos_prime);

addLaneByIds(pyr, okoro);
addLaneByIds(pyr, ax);
addLaneByIds(pyr, trysin);

addLaneByIds(trysin, pyr);
addLaneByIds(trysin, dorak);
addLaneByIds(trysin, toyako);

addLaneByIds(toyako, trysin);
addLaneByIds(toyako, vosa);
addLaneByIds(toyako, okoi);

addLaneByIds(dorak, trysin);
addLaneByIds(dorak, vosa);

addLaneByIds(vosa, dorak);
addLaneByIds(vosa, toyako);
addLaneByIds(vosa, rem_s);

addLaneByIds(ax, pyr);
addLaneByIds(ax, koki);

// --- Koki Prime → Omega web (corrected) ---
addLaneByIds(koki, ax);
addLaneByIds(koki, osf);
addLaneByIds(koki, panag);

addLaneByIds(panag, koki);
addLaneByIds(panag, vieno);

addLaneByIds(vieno, panag);
addLaneByIds(vieno, xtc);

addLaneByIds(xtc, vieno);
addLaneByIds(xtc, osf);

addLaneByIds(osf, xtc);
addLaneByIds(osf, koki);
addLaneByIds(osf, kraw);
addLaneByIds(osf, kroka);

addLaneByIds(kroka, osf);
addLaneByIds(kroka, kraw);
addLaneByIds(kroka, tetra_prime);
addLaneByIds(kroka, moira);

addLaneByIds(moira, kroka);
addLaneByIds(moira, aplas);

addLaneByIds(aplas, atokaka);

addLaneByIds(tetra_prime, kroka);
addLaneByIds(tetra_prime, poly);

addLaneByIds(poly, tetra_prime);
addLaneByIds(poly, asvo);
addLaneByIds(poly, anto);
addLaneByIds(poly, knatz);

addLaneByIds(dolca, knatz);

addLaneByIds(anto, poly);
addLaneByIds(anto, kraw);
addLaneByIds(anto, alexa);

addLaneByIds(kraw, kroka);
addLaneByIds(kraw, osf);
addLaneByIds(kraw, anto);

addLaneByIds(alexa, anto);
addLaneByIds(alexa, rem_s);

addLaneByIds(asvo, poly);
addLaneByIds(asvo, riki);
addLaneByIds(asvo, knatz);

addLaneByIds(knatz, dolca);
addLaneByIds(knatz, iraklo);
addLaneByIds(knatz, riki);
addLaneByIds(knatz, asvo);
addLaneByIds(knatz, poly);

addLaneByIds(riki, asvo);
addLaneByIds(riki, iraklo);
addLaneByIds(riki, tromp);
addLaneByIds(riki, knatz);

addLaneByIds(iraklo, knatz);

addLaneByIds(tromp, emiprime);
addLaneByIds(tromp, gona);

addLaneByIds(emiprime, tromp);
addLaneByIds(emiprime, philop);
addLaneByIds(emiprime, bet);
addLaneByIds(emiprime, kozan);

addLaneByIds(kozan, gona);
addLaneByIds(kozan, emiprime);
addLaneByIds(kozan, bet);

addLaneByIds(gona, tromp);
addLaneByIds(gona, kozan);

addLaneByIds(bet, emiprime);
addLaneByIds(bet, kozan);
addLaneByIds(bet, naok);
addLaneByIds(bet, kaldur);

addLaneByIds(kaldur, bet);
addLaneByIds(kaldur, krow_d);

addLaneByIds(philop, emiprime);
addLaneByIds(philop, rem_s);

addLaneByIds(krow_d, rem_s);
addLaneByIds(krow_d, kaldur);
addLaneByIds(krow_d, tsan);
addLaneByIds(krow_d, azib);

addLaneByIds(naok, bet);
addLaneByIds(naok, toda);

addLaneByIds(toda, nokii);
addLaneByIds(toda, colo);

addLaneByIds(colo, toda);
addLaneByIds(colo, calisa);
addLaneByIds(colo, laka);

addLaneByIds(calisa, colo);
addLaneByIds(calisa, laka);

addLaneByIds(laka, colo);
addLaneByIds(laka, calisa);
addLaneByIds(laka, ver);
addLaneByIds(laka, ioso);

addLaneByIds(ver, laka);
addLaneByIds(ver, ioso);

addLaneByIds(ioso, laka);
addLaneByIds(ioso, ver);
addLaneByIds(ioso, seres);
addLaneByIds(ioso, moki);

addLaneByIds(moki, ioso);
addLaneByIds(moki, lo);
addLaneByIds(moki, polirsh);

addLaneByIds(lo, moki);
addLaneByIds(lo, wof);

addLaneByIds(wof, lo);
addLaneByIds(wof, tsan);

addLaneByIds(tsan, wof);
addLaneByIds(tsan, krow_d);

addLaneByIds(seres, ioso);
addLaneByIds(seres, pao7);

addLaneByIds(pao7, seres);
addLaneByIds(pao7, okarin);

addLaneByIds(okarin, pao7);
addLaneByIds(okarin, polirsh);
addLaneByIds(okarin, omega);

addLaneByIds(omega, okarin);
addLaneByIds(omega, vessu);
addLaneByIds(omega, nica);

// ---------- RESOURCE TAGS (Pirates / AFM / GGP) ----------
// PIRATES: Laertis, Moki, Vhalor, Kroka
["laertis","moki","vhalor","kroka"].forEach(uid => {
  if (SYS[uid]) {
    tagSystem(uid, {
      iconUrl: ICONS.PIRATES,
      popupText: "Major Pirate System",
      dotColor: "#ff5a3c"
    });
  } else {
    console.warn("PIRATES: system not found:", uid);
  }
});

// AFM: Phosyr, Panag, Isvo, Defok, Oryx, Fisu, Hat, Panta II
["phosyr","panag","isvo","defok","oryx","fisu","hat","penta_ii"].forEach(uid => {
  const s = SYS[uid];
  if (s && s.marker) {
    const html = `<b>${s.name}</b><div style="margin-top:4px;color:#ffddaa">Major AFM deposits</div>`;
    s.tagline = "Major AFM deposits";
    updateSystemPopup(uid, html);
  } else {
    console.warn("AFM: system not found:", uid);
  }
});

// GGP: Omega, Erethis, Aliti, Ika
["omega","erethis","aliti","ika"].forEach(uid => {
  const s = SYS[uid];
  if (s && s.marker) {
    const html = `<b>${s.name}</b><div style="margin-top:4px;color:#ffddaa">Major GGP deposits</div>`;
    s.tagline = "Major GGP deposits";
    updateSystemPopup(uid, html);
  } else {
    console.warn("GGP: system not found:", uid);
  }
});

// ---------- UI wiring ----------
document.getElementById('go').onclick = () => focusSystemByNameFragment(document.getElementById('q').value);
document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('go').click(); });

const chkNames = document.getElementById('toggle-names');
const chkLanes = document.getElementById('toggle-lanes');
chkNames.addEventListener('change', () => setLabelsVisible(chkNames.checked));
chkLanes.addEventListener('change', () => setHyperlanesVisible(chkLanes.checked));

// defaults
chkNames.checked = false;
setLabelsVisible(false);
