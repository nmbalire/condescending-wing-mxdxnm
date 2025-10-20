/* ============================
   Attendee App with Images
   ============================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmtUGX = (n) => "UGX " + Math.round(n).toLocaleString("en-UG");
/* === QR helper (demo mosaic, deterministic per text) === */
function qrSVG(text) {
  const size = 21,
    scale = 4;
  let h = 2166136261 >>> 0; // simple seeded hash
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    // xorshift-ish PRNG
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };

  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder =
        (x < 5 && y < 5) || (x > size - 6 && y < 5) || (x < 5 && y > size - 6);
      const on = finder
        ? x % 5 === 0 || y % 5 === 0 || (x > 0 && x < 4 && y > 0 && y < 4)
        : rand() > 0.5;
      if (on)
        rects += `<rect x="${x * scale}" y="${
          y * scale
        }" width="${scale}" height="${scale}"/>`;
    }
  }
  const w = size * scale;
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${w}' width='${w}' height='${w}' fill='%23000'>${rects}</svg>`;
}
/* === Build a human-readable ticket ID for the event/tier === */
function buildTicketId(ev, tier) {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  const prefix = tier === "VIP" ? "VIP" : tier === "EARLY" ? "EB" : "GA";
  const tag =
    (ev.title || "EVENT")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 10)
      .toUpperCase() || "EVENT";
  return `${tag}-${prefix}-${rnd}`;
}

const EV_KEY = "events.list";
const PAY_KEY = "pay.history";
const ORD_KEY = "orders.self"; // orders on this device

function load(key, def) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(def));
  } catch {
    return def;
  }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* ---- Posters & venue images for known demo events ---- */
const IMG_MAP = [
  {
    match: /sunset|fest/i,
    poster: "assets/sunset.jpg",
    venue: "assets/arena-milano.jpg",
  },
  {
    match: /city open|tennis/i,
    poster: "assets/tennis.jpg",
    venue: "assets/nationale-arena.jpg",
  },
];

function attachImages(ev) {
  for (const r of IMG_MAP) {
    if (r.match.test(ev.title)) {
      return { ...ev, poster: r.poster, venueImg: r.venue };
    }
  }
  // defaults if not matched
  return { ...ev, poster: "", venueImg: "" };
}

