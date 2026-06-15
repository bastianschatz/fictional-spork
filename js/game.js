/* ===== Level Devil — ein kleiner Troll-Plattformer =====
   Der Level spielt nicht fair: Böden brechen weg, Spikes schießen hoch,
   Decken fallen, Türen fliehen. Erreiche trotzdem die Tür. */
const LevelDevil = (function () {
  'use strict';

  // Fallback für sehr alte Browser ohne CanvasRenderingContext2D.roundRect
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
    };
  }

  const VW = 720, VH = 405;            // virtuelle Spielfläche (16:9)
  const GRAV = 1500, MOVE = 195, JUMP = -495, MAXFALL = 720;
  const PW = 22, PH = 30;

  let canvas, ctx, scale = 2;
  let levelEl, deathsEl, overlay, ovTitle, ovText, ovBtn, touchWrap;
  let running = false, raf = 0, last = 0;
  let deaths = 0, levelIndex = 0;
  let flash = 0, won = false;
  const keys = { left: false, right: false, jump: false, jumpHeld: false };

  let player, level, coyote = 0;

  // ---- Level-Definitionen (liefern jedes Mal frische Objekte) ----
  function levelDefs() {
    return [
      // L1 — lerne, nichts zu trauen
      () => ({
        spawn: { x: 30, y: 300 },
        platforms: [
          { x: 0, y: 365, w: 280, h: 40, type: 'solid' },
          { x: 360, y: 365, w: 360, h: 40, type: 'solid' },
        ],
        spikes: [{ x: 545, y: 338, w: 30, h: 27, hidden: true, trig: 500 }],
        blocks: [],
        door: { x: 662, y: 300, w: 34, h: 65 },
      }),
      // L2 — brechende Böden & fallende Decke
      () => ({
        spawn: { x: 26, y: 300 },
        platforms: [
          { x: 0, y: 365, w: 200, h: 40, type: 'solid' },
          { x: 240, y: 322, w: 74, h: 16, type: 'fall' },
          { x: 360, y: 292, w: 74, h: 16, type: 'fall' },
          { x: 480, y: 322, w: 74, h: 16, type: 'solid' },
          { x: 580, y: 365, w: 140, h: 40, type: 'solid' },
        ],
        spikes: [{ x: 636, y: 338, w: 26, h: 27, hidden: true, trig: 596 }],
        blocks: [{ x: 470, y: -90, w: 70, h: 72, trig: 250, floorY: 322 }],
        door: { x: 668, y: 300, w: 34, h: 65 },
      }),
      // L3 — Falle-Plattform, Spikes & eine fliehende Tür
      () => ({
        spawn: { x: 26, y: 300 },
        platforms: [
          { x: 0, y: 365, w: 220, h: 40, type: 'solid' },
          { x: 258, y: 320, w: 78, h: 16, type: 'fake' },
          { x: 360, y: 300, w: 70, h: 16, type: 'solid' },
          { x: 466, y: 330, w: 70, h: 16, type: 'fall' },
          { x: 560, y: 365, w: 160, h: 40, type: 'solid' },
        ],
        spikes: [
          { x: 300, y: 338, w: 26, h: 27, hidden: false },
          { x: 612, y: 338, w: 26, h: 27, hidden: true, trig: 575 },
        ],
        blocks: [],
        door: {
          x: 678, y: 300, w: 34, h: 65, flees: true, stage: 0, cd: 0,
          stops: [{ x: 600, y: 240 }, { x: 678, y: 168 }],
        },
      }),
    ];
  }
  let DEFS = levelDefs();

  // ---- Level laden / zurücksetzen ----
  function loadLevel(i) {
    DEFS = levelDefs();
    level = DEFS[i]();
    won = false;
    // platform state
    for (const p of level.platforms) { p.active = true; p.falling = false; p.vy = 0; p.touched = false; p.fakeT = 0; p.revealed = p.type !== 'rise'; }
    for (const s of level.spikes) s.revealed = !s.hidden;
    for (const b of level.blocks) { b.triggered = false; b.vy = 0; b.cy = b.y; }
    player = { x: level.spawn.x, y: level.spawn.y, vx: 0, vy: 0, ground: false, dir: 1 };
    coyote = 0;
  }

  function platSolid(p) {
    if (!p.active) return false;
    if (p.falling) return false;
    if (p.type === 'rise' && !p.revealed) return false;
    return true;
  }

  // ---- Tod & Respawn ----
  function die() {
    if (won) return;
    deaths++; deathsEl.textContent = deaths;
    flash = 0.28;
    loadLevel(levelIndex);
  }

  function nextLevel() {
    levelIndex++;
    if (levelIndex >= DEFS.length) {
      won = true; running = false;
      showOverlay('Geschafft! 🏆', 'Du hast dem Teufel getrotzt. Genug gespielt — zurück ans Lernen?', 'Zurück zum Lernen', () => exit());
      return;
    }
    showOverlay('Level ' + (levelIndex + 1), 'Es wird gemeiner.', 'Weiter', () => { loadLevel(levelIndex); hideOverlay(); resume(); });
    levelEl.textContent = levelIndex + 1;
  }

  // ---- Kollision Helfer ----
  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---- Physik / Logik ----
  function update(dt) {
    if (flash > 0) flash -= dt;

    // input -> velocity
    player.vx = (keys.right ? MOVE : 0) - (keys.left ? MOVE : 0);
    if (player.vx > 0) player.dir = 1; else if (player.vx < 0) player.dir = -1;

    if (player.ground) coyote = 0.09; else coyote -= dt;
    if (keys.jump && coyote > 0) { player.vy = JUMP; player.ground = false; coyote = 0; keys.jump = false; }
    // variable jump height
    if (!keys.jumpHeld && player.vy < -160) player.vy = -160;

    player.vy += GRAV * dt;
    if (player.vy > MAXFALL) player.vy = MAXFALL;

    // platform timers (fall / fake)
    for (const p of level.platforms) {
      if (p.type === 'fall' && p.touched && !p.falling) { p.timer = (p.timer ?? 0.34) - dt; if (p.timer <= 0) p.falling = true; }
      if (p.falling) { p.vy += GRAV * dt; p.y += p.vy * dt; if (p.y > VH + 80) p.active = false; }
      if (p.type === 'fake' && p.fakeT > 0) { p.fakeT -= dt; if (p.fakeT <= 0) p.active = false; }
      if (p.type === 'rise' && !p.revealed && player.x + PW > p.trig) p.revealed = true;
    }

    // ---- horizontal ----
    player.x += player.vx * dt;
    for (const p of level.platforms) {
      if (!platSolid(p)) continue;
      if (overlaps(player.x, player.y, PW, PH, p.x, p.y, p.w, p.h)) {
        if (player.vx > 0) player.x = p.x - PW; else if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }
    player.x = Math.max(0, Math.min(VW - PW, player.x));

    // ---- vertical ----
    player.y += player.vy * dt;
    player.ground = false;
    for (const p of level.platforms) {
      if (!platSolid(p)) continue;
      if (overlaps(player.x, player.y, PW, PH, p.x, p.y, p.w, p.h)) {
        if (player.vy > 0) {                 // landing on top
          player.y = p.y - PH; player.vy = 0; player.ground = true;
          if (p.type === 'fall' && !p.touched) { p.touched = true; p.timer = 0.34; }
          if (p.type === 'fake' && p.fakeT === 0 && p.active) p.fakeT = 0.09;
        } else if (player.vy < 0) {           // bonk head
          player.y = p.y + p.h; player.vy = 0;
        }
      }
    }

    // spikes
    for (const s of level.spikes) {
      if (!s.revealed && s.hidden && player.x + PW > s.trig) s.revealed = true;
      if (s.revealed && overlaps(player.x, player.y, PW, PH, s.x, s.y, s.w, s.h)) return die();
    }

    // falling blocks (ceilings)
    for (const b of level.blocks) {
      if (!b.triggered && player.x + PW > b.trig) b.triggered = true;
      if (b.triggered) {
        b.vy += GRAV * dt; b.cy += b.vy * dt;
        if (b.cy + b.h >= b.floorY) { b.cy = b.floorY - b.h; b.vy = 0; }
      }
      if (overlaps(player.x, player.y, PW, PH, b.x, b.cy, b.w, b.h)) return die();
    }

    // door
    const d = level.door;
    if (d.flees) {
      d.cd -= dt;
      const near = Math.abs((player.x + PW / 2) - (d.x + d.w / 2)) < 80 && Math.abs((player.y) - d.y) < 120;
      if (near && d.cd <= 0 && d.stage < d.stops.length) {
        const s = d.stops[d.stage++]; d.x = s.x; d.y = s.y; d.cd = 0.5;
        if (d.stage >= d.stops.length) d.flees = false;
      }
    }
    if (!d.fake && !d.flees && overlaps(player.x, player.y, PW, PH, d.x, d.y, d.w, d.h)) { nextLevel(); return; }
    if (d.fake && overlaps(player.x, player.y, PW, PH, d.x, d.y, d.w, d.h)) return die();

    // fell off the world
    if (player.y > VH + 60) return die();
  }

  // ---- Rendering ----
  function rrect(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // backdrop
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#15161f'); g.addColorStop(1, '#0c0d13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    // platforms — fake/fall look identical to solid (that's the trick)
    for (const p of level.platforms) {
      if (p.type === 'rise' && !p.revealed) continue;
      if (!p.active && !p.falling) continue;
      const base = '#2b2f3e', edge = '#3a4054';
      rrect(p.x, p.y, p.w, p.h, 5, base);
      ctx.fillStyle = edge; ctx.fillRect(p.x, p.y, p.w, 3);
    }
    // blocks (falling ceilings)
    for (const b of level.blocks) {
      rrect(b.x, b.cy, b.w, b.h, 4, '#43485c');
      ctx.fillStyle = '#5a6076'; ctx.fillRect(b.x, b.cy + b.h - 4, b.w, 4);
    }
    // spikes
    ctx.fillStyle = '#FF4D4D';
    for (const s of level.spikes) {
      if (!s.revealed) continue;
      const n = Math.max(1, Math.round(s.w / 13));
      const sw = s.w / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(s.x + i * sw, s.y + s.h);
        ctx.lineTo(s.x + i * sw + sw / 2, s.y);
        ctx.lineTo(s.x + i * sw + sw, s.y + s.h);
        ctx.closePath(); ctx.fill();
      }
    }
    // door
    const d = level.door;
    rrect(d.x, d.y, d.w, d.h, 5, d.flees ? '#8a6bff' : '#34D399');
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(d.x + d.w - 9, d.y + d.h / 2, 3, 0, 7); ctx.fill();

    // player
    rrect(player.x, player.y, PW, PH, 5, '#7C6BFF');
    ctx.fillStyle = '#fff';
    const ex = player.dir > 0 ? player.x + PW - 9 : player.x + 4;
    ctx.fillRect(ex, player.y + 8, 4, 4); ctx.fillRect(ex + (player.dir > 0 ? -6 : 6), player.y + 8, 4, 4);

    // death flash
    if (flash > 0) { ctx.fillStyle = `rgba(255,60,60,${Math.min(.5, flash)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  // ---- loop ----
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.032, (t - last) / 1000 || 0); last = t;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }

  // ---- overlay ----
  function showOverlay(title, text, btn, cb) {
    ovTitle.textContent = title; ovText.textContent = text; ovBtn.textContent = btn;
    overlay.classList.remove('hidden');
    ovBtn.onclick = cb;
  }
  function hideOverlay() { overlay.classList.add('hidden'); }

  function resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function pause() { running = false; cancelAnimationFrame(raf); }

  let exitCb = () => {};
  function exit() { pause(); exitCb(); }

  // ---- public ----
  function start() {
    levelIndex = 0; deaths = 0; deathsEl.textContent = '0'; levelEl.textContent = '1';
    loadLevel(0); draw();
    showOverlay('Level Devil 😈', 'Erreiche die Tür. Klingt einfach. Ist es nicht — der Level betrügt.', 'Los', () => { hideOverlay(); resume(); });
  }
  function stop() { pause(); }

  function setup(opts) {
    canvas = opts.canvas; ctx = canvas.getContext('2d');
    scale = canvas.width / VW;
    levelEl = opts.levelEl; deathsEl = opts.deathsEl;
    overlay = opts.overlay; ovTitle = opts.ovTitle; ovText = opts.ovText; ovBtn = opts.ovBtn;
    touchWrap = opts.touchWrap; exitCb = opts.onExit || exitCb;

    // keyboard
    addEventListener('keydown', e => {
      if (!running && overlay.classList.contains('hidden') === false) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.left = true;
      else if (k === 'arrowright' || k === 'd') keys.right = true;
      else if (k === 'arrowup' || k === 'w' || k === ' ') { keys.jump = true; keys.jumpHeld = true; }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    });
    addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.left = false;
      else if (k === 'arrowright' || k === 'd') keys.right = false;
      else if (k === 'arrowup' || k === 'w' || k === ' ') keys.jumpHeld = false;
    });

    // touch
    if (matchMedia('(pointer:coarse)').matches) touchWrap.classList.add('on');
    const bind = (el, on, off) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
      el.addEventListener('pointerup', e => { e.preventDefault(); off(); });
      el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    };
    bind(opts.tcLeft, () => keys.left = true, () => keys.left = false);
    bind(opts.tcRight, () => keys.right = true, () => keys.right = false);
    bind(opts.tcJump, () => { keys.jump = true; keys.jumpHeld = true; }, () => keys.jumpHeld = false);
  }

  return { setup, start, stop };
})();
