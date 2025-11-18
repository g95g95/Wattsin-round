const { useMemo, useState, useEffect, useRef } = React;
const html = htm.bind(React.createElement);

const bikeCatalog = [
  { name: "Specialized Tarmac SL8", weight: 6.6, type: "Corsa" },
  { name: "Trek Émonda SLR 9", weight: 6.8, type: "Corsa" },
  { name: "Canyon Ultimate CFR", weight: 6.2, type: "Corsa" },
  { name: "Bianchi Oltre RC", weight: 6.9, type: "Corsa" },
  { name: "Pinarello Dogma F", weight: 6.8, type: "Corsa" },
  { name: "Scott Spark RC World Cup", weight: 10.2, type: "MTB" },
  { name: "Orbea Oiz OMX", weight: 10.6, type: "MTB" },
  { name: "Canyon Lux World Cup", weight: 10.1, type: "MTB" },
  { name: "Santa Cruz Blur CC", weight: 10.4, type: "MTB" },
  { name: "Wilier Rave SLR", weight: 8.2, type: "Gravel" },
  { name: "Cannondale SuperSix Evo LAB71", weight: 6.9, type: "Corsa" },
];

const performanceBands = [
  { label: "World Tour / Pro", min: 6.2 },
  { label: "Pro Continental", min: 5.6 },
  { label: "Elite Nazionale", min: 5.0 },
  { label: "Amatore di punta", min: 4.4 },
  { label: "Amatore nazionale", min: 3.8 },
  { label: "Amatore regionale", min: 3.2 },
  { label: "Cicloturista evoluto", min: 2.6 },
  { label: "Cicloturista", min: 0 },
];

const comparisonCurves = {
  Pro: [
    [5, 7.4],
    [10, 6.7],
    [20, 6.2],
    [40, 5.9],
    [60, 5.7],
  ],
  "Amatore forte": [
    [5, 6.3],
    [10, 5.6],
    [20, 5.1],
    [40, 4.7],
    [60, 4.5],
  ],
  "Amatore medio": [
    [5, 5.2],
    [10, 4.6],
    [20, 4.2],
    [40, 3.8],
    [60, 3.6],
  ],
  Cicloturista: [
    [5, 4.2],
    [10, 3.7],
    [20, 3.3],
    [40, 3.0],
    [60, 2.8],
  ],
};

const formatNumber = (value, decimals = 1, suffix = "") =>
  Number.isFinite(value) ? `${value.toFixed(decimals)}${suffix}` : "-";

