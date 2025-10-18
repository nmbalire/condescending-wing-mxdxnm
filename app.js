/* ============================
   Tiny DOM helpers & utils
   ============================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmtUGX = (n) => "UGX " + Math.round(n).toLocaleString("en-UG");
const parseUGX = (txt) => Number((txt || "").replace(/[^0-9]/g, "") || 0);
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const shiftDate = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ============================
      Deterministic RNG per key
      ============================ */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(key) {
  return mulberry32(xmur3(key)());
}

/* ============================
      Auth flags (demo)
      ============================ */
const AUTH_KEY = "auth.ok"; // '1' when authenticated
function setAuth(v) {
  localStorage.setItem(AUTH_KEY, v ? "1" : "0");
}
function isAuth() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

/* ============================
      Show/hide app vs login
      ============================ */
function showLogin() {
  $("#login")?.style && ($("#login").style.display = "grid");
  $("#app")?.style && ($("#app").style.display = "none");
}
function showApp() {
  $("#login")?.style && ($("#login").style.display = "none");
  $("#app")?.style && ($("#app").style.display = "grid");
}

/* ============================
      Tabs (with scroll-to-top)
      ============================ */
function initTabs() {
  const links = document.querySelectorAll("[data-tab-link]");
  const panes = document.querySelectorAll("[data-tab]");

  function activate(id) {
    links.forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === "#" + id)
    );
    panes.forEach((s) => s.classList.toggle("active", s.id === id));
    location.hash = "#" + id;

    // Always start from top when switching tabs
    try {
      const main = document.querySelector(".container");
      if (main) main.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (_) {
      window.scrollTo(0, 0);
    }
  }

  links.forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activate(a.getAttribute("href").slice(1));
    })
  );

  const start = (location.hash || "#sales").slice(1);
  activate(start);
}

/* Guard: only show login if not authenticated; otherwise bounce back to sales */
addEventListener("hashchange", () => {
  if (location.hash === "#login") {
    if (!isAuth()) {
      showLogin();
      return;
    }
    location.hash = "#sales";
  }
  showApp();
});

/* ============================
      Session (10 min idle / 60 abs)
      ============================ */
function initSession() {
  const ABS_MIN = 60,
    IDLE_MIN = 10,
    WARN_SEC = 60;
  const KS = { start: "sess.start", active: "sess.activity" };
  const now = () => Date.now();
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60),
      r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  };
  const setLS = (k, v) => localStorage.setItem(k, String(v));
  const getLS = (k) => {
    const v = localStorage.getItem(k);
    return v ? Number(v) : null;
  };

  if (!getLS(KS.start)) setLS(KS.start, now());
  if (!getLS(KS.active)) setLS(KS.active, now());

  [
    "click",
    "keydown",
    "mousemove",
    "scroll",
    "touchstart",
    "focus",
    "visibilitychange",
  ].forEach((evt) =>
    addEventListener(evt, () => setLS(KS.active, now()), { passive: true })
  );

  function timeLeft() {
    const abs = (getLS(KS.start) || now()) + ABS_MIN * 60 * 1000;
    const idle = (getLS(KS.active) || now()) + IDLE_MIN * 60 * 1000;
    return Math.min(abs, idle) - now();
  }

  $("#sessStay")?.addEventListener("click", () => {
    setLS(KS.active, now());
    $("#sessBanner").style.display = "none";
  });

  setInterval(() => {
    const left = timeLeft();
    const banner = $("#sessBanner"),
      c = $("#sessCountdown");

    if (left <= 0) {
      // Expired → force login
      setAuth(false);
      banner && (banner.style.display = "none");
      location.hash = "#login";
      showLogin();
      // reset new timers
      setLS(KS.start, now());
      setLS(KS.active, now());
      return;
    }
    if (left <= WARN_SEC * 1000) {
      banner && (banner.style.display = "block");
      c && (c.textContent = fmt(left));
    } else {
      banner && (banner.style.display = "none");
    }
  }, 1000);
}

/* ============================
      Simple bar charts
      ============================ */
function ensureBars(c, n) {
  if (!c) return;
  while (c.children.length < n) {
    const b = document.createElement("div");
    b.className = "bar";
    c.appendChild(b);
  }
  while (c.children.length > n) c.removeChild(c.lastChild);
}
function setBars(c, vals) {
  if (!c) return;
  const m = Math.max(1, ...vals.map((v) => Math.abs(v)));
  [...c.children].forEach(
    (b, i) => (b.style.height = clamp((vals[i] / m) * 100, 0, 100) + "%")
  );
}

/* ============================
      SALES
      ============================ */
