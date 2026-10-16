/* =========================================================
   OBBY · animación de inicio
   Dos cubitos se encuentran en una pista de plataformas
   flotantes y avanzan juntos, una etapa por cada recuerdo.
   (Estilo propio: no usa ningún personaje ni logo de terceros.)
   ========================================================= */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  let current = null;
  function skip() { if (current) current.skip(); }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * opts: {
   *   canvas, stages, names:{me,her},
   *   sleep(ms), isSkipped(),
   *   card:{ show(i), showFinal(), hide() },
   *   onStage(i)
   * }
   */
  function play(opts) {
    return new Promise(resolve => {
      const cv = opts.canvas, ctx = cv.getContext('2d');
      const N = Math.max(1, opts.stages);
      let W = 0, H = 0, S = 1, dpr = 1, GROUND = 0;
      let running = true, skipFlag = false, time = 0, last = 0, raf = 0;
      let anims = [], particles = [], rings = [];
      let shake = 0, flashA = 0, flashCol = '255,255,255';

      function resize() {
        dpr = Math.min(global.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect();
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        S = Math.max(.8, Math.min(W / 330, H / 700));
        GROUND = H * .70;
      }
      resize();
      global.addEventListener('resize', resize);

      /* ---------- Mundo ---------- */
      const GAP = 258, PAD_W = 80, STEP_W = 44, LAVA_Y = -132;
      const pads = [], steps = [], all = [];
      for (let i = 0; i < N; i++) {
        const p = { kind: 'pad', i, cx: i * GAP, w: PAD_W, y: i * 14, flag: 0, glow: 0, press: 0 };
        pads.push(p); all.push(p);
      }
      const kinds = ['bar', 'tramp', 'kill', 'bar'];
      for (let i = 0; i < N - 1; i++) {
        const a = { kind: 'step', cx: i * GAP + 92, w: STEP_W, y: pads[i].y + 10, alt: 0, press: 0, glow: 0 };
        const b = { kind: 'step', cx: i * GAP + 166, w: STEP_W, y: pads[i].y + 12, alt: 1, press: 0, glow: 0 };
        const k = kinds[i % kinds.length];
        if (k === 'tramp') a.tramp = true;
        steps.push({ a, b, kind: k, x: i * GAP + 129, y: pads[i].y });
        all.push(a, b);
      }
      const L = { kind: 'step', cx: -92, w: STEP_W, y: 10, alt: 1, press: 0, glow: 0 };
      const P = pads[N - 1];
      const f1 = { kind: 'step', cx: P.cx + 92, w: STEP_W, y: P.y + 10, alt: 0, press: 0, glow: 0 };
      const f2 = { kind: 'step', cx: P.cx + 166, w: STEP_W, y: P.y + 14, alt: 1, press: 0, glow: 0 };
      const goal = { kind: 'goal', cx: P.cx + 258, w: PAD_W, y: P.y + 26, glow: 0, press: 0, open: 0 };
      all.push(L, f1, f2, goal);

      /* ---------- Fondo lejano ---------- */
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const far = Array.from({ length: 22 }, () => ({
        x: rnd() * (N * GAP + 900) - 450, y: rnd() * 380 - 60, s: 5 + rnd() * 17,
        r: rnd() * TAU, v: (rnd() - .5) * .8, a: .08 + rnd() * .16, blue: rnd() > .5
      }));

      /* ---------- Personajes ---------- */
      const A = { name: opts.names.me, c1: '#cfe9ff', c2: '#6fa8ff', dark: '#2b4f99', x: L.cx, y: L.y, sx: 1, sy: 1, k: 1, alpha: 0, run: 0, look: 1, blink: 1.5, say: '', sayT: 0, face: 0, bow: false };
      const B = { name: opts.names.her, c1: '#e6dcff', c2: '#9b82ff', dark: '#4a3aa0', x: steps[0] ? steps[0].a.cx : 92, y: steps[0] ? steps[0].a.y : 10, sx: 1, sy: 1, k: 1, alpha: 0, run: 0, look: -1, blink: 2.4, say: '', sayT: 0, face: 0, bow: true };
      const chars = [A, B];

      /* ---------- Cámara ---------- */
      const cam = { x: 0, y: 8 }, focus = { x: 0, y: 8 };

      /* ---------- Utilidades de animación ---------- */
      function anim(dur, fn) {
        if (skipFlag) { fn(1); return Promise.resolve(); }
        return new Promise(res => anims.push({ t: 0, dur, fn, res }));
      }
      const wait = s => opts.sleep(s * 1000);
      const say = (c, text, d) => { c.say = text; c.sayT = d || 1.4; };
      function burst(x, y, n, colors, speed, life, grav) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = (.35 + Math.random() * .65) * (speed || 120);
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + 20, life: life || .9, max: life || .9, s: 2 + Math.random() * 3.2, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * TAU, g: grav == null ? 260 : grav });
        }
      }
      const ring = (x, y, color, max) => rings.push({ x, y, r: 4, max: max || 62, life: .8, t: 0, c: color || '201,188,255' });
      const PAL = ['#c9bcff', '#a9d4ff', '#ffffff', '#9b82ff', '#bfe3ff'];

      /* ---------- Movimientos ---------- */
      async function hop(c, tx, ty, o) {
        o = o || {};
        const h = o.h == null ? 46 : o.h, dur = o.dur || .55, x0 = c.x, y0 = c.y;
        if (tx !== x0) c.look = tx > x0 ? 1 : -1;
        await anim(.1, t => { c.sy = 1 - .22 * t; c.sx = 1 + .16 * t; });
        await anim(dur, t => {
          const e = smooth(t), s = Math.sin(t * Math.PI);
          c.x = lerp(x0, tx, e);
          c.y = lerp(y0, ty, t) + 4 * h * t * (1 - t);
          c.sy = 1 + .2 * s; c.sx = 1 - .1 * s; c.run = t * 16;
        });
        c.x = tx; c.y = ty; c.run = 0;
        burst(tx, ty, 5, ['#cfc6f0', '#9a92c4'], 55, .5, 120);
        await anim(.18, t => { const b = easeOutBack(t); c.sy = .78 + .22 * b; c.sx = 1.18 - .18 * b; });
        c.sx = 1; c.sy = 1;
      }

      async function failHop(c, tx, ty) {
        const x0 = c.x, y0 = c.y; let splashed = false;
        c.look = tx > x0 ? 1 : -1;
        await anim(.1, t => { c.sy = 1 - .22 * t; c.sx = 1 + .16 * t; });
        c.face = 1;
        await anim(1.05, t => {
          const u = Math.min(1, t / .5);
          if (t <= .5) { c.x = lerp(x0, tx, smooth(u)); c.y = y0 + 4 * 46 * u * (1 - u) + lerp(0, ty - y0, u); }
          else { const f = (t - .5) / .5; c.x = tx + f * 10; c.y = ty - 330 * f * f; c.run = t * 20; }
          c.sy = 1.1; c.sx = .94;
          if (!splashed && c.y < LAVA_Y + 6) {
            splashed = true;
            burst(c.x, LAVA_Y + 6, 22, ['#ff5c7a', '#ff9e5e', '#ffd0b0'], 170, .9, 300);
            shake = 9; flashA = .28; flashCol = '255,70,110'; c.alpha = 0;
          }
        });
        c.alpha = 0; c.face = 0; c.run = 0; c.sx = c.sy = 1;
      }

      async function respawn(c, plat, offX) {
        c.x = plat.cx + (offX || 0); c.y = plat.y + 70; c.alpha = 0; c.look = 1; c.sx = c.sy = 1;
        ring(c.x, plat.y, '155,130,255', 44);
        const y1 = plat.y;
        await anim(.45, t => { c.alpha = t; c.y = lerp(y1 + 70, y1, smooth(t)); });
        c.y = y1; c.alpha = 1;
        await anim(.18, t => { const b = easeOutBack(t); c.sy = .78 + .22 * b; c.sx = 1.18 - .18 * b; });
        c.sx = c.sy = 1;
      }

      function arrive(p, i) {
        ring(p.cx, p.y, '201,188,255', 70);
        ring(p.cx, p.y, '169,212,255', 46);
        burst(p.cx, p.y + 20, 34, PAL, 190, 1.1, 240);
        p.glow = 1; shake = 3.5;
        anim(.9, t => { p.flag = smooth(t); });
        if (opts.onStage) opts.onStage(i);
      }

      const setFocus = (x, y) => { focus.x = x; focus.y = y; };

      /* ---------- Guion ---------- */
      async function director() {
        const pad0 = pads[0];
        setFocus(0, 6);
        await anim(.7, t => { A.alpha = B.alpha = t; });
        say(A, '¡hola!', 1.2); await wait(.9);
        say(B, '¡hola!', 1.2); await wait(1.0);

        // Ella llega primero
        setFocus(30, 6);
        await hop(B, pad0.cx + 16, pad0.y, { h: 54, dur: .6 });
        say(A, 'voy…', 1.1); await wait(.7);

        // Primer intento: se cae a la lava
        await failHop(A, -56, pad0.y);
        await wait(.5);
        say(B, '¡otra vez!', 1.4);
        await respawn(A, L, 0);
        await wait(.4);

        // Segundo intento: lo consigue
        await hop(A, pad0.cx - 16, pad0.y, { h: 60, dur: .62 });
        B.look = -1; A.look = 1;
        arrive(pad0, 0);
        say(A, '¡lo logré!', 1.3);
        await wait(.5);
        await opts.card.show(0);
        await opts.card.hide();

        // Etapas siguientes
        for (let i = 0; i < N - 1; i++) {
          const s = steps[i], to = pads[i + 1], from = pads[i];
          const legs = s.kind === 'tramp'
            ? [{ p: s.a, h: 44, off: 10, tramp: true }, { p: to, h: 128, off: 16, dur: .95, big: true }]
            : [{ p: s.a, h: 46, off: 10 }, { p: s.b, h: 54, off: 10 }, { p: to, h: 48, off: 16 }];
          for (const leg of legs) {
            setFocus((leg.p.cx + A.x) / 2, (leg.p.y + A.y) / 2);
            const o = { h: leg.h, dur: leg.dur || .52 };
            await Promise.all([
              hop(A, leg.p.cx - leg.off, leg.p.y, o),
              wait(.12).then(() => hop(B, leg.p.cx + leg.off, leg.p.y, o))
            ]);
            if (leg.tramp) { leg.p.press = 1; shake = 4; burst(leg.p.cx, leg.p.y + 4, 14, ['#ff9fc0', '#ffd0e4', '#fff'], 120, .6, 200); await wait(.12); }
            if (leg.p.kind === 'pad') setFocus(leg.p.cx, leg.p.y);
          }
          arrive(to, i + 1);
          await wait(.4);
          await opts.card.show(i + 1);
          await opts.card.hide();
        }

        // Final: portal
        setFocus(goal.cx - 60, goal.y);
        for (const leg of [{ p: f1, h: 46, off: 10 }, { p: f2, h: 52, off: 10 }, { p: goal, h: 50, off: 16 }]) {
          setFocus((leg.p.cx + A.x) / 2 + 20, (leg.p.y + A.y) / 2);
          const o = { h: leg.h, dur: .52 };
          await Promise.all([hop(A, leg.p.cx - leg.off, leg.p.y, o), wait(.12).then(() => hop(B, leg.p.cx + leg.off, leg.p.y, o))]);
        }
        setFocus(goal.cx, goal.y);
        ring(goal.cx, goal.y, '201,188,255', 80);
        const cardDone = opts.card.showFinal();
        await anim(1.2, t => { goal.open = smooth(t); });
        say(A, '¡vamos!', 1.2);
        await wait(.9);
        await cardDone;

        // Entran al portal (la tarjeta se va antes del destello)
        opts.card.hide();
        const px = goal.cx, py = goal.y + 34;
        const ax = A.x, ay = A.y, bx = B.x, by = B.y;
        await anim(1.0, t => {
          const e = smooth(t), s = Math.sin(t * Math.PI);
          A.x = lerp(ax, px, e); A.y = lerp(ay, py, e) + 30 * s; A.k = 1 - .75 * e; A.alpha = 1 - Math.max(0, (t - .6) / .4);
          B.x = lerp(bx, px, e); B.y = lerp(by, py, e) + 30 * s; B.k = 1 - .75 * e; B.alpha = A.alpha;
          A.run = B.run = t * 14;
        });
        A.alpha = B.alpha = 0;
        flashCol = '255,255,255';
        await anim(.7, t => { flashA = Math.min(1, t * 1.4); goal.glow = 1; });
      }

      /* ---------- Bucle ---------- */
      function update(dt) {
        time += dt;
        for (let i = anims.length - 1; i >= 0; i--) {
          const a = anims[i]; a.t += dt;
          const p = Math.min(1, a.t / a.dur); a.fn(p);
          if (p >= 1) { anims.splice(i, 1); a.res(); }
        }
        const k = Math.min(1, dt * 3.4);
        cam.x += (focus.x - cam.x) * k; cam.y += (focus.y - cam.y) * k;
        shake *= Math.pow(.02, dt); flashA = Math.max(0, flashA - dt * 1.8 * (flashCol === '255,255,255' && goal.open >= 1 ? 0 : 1));
        for (let i = particles.length - 1; i >= 0; i--) {
          const q = particles[i]; q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; }
          q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 6;
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i]; r.t += dt; if (r.t >= r.life) { rings.splice(i, 1); continue; }
          r.r = lerp(4, r.max, 1 - Math.pow(1 - r.t / r.life, 3));
        }
        for (const p of all) { p.glow = Math.max(0, (p.glow || 0) - dt * .9); p.press = Math.max(0, (p.press || 0) - dt * 2.6); }
        for (const c of chars) {
          c.blink -= dt; if (c.blink < -.12) c.blink = 1.6 + Math.random() * 2.4;
          if (c.sayT > 0) c.sayT -= dt;
        }
      }

      const X = x => (x - cam.x) * S + W / 2;
      const Y = y => GROUND - (y - cam.y) * S;

      function drawFar() {
        // moon
        const mx = W * .86 - cam.x * .03 * S, my = H * .105;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 70 * S);
        mg.addColorStop(0, 'rgba(210,196,255,.30)'); mg.addColorStop(.35, 'rgba(160,140,240,.14)'); mg.addColorStop(1, 'rgba(160,140,240,0)');
        ctx.fillStyle = mg; ctx.fillRect(mx - 80 * S, my - 80 * S, 160 * S, 160 * S);
        ctx.fillStyle = 'rgba(225,215,255,.2)'; ctx.beginPath(); ctx.arc(mx, my, 15 * S, 0, TAU); ctx.fill();
        // cubos lejanos
        const span = N * GAP + 900;
        for (const f of far) {
          let wx = f.x - cam.x * .35; wx = ((wx + 450) % span + span) % span - 450;
          const sx = wx * S + W / 2, sy = GROUND - (f.y - cam.y * .35) * S;
          const sz = f.s * S;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(f.r + time * f.v);
          ctx.globalAlpha = f.a; ctx.strokeStyle = f.blue ? '#a9d4ff' : '#c9bcff'; ctx.lineWidth = 1.2;
          ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
        }
        ctx.globalAlpha = 1;
        // bruma inferior
        const g = ctx.createLinearGradient(0, H * .5, 0, H);
        g.addColorStop(0, 'rgba(110,80,220,0)'); g.addColorStop(1, 'rgba(110,80,220,.16)');
        ctx.fillStyle = g; ctx.fillRect(0, H * .5, W, H * .5);
      }

      function drawLava() {
        const ly = Y(LAVA_Y);
        if (ly > H + 20) return;
        const g = ctx.createLinearGradient(0, ly - 40 * S, 0, H);
        g.addColorStop(0, 'rgba(255,80,120,0)'); g.addColorStop(.28, 'rgba(255,80,120,.30)');
        g.addColorStop(.3, '#ff5577'); g.addColorStop(.6, '#c4204a'); g.addColorStop(1, '#5c0f2c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H + 2); ctx.lineTo(0, ly);
        for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, ly + Math.sin(x * .035 + time * 2.2) * 3 * S + Math.sin(x * .09 - time * 3) * 1.5 * S);
        ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,190,170,.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let x = 0; x <= W + 8; x += 8) { const y = ly + Math.sin(x * .035 + time * 2.2) * 3 * S + Math.sin(x * .09 - time * 3) * 1.5 * S; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }

      function drawPlat(p) {
        const x = X(p.cx - p.w / 2), w = p.w * S, y = Y(p.y), th = 7 * S, fh = 15 * S;
        if (x > W + 40 || x + w < -40) return;
        const pal = p.kind === 'goal' ? ['#ffffff', '#7c68d8'] : p.kind === 'pad' ? ['#d6cbff', '#4d3ba8'] : (p.alt ? ['#b9ddff', '#2f5e9e'] : ['#c9bcff', '#43348f']);
        // brillo inferior
        const gl = ctx.createRadialGradient(x + w / 2, y + th + fh, 0, x + w / 2, y + th + fh, w * .9);
        gl.addColorStop(0, `rgba(${p.alt ? '120,180,255' : '150,120,255'},${.22 + p.glow * .4})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - w * .5, y, w * 2, fh * 4);
        const press = p.tramp ? 0 : (p.press || 0) * 3 * S;
        // frente
        ctx.fillStyle = pal[1]; rr(ctx, x, y + th * .5 + press, w, fh + th * .5, 4 * S); ctx.fill();
        // cara superior
        ctx.fillStyle = pal[0]; rr(ctx, x, y + press, w, th, 3 * S); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 3 * S, y + press + 1, w - 6 * S, 1.2);
        if (p.glow > .02) { ctx.strokeStyle = `rgba(255,255,255,${p.glow * .9})`; ctx.lineWidth = 2; rr(ctx, x - 1, y - 1 + press, w + 2, th + fh + 2, 4 * S); ctx.stroke(); }
        // trampolín
        if (p.tramp) {
          const cx = X(p.cx), pr = p.press || 0, ph = (7 - 3.5 * pr) * S;
          ctx.strokeStyle = '#ffd0e4'; ctx.lineWidth = 1.6 * S;
          ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(cx + k * 7 * S, y); ctx.lineTo(cx + k * 7 * S, y - ph * .5); }
          ctx.stroke();
          ctx.fillStyle = '#ff8fb8'; rr(ctx, cx - 18 * S, y - ph - 2 * S, 36 * S, 5 * S, 2.5 * S); ctx.fill();
        }
      }

      function drawPadExtras(p) {
        // poste de bandera + cartel
        const x = X(p.cx + 33), y = Y(p.y);
        ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40 * S); ctx.stroke();
        const fy = y - 6 * S - 28 * S * (p.flag || 0);
        ctx.fillStyle = '#a9d4ff'; ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x + 17 * S, fy + 5.5 * S); ctx.lineTo(x, fy + 11 * S); ctx.closePath(); ctx.fill();
        // cartel con el número
        const sx = X(p.cx - 33);
        ctx.fillStyle = 'rgba(8,6,16,.7)'; rr(ctx, sx - 8 * S, y - 22 * S, 16 * S, 14 * S, 3 * S); ctx.fill();
        ctx.strokeStyle = 'rgba(201,188,255,.7)'; ctx.lineWidth = 1; rr(ctx, sx - 8 * S, y - 22 * S, 16 * S, 14 * S, 3 * S); ctx.stroke();
        ctx.fillStyle = '#d6cbff'; ctx.font = `700 ${9 * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(p.i + 1), sx, y - 15 * S);
        ctx.strokeStyle = 'rgba(233,228,250,.6)'; ctx.beginPath(); ctx.moveTo(sx, y - 8 * S); ctx.lineTo(sx, y); ctx.stroke();
      }

      function drawDecor() {
        steps.forEach((s, i) => {
          const x = X(s.x);
          if (x < -80 || x > W + 80) return;
          if (s.kind === 'bar') {
            const top = Y(s.y + 22), base = Y(LAVA_Y);
            ctx.fillStyle = '#3a3358'; ctx.fillRect(x - 2.5 * S, top, 5 * S, base - top);
            const a = time * 2.6 + i, len = 40 * S, w = Math.abs(Math.cos(a)) * len;
            ctx.fillStyle = '#ff5c7a'; rr(ctx, x - w / 2, top - 3.5 * S, Math.max(w, 6 * S), 7 * S, 3.5 * S); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - w / 2 + 2, top - 2.5 * S, Math.max(w - 4, 2), 1.4);
            ctx.fillStyle = '#ffb3c2'; ctx.beginPath(); ctx.arc(x, top, 4 * S, 0, TAU); ctx.fill();
          } else if (s.kind === 'kill') {
            const y = Y(s.y + 3), w = 20 * S, h = 12 * S;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 30 * S); g.addColorStop(0, 'rgba(255,80,120,.35)'); g.addColorStop(1, 'rgba(255,80,120,0)');
            ctx.fillStyle = g; ctx.fillRect(x - 32 * S, y - 30 * S, 64 * S, 60 * S);
            ctx.fillStyle = '#a3153b'; rr(ctx, x - w / 2, y, w, h, 2 * S); ctx.fill();
            ctx.fillStyle = '#ff5c7a'; rr(ctx, x - w / 2, y - 2 * S, w, 6 * S, 2 * S); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.2;
            for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * 6 * S - 2 * S, y + 4 * S); ctx.lineTo(x + k * 6 * S + 2 * S, y + 11 * S); ctx.stroke(); }
          }
        });
      }

      function drawPortal() {
        const x = X(goal.cx), y = Y(goal.y), o = goal.open;
        if (o <= 0.01) return;
        const cy = y - 38 * S, rx = 22 * S * (.4 + .6 * o), ry = 36 * S * (.4 + .6 * o);
        const g = ctx.createRadialGradient(x, cy, 0, x, cy, 90 * S * o);
        g.addColorStop(0, `rgba(255,255,255,${.55 * o})`); g.addColorStop(.4, `rgba(185,166,255,${.28 * o})`); g.addColorStop(1, 'rgba(185,166,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 100 * S, cy - 100 * S, 200 * S, 200 * S);
        ctx.fillStyle = `rgba(20,12,50,${.85 * o})`; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill();
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = `rgba(${k % 2 ? '169,212,255' : '201,188,255'},${.8 * o})`; ctx.lineWidth = 1.6 * S;
          ctx.beginPath(); ctx.ellipse(x, cy, rx * (.35 + k * .18), ry * (.35 + k * .18), 0, time * (k % 2 ? 2 : -2.4) + k, time * (k % 2 ? 2 : -2.4) + k + 3.4); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(233,228,250,${o})`; ctx.lineWidth = 3.5 * S; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      }

      function drawChar(c) {
        if (c.alpha <= .01) return;
        const sx = X(c.x), sy = Y(c.y);
        ctx.save(); ctx.globalAlpha = c.alpha; ctx.translate(sx, sy);
        const idle = c.run === 0 ? 1 + Math.sin(time * 3 + (c === B ? 1.3 : 0)) * .015 : 1;
        ctx.scale(S * c.sx * c.k, S * c.sy * c.k * idle);
        const sw = Math.sin(c.run * 1.4) * 3.2;
        ctx.fillStyle = c.dark;
        rr(ctx, -8.5, -8 - Math.max(0, sw), 6, 8, 2); ctx.fill();
        rr(ctx, 2.5, -8 - Math.max(0, -sw), 6, 8, 2); ctx.fill();
        const g = ctx.createLinearGradient(0, -34, 0, -6); g.addColorStop(0, c.c1); g.addColorStop(1, c.c2);
        ctx.fillStyle = g; rr(ctx, -13, -34, 26, 27, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, -10, -31, 9, 3, 1.5); ctx.fill();
        if (c.bow) {
          ctx.fillStyle = '#fff'; ctx.beginPath();
          ctx.moveTo(6, -35); ctx.lineTo(1, -41); ctx.lineTo(1, -31); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -35); ctx.lineTo(11, -41); ctx.lineTo(11, -31); ctx.closePath(); ctx.fill();
          ctx.fillStyle = c.dark; ctx.beginPath(); ctx.arc(6, -35, 1.8, 0, TAU); ctx.fill();
        }
        const lk = c.look * 1.6, eh = c.blink < 0 ? .5 : 3.6;
        ctx.fillStyle = '#1a1033';
        ctx.beginPath(); ctx.ellipse(-5 + lk, -21, 2.6, eh, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5 + lk, -21, 2.6, eh, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
        if (c.face) ctx.ellipse(lk, -13, 2.4, 3, 0, 0, TAU); else ctx.arc(lk, -15, 3.6, .15 * Math.PI, .85 * Math.PI);
        ctx.stroke();
        ctx.restore();

        // etiqueta con el nombre
        const tx = sx, ty = sy - 52 * S * c.k;
        ctx.save(); ctx.globalAlpha = c.alpha;
        ctx.font = `700 ${11 * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(c.name).width + 14 * S;
        ctx.fillStyle = 'rgba(8,6,16,.62)'; rr(ctx, tx - tw / 2, ty - 9 * S, tw, 18 * S, 9 * S); ctx.fill();
        ctx.fillStyle = '#efeaff'; ctx.fillText(c.name, tx, ty + .5);
        if (c.sayT > 0 && c.say) {
          const p = Math.min(1, (1.4 - Math.min(c.sayT, 1.4)) * 8 + .2), a = Math.min(1, c.sayT * 3);
          ctx.globalAlpha = c.alpha * a; ctx.font = `700 ${12.5 * S}px "DM Sans",system-ui,sans-serif`;
          const bw = ctx.measureText(c.say).width + 18 * S, by = ty - 28 * S - (1 - Math.min(1, p)) * 6 * S;
          ctx.fillStyle = '#f3f0f9'; rr(ctx, tx - bw / 2, by - 11 * S, bw, 22 * S, 11 * S); ctx.fill();
          ctx.beginPath(); ctx.moveTo(tx - 4 * S, by + 10.5 * S); ctx.lineTo(tx + 4 * S, by + 10.5 * S); ctx.lineTo(tx, by + 16 * S); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#1b1530'; ctx.fillText(c.say, tx, by + .5);
        }
        ctx.restore();
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (shake > .2) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        drawFar();
        drawLava();
        for (const p of all) drawPlat(p);
        for (const p of pads) drawPadExtras(p);
        drawDecor();
        drawPortal();
        // partículas detrás / anillos en el suelo
        for (const r of rings) {
          const a = 1 - r.t / r.life; ctx.strokeStyle = `rgba(${r.c},${a * .9})`; ctx.lineWidth = 2 * S;
          ctx.beginPath(); ctx.ellipse(X(r.x), Y(r.y), r.r * S, r.r * S * .28, 0, 0, TAU); ctx.stroke();
        }
        chars.forEach(drawChar);
        for (const q of particles) {
          const a = Math.max(0, q.life / q.max); ctx.globalAlpha = a; ctx.fillStyle = q.c;
          ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(q.r); const s = q.s * S * (.5 + a * .5); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        if (flashA > .01) { ctx.fillStyle = `rgba(${flashCol},${Math.min(1, flashA)})`; ctx.fillRect(0, 0, W, H); }
      }

      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        update(dt); draw();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function finish() {
        if (!running) return;
        running = false; cancelAnimationFrame(raf);
        global.removeEventListener('resize', resize);
        current = null;
        resolve();
      }

      current = {
        skip() {
          skipFlag = true;
          const list = anims.slice(); anims = [];
          list.forEach(a => { a.fn(1); a.res(); });
        }
      };

      director().then(finish, finish);
    });
  }

  global.Obby = { play, skip };
})(window);