/* Fallback: make a nice data-URI poster if file missing */
function posterPlaceholder(title, w = 800, h = 420) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const svg = `
     <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
       <defs>
         <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
           <stop offset="0" stop-color="#0ea5e9"/>
           <stop offset="1" stop-color="#a78bfa"/>
         </linearGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
       <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
             font-family="system-ui,Segoe UI,Roboto,Inter" font-size="34" fill="white"
             style="paint-order:stroke;stroke:#000;stroke-width:2;opacity:.95">
         ${esc(title)}
       </text>
     </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* Seed two demo events if organizer hasn’t created any yet */
function seedEventsIfEmpty() {
  const have = load(EV_KEY, []);
  if (have.length) return;
  const addDays = (d) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return { date: t.toISOString().slice(0, 10), time: "19:30" };
  };
  const demo = [
    {
      id: "EVT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      title: "Sunset Fest 2025",
      venue: "Arena Milano",
      city: "Milan",
      ...addDays(21),
      priceGA: 95000,
      priceVIP: 185000,
      desc: "Open-air summer festival with headliners and DJs.",
    },
    {
      id: "EVT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      title: "Nambole std",
      venue: "Nationale Arena",
      city: "Bucharest",
      ...addDays(45),
      priceGA: 65000,
      priceVIP: 120000,
      desc: "International tennis event: main draw night sessions.",
    },
  ];
  save(EV_KEY, demo);
}

/* Render event cards with posters */
function renderEvents() {
  const list = load(EV_KEY, []).map(attachImages);
  const q = ($("#q")?.value || "").trim().toLowerCase();
  const filtered = list.filter((ev) => {
    const hay = (ev.title + " " + ev.city + " " + ev.venue).toLowerCase();
    return hay.includes(q);
  });

  const grid = $("#events"),
    empty = $("#noEvents");
  grid.innerHTML = "";
  if (!filtered.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  filtered.forEach((ev) => {
    const card = document.createElement("div");
    card.className = "card ev-card";

    // img (poster)
    const img = document.createElement("img");
    img.alt = `${ev.title} poster`;
    img.src = ev.poster || posterPlaceholder(ev.title);
    img.addEventListener("error", () => {
      img.src = posterPlaceholder(ev.title);
    });
    card.appendChild(img);

    // header row
    const row = document.createElement("div");
    row.className = "row space";
    const left = document.createElement("div");
    left.innerHTML = `
         <div class="ev-title">${ev.title}</div>
         <div class="small">${ev.venue}, ${ev.city} • ${new Date(
      ev.date + "T" + (ev.time || "19:30") + ":00"
    ).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })}
           ${ev.time || "19:30"}</div>
       `;
    const kpi = document.createElement("div");
    kpi.className = "kpi";
    kpi.textContent = `from ${fmtUGX(ev.priceGA)}`;
    row.appendChild(left);
    row.appendChild(kpi);
    card.appendChild(row);

    // description
    const p = document.createElement("p");
    p.className = "small";
    p.textContent = ev.desc || "";
    card.appendChild(p);

    // buy button
    const actions = document.createElement("div");
    actions.className = "row";
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Buy";
    btn.addEventListener("click", () => startCheckout(ev));
    actions.style.marginTop = "8px";
    actions.appendChild(btn);
    card.appendChild(actions);

    grid.appendChild(card);
  });
}

/* Checkout state */
let curEvent = null;
let curMethod = null;

function startCheckout(ev) {
  curEvent = ev;
  curMethod = null;

  const wrap = $("#checkout");
  wrap.style.display = "block";

  const dt = new Date(ev.date + "T" + (ev.time || "19:30") + ":00");
  const when = dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sum = $("#evSummary");
  sum.innerHTML = `
       <div class="row" style="align-items:flex-start">
         <img class="venue-thumb" id="venueThumb" alt="Venue image">
         <div>
           <div><strong>${ev.title}</strong></div>
           <div class="small">${ev.venue}, ${ev.city} • ${when}</div>
         </div>
       </div>
     `;
  const thumb = $("#venueThumb");
  thumb.src = ev.venueImg || posterPlaceholder(ev.venue);
  thumb.addEventListener("error", () => {
    thumb.src = posterPlaceholder(ev.venue);
  });

  // defaults
  $("#tier").value = "GA";
  $("#qty").value = 2;
  $("#buyer").value = "";

  updateTotal();
}

function updateTotal() {
  if (!curEvent) return;
  const tier = $("#tier").value;
  const qty = Math.max(1, +$("#qty").value || 1);
  const unit = tier === "VIP" ? curEvent.priceVIP : curEvent.priceGA;
  $("#totalKPI").textContent = fmtUGX(unit * qty);
  const txt =
    {
      apple: "Apple Pay",
      visa: "Visa",
      mc: "Mastercard",
      paypal: "PayPal",
      mtn: "MTN MoMo",
      airtel: "Airtel Money",
    }[curMethod] || "—";

  $("#payNote").textContent = `Method: ${txt}`;
}

/* Payments from attendee side: write to PAY_KEY + own order list */
function pushPayment({ method, tier, qty, buyer }) {
  const unit = tier === "VIP" ? curEvent.priceVIP : curEvent.priceGA;
  const total = unit * qty;
  const ts = new Date().toISOString();

  // generate unique ticket codes (one per ticket)
  const codes = Array.from({ length: qty }, () =>
    buildTicketId(curEvent, tier)
  );

  // write to organizer's Payments history (kept simple/compatible)
  const rec = {
    ts,
    method,
    ticket: tier,
    name: buyer || "A. Example",
    amount: total,
  };
  const all = load(PAY_KEY, []);
  all.push(rec);
  save(PAY_KEY, all);

  // save a rich order locally for the attendee (includes codes)
  const order = {
    id: "ORD-" + Math.random().toString(36).slice(2, 9).toUpperCase(),
    ts,
    event: curEvent.title,
    venue: curEvent.venue,
    city: curEvent.city,
    date: curEvent.date,
    time: curEvent.time || "19:30",
    tier,
    qty,
    unit,
    total,
    method,
    buyer: buyer || "A. Example",
    codes,
  };
  const mine = load(ORD_KEY, []);
  mine.push(order);
  save(ORD_KEY, mine);

  renderOrders();
  return order; // so the caller can immediately open the receipt
}

/* Render orders table (this device) */
function renderOrders() {
  const rows = load(ORD_KEY, []).sort(
    (a, b) => new Date(b.ts) - new Date(a.ts)
  );
  const empty = $("#ordersEmpty"),
    wrap = $("#ordersWrap"),
    tb = $("#ordersTable"),
    cnt = $("#orderCount");
  if (!rows.length) {
    empty.style.display = "block";
    wrap.style.display = "none";
    cnt.textContent = "0";
    tb.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  wrap.style.display = "block";
  cnt.textContent = String(rows.length);

  const fmt = (iso) => {
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

  tb.innerHTML = rows
    .map(
      (r) => `
       <tr>
         <td>${fmt(r.ts)}</td>
         <td>${r.event}</td>
         <td>${r.tier}</td>
         <td>${r.qty}</td>
         <td style="text-align:right">${fmtUGX(r.total)}</td>
         <td style="text-align:right"><button class="pill" data-rec="${
           r.ts
         }">Receipt</button></td>
       </tr>
     `
    )
    .join("");

  // receipt buttons
  tb.querySelectorAll("[data-rec]").forEach((b) => {
    b.addEventListener("click", () => {
      const row = rows.find((x) => x.ts === b.getAttribute("data-rec"));
      openQuickReceipt(row);
    });
  });
}

/* Simple printable receipt */
function openQuickReceipt(o) {
  const w = window.open("", "_blank");
  if (!w) return;

  const when = new Date(o.ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const codesHTML = (o.codes || [])
    .map(
      (code) => `
       <div class="code">
         <div class="code-text">${code}</div>
         <img alt="QR for ${code}" src="${qrSVG(code)}">
       </div>
     `
    )
    .join("");

  w.document.write(`
   <!doctype html>
   <html>
   <head>
   <meta charset="utf-8">
   <title>Receipt ${o.id || ""}</title>
   <style>
     body{font-family:system-ui,Segoe UI,Roboto,Inter;padding:24px;background:#0b0f14;color:#e5eef5}
     .box{max-width:720px;margin:0 auto;background:#141b22;border:1px solid #263241;border-radius:16px;padding:24px}
     h1{margin:0 0 8px;font-size:22px}
     .muted{color:#9fb3c8;font-size:13px}
     table{width:100%;border-collapse:collapse;margin-top:14px}
     th,td{padding:8px;border-bottom:1px solid #243242;text-align:left}
     tfoot td{border-top:1px solid #2c3b4b;font-weight:700}
     .right{text-align:right}
     .codes{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:14px}
     .code{display:flex;align-items:center;justify-content:space-between;border:1px solid #2b3948;border-radius:12px;padding:10px;background:#0e151c}
     .code img{background:#fff;border-radius:8px;padding:4px}
     .code-text{font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace}
     @media print{body{background:#fff;color:#000}.box{border-color:#ddd}}
   </style>
   </head>
   <body>
     <div class="box">
       <h1>Payment Receipt</h1>
       <div class="muted">${o.id ? "Order " + o.id + " • " : ""}${when}</div>
   
       <div style="margin-top:10px">
         <div><strong>${o.event || ""}</strong></div>
         <div class="muted">${o.venue || ""}${o.city ? ", " + o.city : ""} • ${
    o.date || ""
  } ${o.time || ""}</div>
       </div>
   
       <div style="margin-top:10px">
         <span class="muted">Method:</span>
         <strong>${
           o.method === "mc"
             ? "Mastercard"
             : o.method === "visa"
             ? "Visa"
             : o.method === "apple"
             ? "Apple Pay"
             : o.method === "paypal"
             ? "PayPal"
             : o.method === "mtn"
             ? "MTN MoMo"
             : o.method === "airtel"
             ? "Airtel Money"
             : "—"
         }</strong>
        
       </div>
   
       <table>
         <thead><tr><th>Description</th><th class="right">Unit</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead>
         <tbody>
           <tr>
             <td>${o.tier} – ${o.event || ""}</td>
             <td class="right">${fmtUGX(
               o.unit || Math.round((o.total || 0) / (o.qty || 1))
             )}</td>
             <td class="right">${o.qty || 1}</td>
             <td class="right">${fmtUGX(o.total || 0)}</td>
           </tr>
         </tbody>
         <tfoot><tr><td colspan="3" class="right">Total</td><td class="right">${fmtUGX(
           o.total || 0
         )}</td></tr></tfoot>
       </table>
   
       ${
         o.codes && o.codes.length
           ? `
         <div style="margin-top:14px"><strong>Tickets</strong></div>
         <div class="codes">${codesHTML}</div>
       `
           : ""
       }
   
       <div style="margin-top:16px">
         <button onclick="window.print()" style="padding:8px 14px;border-radius:10px;border:1px solid #2b3948;background:#0e151c;color:#e5eef5">Print / Save PDF</button>
       </div>
     </div>
   </body>
   </html>`);
  w.document.close();
}

/* Wire up the UI */
document.addEventListener("DOMContentLoaded", () => {
  seedEventsIfEmpty();
  renderEvents();
  renderOrders();

  $("#q")?.addEventListener("input", renderEvents);

  // pay method buttons
  $("#payGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method");
    if (!btn) return;
    $$(".pay-method").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    curMethod = btn.dataset.method;
    updateTotal();
  });

  $("#tier")?.addEventListener("input", updateTotal);
  $("#qty")?.addEventListener("input", updateTotal);

  $("#cancel")?.addEventListener("click", () => {
    $("#checkout").style.display = "none";
  });

  $("#pay")?.addEventListener("click", () => {
    if (!curEvent) return;
    if (!curMethod) return alert("Choose a payment method.");
    const qty = Math.max(1, +$("#qty").value || 1);
    const buyer = ($("#buyer").value || "A. Example").trim();

    // simulate purchase
    pushPayment({ method: curMethod, tier: $("#tier").value, qty, buyer });
    alert(
      "Payment successful ✔  (Visible on organizer dashboard Payments history)"
    );
    $("#checkout").style.display = "none";
  });
});

/* Organizer dashboard will refresh automatically via `storage` event. */