function initSales() {
  const chart = $("#salesChart");
  if (!chart) return;
  const dateIn = $("#salesDate"),
    prev = $("#salesPrev"),
    next = $("#salesNext");
  const totalEl = $("#salesTotal"),
    deltaEl = $("#salesDelta"),
    gauge = $("#salesGauge");
  const totalIn = $("#salesTotalInput"),
    deltaR = $("#salesDeltaRange");
  const barsR = $("#salesBars"),
    smoothR = $("#salesSmooth");

  dateIn.value = todayStr();

  prev.addEventListener("click", () => {
    dateIn.value = shiftDate(dateIn.value, -1);
    update();
  });
  next.addEventListener("click", () => {
    dateIn.value = shiftDate(dateIn.value, +1);
    update();
  });
  dateIn.addEventListener("input", update);

  function compute(iso) {
    const rnd = seededRng("sales|" + iso);
    const total = Math.round(2200 + rnd() * 6500);
    const pct = Math.round(-18 + rnd() * 52);
    const chWeb = 30 + rnd() * 40,
      chApp = 15 + rnd() * 50;
    let chRes = 100 - chWeb - chApp;
    return {
      total,
      pct,
      mix: [Math.round(chWeb), Math.round(chApp), Math.round(chRes)],
      seq: (n, smooth) => {
        const r2 = seededRng("sales|seq|" + iso + "|" + n + "|" + smooth);
        let v = 1,
          arr = [];
        for (let i = 0; i < n; i++) {
          v += (r2() * 2 - 1) * (smooth / 100);
          v = Math.max(0.1, v);
          arr.push(v);
        }
        const sum = arr.reduce((a, b) => a + b, 0);
        return arr.map((x) => (x / sum) * total);
      },
    };
  }

  function update() {
    const iso = dateIn.value || todayStr();
    const base = compute(iso);
    const n = +barsR.value,
      smooth = +smoothR.value;
    ensureBars(chart, n);
    setBars(
      chart,
      base.seq(n, smooth).map((v) => v * (0.98 + (deltaR.value / 100) * 0.04))
    );

    const tweaked = Math.max(
      0,
      Math.round(base.total + (+totalIn.value - +totalIn.defaultValue))
    );
    totalEl.textContent = tweaked.toLocaleString();
    const pct = base.pct + Math.round(+deltaR.value / 5);
    deltaEl.textContent = (pct >= 0 ? "+" : "") + pct + "% today";
    gauge.style.width = clamp(50 + pct, 0, 100) + "%";

    const [w, a, r] = base.mix;
    $("#mixWeb").style.width = w + "%";
    $("#mixApp").style.width = a + "%";
    $("#mixRes").style.width = r + "%";
    $("#mixWebV").textContent = w + "%";
    $("#mixAppV").textContent = a + "%";
    $("#mixResV").textContent = r + "%";
  }

  [totalIn, deltaR, barsR, smoothR].forEach((el) =>
    el.addEventListener("input", update)
  );
  ensureBars(chart, +barsR.value);
  update();
}

/* ============================
      PRICING
      ============================ */
function initPricing() {
  const chart = $("#priceChart");
  if (!chart) return;
  const dateIn = $("#priceDate"),
    typeSel = $("#ticketType"),
    segSel = $("#segment");
  const demR = $("#dem"),
    daysR = $("#days"),
    demV = $("#demV"),
    daysV = $("#daysV");
  const minNum = $("#minNum"),
    maxNum = $("#maxNum"),
    minRng = $("#minRng"),
    maxRng = $("#maxRng");
  const priceKPI = $("#priceKPI"),
    bandFill = $("#bandFill");

  dateIn.value = todayStr();

  const tierBand = {
    GA: { min: 45000, max: 95000 },
    VIP: { min: 90000, max: 220000 },
    EARLY: { min: 30000, max: 70000 },
  };
  const segMult = {
    SUPERFAN: 1.1,
    EARLYBIRD: 0.93,
    LASTMIN: 1.15,
    BARGAIN: 0.87,
    LOCAL: 0.96,
  };
  function applyBand() {
    const t = tierBand[typeSel.value],
      m = segMult[segSel.value] || 1;
    const mi = Math.round(t.min * m),
      ma = Math.round(t.max * m);
    minNum.value = mi;
    maxNum.value = ma;
    minRng.value = mi;
    maxRng.value = ma;
  }
  function syncPair(a, b) {
    const on = (e) => {
      if (e.target === a) {
        b.value = a.value;
      } else {
        a.value = b.value;
      }
      update();
    };
    a.addEventListener("input", on);
    b.addEventListener("input", on);
  }
  syncPair(minRng, minNum);
  syncPair(maxRng, maxNum);

  function baseFor(key) {
    const rnd = seededRng(key);
    return {
      dailyDemand: clamp(0.35 + rnd() * 0.7, 0, 1),
      spark: (n) => {
        const r2 = seededRng(key + "|spark");
        return Array.from(
          { length: n },
          (_, i) => 0.92 + Math.sin(i / 2) / 20 + (r2() - 0.5) * 0.08
        );
      },
    };
  }

  function calc() {
    const iso = dateIn.value || todayStr();
    const key = `price|${iso}|${typeSel.value}|${segSel.value}`;
    const b = baseFor(key);
    const min = +minNum.value,
      max = +maxNum.value;
    const dUser = +demR.value,
      t = +daysR.value;
    const dBlend = clamp(0.6 * dUser + 0.4 * b.dailyDemand, 0, 1);
    const tFac = clamp(1 - t / 90, 0, 1);
    const score = clamp(0.25 + 0.6 * dBlend + 0.15 * tFac, 0, 1);
    const price = min + (max - min) * score;
    return { price, spark: b.spark(12).map((f) => price * f) };
  }

  function update() {
    demV.textContent = (+demR.value).toFixed(2);
    daysV.textContent = daysR.value;
    const { price, spark } = calc();
    priceKPI.textContent = fmtUGX(price);
    const min = +minNum.value,
      max = +maxNum.value;
    const pct = ((price - min) / Math.max(1, max - min)) * 100;
    bandFill.style.width = clamp(pct, 0, 100) + "%";
    ensureBars(chart, 12);
    setBars(chart, spark);
  }

  [
    dateIn,
    typeSel,
    segSel,
    demR,
    daysR,
    minNum,
    minRng,
    maxNum,
    maxRng,
  ].forEach((el) => el.addEventListener("input", update));
  applyBand();
  update();
}

