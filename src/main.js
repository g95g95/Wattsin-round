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

const state = {
  form: {
    age: "",
    sex: "",
    riderWeight: "",
    bikeWeight: "",
    bikeModel: "",
    bikeType: "",
    elevationGain: "",
    climbName: "",
    climbDate: "",
    headwind: "",
    time: "",
    distance: "",
  },
  metrics: null,
};

function formatNumber(value, decimals = 1, suffix = "") {
  return Number.isFinite(value) ? `${value.toFixed(decimals)}${suffix}` : "-";
}

function parseDuration(duration) {
  const parts = duration.split(":").map(Number);
  if (parts.some(Number.isNaN) || parts.length > 3) return null;
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function computeRelativity(timeSeconds, gain, speed) {
  const c = 299792458;
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
  const gain = Number(form.elevationGain);
  const distance = Number(form.distance) * 1000;
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

function populateCatalog() {
  const list = document.getElementById("bike-models");
  bikeCatalog.forEach((bike) => {
    const option = document.createElement("option");
    option.value = bike.name;
    option.textContent = `${bike.name} (${bike.type})`;
    list.appendChild(option);
  });
}

function setSection(step) {
  document.querySelectorAll("#progress-steps .progress-step").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) <= step);
  });
  document.getElementById("intro-section").hidden = step !== 1;
  document.getElementById("form-section").hidden = step !== 2;
  document.getElementById("results-section").hidden = step !== 3;
}

function switchTab(name) {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.getElementById("tab-pesi").hidden = name !== "pesi";
  document.getElementById("tab-salita").hidden = name !== "salita";
}

function switchInsight(name) {
  document.querySelectorAll("[data-insight]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.insight === name);
  });
  document.getElementById("insight-confronto").hidden = name !== "confronto";
  document.getElementById("insight-teoria").hidden = name !== "teoria";
}

function updateFormFromInputs() {
  state.form.age = document.getElementById("age").value;
  state.form.sex = document.getElementById("sex").value;
  state.form.riderWeight = document.getElementById("rider-weight").value;
  state.form.bikeWeight = document.getElementById("bike-weight").value;
  state.form.bikeModel = document.getElementById("bike-model").value;
  state.form.bikeType = document.getElementById("bike-type").value;
  state.form.elevationGain = document.getElementById("elevation").value;
  state.form.climbName = document.getElementById("climb-name").value;
  state.form.climbDate = document.getElementById("climb-date").value;
  state.form.headwind = document.getElementById("headwind").value;
  state.form.time = document.getElementById("duration").value;
  state.form.distance = document.getElementById("distance").value;
}

function autofillBike() {
  const model = document.getElementById("bike-model").value;
  const bike = bikeCatalog.find((b) => b.name === model);
  if (bike) {
    document.getElementById("bike-weight").value = bike.weight;
    document.getElementById("bike-type").value = bike.type;
  }
}

function validateInputs() {
  updateFormFromInputs();
  const required = ["age", "sex", "riderWeight", "bikeWeight", "elevationGain", "time", "distance"];
  const missing = required.filter((key) => !state.form[key]);
  if (missing.length) return "Compila tutti i campi obbligatori: età, sesso, pesi, dislivello, tempo e distanza.";
  const numbers = ["riderWeight", "bikeWeight", "elevationGain", "distance"].map((key) => Number(state.form[key]));
  if (numbers.some((n) => !Number.isFinite(n) || n <= 0)) {
    return "Verifica che pesi, dislivello e distanza siano numeri positivi.";
  }
  const seconds = parseDuration(state.form.time);
  if (!seconds || seconds <= 0) return "Il tempo deve essere nel formato hh:mm:ss e maggiore di zero.";
  const distance = Number(state.form.distance) * 1000;
  const grade = Number(state.form.elevationGain) / distance;
  if (grade > 0.25 || grade < 0.02) {
    return "La pendenza media sembra anomala (<2% o >25%). Controlla i dati.";
  }
  return null;
}

