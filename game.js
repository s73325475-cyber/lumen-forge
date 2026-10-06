(() => {
  "use strict";

  const COLS = 5;
  const ROWS = 7;
  const BASE_ROWS = 5;
  const SIZE = COLS * ROWS;
  const HEAT_STONES = 1;
  const HEAT_CAP = 4;
  const MAX_TIER = 9;
  const SAVE_KEY = "lumen-forge-v1";
  const TAP_BASE = 16;
  const FINE = 30;
  const AUTO_CAP = 24 * FINE;
  const YIELD_CAP = 24 * FINE;
  const HAMMER_CAP = 30 * FINE;
  const MINE_CAP = 16 * FINE;
  const REFINE_CAP = 24 * FINE;
  const SENSE_CAP = 30 * FINE;
  const TRADE_CAP = 24 * FINE;
  const AUTO_ENERGY_MIN = 13;
  const AUTO_ENERGY_MAX = 80;
  const AUTO_COIN_MIN = 1;
  const AUTO_COIN_MAX = 6;
  const YIELD_MIN = 0.05;
  const YIELD_MAX = 0.7;
  const TAP_MAX = 48;
  const MINE_EXTRA_MAX = 1;
  const REFINE_T3_MAX = 0.25;
  const REFINE_UP_MAX = 0.7;
  const SENSE_MIN = 2;
  const SENSE_MAX = 6;
  const TRADE_MIN = 1;
  const TRADE_MAX = 2;
  const COMBO_MS = 3400;
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TIER = ["", "먼지", "조각", "수정", "보석", "유성", "성핵", "은하", "루멘", "극광"];
  const HUNTS = [
    { game: "성수 사냥", monster: "유성충" },
    { game: "성수 사냥", monster: "유리나방" },
    { game: "성수 사냥", monster: "심연게" },
    { game: "성수 사냥", monster: "금살쾡이" },
  ];
  const TIER_COLOR = ["", "#d5deea", "#3ec6ea", "#3d6dff", "#3cbe2a", "#f09a4a", "#ef3b3b", "#e23d9a", "#f2e27a", "#8b4dff"];
  const RANKS = ["수습 대장", "견습 세공사", "별 세공사", "보석 장인", "유성 대장", "성핵 명인", "은하 조율사", "루멘 마스터"];
  const COACH = [
    "금빛 모서리가 있는 같은 조각을, 빛나는 칸으로 겹쳐 보세요.",
    "아래 별을 여러 번 두드리면 에너지가 차고 새 먼지가 나옵니다.",
    "필요한 개수가 모이면 주문 카드가 밝아집니다. 눌러 보세요.",
  ];
  function grow(level, cap, from, to) {
    if (level <= 0 || cap <= 0) return from;
    const t = Math.min(1, level / cap);
    return from + (to - from) * t;
  }

  function surge(level, cap) {
    if (level <= 0 || cap <= 0) return 0;
    return Math.sqrt(Math.min(1, level / cap));
  }

  function autoEnergyRate(level) {
    if (level <= 0) return 0;
    return AUTO_ENERGY_MIN + (AUTO_ENERGY_MAX - AUTO_ENERGY_MIN) * surge(level, AUTO_CAP);
  }

  function yieldChance(level) {
    if (level <= 0) return 0;
    return grow(level, YIELD_CAP, YIELD_MIN, YIELD_MAX);
  }

  function migrateBoard(board) {
    if (board.length === SIZE) return board.slice();
    const next = Array(SIZE).fill(0);
    if (board.length === 25) {
      for (let i = 0; i < 25; i++) next[i] = board[i];
      return next;
    }
    if (board.length === 30) {
      const extras = [];
      for (let i = 0; i < 30; i++) {
        const row = Math.floor(i / 6);
        const col = i % 6;
        if (col < 5) next[row * 5 + col] = board[i];
        else if (board[i]) extras.push(board[i]);
      }
      for (let i = 25; i < SIZE && extras.length; i++) next[i] = extras.shift();
      return next;
    }
    return null;
  }

  function migrateIndex(index, length) {
    if (length !== 30) return index;
    const row = Math.floor(index / 6);
    const col = index % 6;
    return col < 5 ? row * 5 + col : -1;
  }

  function autoCoinRate(level) {
    if (level <= 0) return 0;
    return AUTO_COIN_MIN + (AUTO_COIN_MAX - AUTO_COIN_MIN) * surge(level, AUTO_CAP);
  }

  function tapEnergy(level) {
    return grow(level, HAMMER_CAP, TAP_BASE, TAP_MAX);
  }

  function mineExtra(level) {
    return grow(level, MINE_CAP, 0, MINE_EXTRA_MAX);
  }

  function refineOdds(level) {
    return {
      tier3: grow(level, REFINE_CAP, 0, REFINE_T3_MAX),
      tier2: grow(level, REFINE_CAP, 0, REFINE_UP_MAX),
    };
  }

  function sensePay(level) {
    return grow(level, SENSE_CAP, SENSE_MIN, SENSE_MAX);
  }

  function tradeMult(level) {
    return grow(level, TRADE_CAP, TRADE_MIN, TRADE_MAX);
  }

  const OPEN_AT = 30;
  const UPS = [
    { id: "auto", name: "자동 망치", max: AUTO_CAP, base: 36, premium: 0, blurb: "코인을 쓰면서 자동으로 두드립니다. 코인이 없으면 멈춥니다.", now: (s) => (s.up.auto ? `+${autoEnergyRate(s.up.auto).toFixed(1)}/초 · -${autoCoinRate(s.up.auto).toFixed(1)}` : "자동 두드리기 없음") },
    { id: "yield", name: "증산", max: YIELD_CAP, base: 24, premium: 8, gate: { id: "auto", level: OPEN_AT }, blurb: "자동 망치가 돌을 낼 때, 하나 더 나올 확률이 오릅니다.", now: (s) => `하나 더 ${(yieldChance(s.up.yield) * 100).toFixed(1)}%` },
    { id: "hammer", name: "망치", max: HAMMER_CAP, base: 16, premium: 5, gate: { id: "auto", level: OPEN_AT }, blurb: "한 번 두드릴 때 에너지가 더 찹니다.", now: (s) => `에너지 +${tapEnergy(s.up.hammer).toFixed(1)}` },
    { id: "mine", name: "채광", max: MINE_CAP, base: 22, premium: 11, gate: { id: "hammer", level: OPEN_AT }, blurb: "에너지가 찰 때 조각이 더 나올 수 있습니다.", now: (s) => `한 번에 ${(1 + mineExtra(s.up.mine)).toFixed(2)}개` },
    { id: "refine", name: "정련", max: REFINE_CAP, base: 18, premium: 15, gate: { id: "mine", level: OPEN_AT }, blurb: "더 높은 등급이 나올 확률이 오릅니다.", now: (s) => `상위 ${(refineOdds(s.up.refine).tier2 * 100).toFixed(1)}%` },
    { id: "sense", name: "공명", max: SENSE_CAP, base: 20, premium: 17, gate: { id: "refine", level: OPEN_AT }, blurb: "공명 칸에서 합치면 코인이 더 나옵니다.", now: (s) => `공명 +${sensePay(s.up.sense).toFixed(2)}코인` },
    { id: "trade", name: "장사", max: TRADE_CAP, base: 14, premium: 20, gate: { id: "sense", level: OPEN_AT }, blurb: "분해하면 받는 코인이 오릅니다.", now: (s) => `분해 ×${tradeMult(s.up.trade).toFixed(3)}` },
  ];

  const app = document.getElementById("app");
  const playEl = document.getElementById("play");
  const start = document.getElementById("start");
  const board = document.getElementById("board");
  const ordersEl = document.getElementById("orders");
  const coinsEl = document.getElementById("coins");
  const xpFill = document.getElementById("xp-fill");
  const xpLabel = document.getElementById("xp-label");
  const coach = document.getElementById("coach");
  const coachText = document.getElementById("coach-text");
  const selEl = document.getElementById("sel");
  const pipsEl = document.getElementById("pips");
  const microEl = document.getElementById("micro");
  const sellBtn = document.getElementById("sell");
  const tapBtn = document.getElementById("tap");
  const tapWrap = document.getElementById("tap-wrap");
  const comboEl = document.getElementById("combo");
  const comboLabel = comboEl.querySelector("b");
  const comboLife = comboEl.querySelector("i");
  const goalEl = document.getElementById("goal");
  const heatFill = document.getElementById("heat-fill");
  const heatLabel = document.getElementById("heat-label");
  const heatbar = document.getElementById("heatbar");
  const tapGain = document.getElementById("tap-gain");
  const toastEl = document.getElementById("toast");
  const fx = document.getElementById("fx");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalActions = document.getElementById("modal-actions");
  const shopList = document.getElementById("shop-list");
  const shopRank = document.getElementById("shop-rank");
  const soundBtn = document.getElementById("sound");
  const starsCanvas = document.getElementById("stars");
  const starCtx = starsCanvas.getContext("2d");

  const ghost = document.createElement("div");
  ghost.className = "gem ghost";
  ghost.hidden = true;
  app.appendChild(ghost);

  let state = null;
  let started = false;
  let pending = null;
  let audioCtx = null;
  let tapLock = 0;
  let toastTimer = 0;
  let toastOn = false;
  const toastQ = [];
  let saveTimer = 0;
  let pointer = null;
  let starPts = [];
  let cellEls = [];
  let liftEl = null;
  let hoverEl = null;
  let shopCards = null;
  let orderPaintKey = "";
  let energyRing = "";
  let energyAd = "";
  let energyGain = "";
  let energyMicro = "";
  let energyMicroAt = 0;
  let saveTick = 0;

  function fmt(n) {
    return Math.floor(n).toLocaleString("ko-KR");
  }

  function hasBatchim(word) {
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return false;
    return (c - 0xac00) % 28 !== 0;
  }

  function josa(word, withBatchim, without) {
    return word + (hasBatchim(word) ? withBatchim : without);
  }

  function rankName() {
    return RANKS[Math.min(RANKS.length - 1, state.level - 1)];
  }

  function missionSlots() {
    if (state.level >= 10) return 3;
    if (state.level >= 5) return 2;
    return 1;
  }

  function missionOpen(index) {
    return index >= 0 && index < missionSlots();
  }

  function needXp() {
    return 40 + (state.level - 1) * 45;
  }

  function trackOpen(id, up) {
    const spec = UPS.find((item) => item.id === id);
    const levels = up || (state && state.up) || {};
    if (!spec || !spec.gate) return true;
    if ((levels[spec.id] || 0) > 0) return true;
    return (levels[spec.gate.id] || 0) >= spec.gate.level;
  }

  function gateRows(up) {
    let rows = BASE_ROWS;
    if (trackOpen("refine", up)) rows += 1;
    if (trackOpen("trade", up)) rows += 1;
    return Math.min(ROWS, rows);
  }

  function openRows(up, board) {
    const levels = up || (state && state.up);
    const cells = board === undefined ? (state && state.board) : board;
    let rows = gateRows(levels);
    if (cells) {
      for (let i = rows * COLS; i < SIZE; i++) {
        if (cells[i]) rows = Math.floor(i / COLS) + 1;
      }
    }
    return Math.min(ROWS, rows);
  }

  function cellOpen(i, up, board) {
    return i >= 0 && i < openRows(up, board) * COLS;
  }

  function rowUnlockName(row) {
    return row === BASE_ROWS ? "정련" : "장사";
  }

  function settleBoard(board, up) {
    const limit = gateRows(up) * COLS;
    const held = [];
    for (let i = limit; i < board.length; i++) {
      if (!board[i]) continue;
      held.push(board[i]);
      board[i] = 0;
    }
    for (const tier of held) {
      let spot = -1;
      for (let i = 0; i < limit; i++) {
        if (!board[i]) {
          spot = i;
          break;
        }
      }
      if (spot >= 0) {
        board[spot] = tier;
        continue;
      }
      for (let i = limit; i < board.length; i++) {
        if (!board[i]) {
          board[i] = tier;
          break;
        }
      }
    }
  }

  function neighbors(i) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const rows = openRows();
    const list = [];
    if (c > 0) list.push(i - 1);
    if (c < COLS - 1) list.push(i + 1);
    if (r > 0) list.push(i - COLS);
    if (r < rows - 1) list.push(i + COLS);
    return list;
  }

  function adjacent(a, b) {
    return neighbors(a).includes(b);
  }

  function empties() {
    const list = [];
    const n = openRows() * COLS;
    for (let i = 0; i < n; i++) if (!state.board[i]) list.push(i);
    return list;
  }

  function boardOpen() {
    const n = openRows() * COLS;
    for (let i = 0; i < n; i++) if (!state.board[i]) return true;
    return false;
  }

  function randomEmpty() {
    const list = empties();
    if (!list.length) return -1;
    return list[Math.floor(Math.random() * list.length)];
  }

  function hasTwin(i) {
    const t = state.board[i];
    if (!t || t >= MAX_TIER) return false;
    return neighbors(i).some((n) => state.board[n] === t);
  }

  function hasMerge() {
    for (let i = 0; i < SIZE; i++) if (hasTwin(i)) return true;
    return false;
  }

  function isStuck() {
    return empties().length === 0 && !hasMerge();
  }

  function orderCanClear() {
    return state.orders.some((o, index) => {
      if (!missionOpen(index)) return false;
      if (o.type !== "gem" && o.type !== "hunt") return false;
      const need = o.count - o.have;
      if (need <= 0) return false;
      let onBoard = 0;
      for (let i = 0; i < SIZE; i++) if (state.board[i] === o.tier) onBoard += 1;
      return onBoard >= need;
    });
  }

  function noMoves() {
    return isStuck() && !orderCanClear();
  }

  function pickTwoWithin(limit) {
    const a = Math.floor(Math.random() * limit);
    let b = Math.floor(Math.random() * (limit - 1));
    if (b >= a) b += 1;
    return [a, b];
  }

  function pickTwoCells() {
    return pickTwoWithin(openRows() * COLS);
  }

  function dealBoard(rows) {
    const n = rows * COLS;
    const board = Array(SIZE).fill(0);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const anchor = order[0];
    const ar = Math.floor(anchor / COLS);
    const ac = anchor % COLS;
    const around = [];
    if (ac > 0) around.push(anchor - 1);
    if (ac < COLS - 1) around.push(anchor + 1);
    if (ar > 0) around.push(anchor - COLS);
    if (ar < rows - 1) around.push(anchor + COLS);
    const mate = around[Math.floor(Math.random() * around.length)];
    const pairTier = Math.random() < 0.65 ? 1 : 2;
    board[anchor] = pairTier;
    board[mate] = pairTier;
    const extra = 2 + Math.floor(Math.random() * 4);
    let placed = 0;
    for (const i of order) {
      if (i === anchor || i === mate) continue;
      if (placed >= extra) break;
      board[i] = Math.random() < 0.78 ? 1 : 2;
      placed += 1;
    }
    return board;
  }

  function sellValue(tier) {
    return Math.round((1 + tier) * tradeMult(state.up.trade));
  }

  function quotedCost(base, level) {
    const pace = Math.floor(level / 8);
    const curve = (base / FINE) * Math.pow(1.12, level / 20);
    return Math.max(1, pace + Math.round(curve));
  }

  function upgradeCost(id) {
    const spec = UPS.find((u) => u.id === id);
    return quotedCost(spec.base, state.up[id]) + (spec.premium || 0);
  }

  function payScale(level, up) {
    const bag = up || (state && state.up) || {};
    const levelScale = 1 + Math.max(0, (level || 1) - 1) * 0.02;
    return levelScale * (1 + (bag.refine || 0) / 80);
  }

  function gemReward(tier, count, level, up) {
    return Math.round(5 * tier * count * payScale(level, up));
  }

  function comboReward(need, level, up) {
    const lv = level || (state ? state.level : 1);
    return Math.round(4 * need * payScale(lv, up));
  }

  function huntReward(tier, count, level, up) {
    const base = gemReward(tier, count, level, up);
    return Math.max(base + 1, Math.round(base * 1.25));
  }

  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function play(freq, dur = 0.12, type = "sine", vol = 0.045, delay = 0) {
    if (!state || !state.sound) return;
    try {
      const ctx = ac();
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) {
      /* audio is optional */
    }
  }

  function toast(msg) {
    toastQ.push(msg);
    if (toastQ.length > 4) toastQ.shift();
    pumpToast();
  }

  function pumpToast() {
    if (toastOn || !toastQ.length) return;
    toastOn = true;
    const msg = toastQ.shift();
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
      toastOn = false;
      pumpToast();
    }, 1100);
  }

  function floatAt(x, y, text, hot) {
    const node = document.createElement("div");
    node.className = "floater" + (hot ? " hot" : "");
    node.textContent = text;
    node.style.left = x + "px";
    node.style.top = y + "px";
    fx.appendChild(node);
    setTimeout(() => node.remove(), 760);
  }

  function cellPoint(i) {
    const el = board.querySelector(`[data-i="${i}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * 0.35 };
  }

  function floatCell(i, text, hot) {
    const p = cellPoint(i);
    if (p) floatAt(p.x, p.y, text, hot);
  }

  function burst(i, color) {
    const p = cellPoint(i);
    if (!p || REDUCE) return;
    for (let k = 0; k < 7; k++) {
      const spark = document.createElement("i");
      spark.className = "spark";
      const ang = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 26;
      spark.style.left = p.x + "px";
      spark.style.top = p.y + "px";
      spark.style.background = color;
      spark.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      spark.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      fx.appendChild(spark);
      setTimeout(() => spark.remove(), 520);
    }
  }

  function shake() {
    if (REDUCE) return;
    app.classList.remove("shake");
    void app.offsetWidth;
    app.classList.add("shake");
    setTimeout(() => app.classList.remove("shake"), 300);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, REDUCE ? 0 : ms));
  }

  function freshOrders() {
    return [
      { type: "gem", tier: 2, count: 1, have: 0, reward: gemReward(2, 1, 1), xp: 6, id: 1 },
      { type: "gem", tier: 3, count: 1, have: 0, reward: gemReward(3, 1, 1), xp: 9, id: 2 },
      { type: "gem", tier: 1, count: 3, have: 0, reward: gemReward(1, 3, 1), xp: 9, id: 3 },
    ];
  }

  function freshState() {
      const boardState = dealBoard(BASE_ROWS);
    return {
      coins: 0,
      xp: 0,
      level: 1,
      energy: 36,
      board: boardState,
      resonance: pickTwoWithin(BASE_ROWS * COLS),
      resWave: 0,
      up: { hammer: 0, mine: 0, refine: 0, auto: 1, trade: 0, sense: 0, yield: 0 },
      orders: freshOrders(),
      nextId: 4,
      bestCombo: 0,
      merges: 0,
      lumens: 0,
      maxTier: 2,
      taps: 0,
      adTapMark: 0,
      tapRewards: 0,
      sound: true,
      tutorial: 0,
      combo: 0,
      lastMerge: 0,
      selected: null,
      busy: false,
      modal: false,
      pendingChest: false,
      fullTold: false,
      ended: false,
      autoBuy: true,
      autoPick: null,
      huntIn: 24,
      just: new Set(),
      hotCells: new Set(),
      openedCells: new Set(),
      heat: 0,
      heatLeft: 0,
      overheat: false,
      goal: 3,
    };
  }

  function validOrder(o) {
    if (!o || typeof o !== "object") return false;
    if (o.type === "gem") return o.tier >= 1 && o.tier <= MAX_TIER && o.count >= 1 && o.have >= 0 && o.have <= o.count;
    if (o.type === "combo") return o.need >= 2 && o.need <= 12;
    if (o.type === "hunt") return o.tier >= 1 && o.tier <= MAX_TIER && o.count >= 1 && typeof o.monster === "string";
    return false;
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.board)) return null;
      if (data.board.length !== SIZE && data.board.length !== 25 && data.board.length !== 30) return null;
      if (!data.board.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_TIER)) return null;
      if (!Array.isArray(data.orders) || data.orders.length !== 3 || !data.orders.every(validOrder)) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function hydrate(data) {
    const next = freshState();
    next.coins = Math.max(0, data.coins | 0);
    next.xp = Math.max(0, data.xp | 0);
    next.level = Math.max(1, data.level | 0);
    next.energy = Math.max(0, Math.min(240, Number(data.energy) || 0));
    const board = migrateBoard(data.board);
    if (!board) return freshState();
    next.board = board;
    const boardLength = data.board.length;
    next.resWave = Math.max(0, Math.min(5, data.resWave | 0));
    next.orders = data.orders.map((o) => {
      const copy = { ...o };
      if (typeof copy.rush === "number") copy.rush = Math.max(0, Math.min(90, copy.rush));
      if (!copy.rush) delete copy.rush;
      if (copy.type === "gem") {
        copy.reward = gemReward(copy.tier, copy.count, next.level);
        copy.xp = 3 * copy.tier * copy.count;
      } else if (copy.type === "combo") {
        copy.reward = comboReward(copy.need);
        copy.xp = 3 * copy.need;
      } else if (copy.type === "hunt") {
        copy.hit = Math.max(1, Math.min(3, copy.hit | 0));
        copy.tier = Math.max(1, Math.min(3, copy.tier | 0));
        copy.count = Math.max(1, Math.min(3, copy.count | 0));
        copy.have = Math.min(copy.have | 0, copy.count);
        copy.game = "성수 사냥";
        if (!HUNTS.some((hunt) => hunt.monster === copy.monster)) copy.monster = HUNTS[0].monster;
        copy.reward = huntReward(copy.tier, copy.count, next.level);
        copy.xp = 3 * copy.tier * copy.count;
        delete copy.rush;
      }
      return copy;
    });
    next.nextId = Math.max(4, data.nextId | 0);
    next.bestCombo = data.bestCombo | 0;
    next.merges = data.merges | 0;
    next.lumens = data.lumens | 0;
    next.maxTier = Math.max(1, Math.min(MAX_TIER, data.maxTier | 0));
    next.taps = data.taps | 0;
    next.sound = data.sound !== false;
    next.tutorial = data.tutorial === -1 ? -1 : Math.max(0, Math.min(2, data.tutorial | 0));
    if (data.up) {
      const ver = data.upVer | 0;
      for (const spec of UPS) {
        let level = data.up[spec.id] | 0;
        if (ver < 2) level = scaleLegacyLevel(spec.id, level);
        if (ver < 3) level *= FINE;
        next.up[spec.id] = Math.max(0, Math.min(spec.max, level));
      }
      if (next.up.auto < 1) next.up.auto = 1;
    }
    next.huntIn = Number.isFinite(Number(data.huntIn)) ? Math.max(0, Math.min(180, Number(data.huntIn))) : 16;
    next.autoBuy = data.autoSet === true ? data.autoBuy === true : true;
    if (data.autoPick && typeof data.autoPick === "object") {
      next.autoPick = {};
      for (const spec of UPS) next.autoPick[spec.id] = data.autoPick[spec.id] !== false;
    }
    if (Array.isArray(data.resonance) && data.resonance.length === 2) {
      let a = migrateIndex(data.resonance[0] | 0, boardLength);
      let b = migrateIndex(data.resonance[1] | 0, boardLength);
      if (a !== b && a >= 0 && a < SIZE && b >= 0 && b < SIZE) next.resonance = [a, b];
    }
    let seen = 0;
    for (const t of next.board) seen = Math.max(seen, t);
    next.maxTier = Math.max(next.maxTier, seen);
    next.orders.forEach((order) => tuneOrder(order, next.maxTier, next.level, next.up));
    const gems = next.orders.filter((order) => order.type === "gem");
    if (gems.length && !gems.some((order) => order.tier <= 2)) {
      const hard = gems.slice().sort((a, b) => b.tier - a.tier)[0];
      hard.tier = 1;
      hard.count = 3;
      hard.have = 0;
      hard.reward = gemReward(1, 3, next.level, next.up);
      hard.xp = 9;
    }
    next.orders.forEach((order) => {
      if (!order) return;
      if (order.type === "gem") order.reward = gemReward(order.tier, order.count, next.level, next.up);
      else if (order.type === "combo") order.reward = comboReward(order.need, next.level, next.up);
      else if (order.type === "hunt") order.reward = huntReward(order.tier, order.count, next.level, next.up);
    });
    next.adTapMark = Number.isInteger(data.adTapMark) ? data.adTapMark : next.taps;
    next.tapRewards = Number.isInteger(data.tapRewards) ? data.tapRewards : Math.floor(next.taps / 100);
    next.heat = Math.max(0, Math.min(100, Number(data.heat) || 0));
    next.overheat = !!data.overheat;
    next.heatLeft = next.overheat
      ? Math.max(1, Math.min(HEAT_STONES, Number.isInteger(data.heatLeft) ? data.heatLeft : HEAT_STONES))
      : 0;
    if (Number.isInteger(data.goal) && data.goal >= 3) next.goal = Math.min(MAX_TIER + 1, data.goal);
    else next.goal = Math.min(MAX_TIER + 1, Math.max(3, next.maxTier + 1));
    settleBoard(next.board, next.up);
    const limit = openRows(next.up, next.board) * COLS;
    const [ra, rb] = next.resonance;
    if (!(ra !== rb && cellOpen(ra, next.up, next.board) && cellOpen(rb, next.up, next.board))) {
      next.resonance = pickTwoWithin(limit);
    }
    const knewRush = data.orders.some((o) => typeof o.rush === "number");
    if (!knewRush && next.tutorial < 0) {
      const firstGem = next.orders.find((o) => o.type === "gem");
      if (firstGem) firstGem.rush = 32;
    }
    return next;
  }

  function snapshot() {
    return {
      v: 1,
      coins: state.coins,
      xp: state.xp,
      level: state.level,
      energy: state.energy,
      board: state.board,
      resonance: state.resonance,
      resWave: state.resWave,
      up: state.up,
      upVer: 3,
      autoBuy: state.autoBuy === true,
      autoSet: true,
      autoPick: state.autoPick,
      orders: state.orders,
      nextId: state.nextId,
      bestCombo: state.bestCombo,
      merges: state.merges,
      lumens: state.lumens,
      maxTier: state.maxTier,
      taps: state.taps,
      adTapMark: state.adTapMark | 0,
      tapRewards: state.tapRewards | 0,
      sound: state.sound,
      tutorial: state.tutorial,
      heat: state.heat,
      heatLeft: state.heatLeft | 0,
      overheat: state.overheat,
      goal: state.goal,
      huntIn: state.huntIn,
    };
  }

  function save() {
    if (!started || !state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
    } catch (err) {
      /* ignore private mode */
    }
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 220);
  }

  function renderBoard() {
    const sel = state.selected;
    const selTier = sel != null ? state.board[sel] : 0;
    const popped = state.just;
    const forged = state.hotCells;
    const opened = state.openedCells || new Set();
    state.just = new Set();
    state.hotCells = new Set();
    state.openedCells = new Set();
    board.innerHTML = state.board
      .map((tier, i) => {
        if (!cellOpen(i)) {
          const name = rowUnlockName(Math.floor(i / COLS));
          const mid = Math.floor(i / COLS) * COLS + 2;
          const mark = i === mid ? `<b class="seal">${name}</b>` : "";
          return `<div class="cell sealed" data-i="${i}" role="button" aria-label="${josa(name, "이", "가")} 열리면 열림">${mark}</div>`;
        }
        const cls = ["cell"];
        if (state.resonance.includes(i)) cls.push("res");
        if (sel === i) cls.push("sel");
        if (popped.has(i)) cls.push("just");
        if (opened.has(i)) cls.push("opened");
        if (forged.has(i)) cls.push("forged");
        if (hasTwin(i)) cls.push("pair");
        if (selTier && tier === selTier && sel !== i && adjacent(sel, i) && tier < MAX_TIER) cls.push("mergeable");
        const gem = tier ? `<div class="gem t${tier}"></div>` : "";
        const label = tier ? TIER[tier] : "빈칸";
        return `<div class="${cls.join(" ")}" data-i="${i}" role="button" aria-label="${label}">${gem}</div>`;
      })
      .join("");
    cellEls = [...board.children];
    liftEl = null;
    hoverEl = null;
  }

  function payout(order) {
    return order.rush > 0 ? Math.round(order.reward * 1.6) : order.reward;
  }

  function crystalMark(tier) {
    const file = tier === "combo" ? "crystal-combo" : `crystal-${tier}`;
    return `<img class="crystal" src="art/${file}.png?v=48" alt="">`;
  }

  function renderOrders() {
    orderPaintKey = "";
    refreshOrderPay();
    ordersEl.innerHTML = state.orders
      .map((o, i) => {
        if (!missionOpen(i)) {
          const need = i === 1 ? 5 : 10;
          return `<button class="order locked" type="button" data-slot="${need}" aria-label="Lv.${need}에 열림">
            <span class="order-copy">
              <span class="order-k">잠김</span>
              <strong>Lv.${need}</strong>
              <em>미션이 열립니다</em>
            </span>
          </button>`;
        }
        if (o.type === "combo") {
          const cur = Math.min(state.combo, o.need);
          return `<button class="order" type="button" data-order="${i}">
            <span class="order-copy">
              <span class="order-k">연속 합치기</span>
              <strong>콤보 ${o.need}</strong>
              <em class="num">+${fmt(o.reward)}</em>
            </span>
            ${crystalMark("combo")}
            <span class="bar"><i style="width:${(cur / o.need) * 100}%"></i></span>
          </button>`;
        }
        if (o.type === "hunt") {
          const need = o.count - o.have;
          const onBoard = freeCells(o.tier).length;
          const got = Math.min(o.count, o.have + Math.min(onBoard, Math.max(need, 0)));
          const ready = need > 0 && onBoard >= need;
          return `<button class="order hunt${ready ? " ready" : ""}" type="button" data-order="${i}">
            <span class="order-copy">
              <span class="order-k">${ready ? "곧 공격" : o.game}</span>
              <strong>${o.monster} <b class="frac">${o.hit}/3</b></strong>
              <em class="num"><i class="dot t${o.tier}"></i>${TIER[o.tier]} ${got}/${o.count} · +${fmt(o.reward)}</em>
            </span>
            ${crystalMark(o.tier)}
            <span class="bar"><i style="width:${(got / o.count) * 100}%"></i></span>
          </button>`;
        }
        const need = o.count - o.have;
        const onBoard = freeCells(o.tier).length;
        const got = Math.min(o.count, o.have + Math.min(onBoard, Math.max(need, 0)));
        const ready = need > 0 && onBoard >= need;
        const rush = o.rush > 0;
        const kind = rush ? `급함 <b class="rush">${Math.ceil(o.rush)}초</b>` : ready ? "곧 납품" : "납품";
        return `<button class="order${ready ? " ready" : ""}${rush ? " rush" : ""}" type="button" data-order="${i}">
          <span class="order-copy">
            <span class="order-k">${kind}</span>
            <strong><i class="dot t${o.tier}"></i>${TIER[o.tier]} <b class="frac">${got}/${o.count}</b></strong>
            <em class="num">+${fmt(payout(o))}</em>
          </span>
          ${crystalMark(o.tier)}
          <span class="bar"><i style="width:${(got / o.count) * 100}%"></i></span>
        </button>`;
      })
      .join("");
  }

  function renderMeters() {
    if (state.goal > MAX_TIER) {
      goalEl.innerHTML = "<span>별자리 완성</span>";
    } else {
      goalEl.innerHTML = `<i class="dot t${state.goal}"></i><span>${TIER[state.goal]} 빚기</span>`;
    }
    heatFill.style.width = `${state.heat}%`;
    heatbar.classList.toggle("hot", state.overheat);
    heatLabel.textContent = state.overheat ? `달굼 ${state.heatLeft || HEAT_STONES}` : "화로";
    tapWrap.classList.toggle("hot", state.overheat);
  }

  function renderPips() {
    const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < state.resWave ? "on" : ""}"></i>`).join("");
    pipsEl.innerHTML = `<span>공명</span><span class="crest" aria-hidden="true">${dots}</span>`;
  }

  function renderHeader() {
    coinsEl.textContent = fmt(state.coins);
    const need = needXp();
    xpFill.style.width = Math.min(100, (state.xp / need) * 100) + "%";
    xpLabel.textContent = `Lv.${state.level} ${rankName()}  ${fmt(state.xp)}/${fmt(need)}`;
    soundBtn.classList.toggle("off", !state.sound);
    soundBtn.setAttribute("aria-pressed", state.sound ? "true" : "false");
  }

  function renderDock() {
    const sel = state.selected;
    const tier = sel != null ? state.board[sel] : 0;
    if (!tier) {
      selEl.textContent = noMoves()
        ? "이번 판은 여기까지예요."
        : isStuck()
          ? "주문 카드를 누르면 칸이 비어요."
          : "붙어 있는 같은 등급을 겹치거나, 한 번 더 눌러 합치세요.";
      sellBtn.textContent = "분해";
      sellBtn.disabled = true;
      if (state.up.auto > 0 && state.coins <= 0 && !noMoves() && !isStuck()) {
        selEl.textContent = "두드리기를 누르세요~";
      }
    } else {
      const twins = neighbors(sel).filter((n) => state.board[n] === tier);
      selEl.textContent = twins.length === 1
        ? `${TIER[tier]} · 한 번 더 누르면 합쳐집니다.`
        : `${TIER[tier]} · 붙어 있는 같은 등급만 합쳐집니다.`;
      sellBtn.textContent = "분해";
      sellBtn.disabled = false;
    }
    sellBtn.classList.toggle("alert", isStuck());
    paintEnergy();
  }

  function renderCoach() {
    const step = state.tutorial;
    coach.hidden = step < 0;
    if (step >= 0) coachText.textContent = COACH[step];
    board.classList.toggle("coach-on", step === 0);
    tapWrap.classList.toggle("coach-on", step === 1);
    ordersEl.classList.toggle("coach-on", step === 2);
  }

  function effectAt(spec, level) {
    const prev = state.up[spec.id];
    state.up[spec.id] = level;
    const text = spec.now(state);
    state.up[spec.id] = prev;
    return text;
  }

  function scaleLegacyLevel(id, level) {
    if (level <= 0) return 0;
    if (id === "hammer" || id === "mine") return level * 4;
    if (id === "refine") return level * 3;
    if (id === "auto") return Math.round((4 + 16 * level) / 5);
    if (id === "trade") return Math.round((level * 10) / 3);
    if (id === "sense") return level * 5;
    return level;
  }

  function upgradeHold() {
    const rate = autoCoinRate(state.up.auto);
    return rate > 0 ? rate * 20 : 0;
  }

  function pickOn(id) {
    if (!state || !state.autoBuy) return false;
    if (!state.autoPick) return true;
    return state.autoPick[id] !== false;
  }

  function allPick() {
    const pick = {};
    for (const spec of UPS) pick[spec.id] = true;
    return pick;
  }

  function picksCustom() {
    return !!(state.autoPick && UPS.some((spec) => state.autoPick[spec.id] === false));
  }

  function upgradeOpen(spec) {
    if (!spec || !spec.gate) return true;
    if ((state.up[spec.id] || 0) > 0) return true;
    return (state.up[spec.gate.id] || 0) >= spec.gate.level;
  }

  function gateText(spec) {
    const need = UPS.find((item) => item.id === spec.gate.id);
    return `${need.name} Lv.${spec.gate.level}에 열림`;
  }

  function markRowsOpened(before, after) {
    const opened = state.openedCells || new Set();
    for (let row = before; row < after; row++) {
      for (let c = 0; c < COLS; c++) opened.add(row * COLS + c);
    }
    state.openedCells = opened;
    const gained = after - before;
    toast(gained === 1 ? "아래 줄이 열렸어요" : `아래 ${gained}줄이 열렸어요`);
    play(520, 0.08, "triangle", 0.04);
    play(780, 0.14, "sine", 0.04, 0.06);
  }

  function noteUnlocks(raisedId) {
    const level = state.up[raisedId];
    for (const spec of UPS) {
      if (!spec.gate || spec.gate.id !== raisedId || state.up[spec.id] > 0) continue;
      if (level === spec.gate.level) toast(`${josa(spec.name, "이", "가")} 열렸어요`);
    }
    if (raisedId === "mine" && level === OPEN_AT && !(state.up.refine > 0)) {
      markRowsOpened(BASE_ROWS, BASE_ROWS + 1);
      return true;
    }
    if (raisedId === "sense" && level === OPEN_AT && !(state.up.trade > 0)) {
      markRowsOpened(gateRows() - 1, gateRows());
      return true;
    }
    return false;
  }

  function upgradePlan() {
    const list = [];
    for (const spec of UPS) {
      if (!upgradeOpen(spec) || !pickOn(spec.id)) continue;
      const level = state.up[spec.id];
      if (level >= spec.max) continue;
      list.push({ id: spec.id, cost: upgradeCost(spec.id), level });
    }
    list.sort((a, b) => a.cost - b.cost || a.level - b.level);
    const plan = [];
    let left = state.coins - upgradeHold();
    for (const item of list) {
      if (item.cost > left) break;
      plan.push(item);
      left -= item.cost;
    }
    return plan;
  }

  function roundUpgradeCost() {
    let sum = 0;
    for (const spec of UPS) {
      if (!upgradeOpen(spec) || state.up[spec.id] >= spec.max) continue;
      sum += upgradeCost(spec.id);
    }
    return Math.max(6, sum);
  }

  function coinAdGain() {
    return Math.max(100, roundUpgradeCost());
  }

  function renderShop(focusId) {
    if (!state) return;
    const scroll = shopList.scrollTop;
    const autoBtn = document.getElementById("auto-buy");
    if (autoBtn) autoBtn.setAttribute("aria-pressed", state.autoBuy ? "true" : "false");
    shopRank.textContent = `${rankName()} · Lv.${state.level}`;
    shopCards = null;
    shopList.innerHTML = UPS.map((spec) => {
      const lv = state.up[spec.id];
      const open = upgradeOpen(spec);
      if (!open) {
        return `<div class="up locked" data-id="${spec.id}" title="${spec.blurb}">
          <div>
            <h3>${spec.name}</h3>
            <p>${gateText(spec)}</p>
          </div>
          <button class="btn small" type="button" disabled>잠김</button>
          <span class="cool" aria-hidden="true"><i></i></span>
        </div>`;
      }
      const maxed = lv >= spec.max;
      const cost = maxed ? 0 : upgradeCost(spec.id);
      const afford = !maxed && state.coins >= cost;
      const next = maxed ? spec.now(state) : `다음 ${effectAt(spec, lv + 1)}`;
      return `<div class="up" data-id="${spec.id}" title="${spec.blurb}">
        <div>
          <h3>${spec.name} <span class="num">Lv.${lv}/${spec.max}</span></h3>
          <p>${next}</p>
        </div>
        <button class="btn small${afford ? " primary" : ""}" type="button" data-up="${spec.id}" ${maxed ? "disabled" : ""} aria-label="${maxed ? "최대" : `${fmt(cost)}코인`}">
          ${maxed ? "최대" : fmt(cost)}
        </button>
        <span class="cool" aria-hidden="true"><i></i></span>
      </div>`;
    }).join("");
    if (focusId) scrollUpgrade(focusId);
    else shopList.scrollTop = scroll;
    paintAutoCool();
  }

  function scrollUpgrade(id) {
    const card = shopList.querySelector(`.up[data-id="${id}"]`);
    if (!card) return;
    const listRect = shopList.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const visible = cardRect.bottom > listRect.top + 8 && cardRect.top < listRect.bottom - 8;
    if (visible) return;
    const cardTop = cardRect.top - listRect.top + shopList.scrollTop;
    const top = cardTop - Math.max(0, (shopList.clientHeight - card.offsetHeight) / 2);
    shopList.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function paintAutoCool() {
    if (!shopList || !state) return;
    const on = !!state.autoBuy;
    const plan = on ? upgradePlan() : [];
    const focus = plan.map((item) => item.id).join(",");
    if (focus !== autoFocusId) {
      autoFocusId = focus;
      if (plan.length) scrollUpgrade(plan[0].id);
    }
    const activeIds = new Set(plan.map((item) => item.id));
    const cool = on && plan.length ? Math.max(0, Math.min(1, autoBuyWait / AUTO_BUY_SEC)).toFixed(2) : "0";
    if (!shopCards || shopCards.length !== shopList.children.length) shopCards = [...shopList.children];
    for (const card of shopCards) {
      const picked = on && !card.classList.contains("locked") && pickOn(card.dataset.id);
      const active = activeIds.has(card.dataset.id);
      if (card.classList.contains("aim") !== picked) card.classList.toggle("aim", picked);
      if (card.classList.contains("cooling") !== active) card.classList.toggle("cooling", active);
      const next = active ? cool : "0";
      if (card.dataset.cool !== next) {
        card.dataset.cool = next;
        card.style.setProperty("--cool", next);
      }
    }
  }

  function tuneOrder(order, maxTier, level, up) {
    if (order.type !== "gem") return;
    const cap = Math.max(2, Math.min(4, maxTier || 2));
    if (order.tier >= 5 || order.tier > Math.max(cap, maxTier || 0)) {
      order.tier = order.tier >= 5 ? Math.min(3, cap) : Math.min(order.tier, cap);
    }
    if (order.tier >= 4) order.count = 1;
    else if (order.tier === 3) order.count = Math.min(order.count, 2);
    order.have = Math.min(order.have | 0, order.count);
    order.reward = gemReward(order.tier, order.count, level, up);
    order.xp = 3 * order.tier * order.count;
  }

  function refreshOrderPay() {
    if (!state) return;
    for (const order of state.orders) {
      if (!order) continue;
      if (order.type === "gem") order.reward = gemReward(order.tier, order.count, state.level);
      else if (order.type === "combo") order.reward = comboReward(order.need);
      else if (order.type === "hunt") order.reward = huntReward(order.tier, order.count, state.level);
    }
  }

  function render() {
    renderHeader();
    renderMeters();
    renderOrders();
    renderBoard();
    renderPips();
    renderDock();
    renderCoach();
    renderShop();
  }

  function paintEnergy() {
    const p = Math.max(0, Math.min(1, state.energy / 100)).toFixed(3);
    const toward = Math.max(0, state.taps - (state.adTapMark | 0));
    const adp = (adTapReward ? 1 : Math.max(0, Math.min(1, toward / TAP_AD_EVERY))).toFixed(3);
    if (p !== energyRing) {
      energyRing = p;
      tapWrap.style.setProperty("--p", p);
    }
    if (adp !== energyAd) {
      energyAd = adp;
      tapWrap.style.setProperty("--tap-ad", adp);
    }
    const gainText = state.overheat ? `달굼 ${state.heatLeft || HEAT_STONES}` : `에너지 +${tapEnergy(state.up.hammer).toFixed(1)}`;
    if (gainText !== energyGain) {
      energyGain = gainText;
      tapGain.textContent = gainText;
    }
    const now = performance.now();
    if (now - energyMicroAt < 200) return;
    energyMicroAt = now;
    if (!microEl) return;
    const resting = !boardOpen();
    const auto = state.up.auto
      ? (state.coins <= 0 ? " · 자동 정지" : resting ? " · 자동 대기" : ` · 자동 -${autoCoinRate(state.up.auto).toFixed(1)}`)
      : "";
    const micro = `에너지 ${Math.floor(Math.min(100, state.energy))} · 연타 ${fmt(state.taps)} · 합치기 ${fmt(state.merges)}${auto}`;
    if (micro !== energyMicro) {
      energyMicro = micro;
      microEl.textContent = micro;
    }
  }

  function paintCombo() {
    if (!state) return;
    const elapsed = performance.now() - state.lastMerge;
    const alive = state.combo >= 2 && elapsed < COMBO_MS;
    if (comboEl.hidden === alive) comboEl.hidden = !alive;
    if (!alive) return;
    comboLabel.textContent = `콤보 ${state.combo}`;
    comboLife.style.setProperty("--left", String(Math.max(0, 1 - elapsed / COMBO_MS)));
  }

  function pingTutorial(action) {
    if (!state || state.tutorial < 0) return;
    const steps = ["merge", "spawn", "deliver"];
    if (steps[state.tutorial] !== action) return;
    state.tutorial += 1;
    if (state.tutorial >= steps.length) state.tutorial = -1;
    renderCoach();
  }

  function gainXp(amount) {
    const slotsBefore = missionSlots();
    state.xp += amount;
    let ranked = false;
    while (state.xp >= needXp()) {
      state.xp -= needXp();
      state.level += 1;
      ranked = true;
    }
    if (ranked) {
      const gift = Math.min(3, 1 + Math.floor(state.level / 3));
      const spot = randomEmpty();
      if (spot >= 0) {
        state.board[spot] = gift;
        state.just.add(spot);
      } else {
        state.coins += sellValue(gift);
      }
      toast(`${josa(rankName(), "이", "가")} 되었어요`);
      const opened = missionSlots() - slotsBefore;
      if (opened > 0) toast(opened === 1 ? "미션이 하나 더 열렸어요" : "미션이 더 열렸어요");
      play(523, 0.12, "triangle", 0.05);
      play(659, 0.16, "triangle", 0.04, 0.08);
    }
  }

  function missionPower() {
    const ups = state.up;
    const sum = ups.hammer + ups.mine + ups.refine + ups.auto + ups.trade + ups.sense;
    const upgrade = sum / (6 * FINE);
    const rank = Math.max(0, state.level - 1) / 10;
    return upgrade * 0.7 + rank * 0.5;
  }

  function pickOrderTier() {
    const seen = Math.max(1, state.maxTier | 0);
    const power = missionPower();
    const bag = [1, 1, 1, 2, 2];
    if (state.level >= 2 || power >= 0.35) bag.push(2);
    if (seen >= 3 && (state.level >= 2 || power >= 0.45)) bag.push(3);
    if (seen >= 3 && power >= 0.9) bag.push(3);
    if (seen >= 4 && state.level >= 4 && power >= 0.6) bag.push(4);
    if (seen >= 4 && power >= 1.7) bag.push(4);
    if (seen >= 5 && state.level >= 6 && power >= 1.5) bag.push(5);
    if (seen >= 6 && state.level >= 8 && power >= 2.1) bag.push(6);
    return bag[Math.floor(Math.random() * bag.length)];
  }

  function orderCount(tier) {
    const power = missionPower();
    if (tier <= 1) {
      let count = Math.random() < Math.min(0.88, 0.45 + power * 0.2) ? 3 : 2;
      if (power >= 1.5 && Math.random() < Math.min(0.4, (power - 1.3) * 0.22)) count = 4;
      return count;
    }
    if (tier === 2) {
      let count = Math.random() < Math.min(0.88, 0.55 + power * 0.16) ? 2 : 1;
      if (power >= 1.8 && count === 2 && Math.random() < 0.3) count = 3;
      return count;
    }
    if (tier === 3) return Math.random() < Math.min(0.42, 0.3 + power * 0.06) ? 2 : 1;
    return 1;
  }

  function rollOrder(skipIndex) {
    const id = state.nextId++;
    if (state.level >= 3 && Math.random() < Math.min(0.28, 0.16 + missionPower() * 0.04)) {
      const need = Math.min(4, 3 + Math.floor((state.level - 1) / 4));
      return {
        type: "combo",
        need,
        reward: comboReward(need),
        xp: 3 * need,
        id,
      };
    }
    let tier = pickOrderTier();
    const others = state.orders.filter((order, index) => index !== skipIndex && missionOpen(index) && order && order.type === "gem");
    const easy = others.filter((order) => order.tier <= 2).length;
    if (others.length >= 1 && easy === 0 && tier > 2) tier = Math.random() < 0.65 ? 1 : 2;
    const count = orderCount(tier);
    const order = {
      type: "gem",
      tier,
      count,
      have: 0,
      reward: gemReward(tier, count, state.level),
      xp: 3 * tier * count,
      id,
    };
    if (state.level >= 1 && tier <= 5 && Math.random() < Math.min(0.52, 0.36 + missionPower() * 0.05)) order.rush = 22 + tier * 4;
    return order;
  }

  function makeHunt(prev) {
    const guest = prev
      ? { game: prev.game, monster: prev.monster }
      : HUNTS[Math.floor(Math.random() * HUNTS.length)];
    const power = missionPower();
    const roll = Math.random();
    let tier = roll < Math.max(0.28, 0.5 - power * 0.08) ? 1 : 2;
    if (roll >= 0.84 && state.maxTier >= 3 && (state.level >= 4 || power >= 0.8)) tier = 3;
    let count = 1;
    if (tier === 1) count = Math.random() < Math.min(0.8, 0.5 + power * 0.12) ? 2 : 1;
    else if (tier === 2 && power >= 1.2 && Math.random() < 0.34) count = 2;
    return {
      type: "hunt",
      game: guest.game || "성수 사냥",
      monster: guest.monster,
      hit: prev ? Math.min(3, (prev.hit | 0) + 1) : 1,
      tier,
      count,
      have: 0,
      reward: huntReward(tier, count, state.level),
      xp: 3 * tier * count,
      id: state.nextId++,
    };
  }

  function huntSlot() {
    const easy = state.orders.filter((order, index) => missionOpen(index) && order.type === "gem" && order.tier <= 2).length;
    const open = [];
    state.orders.forEach((order, index) => {
      if (!missionOpen(index)) return;
      if (order.type !== "gem" || order.rush > 0) return;
      const need = order.count - order.have;
      const onBoard = state.board.filter((n) => n === order.tier).length;
      if (need > 0 && onBoard >= need) return;
      if (order.tier <= 2 && easy <= 1) return;
      open.push(index);
    });
    if (open.length) return open[Math.floor(Math.random() * open.length)];
    return state.orders.findIndex((order, index) => missionOpen(index) && order.type === "combo");
  }

  function tickHunt(dt) {
    if (!state || state.tutorial >= 0) return;
    if (state.orders.some((order, index) => missionOpen(index) && order.type === "hunt")) return;
    state.huntIn = Math.max(0, (Number(state.huntIn) || 0) - dt * MISSION_PACE);
    if (state.huntIn > 0) return;
    const index = huntSlot();
    if (index < 0) {
      state.huntIn = 8;
      return;
    }
    const hunt = makeHunt(null);
    state.orders[index] = hunt;
    toast(`${josa(hunt.monster, "이", "가")} 성수 사냥에서 건너왔어요`);
    play(660, 0.09, "sine", 0.04);
    render();
    saveSoon();
  }

  function addHeat(tier) {
    if (state.overheat) return;
    state.heat = Math.min(100, state.heat + 22 + tier * 12);
    if (state.heat >= 100) {
      state.heat = 100;
      state.overheat = true;
      state.heatLeft = HEAT_STONES;
      toast(`화로가 달아올랐어요. 다음 돌 ${HEAT_STONES}개가 한 단계 뜨겁습니다.`);
      play(740, 0.08, "triangle", 0.05);
      play(980, 0.16, "sine", 0.05, 0.05);
      play(1240, 0.2, "triangle", 0.04, 0.12);
      shake();
      heatbar.classList.remove("ignite");
      void heatbar.offsetWidth;
      heatbar.classList.add("ignite");
      setTimeout(() => heatbar.classList.remove("ignite"), 700);
    }
  }

  function noteGoal(tier) {
    if (state.goal > tier || state.goal > MAX_TIER) return;
    let reward = 0;
    while (state.goal <= tier && state.goal <= MAX_TIER) {
      reward += 10 * state.goal;
      state.goal += 1;
    }
    state.coins += reward;
    toast(`${josa(TIER[tier], "을", "를")} 빚었어요 +${fmt(reward)}`);
    play(880, 0.12, "triangle", 0.045);
  }

  function pickSpawnCell(tier) {
    const list = empties();
    if (!list.length) return -1;
    const near = list.filter((i) => neighbors(i).some((n) => state.board[n] === tier));
    const pool = near.length && Math.random() < 0.72 ? near : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function tickRush(dt) {
    let dirty = false;
    state.orders.forEach((order, index) => {
      if (!missionOpen(index) || !(order.rush > 0)) return;
      order.rush -= dt * MISSION_PACE;
      const label = ordersEl.querySelector(`[data-order="${index}"] .rush`);
      if (label && order.rush > 0) label.textContent = `${Math.ceil(order.rush)}초`;
      if (order.rush <= 0) {
        state.orders[index] = rollOrder(index);
        toast("급한 주문이 지나갔어요");
        dirty = true;
      }
    });
    if (dirty) {
      render();
      saveSoon();
    }
  }

  function relocateResonance(avoid) {
    const pool = [];
    const n = openRows() * COLS;
    for (let i = 0; i < n; i++) if (i !== avoid) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    state.resonance = [pool[0], pool[1]];
  }

  function rolledTier() {
    const odds = refineOdds(state.up.refine);
    const x = Math.random();
    const tier3 = odds.tier3;
    const tier2 = odds.tier2;
    if (x < tier3) return 3;
    if (x < tier2) return 2;
    return 1;
  }

  function spawnCount(manual) {
    let extra = mineExtra(state.up.mine);
    if (manual) extra += 0.7;
    else extra += yieldChance(state.up.yield || 0);
    const whole = Math.floor(extra);
    const frac = extra - whole;
    return 1 + whole + (Math.random() < frac ? 1 : 0);
  }

  function resolveEnergy(manual) {
    const spawned = [];
    let guard = 0;
    const heated = [];
    while (state.energy >= 100 && guard++ < 8) {
      let count = spawnCount(manual);
      if (state.overheat && state.heatLeft > 0) {
        count = Math.min(state.heatLeft, empties().length);
      }
      const batch = [];
      for (let k = 0; k < count; k++) {
        let tier = rolledTier();
        let hot = false;
        if (state.overheat && state.heatLeft > 0) {
          tier = Math.min(HEAT_CAP, tier + 1);
          hot = true;
          state.heatLeft -= 1;
        }
        const i = pickSpawnCell(tier);
        if (i < 0) {
          if (hot) state.heatLeft += 1;
          break;
        }
        state.board[i] = tier;
        if (tier > state.maxTier) state.maxTier = tier;
        if (hot) {
          state.hotCells.add(i);
          heated.push(i);
        }
        batch.push(i);
      }
      if (state.overheat && state.heatLeft <= 0) {
        state.overheat = false;
        state.heat = 0;
        state.heatLeft = 0;
      }
      if (!batch.length) {
        state.energy = 100;
        if (noMoves()) {
          state.fullTold = true;
          break;
        }
        if (!state.fullTold) {
          toast(isStuck() ? "주문 카드를 누르면 칸이 비어요." : "판이 가득 찼어요. 합치거나 분해하세요.");
          state.fullTold = true;
          shake();
        }
        break;
      }
      state.fullTold = false;
      state.energy -= 100;
      spawned.push(...batch);
    }
    if (spawned.length) {
      state.just = new Set(spawned);
      pingTutorial("spawn");
      play(heated.length ? 820 : 640, heated.length ? 0.1 : 0.07, "triangle", heated.length ? 0.05 : 0.04);
      render();
      if (heated.length) {
        board.classList.remove("forge-flash");
        void board.offsetWidth;
        board.classList.add("forge-flash");
        setTimeout(() => board.classList.remove("forge-flash"), 650);
        heated.forEach((i) => {
          floatCell(i, "달굼", true);
          burst(i, "#ffd56a");
        });
      }
    } else {
      renderDock();
    }
    noteBoardLocked();
  }

  function doTap() {
    if (!started || !state || state.modal) return;
    if (state.ended) {
      askContinue();
      return;
    }
    const now = performance.now();
    if (now - tapLock < 40) return;
    tapLock = now;
    state.taps += 1;
    const crit = Math.random() < 0.075;
    const gain = tapEnergy(state.up.hammer) * (crit ? 2 : 1);
    state.energy += gain;
    if (crit) {
      tapBtn.classList.add("crit");
      setTimeout(() => tapBtn.classList.remove("crit"), 120);
      const rect = tapBtn.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      floatAt(rect.left - a.left + rect.width / 2, rect.top - a.top, "크리티컬", true);
      play(880, 0.08, "square", 0.035);
    } else {
      play(520, 0.045, "triangle", 0.03);
    }
    resolveEnergy(true);
    paintEnergy();
    microEl.textContent = `에너지 ${Math.floor(Math.min(100, state.energy))} · 연타 ${fmt(state.taps)} · 합치기 ${fmt(state.merges)}`;
    saveSoon();
    if (navigator.vibrate) navigator.vibrate(8);
    maybeTapAd();
  }

  function bumpCombo() {
    const now = performance.now();
    if (state.lastMerge && now - state.lastMerge < COMBO_MS) state.combo += 1;
    else state.combo = 1;
    state.lastMerge = now;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    if (state.combo === 3 || state.combo === 5 || state.combo === 8) {
      const name = state.combo === 3 ? "콤보가 이어졌어요" : state.combo === 5 ? "훌륭해요" : "별이 울려요";
      toast(name);
    }
  }

  function checkComboOrders() {
    state.orders.forEach((o, i) => {
      if (!missionOpen(i)) return;
      if (o.type === "combo" && state.combo >= o.need) {
        state.coins += o.reward;
        gainXp(o.xp);
        toast(`콤보 주문 완료 +${fmt(o.reward)}`);
        play(698, 0.1, "sine", 0.04);
        state.orders[i] = rollOrder(i);
      }
    });
  }

  function onCrafted(cell, tier, first) {
    bumpCombo();
    state.merges += 1;
    if (tier > state.maxTier) state.maxTier = tier;
    addHeat(tier);
    noteGoal(tier);
    let coins = tier;
    if (state.combo > 1) coins += Math.min(6, state.combo - 1);
    if (first && state.resonance.includes(cell)) {
      coins += sensePay(state.up.sense);
      state.resWave += 1;
      relocateResonance(cell);
      if (state.resWave >= 5) state.pendingChest = true;
    }
    state.coins += coins;
    floatCell(cell, "+" + fmt(coins), tier >= 6);
    burst(cell, TIER_COLOR[tier]);
    play(280 + tier * 62, 0.1, "sine", 0.05);
    play(420 + tier * 48, 0.12, "triangle", 0.03, 0.05);
    if (tier >= 5) shake();
    if (tier === 8 || tier === MAX_TIER) {
      if (tier === 8) state.lumens += 1;
      const bonus = 20 + 5 * state.level;
      state.coins += bonus;
      toast(`${josa(TIER[tier], "이", "가")} 태어났어요 +${fmt(bonus)}`);
      play(880, 0.18, "sine", 0.05, 0.02);
    }
    if (first) pingTutorial("merge");
    checkComboOrders();
    if (navigator.vibrate) navigator.vibrate(10 + tier * 3);
  }

  async function cascade(from, to, tier) {
    state.busy = true;
    state.selected = null;
    state.board[from] = 0;
    let next = tier + 1;
    state.board[to] = next;
    onCrafted(to, next, true);
    render();
    let cell = to;
    while (next < MAX_TIER) {
      const n = neighbors(cell).find((i) => state.board[i] === next);
      if (n == null) break;
      await wait(170);
      state.board[n] = 0;
      next += 1;
      state.board[cell] = next;
      onCrafted(cell, next, false);
      render();
    }
    state.busy = false;
    if (state.pendingChest) {
      state.pendingChest = false;
      openChest();
    }
    save();
  }

  function tryAction(from, to) {
    if (!state || state.busy || state.modal) return;
    if (from === to || from == null || to == null) return;
    if (!cellOpen(from) || !cellOpen(to)) {
      const row = Math.floor((cellOpen(to) ? from : to) / COLS);
      toast(`${josa(rowUnlockName(row), "이", "가")} 열리면 이 줄이 열려요`);
      return;
    }
    const a = state.board[from];
    const b = state.board[to];
    if (!a) return;
    if (b === 0) {
      toast("조각은 움직이지 않아요. 붙어 있는 같은 등급만 합쳐집니다.");
      play(150, 0.08, "sawtooth", 0.02);
      return;
    }
    if (a === b && a < MAX_TIER && adjacent(from, to)) {
      cascade(from, to, a);
      return;
    }
    if (a >= MAX_TIER && b >= MAX_TIER) toast(`${josa(TIER[MAX_TIER], "은", "는")} 더 합칠 수 없어요.`);
    else if (a === b && !adjacent(from, to)) toast("붙어 있어야 합쳐져요.");
    else toast("같은 등급만 합칠 수 있어요.");
    play(150, 0.08, "sawtooth", 0.02);
  }

  function protectedCells() {
    const keep = new Set();
    if (state && state.selected != null && state.board[state.selected]) keep.add(state.selected);
    if (pointer && state && state.board[pointer.cell]) keep.add(pointer.cell);
    return keep;
  }

  function freeCells(tier) {
    const keep = protectedCells();
    const pool = [];
    for (let i = 0; i < SIZE; i++) {
      if (state.board[i] === tier && !keep.has(i)) pool.push(i);
    }
    return pool;
  }

  function claimOrder(index) {
    if (!state || state.busy || state.modal) return;
    if (!missionOpen(index)) return;
    const order = state.orders[index];
    if (!order) return;
    if (order.type === "combo") {
      toast("이 주문은 연속으로 합치면 채워져요.");
      return;
    }
    const need = order.count - order.have;
    if (need <= 0) return;
    const pool = freeCells(order.tier);
    if (pool.length < need) {
      const total = state.board.filter((n) => n === order.tier).length;
      toast(total >= need ? "고른 보석은 미션에 넣지 않아요." : `${josa(TIER[order.tier], "이", "가")} ${need}개 있어야 해요.`);
      play(150, 0.08, "sawtooth", 0.02);
      return;
    }
    for (let n = pool.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      const tmp = pool[n];
      pool[n] = pool[j];
      pool[j] = tmp;
    }
    pool.slice(0, need).forEach((from) => {
      floatCell(from, order.type === "hunt" ? "공격" : TIER[order.tier]);
      state.board[from] = 0;
      if (state.selected === from) state.selected = null;
    });
    state.fullTold = false;
    order.have = order.count;
    play(720, 0.07, "sine", 0.04);
    const pay = payout(order);
    state.coins += pay;
    gainXp(order.xp);
    const card = ordersEl.querySelector(`[data-order="${index}"]`);
    if (card) {
      const r = card.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      floatAt(r.left - a.left + r.width / 2, r.top - a.top, "+" + fmt(pay), true);
    }
    const defeated = order.type === "hunt" && order.hit >= 3;
    const bonus = defeated ? 6 : 0;
    if (bonus) state.coins += bonus;
    if (order.type === "hunt" && !defeated) {
      toast(`${josa(order.monster, "을", "를")} 맞췄어요 ${order.hit}/3`);
      state.orders[index] = makeHunt(order);
    } else if (defeated) {
      toast(`${josa(order.monster, "을", "를")} 쓰러뜨렸어요 +${bonus}`);
      state.orders[index] = rollOrder(index);
      state.huntIn = 55 + Math.random() * 20;
    } else {
      toast(order.rush > 0 ? "급한 주문을 맞췄어요" : "주문을 마쳤어요");
      state.orders[index] = rollOrder(index);
    }
    play(523, 0.1, "triangle", 0.045);
    play(784, 0.14, "triangle", 0.035, 0.07);
    pingTutorial("deliver");
    render();
    save();
  }

  function sellTargets() {
    const index = state.selected;
    if (index == null || !state.board[index]) return [];
    return [index];
  }

  function doSell(indexes) {
    const list = Array.isArray(indexes) ? indexes : [indexes];
    let total = 0;
    let sold = 0;
    for (const index of list) {
      const tier = state.board[index];
      if (!tier) continue;
      const val = sellValue(tier);
      state.board[index] = 0;
      total += val;
      sold += 1;
      floatCell(index, "+" + fmt(val));
    }
    if (!sold) return 0;
    state.selected = null;
    state.fullTold = false;
    state.coins += total;
    play(480, 0.07, "triangle", 0.035);
    render();
    save();
    return sold;
  }

  const AD_SEC = 5;
  const TAP_AD_SEC = 3;
  const TAP_AD_EVERY = 100;
  const BLAZE_SEC = 5;
  let adSell = null;
  let adTapReward = null;
  let adContinue = null;
  let adCoin = null;
  let blazeLeft = 0;

  function clearAdBar() {
    const bar = document.getElementById("ad-bar");
    if (bar) bar.remove();
  }

  function currentAd() {
    return adSell || adTapReward || adContinue || adCoin;
  }

  function paintAd() {
    const ad = currentAd();
    const inner = document.querySelector("#ad-bar i");
    if (!inner || !ad) return;
    const ratio = 1 - Math.max(0, ad.left) / ad.total;
    inner.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  function mountAdBar() {
    const bar = document.createElement("div");
    bar.id = "ad-bar";
    bar.className = "ad-bar";
    bar.innerHTML = "<i></i>";
    modalActions.before(bar);
    paintAd();
  }

  function finishAdSell() {
    const indexes = adSell ? adSell.indexes : [];
    adSell = null;
    closeModal();
    const sold = doSell(indexes);
    if (sold) toast(`선택한 돌 ${sold}개를 분해했어요`);
  }

  function tickAdSell(dt) {
    const ad = currentAd();
    if (!ad) return;
    ad.left -= dt;
    paintAd();
    if (ad.left > 0) return;
    if (adSell) finishAdSell();
    else if (adContinue) finishContinueAd();
    else if (adCoin) finishCoinAd();
    else finishTapAd();
  }

  function finishCoinAd() {
    const gain = adCoin ? adCoin.gain : 0;
    adCoin = null;
    closeModal();
    if (!gain || !state) return;
    state.coins += gain;
    toast(`+${fmt(gain)}코인`);
    render();
    save();
  }

  function offerReward(slot, onReward, onCancel, fallback) {
    const ads = window.LumenAds;
    if (!ads || !ads.officialReady()) {
      fallback();
      return;
    }
    openModal({
      title: "광고",
      body: "광고가 끝나면 보상을 받습니다.",
      actions: [{
        label: "취소",
        on: () => {
          onCancel();
          closeModal();
        },
      }],
    });
    const handed = ads.requestReward(slot, () => {
      closeModal();
      onReward();
    }, () => {
      closeModal();
      onCancel();
    });
    if (handed) return;
    closeModal();
    toast("광고를 불러오지 못했어요");
    onCancel();
  }

  function openCoinAd() {
    if (!state || state.modal || state.busy || currentAd()) return;
    const gain = coinAdGain();
    offerReward("coin", () => {
      if (!state) return;
      state.coins += gain;
      toast(`+${fmt(gain)}코인`);
      render();
      save();
    }, () => {}, () => {
    adCoin = { left: TAP_AD_SEC, total: TAP_AD_SEC, gain };
    openModal({
      title: "광고",
      body: `광고가 끝나면 +${fmt(gain)}코인을 받습니다.`,
      actions: [{
        label: "취소",
        on: () => {
          adCoin = null;
          closeModal();
        },
      }],
    });
    mountAdBar();
    });
  }

  function finishTapAd() {
    const gain = adTapReward ? adTapReward.gain : 0;
    adTapReward = null;
    closeModal();
    if (!gain || !state) return;
    state.coins += gain;
    toast(`+${fmt(gain)}코인`);
    startBlaze();
    render();
    save();
  }

  function startBlaze() {
    blazeLeft = BLAZE_SEC;
    if (tapWrap) tapWrap.classList.add("blaze");
    toast("망치가 달아올랐어요");
  }

  function tickBlaze(dt) {
    if (blazeLeft <= 0) return;
    blazeLeft = Math.max(0, blazeLeft - dt);
    if (blazeLeft <= 0 && tapWrap) tapWrap.classList.remove("blaze");
  }

  function openTapAd() {
    const gain = roundUpgradeCost() * 2;
    offerReward("tap", () => {
      if (!state) return;
      state.coins += gain;
      toast(`+${fmt(gain)}코인`);
      startBlaze();
      render();
      save();
    }, () => { paintEnergy(); }, () => {
    adTapReward = { left: TAP_AD_SEC, total: TAP_AD_SEC, gain };
    openModal({
      title: "광고",
      body: `광고가 끝나면 +${fmt(gain)}코인을 받습니다.`,
      actions: [{
        label: "취소",
        on: () => {
          adTapReward = null;
          closeModal();
          paintEnergy();
        },
      }],
    });
    mountAdBar();
    });
  }

  function payTapCoins(gain) {
    state.coins += gain;
    toast(`+${fmt(gain)}코인`);
    paintEnergy();
    if (coinsEl) coinsEl.textContent = fmt(state.coins);
    saveSoon();
  }

  function maybeTapAd() {
    if (!state || state.modal || state.busy || adTapReward) return;
    if (state.taps - (state.adTapMark | 0) < TAP_AD_EVERY) return;
    state.adTapMark = state.taps;
    state.tapRewards = (state.tapRewards | 0) + 1;
    if (state.tapRewards % 5 === 0) openTapAd();
    else payTapCoins(roundUpgradeCost());
  }

  function onSell() {
    if (!state || state.busy || state.modal) return;
    const indexes = sellTargets();
    if (!indexes.length) {
      toast("분해할 돌을 고르세요.");
      return;
    }
    const val = indexes.reduce((sum, index) => sum + sellValue(state.board[index]), 0);
    offerReward("sell", () => {
      const sold = doSell(indexes);
      if (sold) toast(`선택한 돌 ${sold}개를 분해했어요`);
    }, () => {}, () => {
    adSell = { indexes, left: AD_SEC, total: AD_SEC };
    openModal({
      title: "분해",
      body: `광고를 시청하면 선택한 돌 ${indexes.length}개를 코인으로 분해합니다.\n+${fmt(val)}코인`,
      actions: [{
        label: "취소",
        on: () => {
          adSell = null;
          closeModal();
        },
      }],
    });
    mountAdBar();
    });
  }

  function grantGem(tier) {
    const i = randomEmpty();
    if (i < 0) {
      const val = sellValue(tier);
      state.coins += val;
      toast("칸이 없어 코인으로 바꿨어요.");
      return;
    }
    state.board[i] = tier;
    if (tier > state.maxTier) state.maxTier = tier;
    state.just = new Set([i]);
  }

  function openChest() {
    state.resWave = 0;
    renderPips();
    const coinReward = Math.round(8 + 3 * state.level + (state.up.sense * 0.4) / FINE);
    play(660, 0.1, "sine", 0.04);
    play(880, 0.16, "sine", 0.035, 0.08);
    openModal({
      title: "공명의 상자",
      body: "다섯 번의 공명이 모였습니다. 보상을 고르세요.",
      actions: [
        {
          label: `코인 +${fmt(coinReward)}`,
          primary: true,
          on: () => {
            state.coins += coinReward;
            closeModal();
            toast("코인을 받았어요");
            render();
            save();
          },
        },
        {
          label: "수정 받기",
          on: () => {
            grantGem(3);
            closeModal();
            render();
            save();
          },
        },
      ],
    });
  }

  function askContinue() {
    if (!state || state.modal) return;
    openModal({
      title: "판이 막혔어요",
      body: "광고를 보면 다음 판을 이어갈 수 있습니다.\n코인과 강화는 그대로 남습니다.",
      actions: [
        { label: "광고 보고 이어하기", primary: true, on: openContinueAd },
        { label: "취소", on: closeModal },
      ],
    });
  }

  function openContinueAd() {
    offerReward("continue", () => {
      if (!state) return;
      nextBoard();
    }, () => { askContinue(); }, () => {
    adContinue = { left: TAP_AD_SEC, total: TAP_AD_SEC };
    clearAdBar();
    openModal({
      title: "광고",
      body: "광고가 끝나면 다음 판이 열립니다.",
      actions: [{
        label: "취소",
        on: () => {
          adContinue = null;
          closeModal();
          askContinue();
        },
      }],
    });
    mountAdBar();
    });
  }

  function finishContinueAd() {
    adContinue = null;
    if (!state) {
      closeModal();
      return;
    }
    nextBoard();
  }

  function nextBoard() {
    state.board = dealBoard(openRows());
    state.selected = null;
    state.just = new Set();
    state.hotCells = new Set();
    state.fullTold = false;
    state.ended = false;
    state.resonance = pickTwoCells();
    closeModal();
    render();
    save();
    toast("새 판을 깔았어요");
  }

  function noteBoardLocked() {
    if (!started || !state || state.busy || state.modal) return;
    if (!noMoves()) {
      state.ended = false;
      return;
    }
    if (state.ended) return;
    state.ended = true;
    play(196, 0.18, "sine", 0.04);
    askContinue();
  }

  function openModal({ title, body, actions }) {
    state.modal = true;
    modal.hidden = false;
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalActions.innerHTML = "";
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.primary ? "btn primary" : "btn ghost";
      button.textContent = action.label;
      button.addEventListener("click", action.on);
      modalActions.appendChild(button);
    }
  }

  function closeModal() {
    if (state) state.modal = false;
    modal.hidden = true;
    modalActions.innerHTML = "";
    clearAdBar();
  }

  function buy(id) {
    const spec = UPS.find((u) => u.id === id);
    if (!spec || state.up[id] >= spec.max) return;
    if (!upgradeOpen(spec)) {
      toast(gateText(spec));
      return;
    }
    const cost = upgradeCost(id);
    if (state.coins < cost) {
      toast("코인이 부족해요.");
      play(150, 0.08, "sawtooth", 0.02);
      return;
    }
    state.coins -= cost;
    state.up[id] += 1;
    noteUnlocks(id);
    const next = state.autoBuy ? (upgradePlan()[0] && upgradePlan()[0].id) : null;
    autoFocusId = next;
    play(620, 0.06, "triangle", 0.04);
    play(830, 0.1, "sine", 0.035, 0.05);
    toast(`${josa(spec.name, "을", "를")} 강화했어요`);
    render();
    scrollUpgrade(next || id);
    save();
  }

  function buyCheapest() {
    const plan = upgradePlan();
    if (!plan.length) return;
    let opened = false;
    for (const item of plan) {
      state.coins -= item.cost;
      state.up[item.id] += 1;
      if (noteUnlocks(item.id)) opened = true;
    }
    play(620, 0.04, "triangle", 0.02);
    if (coinsEl) coinsEl.textContent = fmt(state.coins);
    renderShop();
    if (opened) renderBoard();
    paintEnergy();
    saveSoon();
  }

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest(".cell");
    if (!cell || !board.contains(cell)) return null;
    return Number(cell.dataset.i);
  }

  function hideGhost() {
    ghost.hidden = true;
    ghost.replaceChildren();
    ghost.style.transform = "";
    if (liftEl) liftEl.classList.remove("lifting");
    if (hoverEl) hoverEl.classList.remove("hover");
    liftEl = null;
    hoverEl = null;
  }

  const GRAB_SLOP = 18;

  function canMerge(from, to) {
    if (!state || from == null || to == null || from === to) return false;
    if (!cellOpen(from) || !cellOpen(to)) return false;
    const a = state.board[from];
    const b = state.board[to];
    return !!(a && b && a === b && a < MAX_TIER && adjacent(from, to));
  }

  function grabCell(index) {
    if (!state || !state.board[index]) return;
    state.selected = index;
    render();
  }

  function onPointerDown(e) {
    if (!state || state.modal || e.button > 0) return;
    if (state.ended) {
      askContinue();
      return;
    }
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const index = Number(cell.dataset.i);
    if (!cellOpen(index)) {
      toast(`${josa(rowUnlockName(Math.floor(index / COLS)), "이", "가")} 열리면 이 줄이 열려요`);
      return;
    }
    pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cell: index,
      moved: false,
    };
    try {
      board.setPointerCapture(e.pointerId);
    } catch (err) {
      /* capture is optional if the pointer already ended */
    }
  }

  function onPointerMove(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    if (!pointer.moved && dx * dx + dy * dy > GRAB_SLOP * GRAB_SLOP) pointer.moved = true;
    if (!pointer.moved || !state.board[pointer.cell]) return;
    if (!pointer.shown) {
      pointer.shown = true;
      ghost.className = `gem ghost t${state.board[pointer.cell]}`;
      ghost.hidden = false;
    }
    ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    const nextLift = cellEls[pointer.cell] || null;
    if (liftEl !== nextLift) {
      if (liftEl) liftEl.classList.remove("lifting");
      liftEl = nextLift;
      if (liftEl) liftEl.classList.add("lifting");
    }
    const hover = cellFromPoint(e.clientX, e.clientY);
    const nextHover = hover != null ? cellEls[hover] || null : null;
    if (hoverEl !== nextHover) {
      if (hoverEl) hoverEl.classList.remove("hover");
      hoverEl = nextHover;
      if (hoverEl && hoverEl !== liftEl) hoverEl.classList.add("hover");
    }
  }

  function onPointerUp(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const info = pointer;
    pointer = null;
    hideGhost();
    if (!state || state.modal) return;
    if (state.busy) {
      if (!info.moved) grabCell(info.cell);
      return;
    }
    if (info.moved && state.board[info.cell]) {
      const target = cellFromPoint(e.clientX, e.clientY);
      if (canMerge(info.cell, target)) {
        tryAction(info.cell, target);
        return;
      }
      grabCell(info.cell);
      return;
    }
    const cell = info.cell;
    if (!state.board[cell]) {
      if (state.selected != null) {
        state.selected = null;
        render();
      }
      return;
    }
    if (state.selected != null && state.selected !== cell) {
      if (canMerge(state.selected, cell)) tryAction(state.selected, cell);
      else grabCell(cell);
      return;
    }
    if (state.selected === cell) {
      const tier = state.board[cell];
      const twins = neighbors(cell).filter((n) => state.board[n] === tier);
      if (tier < MAX_TIER && twins.length === 1) {
        tryAction(cell, twins[0]);
        return;
      }
      state.selected = null;
      render();
      return;
    }
    grabCell(cell);
  }

  function onPointerCancel(e) {
    if (!pointer || (e.pointerId != null && e.pointerId !== pointer.id)) return;
    const info = pointer;
    pointer = null;
    hideGhost();
    if (state && !state.modal && !info.moved) grabCell(info.cell);
  }

  function refreshStart() {
    pending = readSave();
    const blurb = document.getElementById("blurb");
    const cont = document.getElementById("continue");
    const fresh = document.getElementById("fresh");
    const wipe = document.getElementById("wipe");
    if (pending) {
      blurb.textContent = `저장된 대장간 · Lv.${pending.level} · 코인 ${fmt(pending.coins)}`;
      cont.hidden = false;
      fresh.hidden = true;
      wipe.hidden = false;
    } else {
      blurb.textContent = "빈 대장간에서 첫 별을 깨웁니다.";
      cont.hidden = true;
      fresh.hidden = false;
      wipe.hidden = true;
    }
  }

  function begin(useSave) {
    state = useSave && pending ? hydrate(pending) : freshState();
    started = true;
    start.hidden = true;
    playEl.hidden = false;
    try { ac(); } catch (err) { /* ignore */ }
    render();
    save();
    noteBoardLocked();
  }

  function helpText() {
    return [
      "별을 두드리면 에너지가 차고, 가득 차면 먼지가 보드에 나타납니다. 손으로 두드리면 두 개 이상 나올 확률이 더 높고, 가끔 크리티컬이 터집니다.",
      "두드리기 아래 숫자는 한 번에 차는 에너지입니다. 손으로 두드리는 것은 공짜입니다.",
      "코인 옆 +를 누르면 3초 광고 뒤에 열린 강화를 한 바퀴 올릴 코인을 받습니다. 도중에 닫으면 없습니다.",
      "자동 망치는 1단계부터 칸이 있을 때 스스로 두드립니다. 속도는 앞부분에서 더 빨리 오르고, 만랩은 그대로입니다. 오백 번 두드리기 광고가 끝나면 5초 동안 최대 속도로 탑니다. 코인이 없어 멈추면 두드리기를 누르세요. 손 두드리기는 공짜입니다.",
      "증산은 자동 망치가 돌을 낼 때 하나 더 나올 확률을 올립니다. 손 두드리기에는 들어가지 않습니다.",
      "조각은 빈칸으로 옮길 수 없습니다. 같은 등급이 이웃해 있으면 겹치거나, 한 번 더 눌러 합칩니다.",
      "금빛 모서리는 바로 옆에서 합칠 수 있다는 표시입니다. 옆에 같은 조각이 더 있으면 연쇄로 합쳐집니다.",
      "짧게 이어 합치면 콤보가 조금 더 붙습니다. 콤보 주문은 그렇게 완료됩니다.",
      "미션은 처음에 하나입니다. 5레벨에 하나, 10레벨에 하나가 더 열립니다.",
      "필요한 개수가 판에 모이면 카드가 밝아지고, 잠시 후 스스로 납품됩니다. 먼저 고른 보석은 납품되지 않습니다. 그 전에 합치면 납품은 멈춥니다. 눌러도 바로 넘길 수 있습니다.",
      "성수 사냥 카드도 보석이 모이면 잠시 후 스스로 공격합니다. 세 번 맞추면 쓰러지고, 마지막에 보너스가 조금 더 나옵니다.",
      "금빛 테두리 칸에서 합치면 공명입니다. 다섯 번이면 상자가 열립니다.",
      "합칠 이웃이 하나뿐이면 그 조각을 한 번 더 눌러 바로 합칠 수 있습니다.",
      "합치면 화로가 달아오릅니다. 가득 차면 다음 돌 1개가 한 단계 높아지고, 보석까지만 올라갑니다.",
      "아래 두 줄은 닫혀 있습니다. 정련이 열리면 한 줄, 장사가 열리면 마지막 줄이 열립니다.",
      "위쪽 목표는 아직 못 빚은 등급입니다. 만들면 보너스 코인을 받습니다.",
      "빨간 글씨의 주문은 제한 시간 안에 맞추면 보상이 커집니다.",
      "칸이 막혀도 납품할 주문이 있으면 카드가 밝아집니다. 합칠 곳도 납품도 없으면 이번 판이 끝납니다. 광고를 보면 다음 판을 이어가고, 도중에 닫으면 넘어가지 않습니다. 코인과 강화는 남습니다.",
      "고른 돌은 분해로 코인을 받습니다. 광고를 시청하면 선택한 돌이 분해되고, 도중에 닫으면 분해되지 않습니다.",
      "전체 자동 강화는 처음부터 켜져 있습니다. 고른 강화를 함께 올리고, 코인이 부족하면 싼 항목부터 올립니다. 칸을 누르면 자동에서 빼거나 다시 넣습니다.",
      "손으로 백 번 두드리면 코인을 받습니다. 오백 번마다 3초 광고가 먼저 나오고, 도중에 닫으면 그 번의 코인은 없습니다.",
      "키보드에서는 스페이스바로 두드릴 수 있습니다.",
    ].join("\n\n");
  }

  document.getElementById("fresh").addEventListener("click", () => begin(false));
  document.getElementById("continue").addEventListener("click", () => begin(true));
  document.getElementById("wipe").addEventListener("click", () => {
    state = freshState();
    openModal({
      title: "저장을 지울까요?",
      body: "이어하던 대장간이 사라집니다.",
      actions: [
        { label: "취소", on: () => { closeModal(); state = null; } },
        {
          label: "지우고 시작",
          primary: true,
          on: () => {
            closeModal();
            try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
            pending = null;
            begin(false);
          },
        },
      ],
    });
  });

  document.getElementById("skip-tutor").addEventListener("click", () => {
    state.tutorial = -1;
    renderCoach();
    saveSoon();
  });
  document.getElementById("help").addEventListener("click", () => {
    openModal({ title: "플레이 방법", body: helpText(), actions: [{ label: "알겠어요", primary: true, on: closeModal }] });
  });
  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    if (state.sound) play(660, 0.08, "sine", 0.05);
    renderHeader();
    saveSoon();
  });
  sellBtn.addEventListener("click", onSell);
  document.getElementById("coin-plus").addEventListener("click", openCoinAd);
  tapBtn.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    doTap();
  });
  tapBtn.addEventListener("click", (e) => {
    if (e.detail === 0) doTap();
  });
  document.getElementById("auto-buy").addEventListener("click", () => {
    if (!state || state.modal) return;
    if (!state.autoBuy) {
      state.autoBuy = true;
      state.autoPick = null;
      autoBuyWait = 0;
      autoFocusId = null;
    } else if (picksCustom()) {
      state.autoPick = null;
      autoFocusId = null;
    } else {
      state.autoBuy = false;
      autoBuyWait = 0;
      autoFocusId = null;
    }
    play(state.autoBuy ? 740 : 220, 0.05, "triangle", 0.03);
    renderShop(state.autoBuy && upgradePlan()[0] ? upgradePlan()[0].id : null);
    save();
  });
  shopList.addEventListener("wheel", () => {
    shopList.scrollTop = shopList.scrollTop;
  }, { passive: true });
  shopList.addEventListener("pointerdown", () => {
    shopList.scrollTop = shopList.scrollTop;
  });
  shopList.addEventListener("click", (e) => {
    const button = e.target.closest("[data-up]");
    if (button) {
      buy(button.dataset.up);
      return;
    }
    const card = e.target.closest(".up[data-id]");
    if (!card || !state || !state.autoBuy || state.modal) return;
    if (card.classList.contains("locked")) {
      const spec = UPS.find((item) => item.id === card.dataset.id);
      if (spec) toast(gateText(spec));
      return;
    }
    if (!state.autoPick) state.autoPick = allPick();
    const id = card.dataset.id;
    state.autoPick[id] = state.autoPick[id] === false;
    autoFocusId = null;
    play(state.autoPick[id] ? 620 : 220, 0.04, "triangle", 0.025);
    renderShop(upgradePlan()[0] ? upgradePlan()[0].id : null);
    saveSoon();
  });
  ordersEl.addEventListener("click", (e) => {
    const locked = e.target.closest("[data-slot]");
    if (locked && state && !state.modal) {
      toast(`Lv.${locked.dataset.slot}에 미션이 열립니다`);
      return;
    }
    const card = e.target.closest("[data-order]");
    if (!card || !state || state.busy || state.modal) return;
    claimOrder(Number(card.dataset.order));
  });
  board.addEventListener("pointerdown", onPointerDown);
  board.addEventListener("pointermove", onPointerMove);
  board.addEventListener("pointerup", onPointerUp);
  board.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  board.addEventListener("dragstart", (e) => e.preventDefault());
  board.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || !started || !state || state.modal) return;
    const active = document.activeElement;
    if (active && active.closest && active.closest("button, a")) return;
    e.preventDefault();
    doTap();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else watchDeploy();
  });
  window.addEventListener("pagehide", () => save());

  const bootedCss = document.querySelector('link[rel="stylesheet"]').getAttribute("href");
  const bootedJs = document.querySelector('script[src*="game.js"]').getAttribute("src");

  function watchDeploy() {
    if (state && state.modal) return;
    fetch("index.html?t=" + Date.now(), { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : ""))
      .then((html) => {
        if (!html) return;
        const css = (html.match(/styles\.css\?v=\d+/) || [])[0];
        const js = (html.match(/game\.js\?v=\d+/) || [])[0];
        if (!css || !js) return;
        if (css === bootedCss && js === bootedJs) return;
        if (state && state.modal) return;
        if (started && state) save();
        location.reload();
      })
      .catch(() => {});
  }

  setInterval(watchDeploy, 45000);

  function fitStars() {
    const rect = app.getBoundingClientRect();
    starsCanvas.width = Math.max(1, Math.round(rect.width));
    starsCanvas.height = Math.max(1, Math.round(rect.height));
    const count = rect.width < 520 ? 28 : 40;
    starPts = Array.from({ length: count }, () => {
      const warm = Math.random() < 0.18;
      const a = (0.28 + Math.random() * 0.55).toFixed(2);
      return {
        x: Math.random(),
        y: Math.random(),
        s: Math.random() * 1.5 + 0.7,
        v: 0.008 + Math.random() * 0.03,
        color: warm ? `rgba(255, 186, 120, ${a})` : `rgba(255, 255, 255, ${a})`,
      };
    });
  }

  function drawStars(dt) {
    if (document.hidden || !starPts.length) return;
    const w = starsCanvas.width;
    const h = starsCanvas.height;
    starCtx.clearRect(0, 0, w, h);
    for (const star of starPts) {
      if (!REDUCE) star.y -= star.v * dt;
      if (star.y < 0) star.y = 1;
      starCtx.fillStyle = star.color;
      starCtx.fillRect(star.x * w, star.y * h, star.s, star.s);
    }
  }

  const AUTO_BUY_SEC = 2.5;
  const MISSION_PACE = 0.5;
  const AUTO_ORDER_SEC = 1.5 / MISSION_PACE;
  let lastT = performance.now();
  let autoBill = 0;
  let autoDry = false;
  let autoBuyWait = 0;
  let autoFocusId = null;
  let autoOrderIndex = -1;
  let autoOrderWait = 0;

  function readyOrderIndex() {
    for (let i = 0; i < state.orders.length; i++) {
      if (!missionOpen(i)) continue;
      const order = state.orders[i];
      if (!order || (order.type !== "gem" && order.type !== "hunt")) continue;
      const need = order.count - order.have;
      if (need <= 0) continue;
      if (freeCells(order.tier).length >= need) return i;
    }
    return -1;
  }

  function paintAutoOrder() {
    if (!ordersEl) return;
    const ratio = autoOrderIndex >= 0 ? Math.max(0, Math.min(1, autoOrderWait / AUTO_ORDER_SEC)) : 0;
    const key = autoOrderIndex + ":" + Math.round(ratio * 40);
    if (key === orderPaintKey) return;
    orderPaintKey = key;
    const pct = (ratio * 100).toFixed(1) + "%";
    for (const card of ordersEl.children) {
      const inner = card.querySelector(".bar i");
      const on = Number(card.dataset.order) === autoOrderIndex;
      if (card.classList.contains("charging") !== on) card.classList.toggle("charging", on);
      if (on && inner) inner.style.width = pct;
    }
  }

  function tickAutoOrder(dt) {
    if (state.modal || state.busy) {
      paintAutoOrder();
      return;
    }
    const index = readyOrderIndex();
    if (index !== autoOrderIndex) {
      autoOrderIndex = index;
      autoOrderWait = 0;
    }
    if (index >= 0) {
      autoOrderWait += dt;
      if (autoOrderWait >= AUTO_ORDER_SEC) {
        autoOrderWait = 0;
        autoOrderIndex = -1;
        claimOrder(index);
      }
    }
    paintAutoOrder();
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (started && state && !state.modal) tickBlaze(dt);
    if (started && state && !state.modal && state.up.auto > 0) {
      const coinRate = autoCoinRate(state.up.auto);
      const resting = !boardOpen();
      if (state.coins <= 0) {
        if (!autoDry) {
          autoDry = true;
          toast("두드리기를 누르세요~");
          paintEnergy();
        }
      } else if (resting) {
        autoBill = 0;
        paintEnergy();
      } else {
        autoDry = false;
        state.energy += (blazeLeft > 0 ? AUTO_ENERGY_MAX : autoEnergyRate(state.up.auto)) * dt;
        autoBill += coinRate * dt;
        const pay = Math.min(state.coins, Math.floor(autoBill));
        if (pay > 0) {
          state.coins -= pay;
          autoBill -= pay;
          if (coinsEl) coinsEl.textContent = fmt(state.coins);
          if (state.coins <= 0) {
            autoDry = true;
            toast("두드리기를 누르세요~");
          }
        }
        if (state.energy >= 100) resolveEnergy();
        else paintEnergy();
      }
    }
    if (started && state && !state.modal && !state.busy && state.autoBuy) {
      autoBuyWait += dt;
      if (autoBuyWait >= AUTO_BUY_SEC) {
        autoBuyWait = 0;
        buyCheapest();
      }
      paintAutoCool();
    } else {
      autoBuyWait = 0;
      paintAutoCool();
    }
    if (started && state && !state.modal && !state.busy) {
      tickRush(dt);
      tickHunt(dt);
    }
    if (started && state) tickAutoOrder(dt);
    if (started && state) tickAdSell(dt);
    paintCombo();
    drawStars(dt);
    saveTick += dt;
    if (saveTick >= 3 && started && state) {
      saveTick = 0;
      save();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", fitStars);
  refreshStart();
  fitStars();
  requestAnimationFrame(loop);
})();