/* ============================
      ATTENDANCE
      ============================ */
function initAttendance() {
  const chart = $("#attChart");
  if (!chart) return;
  const attExp = $("#attExp"),
    attUnc = $("#attUnc"),
    attKPI = $("#attKPI"),
    ciBadge = $("#ciBadge"),
    attConf = $("#attConf");
  ensureBars(chart, 8);

  function update() {
    const exp = +attExp.value * (0.98 + Math.random() * 0.04);
    const unc = +attUnc.value;
    attKPI.textContent = Math.round(exp).toLocaleString();
    ciBadge.textContent = `${Math.round((1 - unc / 100) * 100)}–${Math.round(
      (1 + unc / 100) * 100
    )}% CI`.replace(".", "");
    attConf.style.width =
      clamp(100 - unc * 3.2 + (Math.random() - 0.5) * 4, 5, 100) + "%";

    const weeks = 8;
    const curve = Array.from(
      { length: weeks },
      (_, i) => Math.pow((i + 1) / weeks, 1.6) * (0.95 + Math.random() * 0.1)
    );
    setBars(
      chart,
      curve.map((v) => (v * exp) / weeks)
    );
  }
  [attExp, attUnc].forEach((el) => el.addEventListener("input", update));
  update();
}

/* ============================
      FRAUD
      ============================ */
function initFraud() {
  const chart = $("#fraudChart");
  if (!chart) return;
  const dateIn = $("#fraudDate"),
    prev = $("#fraudPrev"),
    next = $("#fraudNext");
  const riskBar = $("#riskBar"),
    riskBadge = $("#riskBadge"),
    list = $("#fraudList");
  const susNum = $("#susCount"),
    riskPct = $("#riskPct");

  dateIn.value = todayStr();
  prev.addEventListener("click", () => {
    dateIn.value = shiftDate(dateIn.value, -1);
    update();
  });
  next.addEventListener("click", () => {
    dateIn.value = shiftDate(dateIn.value, +1);
    update();
  });
  dateIn.addEventListener("input", update);

  const TPL = [
    "IP mismatch → high-risk region",
    "Card velocity spike ({x}/min)",
    "BIN {x} flagged",
    "Email age < {x} months",
    "Resale pattern across {x} wallets",
    "Proxy/VPN detected",
    "Chargeback cluster proximity {x} km",
    "Device fingerprint mismatch",
  ];

  function base(iso) {
    const rnd = seededRng("fraud|" + iso);
    const count = Math.max(0, Math.round(rnd() * 20 - 2 + rnd() * 3));
    const risk = Math.round(10 + rnd() * 55);
    const series = Array.from(
      { length: 10 },
      (_, i) =>
        (0.3 + rnd() * 0.7) * (0.5 + risk / 100) * (1 + Math.sin(i * 1.3) * 0.2)
    );
    const notes = Array.from({ length: 4 }, () =>
      TPL[Math.floor(rnd() * TPL.length)].replace(
        "{x}",
        Math.max(1, Math.floor(rnd() * 16))
      )
    );
    return { count, risk, series, notes };
  }

  function update() {
    const iso = dateIn.value || todayStr();
    const b = base(iso);
    const count = b.count + Math.round(+susNum.value - +susNum.defaultValue);
    const risk = clamp(b.risk + Math.round((+riskPct.value - 22) / 5), 0, 100);
    riskBar.style.width = risk + "%";
    riskBadge.textContent = `${Math.max(0, count)} suspicious`;
    ensureBars(chart, 10);
    setBars(
      chart,
      b.series.map((v) => v * (0.95 + risk / 1000))
    );
    list.innerHTML = b.notes.map((n) => `<li>${n}</li>`).join("");
  }
  [susNum, riskPct].forEach((el) => el.addEventListener("input", update));
  update();
}