function openModal(message, proceed) {
  const modal = document.getElementById("modal");
  document.getElementById("modal-message").textContent = message;
  modal.hidden = false;
  const confirm = () => {
    modal.hidden = true;
    proceed();
  };
  const close = () => {
    modal.hidden = true;
  };
  document.getElementById("modal-confirm").onclick = confirm;
  document.getElementById("modal-close").onclick = close;
}

function renderResults(metrics) {
  document.getElementById("vam-value").textContent = formatNumber(metrics.vam) + " m/h";
  document.getElementById("power-value").textContent = formatNumber(metrics.totalPower, 0) + " W";
  document.getElementById("wkg-value").textContent = formatNumber(metrics.wkg, 2);
  document.getElementById("band-value").textContent = metrics.category;
  document.getElementById("grade-value").textContent = formatNumber(metrics.grade, 1) + "%";
  document.getElementById("speed-value").textContent = formatNumber(metrics.avgSpeed, 1) + " km/h";
  document.getElementById("grav-delta").textContent = formatNumber(metrics.gravDelta * 1000, 3) + " ms";
  document.getElementById("sr-delta").textContent = formatNumber(metrics.specialDelta * 1000, 3) + " ms";
}

function drawComparisonChart(metrics) {
  const canvas = document.getElementById("comparison-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = canvas.clientHeight || 320;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const margin = { top: 20, right: 18, bottom: 40, left: 50 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxX = 65;
  const maxY = 8;
  const toX = (x) => margin.left + (x / maxX) * chartW;
  const toY = (y) => margin.top + chartH - (y / maxY) * chartH;

  ctx.strokeStyle = "rgba(148,163,184,0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartW, y);
    ctx.stroke();
  }
  for (let i = 1; i <= 6; i++) {
    const x = margin.left + (chartW / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartH);
    ctx.stroke();
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
      const px = toX(x);
      const py = toY(y);
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(label, toX(points[points.length - 1][0]) - 30, toY(points[points.length - 1][1]) - 8);
  });

  if (metrics) {
    ctx.fillStyle = "#f97316";
    const px = toX(metrics.climbMinutes);
    const py = toY(metrics.wkg);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("La tua scalata", px + 10, py - 10);
  }

  ctx.strokeStyle = "#cbd5e1";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "13px Inter, sans-serif";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartH);
  ctx.lineTo(margin.left + chartW, margin.top + chartH);
  ctx.stroke();
  ctx.fillText("Minuti di salita", margin.left + chartW / 2 - 40, height - 12);
  ctx.save();
  ctx.translate(14, margin.top + chartH / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Watt/kg", 0, 0);
  ctx.restore();
  ctx.restore();
}

function exportChart() {
  const canvas = document.getElementById("comparison-chart");
  const dateLabel = state.form.climbDate || new Date().toISOString().slice(0, 10);
  const fileName = `${state.form.climbName || "scalata"}_${dateLabel}`.replace(/\s+/g, "_");
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png", 1.0);
  link.download = `${fileName}.png`;
  link.click();
}

function attachEvents() {
  document.getElementById("intro-next").addEventListener("click", () => {
    updateFormFromInputs();
    if (state.form.age && state.form.sex) setSection(2);
  });

  document.getElementById("back-to-intro").addEventListener("click", () => setSection(1));

  document.getElementById("bike-model").addEventListener("input", autofillBike);

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll("[data-insight]").forEach((btn) => {
    btn.addEventListener("click", () => switchInsight(btn.dataset.insight));
  });

  document.getElementById("open-insights").addEventListener("click", () => {
    switchInsight("confronto");
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("export-chart").addEventListener("click", exportChart);

  document.getElementById("calculate").addEventListener("click", () => {
    const message = validateInputs();
    const proceed = () => {
      const metrics = computeMetrics(state.form);
      if (metrics) {
        state.metrics = metrics;
        renderResults(metrics);
        setSection(3);
        drawComparisonChart(metrics);
      }
    };
    if (message) openModal(message, proceed);
    else proceed();
  });
}

populateCatalog();
attachEvents();
switchTab("pesi");
switchInsight("confronto");
setSection(1);
