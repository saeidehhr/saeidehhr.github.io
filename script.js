const map = L.map('map').setView([25.3, 51.2], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=en', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


// ===== SPI classification → label + color =====
function spiClass(value) {
  const v = parseFloat(value);
  if (isNaN(v)) return { label: 'No Data', color: '#9ca3af' };
  if (v <= -2.0) return { label: 'Extremely Dry', color: '#7f1d1d' };
  if (v <= -1.5) return { label: 'Severely Dry', color: '#b91c1c' };
  if (v <= -1.0) return { label: 'Moderately Dry', color: '#ef4444' };
  if (v <  1.0)  return { label: 'Near Normal',   color: '#fbbf24' };
  if (v <  1.5)  return { label: 'Moderately Wet', color: '#60a5fa' };
  if (v <  2.0)  return { label: 'Very Wet',       color: '#2563eb' };
  return { label: 'Extremely Wet', color: '#1e3a8a' };
}

function styleBySPI(feature) {
  const { color } = spiClass(feature?.properties?.spi);
  return {
    radius: 6,
    color: '#111827',
    weight: 1,
    fillColor: color,
    fillOpacity: 0.9
  };
}

function fmt(x, d = 2) {
  const n = parseFloat(x);
  return isNaN(n) ? 'N/A' : n.toFixed(d);
}

function popupHtml(p) {
  const region = p.region || 'Unknown';
  const monthYear = p.month_year || 'N/A';
  const spi = p.spi;
  const info = spiClass(spi);

  return `
  <div style="font-size:13px;line-height:1.4">
    <strong>${region}</strong><br/>
    <b>Month/Year:</b> ${monthYear}<br/>
    <b>SPI:</b> ${fmt(spi,2)} <span style="color:${info.color};font-weight:600">(${info.label})</span><br/>
    <b>Humidity (RH):</b> ${fmt(p.rh,1)}%<br/>
    <b>Temperature:</b> ${fmt(p.temperature,1)} °C &nbsp; 
    <b>Dewpoint:</b> ${fmt(p.dewpoint,1)} °C
  </div>`;
}

// ===== Load data and build single Month/Year select =====
let allFeatures = [];
let ptsLayer = null;

function populateFilters(gj) {
  allFeatures = gj.features || [];

  const monthYearSet = new Set();
  for (const f of allFeatures) {
    const monthYear = (f.properties?.month_year || '').toString().trim();
    if (monthYear) monthYearSet.add(monthYear);
  }

  const monthYearArr = [...monthYearSet].sort((a,b) => a.localeCompare(b));

  const select = document.getElementById('monthYearSelect');
  select.innerHTML = '<option value="">All</option>' + monthYearArr.map(my => `<option>${my}</option>`).join('');

  select.addEventListener('change', filterAndRender);
  document.getElementById('resetBtn').addEventListener('click', () => {
    select.value = '';
    filterAndRender();
  });
}

function filterAndRender() {
  const monthYear = document.getElementById('monthYearSelect').value;

  const filtered = allFeatures.filter(f => {
    const my = (f.properties?.month_year || '').toString().trim();
    return !monthYear || my === monthYear;
  });

  updateMap(filtered);
}

function updateMap(features) {
  if (ptsLayer) map.removeLayer(ptsLayer);
  ptsLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, styleBySPI(f)),
    onEachFeature: (f, layer) => {
      const p = f.properties || {};
      layer.bindPopup(popupHtml(p));
      layer.bindTooltip(p.region ?? 'Region', { direction: 'top', offset: [0, -6] });
    }
  }).addTo(map);

  try { map.fitBounds(ptsLayer.getBounds(), { padding: [20, 20] }); } catch (e) {}
}

function addLegend() {
  const bins = [
    { label: 'Extremely Dry (≤ -2.0)',      color: '#7f1d1d' },
    { label: 'Severely Dry (-2.0 to -1.5)', color: '#b91c1c' },
    { label: 'Moderately Dry (-1.5 to -1.0)', color: '#ef4444' },
    { label: 'Near Normal (-1.0 to 1.0)',   color: '#fbbf24' },
    { label: 'Moderately Wet (1.0 to 1.5)', color: '#60a5fa' },
    { label: 'Very Wet (1.5 to 2.0)',       color: '#2563eb' },
    { label: 'Extremely Wet (≥ 2.0)',       color: '#1e3a8a' }
  ];

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<strong>SPI</strong><br/>';
    bins.forEach(b => {
      div.innerHTML += `
        <div style="display:flex;align-items:center;margin:2px 0">
          <span style="display:inline-block;width:14px;height:14px;margin-right:6px;border:1px solid #111;background:${b.color}"></span>
          <span>${b.label}</span>
        </div>`;
    });
    return div;
  };
  legend.addTo(map);
}

// ===== Fetch and init =====
fetch('data/qatar.geojson')
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} for data/qatar.geojson`);
    return r.json();
  })
  .then(gj => {
    populateFilters(gj);
    filterAndRender(); // initial (All)
    addLegend();
  })
  .catch(err => console.error('GeoJSON Load Error:', err));