/* ============================
      WALLET (tickets + QR)
      ============================ */
function qrSVG(text) {
  // Simple deterministic mosaic (not a real QR; demo only)
  const size = 21,
    scale = 4,
    r = seededRng("qr|" + text);
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder =
        (x < 5 && y < 5) || (x > size - 6 && y < 5) || (x < 5 && y > size - 6);
      let on = finder
        ? x % 5 === 0 || y % 5 === 0 || (x > 0 && x < 4 && y > 0 && y < 4)
        : r() > 0.5;
      if (on)
        rects += `<rect x="${x * scale}" y="${
          y * scale
        }" width="${scale}" height="${scale}" />`;
    }
  }
  const w = size * scale,
    h = w;
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' fill='%23000'>${rects}</svg>`;
}

function initWallet() {
  const wrap = $("#tickets");
  if (!wrap) return;
  const iso = todayStr();
  const rng = seededRng("wallet|" + iso);
  const pts = 120 + Math.round(rng() * 400);
  $("#loyaltyPts").textContent = pts + " pts";

  const tickets = [
    {
      id: "SUNSET-2025-GA-00123",
      holder: "A. Example",
      event: "Sunset Fest 2025",
      when: "Sat 20 Sep · Arena Milano",
    },
    {
      id: "SUNSET-2025-VIP-00007",
      holder: "B. Example",
      event: "Sunset Fest 2025",
      when: "Sat 20 Sep · Arena Milano",
    },
    {
      id: "CITY-OPEN-2025-EB-00456",
      holder: "A. Example",
      event: "City Open 2025",
      when: "Fri 11 Jul · Nationale Arena",
    },
  ];
  wrap.innerHTML = tickets
    .map(
      (t) =>
        `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
          <div>
            <div style="font-weight:800">${t.event}</div>
            <div class="small">${t.when}</div>
            <div class="small">Ticket: <code>${t.id}</code></div>
          </div>
          <img alt="QR" style="background:#fff;border-radius:8px;padding:4px" src="${qrSVG(
            t.id
          )}"/>
        </div>`
    )
    .join("");
}

/* Utilities used by Payments to append tickets & points */
function addTicketToWallet(t) {
  const wrap = $("#tickets");
  if (!wrap) return;
  const html = `
       <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
         <div>
           <div style="font-weight:800">${t.event}</div>
           <div class="small">${t.when}</div>
           <div class="small">Ticket: <code>${t.id}</code></div>
           <div class="small">Name: <strong>${t.name}</strong></div>
         </div>
         <img alt="QR" style="background:#fff;border-radius:8px;padding:4px" src="${qrSVG(
           t.id
         )}"/>
       </div>`;
  wrap.insertAdjacentHTML("afterbegin", html);
}
function bumpLoyalty(pts) {
  const el = $("#loyaltyPts");
  const cur = parseInt((el.textContent || "0").replace(/\D/g, "")) || 0;
  el.textContent = cur + (pts || 0) + " pts";
}
function buildTicketId(type) {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  const prefix = type === "VIP" ? "VIP" : type === "EARLY" ? "EB" : "GA";
  return `SUNSET-2025-${prefix}-${rnd}`;
}
function showToast(el) {
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 2000);
}
/* ============================
      EVENTS (create + list + receipt)
      ============================ */