function parseDuration(duration) {
  const parts = duration.split(":").map(Number);
  if (parts.some(Number.isNaN) || parts.length > 3) return null;
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function computeRelativity(timeSeconds, gain, speed) {
  const c = 299_792_458;
  const earthGmOverRc2 = 6.957e-10;
  const earthRadius = 6_371_000;

  const altitude = Math.max(gain, 0);
  const gravitationalFactor = Math.sqrt(1 - (2 * 3.986e14) / ((earthRadius + altitude) * c ** 2));
  const baseFactor = Math.sqrt(1 - 2 * earthGmOverRc2);
  const gravDelta = timeSeconds * (gravitationalFactor / baseFactor - 1);

  const beta = speed / c;
  const gamma = 1 / Math.sqrt(1 - beta ** 2);
  const specialDelta = timeSeconds * (gamma - 1);

  return { gravDelta, specialDelta };
}

function computeMetrics(form) {
  const g = 9.80665;
  const rho = 1.2;
  const crr = 0.004;
  const cdA = form.bikeType === "MTB" ? 0.4 : 0.32;

  const riderWeight = Number(form.riderWeight);
  const bikeWeight = Number(form.bikeWeight);
  const mass = riderWeight + bikeWeight;
  const distanceKm = Number(form.distance);
  const distance = distanceKm * 1000;
  let gain = Number(form.elevationGain);
  const gradeInput = Number(form.grade) / 100;
  if ((!gain || gain <= 0) && gradeInput > 0) {
    gain = gradeInput * distance;
  }
  const headwind = Number(form.headwind || 0);
  const seconds = parseDuration(form.time);
  if (!seconds || seconds <= 0 || !mass || !gain || !distance) return null;

  const vam = (gain / seconds) * 3600;
  const speed = distance / seconds;
  const horizontalDistance = Math.max(distance ** 2 - gain ** 2, 0) ** 0.5;
  const grade = gain / (horizontalDistance || distance);

  const airSpeed = speed + headwind;
  const potentialPower = mass * g * speed * grade;
  const rollingPower = crr * mass * g * speed;
  const aeroPower = 0.5 * rho * cdA * airSpeed ** 3;
  const totalPower = potentialPower + rollingPower + aeroPower;
  const wkg = totalPower / riderWeight;
  const category = performanceBands.find(({ min }) => wkg >= min)?.label ?? "-";
  const relativistic = computeRelativity(seconds, gain, speed);

  return {
    vam,
    totalPower,
    wkg,
    category,
    grade: grade * 100,
    avgSpeed: speed * 3.6,
    ...relativistic,
    climbMinutes: seconds / 60,
  };
}

function validateForm(form) {
  const required = ["age", "sex", "riderWeight", "bikeWeight", "time", "distance"];
  const missing = required.filter((key) => !form[key]);
  if (missing.length) return "Compila i campi essenziali: età, sesso, pesi, tempo e distanza.";

  const numbers = ["riderWeight", "bikeWeight", "distance"].map((key) => Number(form[key]));
  if (numbers.some((n) => !Number.isFinite(n) || n <= 0)) {
    return "Verifica che pesi e distanza siano numeri positivi.";
  }

  const seconds = parseDuration(form.time);
  if (!seconds || seconds <= 0) return "Il tempo deve essere nel formato hh:mm:ss e maggiore di zero.";
  const distance = Number(form.distance) * 1000;
  const gainInput = Number(form.elevationGain);
  const gradeInput = Number(form.grade) / 100;
  const gain = gainInput > 0 ? gainInput : gradeInput > 0 ? gradeInput * distance : 0;
  if (!gain) return "Inserisci dislivello oppure la pendenza della salita.";

  const grade = gain / distance;
  if (grade > 0.25 || grade < 0.02) return "La pendenza media sembra anomala (<2% o >25%). Controlla i dati.";
  return null;
}

function ProgressBar({ step }) {
  const steps = ["Presentazione", "Dati", "Risultati"];
  return html`<div class="progress">
    ${steps.map(
      (label, idx) => html`<div class=${`progress-step ${step >= idx + 1 ? "active" : ""}`}>
        <span>${idx + 1}</span>
        <p>${label}</p>
      </div>`
    )}
  </div>`;
}

function Intro({ form, setForm, onNext, banner }) {
  return html`<section class="panel hero">
    <div>
      <p class="eyebrow">Climbing lab</p>
      <h1>Watts in Round</h1>
      <p class="subtitle">
        Flusso guidato, calcoli in tempo reale e confronto con i pro per stimare i tuoi watt/kg.
        Inserisci età e sesso per personalizzare le soglie.
      </p>
      <div class="grid two">
        <label>
          <span>Età</span>
          <input
            type="number"
            min="10"
            max="90"
            placeholder="es. 32"
            value=${form.age}
            onInput=${(e) => setForm((f) => ({ ...f, age: e.target.value }))}
          />
        </label>
        <label>
          <span>Sesso biologico</span>
          <select value=${form.sex} onChange=${(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
            <option value="">Seleziona</option>
            <option value="M">Maschile</option>
            <option value="F">Femminile</option>
            <option value="Altro">Preferisco non indicare</option>
          </select>
        </label>
      </div>
      <div class="hero-actions">
        <button class="primary" onClick=${onNext}>Avanti</button>
        ${banner}
      </div>
    </div>
    <div class="hero-panel">
      <p class="eyebrow">Cosa troverai</p>
      <ul>
        <li>Catalogo bici con peso precompilato</li>
        <li>Verifica di coerenza prima del calcolo</li>
        <li>Grafico confronto ed esportazione PNG</li>
        <li>Spiegazione fisica e bonus relativistico</li>
      </ul>
    </div>
  </section>`;
}

function Tabs({ active, onChange, labels }) {
  return html`<div class="tab-bar">
    ${labels.map(
      ({ id, title }) => html`<button
        class=${active === id ? "active" : ""}
        onClick=${() => onChange(id)}
      >${title}</button>`
    )}
  </div>`;
}

function WeightTab({ form, setForm }) {
  useEffect(() => {
    const selected = bikeCatalog.find((bike) => bike.name === form.bikeModel);
    if (selected) {
      setForm((f) => ({ ...f, bikeWeight: selected.weight, bikeType: selected.type }));
    }
  }, [form.bikeModel, setForm]);

  return html`<div class="grid two fade-in">
    <label>
      <span>Modello bici</span>
      <input
        list="bike-models"
        placeholder="Inizia a digitare un modello"
        value=${form.bikeModel}
        onInput=${(e) => setForm((f) => ({ ...f, bikeModel: e.target.value }))}
      />
      <datalist id="bike-models">
        ${bikeCatalog.map((bike) => html`<option value=${bike.name}>${bike.name} (${bike.type})</option>`)}</datalist>
    </label>
    <label>
      <span>Tipologia</span>
      <select value=${form.bikeType} onChange=${(e) => setForm((f) => ({ ...f, bikeType: e.target.value }))}>
        <option value="">Seleziona</option>
        <option value="Corsa">Corsa</option>
        <option value="MTB">MTB</option>
        <option value="Gravel">Gravel</option>
      </select>
    </label>
    <label>
      <span>Peso atleta (kg)</span>
      <input
        type="number"
        min="30"
        placeholder="es. 68"
        value=${form.riderWeight}
        onInput=${(e) => setForm((f) => ({ ...f, riderWeight: e.target.value }))}
      />
    </label>
    <label>
      <span>Peso bici (kg)</span>
      <input
        type="number"
        min="5"
        step="0.1"
        placeholder="es. 7.2"
        value=${form.bikeWeight}
        onInput=${(e) => setForm((f) => ({ ...f, bikeWeight: e.target.value }))}
      />
    </label>
  </div>`;
}

function ClimbTab({ form, setForm, onOpenRouteDrawer }) {
  const modeLabels = [
    { id: "gain", title: "Dislivello" },
    { id: "grade", title: "Pendenza" },
  ];

  return html`<div class="grid two fade-in">
    <label>
      <span>Nome salita</span>
      <input
        type="text"
        placeholder="es. Zoncolan"
        value=${form.climbName}
        onInput=${(e) => setForm((f) => ({ ...f, climbName: e.target.value }))}
      />
    </label>
    <label>
      <span>Data (opzionale)</span>
      <input type="date" value=${form.climbDate} onInput=${(e) => setForm((f) => ({ ...f, climbDate: e.target.value }))} />
    </label>
    <div class="stack" style=${{ gap: "8px" }}>
      <div class="row-between">
        <div>
          <p class="eyebrow">Inserimento salita</p>
          <${Tabs} active=${form.climbMode} onChange=${(id) => setForm((f) => ({ ...f, climbMode: id }))} labels=${modeLabels} />
        </div>
        <button class="secondary" onClick=${onOpenRouteDrawer}>
          Disegna il percorso
        </button>
      </div>
      ${form.climbMode === "gain"
        ? html`<label>
            <span>Dislivello (m)</span>
            <input
              type="number"
              min="50"
              placeholder="es. 1200"
              value=${form.elevationGain}
              onInput=${(e) => setForm((f) => ({ ...f, elevationGain: e.target.value }))}
            />
          </label>`
        : html`<label>
            <span>Pendenza media (%)</span>
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="es. 8"
              value=${form.grade}
              onInput=${(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
            />
          </label>`}
    </div>
    <label>
      <span>Distanza (km)</span>
      <input
        type="number"
        step="0.1"
        placeholder="es. 12.5"
        value=${form.distance}
        onInput=${(e) => setForm((f) => ({ ...f, distance: e.target.value }))}
      />
    </label>
    <label>
      <span>Tempo (hh:mm:ss)</span>
      <input
        type="text"
        placeholder="00:45:30"
        value=${form.time}
        onInput=${(e) => setForm((f) => ({ ...f, time: e.target.value }))}
      />
    </label>
    <label>
      <span>Vento (m/s, opzionale)</span>
      <input
        type="number"
        step="0.1"
        placeholder="positivo = contrario"
        value=${form.headwind}
        onInput=${(e) => setForm((f) => ({ ...f, headwind: e.target.value }))}
      />
    </label>
  </div>`;
}

function MapDrawer({ open, onClose, onComplete, initialGrade = 7 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawnRef = useRef(null);
  const [grade, setGrade] = useState(Number(initialGrade) || 7);

  useEffect(() => {
    setGrade(Number(initialGrade) || 7);
  }, [initialGrade]);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;
    const hasLeaflet = typeof window !== "undefined" && window.L;
    if (!hasLeaflet) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current).setView([44.5, 11.3], 5.7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const drawControl = new L.Control.Draw({
        draw: {
          polyline: { showLength: true },
          polygon: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: { featureGroup: drawnItems, edit: false },
      });
      map.addControl(drawControl);

      map.on(L.Draw.Event.CREATED, (event) => {
        drawnItems.clearLayers();
        drawnItems.addLayer(event.layer);
        drawnRef.current = event.layer;
      });

      mapRef.current = map;
    }

    setTimeout(() => mapRef.current.invalidateSize(), 120);
  }, [open]);

  const computeDistance = (points) => {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const R = 6371000;
      const toRad = (deg) => (deg * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      total += 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    return total;
  };

  const finish = () => {
    const layer = drawnRef.current;
    if (!layer) return;
    const coords = layer.getLatLngs().flat(Infinity);
    if (!coords.length) return;
    const distanceMeters = computeDistance(coords);
    if (!distanceMeters) return;
    const distanceKm = distanceMeters / 1000;
    const elevationGain = distanceMeters * (grade / 100);
    onComplete({ distanceKm, elevationGain, grade });
  };

  if (!open) return null;

  const hasLeaflet = typeof window !== "undefined" && window.L;

  return html`<div class="drawer-backdrop">
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <p class="eyebrow">Disegna il percorso</p>
          <h3>Traccia la tua scalata sulla mappa</h3>
        </div>
        <button class="ghost" onClick=${onClose}>Chiudi</button>
      </div>
      ${hasLeaflet
        ? html`<div class="drawer-content">
            <div ref=${containerRef} class="map-canvas"></div>
            <div class="drawer-panel">
              <p class="eyebrow">Stima pendenza media</p>
              <div class="grade-slider">
                <input
                  type="range"
                  min="2"
                  max="18"
                  step="0.5"
                  value=${grade}
                  onInput=${(e) => setGrade(Number(e.target.value))}
                />
                <span>${grade.toFixed(1)}%</span>
              </div>
              <p class="muted">
                Disegna una polilinea del percorso. La distanza viene ricavata dalla lunghezza del tracciato; il dislivello è stimato
                dalla pendenza media impostata.
              </p>
              <div class="drawer-actions">
                <button class="ghost" onClick=${onClose}>Annulla</button>
                <button class="primary" onClick=${finish}>Finisci il percorso</button>
              </div>
            </div>
          </div>`
        : html`<div class="drawer-fallback">
            <p>Impossibile caricare la mappa: controlla la connessione o ricarica la pagina.</p>
            <button class="primary" onClick=${onClose}>Chiudi</button>
          </div>`}
    </div>
  </div>`;
}

function Modal({ message, onClose, onConfirm }) {
  return html`<div class="modal-backdrop">
    <div class="modal">
      <h4>Controllo di compatibilità</h4>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="ghost" onClick=${onClose}>Torna indietro</button>
        <button class="primary" onClick=${onConfirm}>Procedi comunque</button>
      </div>
    </div>
  </div>`;
}

function InsightChart({ metrics }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement.clientWidth;
    const height = 320;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 24, right: 18, bottom: 56, left: 64 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const maxX = 70;
    const maxY = 8;
    const toX = (x) => margin.left + (x / maxX) * chartW;
    const toY = (y) => margin.top + chartH - (y / maxY) * chartH;

    ctx.strokeStyle = "rgba(148,163,184,0.2)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px 'Inter', sans-serif";
    for (let i = 0; i <= maxY; i++) {
      const y = toY(i);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartW, y);
      ctx.stroke();
      ctx.fillText(i.toString(), margin.left - 42, y + 4);
    }
    for (let i = 0; i <= 60; i += 10) {
      const x = toX(i);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartH);
      ctx.stroke();
      ctx.fillText(i.toString(), x - 6, margin.top + chartH + 18);
    }

    const colors = ["#22d3ee", "#0ea5e9", "#f59e0b", "#a78bfa"];
    Object.entries(comparisonCurves).forEach(([label, points], idx) => {
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach(([x, y], i) => {
        const px = toX(x);
        const py = toY(y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.fillStyle = colors[idx % colors.length];
      points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(toX(x), toY(y), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText(label, toX(points[points.length - 1][0]) - 28, toY(points[points.length - 1][1]) - 10);
    });

    if (metrics) {
      ctx.fillStyle = "#f97316";
      const px = toX(metrics.climbMinutes);
      const py = toY(metrics.wkg);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText("La tua scalata", px + 10, py - 10);
    }

    const pogacar = { minutes: 40, wkg: 7, label: "Pogačar Plateau de Beille" };
    ctx.fillStyle = "#fb7185";
    ctx.strokeStyle = "#fb7185";
    ctx.beginPath();
    ctx.arc(toX(pogacar.minutes), toY(pogacar.wkg), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "12px 'Inter', sans-serif";
    ctx.fillText(pogacar.label, toX(pogacar.minutes) + 10, toY(pogacar.wkg) - 10);

    ctx.strokeStyle = "#cbd5e1";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "13px 'Inter', sans-serif";
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartH);
    ctx.lineTo(margin.left + chartW, margin.top + chartH);
    ctx.stroke();
    ctx.fillText("Minuti di salita", margin.left + chartW / 2 - 40, height - 16);
    ctx.save();
    ctx.translate(16, margin.top + chartH / 2 + 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Watt/kg", 0, 0);
    ctx.restore();
    ctx.restore();
  }, [metrics]);

  return html`<canvas ref=${canvasRef} class="chart" height="320"></canvas>`;
}

function Theory({ metrics }) {
  return html`<div class="theory">
    <p class="eyebrow">Fisica semplificata</p>
    <h3>Come stimiamo il wattaggio</h3>
    <p>
      La potenza totale è la somma di componente gravitazionale, attrito di rotolamento e resistenza aerodinamica.
    </p>
    <div class="formulae">
      <span>P<sub>grav</sub> = m · g · v · pendenza</span>
      <span>P<sub>rot</sub> = C<sub>rr</sub> · m · g · v</span>
      <span>P<sub>aero</sub> = ½ · ρ · C<sub>dA</sub> · (v + v<sub>vento</sub>)³</span>
      <span>P<sub>tot</sub> = P<sub>grav</sub> + P<sub>rot</sub> + P<sub>aero</sub></span>
    </div>
    <p>
      La VAM è il dislivello orario, mentre il watt/kg confronta prestazioni indipendenti dalla lunghezza della salita.
    </p>
      <div class="bonus">
        <p class="eyebrow">Bonus relativistico</p>
        <h4>Dilatazione temporale sul tuo sforzo</h4>
        <ul>
        <li>Risparmio GR (Schwarzschild): <strong>${formatNumber(metrics?.gravDelta * 1e15, 3, " fs")}</strong></li>
        <li>Risparmio SR (velocità media): <strong>${formatNumber(metrics?.specialDelta * 1e15, 3, " fs")}</strong></li>
        </ul>
        <p>Effetti minuscoli ma reali: più sali e più ti muovi veloce, più il tuo tempo proprio diverge.</p>
      </div>
    </div>`;
}

function Results({ metrics, onShowInsights, onExport, insight, setInsight }) {
  return html`<section class="panel results">
    <div class="card highlight">
      <div class="card-header">
        <div>
          <p class="eyebrow">Risultati principali</p>
          <h2>Il tuo profilo di potenza</h2>
        </div>
        <button class="secondary" onClick=${onShowInsights}>Visualizza insights</button>
      </div>
      <div class="pill-grid">
        <div class="pill"><span>VAM</span><strong>${formatNumber(metrics?.vam, 0, " m/h")}</strong></div>
        <div class="pill"><span>Watt totali</span><strong>${formatNumber(metrics?.totalPower, 0, " W")}</strong></div>
        <div class="pill"><span>W/kg</span><strong>${formatNumber(metrics?.wkg, 2)}</strong></div>
        <div class="pill"><span>Fascia</span><strong>${metrics?.category ?? "-"}</strong></div>
      </div>
      <div class="secondary-grid">
        <div>
          <p class="eyebrow">Pendenza media</p>
          <h4>${formatNumber(metrics?.grade, 1, "%")}</h4>
        </div>
        <div>
          <p class="eyebrow">Velocità media</p>
          <h4>${formatNumber(metrics?.avgSpeed, 1, " km/h")}</h4>
        </div>
      </div>
    </div>

    <div class="card">
      ${html`<${Tabs}
        active=${insight}
        onChange=${setInsight}
        labels=${[
          { id: "confronto", title: "Confronto" },
          { id: "teoria", title: "Teoria" },
        ]}
      />`}
      <div class="card-body">
        ${insight === "confronto"
          ? html`<div class="card-header stack">
                <div>
                  <p class="eyebrow">Curve di riferimento</p>
                  <h3>Confronta la tua scalata</h3>
                </div>
                <button class="ghost" onClick=${onExport}>Esporta grafico</button>
              </div>
              <${InsightChart} metrics=${metrics} />`
          : html`<${Theory} metrics=${metrics} />`}
      </div>
    </div>
  </section>`;
}

function Toast({ message }) {
  return html`<div class="toast">${message}</div>`;
}

function App() {
  const [form, setForm] = useState({
    age: "",
    sex: "",
    riderWeight: "",
    bikeWeight: "",
    bikeModel: "",
    bikeType: "",
    elevationGain: "",
    grade: "",
    climbMode: "gain",
    climbName: "",
    climbDate: "",
    headwind: "",
    time: "",
    distance: "",
  });
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState("pesi");
  const [insight, setInsight] = useState("confronto");
  const [modalMessage, setModalMessage] = useState(null);
  const [toast, setToast] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const metrics = useMemo(() => computeMetrics(form), [form]);
  const estimatedGrade = useMemo(() => {
    const grade = Number(form.grade);
    if (grade > 0) return Math.min(Math.max(grade, 2), 18);
    const gain = Number(form.elevationGain);
    const dist = Number(form.distance);
    if (gain > 0 && dist > 0) {
      const derived = (gain / (dist * 1000)) * 100;
      return Math.min(Math.max(derived, 2), 18);
    }
    return 7;
  }, [form.grade, form.elevationGain, form.distance]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2400);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleNext = () => {
    if (!form.age || !form.sex) {
      setToast("Compila età e sesso per continuare");
      return;
    }
    setStep(2);
  };

  const handleCalculate = () => {
    const message = validateForm(form);
    if (message) {
      setModalMessage(message);
      return;
    }
    handleConfirm();
  };

  const handleConfirm = () => {
    if (!metrics) {
      setToast("Correggi i valori prima di procedere");
      setModalMessage(null);
      return;
    }
    setStep(3);
    setInsight("confronto");
    setModalMessage(null);
  };

  const handleRouteComplete = ({ distanceKm, elevationGain, grade }) => {
    setForm((f) => ({
      ...f,
      distance: distanceKm.toFixed(2),
      elevationGain: Math.round(elevationGain).toString(),
      grade: grade.toFixed(1),
    }));
    setDrawerOpen(false);
    setTab("salita");
    setToast(`Percorso importato: ${distanceKm.toFixed(1)} km, dislivello ~${Math.round(elevationGain)} m`);
  };

  const exportChart = () => {
    const canvas = document.querySelector("canvas.chart");
    if (!canvas) return;
    const dateLabel = form.climbDate || new Date().toISOString().slice(0, 10);
    const fileName = `${form.climbName || "scalata"}_${dateLabel}`.replace(/\s+/g, "_");
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png", 1.0);
    link.download = `${fileName}.png`;
    link.click();
  };

  const banner = html`<div class="chip-row">
    <span class="chip">React 18</span>
    <span class="chip">Canvas live</span>
    <span class="chip">No backend</span>
  </div>`;

  return html`<main class="app">
    <${ProgressBar} step=${step} />

    ${step === 1 && html`<${Intro} form=${form} setForm=${setForm} onNext=${handleNext} banner=${banner} />`}

    ${step === 2 &&
    html`<section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Inserimento dati</p>
            <h2>Completa peso, bici e dettagli della salita</h2>
          </div>
          <div class="panel-actions">
            <button class="ghost" onClick=${() => setStep(1)}>Indietro</button>
            <button class="primary" onClick=${handleCalculate}>Calcola watt/kg</button>
          </div>
        </div>
        <${Tabs}
          active=${tab}
          onChange=${setTab}
          labels=${[
            { id: "pesi", title: "Peso & bici" },
            { id: "salita", title: "Dati salita" },
          ]}
        />
        ${tab === "pesi"
          ? html`<${WeightTab} form=${form} setForm=${setForm} />`
          : html`<${ClimbTab}
              form=${form}
              setForm=${setForm}
              onOpenRouteDrawer=${() => setDrawerOpen(true)}
            />`}
      </section>`}

    ${step === 3 &&
    html`<${Results}
        metrics=${metrics}
        insight=${insight}
        setInsight=${setInsight}
        onShowInsights=${() => setInsight("confronto")}
        onExport=${exportChart}
      />`}

    ${toast && html`<${Toast} message=${toast} />`}
    ${modalMessage &&
    html`<${Modal}
        message=${modalMessage}
        onClose=${() => setModalMessage(null)}
        onConfirm=${handleConfirm}
      />`}
    <${MapDrawer}
      open=${drawerOpen}
      onClose=${() => setDrawerOpen(false)}
      onComplete=${handleRouteComplete}
      initialGrade=${estimatedGrade}
    />
  </main>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