const EV_KEY = "events.list";

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(EV_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveEvents(arr) {
  localStorage.setItem(EV_KEY, JSON.stringify(arr));
}

function seedEventsDemo() {
  const have = loadEvents();
  if (have.length) return;
  const today = new Date();
  const plusDays = (d) => {
    const dt = new Date();
    dt.setDate(today.getDate() + d);
    const iso = dt.toISOString();
    return { date: iso.slice(0, 10), time: "19:30" };
  };
  const demo = [
    {
      id: cryptoRandomId(),
      title: "Sunset Fest 2025",
      venue: "Arena Milano",
      city: "Milan",
      ...plusDays(21),
      cap: 25000,
      priceGA: 95000,
      priceVIP: 185000,
      desc: "Open-air summer festival with headliners and DJs.",
    },
    {
      id: cryptoRandomId(),
      title: "City Open 2025",
      venue: "Nationale Arena",
      city: "Bucharest",
      ...plusDays(45),
      cap: 18000,
      priceGA: 65000,
      priceVIP: 120000,
      desc: "International tennis event: main draw night sessions.",
    },
  ];
  saveEvents(demo);
}
function cryptoRandomId() {
  // short readable id for demo
  return "EVT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function renderEventsTable() {
  const rows = loadEvents().sort((a, b) =>
    (a.date + b.time).localeCompare(b.date + b.time)
  );
  const empty = $("#evEmpty");
  const wrap = $("#evTableWrap");
  const tb = $("#evTable");
  const cnt = $("#evCount");
  if (!tb) return;

  if (!rows.length) {
    empty && (empty.style.display = "block");
    wrap && (wrap.style.display = "none");
    cnt && (cnt.textContent = "0");
    tb.innerHTML = "";
    return;
  }
  empty && (empty.style.display = "none");
  wrap && (wrap.style.display = "block");
  cnt && (cnt.textContent = String(rows.length));

  const fmtDate = (d, t) => {
    const dt = new Date(`${d}T${t || "19:30"}:00`);
    return (
      dt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }) +
      " " +
      dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  tb.innerHTML = rows
    .map(
      (ev) => `
       <tr>
         <td><strong>${ev.title}</strong></td>
         <td>${fmtDate(ev.date, ev.time)}</td>
         <td>${ev.venue}, ${ev.city}</td>
         <td>GA ${fmtUGX(ev.priceGA)} · VIP ${fmtUGX(ev.priceVIP)}</td>
         <td style="text-align:right">
           <button class="pill" data-receipt="${ev.id}">Receipt</button>
         </td>
       </tr>
     `
    )
    .join("");

  // Bind receipt buttons
  tb.querySelectorAll("[data-receipt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = rows.find((r) => r.id === btn.getAttribute("data-receipt"));
      generateReceiptPrompt(ev);
    });
  });
}

function initEvents() {
  const title = $("#evTitle"),
    desc = $("#evDesc"),
    venue = $("#evVenue"),
    city = $("#evCity");
  const date = $("#evDate"),
    time = $("#evTime"),
    cap = $("#evCap");
  const pGA = $("#evPriceGA"),
    pVIP = $("#evPriceVIP");

  if (!title || !$("#events")) return;

  // sensible defaults
  const d = new Date();
  d.setDate(d.getDate() + 14);
  date.value = d.toISOString().slice(0, 10);

  $("#evReset")?.addEventListener("click", () => {
    title.value = "";
    desc.value = "";
    venue.value = "";
    city.value = "";
    const dt = new Date();
    dt.setDate(dt.getDate() + 14);
    date.value = dt.toISOString().slice(0, 10);
    time.value = "19:30";
    cap.value = 25000;
    pGA.value = 95000;
    pVIP.value = 185000;
  });

  $("#evCreate")?.addEventListener("click", () => {
    const payload = {
      id: cryptoRandomId(),
      title: (title.value || "").trim(),
      desc: (desc.value || "").trim(),
      venue: (venue.value || "").trim(),
      city: (city.value || "").trim(),
      date: date.value,
      time: time.value || "19:30",
      cap: Math.max(0, +cap.value || 0),
      priceGA: Math.max(0, +pGA.value || 0),
      priceVIP: Math.max(0, +pVIP.value || 0),
    };
    if (!payload.title) return alert("Please enter a title.");
    if (!payload.venue || !payload.city)
      return alert("Please enter venue and city.");
    if (!payload.date) return alert("Please pick a date.");

    const all = loadEvents();
    all.push(payload);
    saveEvents(all);
    renderEventsTable();
    alert("Event created ✔");
  });

  seedEventsDemo();
  renderEventsTable();
}

/* ---- Receipt generator (printable) ---- */
function generateReceiptPrompt(ev) {
  if (!ev) return;
  const buyer =
    prompt("Buyer name (for receipt):", "A. Example") || "A. Example";
  const qty = Math.max(1, +(prompt("Quantity:", "2") || 1));
  const tier = (
    prompt("Ticket tier (GA/VIP/EARLY):", "GA") || "GA"
  ).toUpperCase();
  const method = (
    prompt("Payment method (visa/mc/apple/paypal):", "visa") || "visa"
  ).toLowerCase();

  const unit = tier === "VIP" ? ev.priceVIP : ev.priceGA;
  openReceiptWindow({
    event: ev,
    buyer,
    qty,
    tier,
    method,
    unit,
    total: unit * qty,
    receiptNo: "R-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
  });
}

function openReceiptWindow({
  event: ev,
  buyer,
  qty,
  tier,
  method,
  unit,
  total,
  receiptNo,
}) {
  const w = window.open("", "_blank");
  if (!w) return alert("Pop-up blocked. Allow pop-ups to see the receipt.");

  const dt = new Date(`${ev.date}T${ev.time || "19:30"}:00`);
  const when = dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  w.document.write(`
   <!doctype html><html><head><meta charset="utf-8">
   <title>Receipt ${receiptNo}</title>
   <style>
     body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,system-ui; background:#0b0f14; color:#e5eef5; padding:24px;}
     .box{max-width:720px;margin:0 auto;background:#141b22;border:1px solid #263241;border-radius:16px;padding:24px;}
     h1{margin:0 0 6px;font-size:22px}
     .muted{color:#9fb3c8;font-size:13px}
     table{width:100%;border-collapse:collapse;margin-top:16px}
     th,td{padding:8px;border-bottom:1px solid #243242;text-align:left}
     tfoot td{border-top:1px solid #2c3b4b;font-weight:700}
     .right{text-align:right}
     .pill{display:inline-block;padding:4px 10px;border:1px solid #2b3948;border-radius:999px;font-size:12px}
     @media print{body{background:#fff;color:#000}.box{border-color:#ddd}}
   </style>
   </head><body>
     <div class="box">
       <h1>Payment Receipt</h1>
       <div class="muted">Receipt No. ${receiptNo}</div>
   
       <div style="margin-top:12px">
         <div><strong>${ev.title}</strong></div>
         <div class="muted">${ev.venue}, ${ev.city} • ${when}</div>
       </div>
   
       <div style="margin-top:12px">
         <span class="pill">${
           method === "mc"
             ? "Mastercard"
             : method === "visa"
             ? "Visa"
             : method === "apple"
             ? "Apple Pay"
             : method === "paypal"
             ? "PayPal"
             : method
         }</span>
         <span class="pill" style="margin-left:6px">${tier} ticket</span>
         <span class="pill" style="margin-left:6px">${qty} ×</span>
       </div>
   
       <table>
         <thead><tr><th>Description</th><th class="right">Unit</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead>
         <tbody>
           <tr>
             <td>${tier} – ${ev.title}</td>
             <td class="right">${fmtUGX(unit)}</td>
             <td class="right">${qty}</td>
             <td class="right">${fmtUGX(total)}</td>
           </tr>
         </tbody>
         <tfoot>
           <tr><td colspan="3" class="right">Total</td><td class="right">${fmtUGX(
             total
           )}</td></tr>
         </tfoot>
       </table>
   
       <div style="margin-top:14px" class="muted">
         Billed to: <strong>${buyer}</strong>
       </div>
       <div style="margin-top:16px">
         <button onclick="window.print()" style="padding:8px 14px;border-radius:10px;border:1px solid #2b3948;background:#0e151c;color:#e5eef5">Print / Save PDF</button>
       </div>
     </div>
   </body></html>
     `);
  w.document.close();
}

/* ============================
      PAYMENTS (with demo history)
      ============================ */

const PAY_KEY = "pay.history";

function loadPayments() {
  try {
    return JSON.parse(localStorage.getItem(PAY_KEY) || "[]");
  } catch {
    return [];
  }
}
function savePayments(arr) {
  localStorage.setItem(PAY_KEY, JSON.stringify(arr));
}

/* Seed a realistic history if none exists */
function seedPaymentsDemo() {
  const have = loadPayments();
  if (Array.isArray(have) && have.length) return;

  // create dates spaced out over the last ~3 weeks
  const now = Date.now();
  const days = (d) => new Date(now - d * 24 * 3600 * 1000).toISOString();

  const demo = [
    {
      ts: days(2),
      method: "visa",
      ticket: "GA",
      name: "A. Example",
      amount: 95000,
    },
    {
      ts: days(5),
      method: "apple",
      ticket: "VIP",
      name: "B. Example",
      amount: 185000,
    },
    {
      ts: days(9),
      method: "mc",
      ticket: "EARLY",
      name: "C. Example",
      amount: 65000,
    },
    {
      ts: days(12),
      method: "paypal",
      ticket: "GA",
      name: "D. Example",
      amount: 98000,
    },
    {
      ts: days(18),
      method: "visa",
      ticket: "GA",
      name: "E. Example",
      amount: 95000,
    },
  ];
  savePayments(demo);
}

function renderPaymentsHistory() {
  const rows = loadPayments().sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const empty = document.getElementById("payEmpty");
  const wrap = document.getElementById("payTableWrap");
  const tbody = document.getElementById("payTable");
  const count = document.getElementById("payCount");

  if (!tbody) return;

  if (!rows.length) {
    if (empty) empty.style.display = "block";
    if (wrap) wrap.style.display = "none";
    if (count) count.textContent = "0";
    tbody.innerHTML = "";
    return;
  }

  if (empty) empty.style.display = "none";
  if (wrap) wrap.style.display = "block";
  if (count) count.textContent = String(rows.length);

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };
  const label = (m) =>
    m === "apple"
      ? "Apple Pay"
      : m === "visa"
      ? "Visa"
      : m === "mc"
      ? "Mastercard"
      : m === "paypal"
      ? "PayPal"
      : m === "mtn"
      ? "MTN MoMo"
      : m === "airtel"
      ? "Airtel Money"
      : m;

  tbody.innerHTML = rows
    .map(
      (r) => `
       <tr>
         <td>${fmtDate(r.ts)}</td>
         <td>${label(r.method)}</td>
         <td>${r.ticket}</td>
         <td>${r.name || "—"}</td>
         <td style="text-align:right">UGX ${Number(
           r.amount || 0
         ).toLocaleString("en-UG")}</td>
       </tr>
     `
    )
    .join("");
}
function renderPaymentsHistory() {
  // ... existing code that fills #payTable ...
} // ← end of renderPaymentsHistory

// Live-refresh Payments when the attendee app writes to localStorage
addEventListener("storage", (e) => {
  if (e.key === PAY_KEY) {
    try {
      renderPaymentsHistory();
    } catch (_) {}
  }
});

// next line in your file is your initPayments() definition
function initPayments() {
  // ...
}

function initPayments() {
  const grid = document.getElementById("payMethods");
  const amount = document.getElementById("payAmount");
  const ttype = document.getElementById("payTicketType");
  const tname = document.getElementById("payName");
  const sum = document.getElementById("paySummary");
  const toast = document.getElementById("payToast");

  if (!grid) return;

  let method = null;

  // Seed demo history once, then render it
  seedPaymentsDemo();
  renderPaymentsHistory();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method");
    if (!btn) return;
    document
      .querySelectorAll(".pay-method")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    method = btn.dataset.method;
    updateSummary();
  });

  document.getElementById("useCurrentPrice")?.addEventListener("click", () => {
    const v =
      Number(document.getElementById("priceKPI")?.textContent || "").replace?.(
        /[^\d]/g,
        ""
      ) || 0;
    if (v > 0) {
      amount.value = v;
      updateSummary();
    }
  });

  document.getElementById("payReset")?.addEventListener("click", () => {
    method = null;
    document
      .querySelectorAll(".pay-method")
      .forEach((b) => b.classList.remove("active"));
    amount.value = 95000;
    ttype.value = "GA";
    tname.value = "";
    updateSummary();
  });

  document.getElementById("payNow")?.addEventListener("click", () => {
    if (!method) return alert("Choose a payment method.");
    const amt = +amount.value || 0;
    if (amt <= 0) return alert("Enter a valid amount.");

    // Save payment
    const rec = {
      ts: new Date().toISOString(),
      method,
      ticket: ttype.value,
      name: tname.value || "A. Example",
      amount: amt,
    };
    const all = loadPayments();
    all.push(rec);
    savePayments(all);
    renderPaymentsHistory();

    // Also reflect in Wallet + toast (if those helpers exist)
    try {
      addTicketToWallet({
        id: buildTicketId(ttype.value),
        event: "Sunset Fest 2025",
        when: "Sat 20 Sep · Arena Milano",
        name: rec.name,
      });
      bumpLoyalty?.(20);
    } catch {}

    if (toast) {
      toast.style.display = "block";
      setTimeout(() => (toast.style.display = "none"), 1800);
    }
  });

  document.getElementById("clearPayments")?.addEventListener("click", () => {
    savePayments([]);
    renderPaymentsHistory();
  });

  [amount, ttype, tname].forEach((el) =>
    el?.addEventListener("input", updateSummary)
  );
  updateSummary();

  function updateSummary() {
    if (!sum) return;
    const pretty = (n) => "UGX " + Number(n || 0).toLocaleString("en-UG");
    const mlabel =
      {
        apple: "Apple Pay",
        visa: "Visa",
        mc: "Mastercard",
        paypal: "PayPal",
        mtn: "MTN MoMo",
        airtel: "Airtel Money",
      }[method] || "—";
    sum.innerHTML = `
         <li>Method: <strong>${mlabel}</strong></li>
         <li>Amount: <strong>${pretty(amount.value)}</strong></li>
         <li>Ticket: <strong>${ttype.value}</strong></li>
         <li>Name: <strong>${tname.value || "—"}</strong></li>
       `;
  }
}

function initPayments() {
  const grid = document.getElementById("payMethods");
  if (!grid) return;
  const amount = document.getElementById("payAmount");
  const ttype = document.getElementById("payTicketType");
  const tname = document.getElementById("payName");
  const sum = document.getElementById("paySummary");
  const toast = document.getElementById("payToast");

  let method = null;

  // Seed demo history once
  seedPaymentsDemo();
  renderPaymentsHistory();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method");
    if (!btn) return;
    document
      .querySelectorAll(".pay-method")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    method = btn.dataset.method;
    updateSummary();
  });

  document.getElementById("useCurrentPrice")?.addEventListener("click", () => {
    const v = Number(
      (document.getElementById("priceKPI")?.textContent || "").replace(
        /[^0-9]/g,
        ""
      )
    );
    if (v > 0) {
      amount.value = v;
      updateSummary();
    }
  });

  document.getElementById("payReset")?.addEventListener("click", () => {
    method = null;
    document
      .querySelectorAll(".pay-method")
      .forEach((b) => b.classList.remove("active"));
    amount.value = 95000;
    ttype.value = "GA";
    tname.value = "";
    updateSummary();
  });

  document.getElementById("payNow")?.addEventListener("click", () => {
    if (!method) return alert("Choose a payment method.");
    const amt = +amount.value || 0;
    if (amt <= 0) return alert("Enter a valid amount.");

    // Save payment
    const rec = {
      ts: new Date().toISOString(),
      method,
      ticket: ttype.value,
      name: tname.value || "A. Example",
      amount: amt,
    };
    const all = loadPayments();
    all.push(rec);
    savePayments(all);
    renderPaymentsHistory();

    // Also reflect in Wallet + toast (existing helpers, if you kept them)
    try {
      addTicketToWallet({
        id: buildTicketId(ttype.value),
        event: "Sunset Fest 2025",
        when: "Sat 20 Sep · Arena Milano",
        name: rec.name,
      });
      bumpLoyalty(20);
    } catch (_) {}

    if (toast) {
      toast.style.display = "block";
      setTimeout(() => (toast.style.display = "none"), 1800);
    }
    // stay on Payments so the user sees history update
  });

  document.getElementById("clearPayments")?.addEventListener("click", () => {
    savePayments([]);
    renderPaymentsHistory();
  });

  [amount, ttype, tname].forEach((el) =>
    el?.addEventListener("input", updateSummary)
  );
  updateSummary();

  function updateSummary() {
    const pretty = (n) => "UGX " + Number(n || 0).toLocaleString("en-UG");
    if (!sum) return;
    sum.innerHTML = `
         <li>Method: <strong>${
           method
             ? {
                 apple: "Apple Pay",
                 visa: "Visa",
                 mc: "Mastercard",
                 paypal: "PayPal",
               }[method] || method
             : "—"
         }</strong></li>
         <li>Amount: <strong>${pretty(amount.value)}</strong></li>
         <li>Ticket: <strong>${ttype.value}</strong></li>
         <li>Name: <strong>${tname.value || "—"}</strong></li>
       `;
  }
}

/* ============================
      LOGIN (demo)
      ============================ */
const DEMO_CREDS = {
  email: "organizer@ai-ticketing.demo",
  password: "Demo!2025",
  company: "123456",
};
let currentOTP = null;

function fillDemoCreds() {
  const e = $("#loginEmail"),
    p = $("#loginPass"),
    c = $("#loginCode"),
    t = $("#loginTrust");
  if (e) e.value = DEMO_CREDS.email;
  if (p) p.value = DEMO_CREDS.password;
  if (c) c.value = DEMO_CREDS.company;
  if (t) t.checked = true;
}

function sendOTP() {
  $("#pushToast").style.display = "block";
  currentOTP = String(Math.floor(100000 + Math.random() * 900000));
  $("#otpBox").style.display = "block";
}
function approveOTP() {
  if (!currentOTP) sendOTP();
  $("#otpInput").value = currentOTP;
  $("#pushToast").style.display = "none";
}
function denyOTP() {
  $("#pushToast").style.display = "none";
  alert("Sign-in denied.");
}
function verifyOTP() {
  const v = $("#otpInput").value.trim();
  if (v && currentOTP && v === currentOTP) {
    setAuth(true);
    location.hash = "#sales";
    showApp();
  } else {
    alert("Invalid code.");
  }
}

function installLoginHandlers() {
  const form = $("#loginForm");
  const emailEl = $("#loginEmail");
  const passEl = $("#loginPass");
  const codeEl = $("#loginCode");
  const demoBtn = $("#fillDemoBtn");
  const otpBtn = $("#otpBtn");

  if (!form) return;

  demoBtn?.addEventListener("click", () => {
    fillDemoCreds();
    emailEl.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok =
      emailEl.value.trim().toLowerCase() === DEMO_CREDS.email &&
      passEl.value === DEMO_CREDS.password &&
      codeEl.value.trim() === DEMO_CREDS.company &&
      $("#loginTrust")?.checked === true;

    if (ok) {
      setAuth(true);
      location.hash = "#sales";
      showApp();
    } else {
      alert("Invalid credentials. Tip: click “Use demo creds”.");
    }
  });

  otpBtn?.addEventListener("click", () => sendOTP());

  $("#signOutLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    setAuth(false);
    location.hash = "#login";
    showLogin();
  });
}

/* ============================
      Boot
      ============================ */
document.addEventListener("DOMContentLoaded", () => {
  // Default experience: show app immediately (no blocking login)
  showApp();

  initTabs();
  initSales();
  initPricing();
  initAttendance();
  initFraud();
  initWallet();
  initPayments();
  initSession();
  installLoginHandlers();
  initEvents(); // ← add this

  // >>> ADD THIS one-liner RIGHT HERE <<<
  if (location.hash && location.hash !== "#login") {
    document.querySelector(`[data-tab-link][href="${location.hash}"]`)?.click();
  }

  // If the URL was #login and user isn’t authenticated, show login
  if (location.hash === "#login" && !isAuth()) {
    showLogin();
  }
});
