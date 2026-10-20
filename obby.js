/* =========================================================
   LA HISTORIA EN ETAPAS · animación de inicio
   Dos cubitos recorren vuestra historia: cada etapa es un
   mundo distinto (obby, chat, construir, noche, lluvia,
   fiesta, hoguera) y al final entran en un portal.
   (Diseño propio: no usa personajes ni logos de terceros.)
   ========================================================= */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const PAL = ['#c9bcff', '#a9d4ff', '#ffffff', '#9b82ff', '#bfe3ff'];
  const PARTY = ['#c9bcff', '#a9d4ff', '#ffb3d1', '#ffe29a', '#b9f0d0', '#ffffff'];

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
   *   canvas, scenes:['obby','chat',...], names:{me,her},
   *   sleep(ms),
   *   card:{ show(i), showFinal(), hide() },
   *   onStage(i)
   * }
   */
  function play(opts) {
    return new Promise(resolve => {
      const cv = opts.canvas, mainCtx = cv.getContext('2d');
      let ctx = mainCtx;
      const names = (opts.scenes && opts.scenes.length) ? opts.scenes : ['obby'];
      const N = names.length;
      let W = 0, H = 0, S = 1, dpr = 1, GROUND = 0;
      let running = true, skipFlag = false, time = 0, last = 0, raf = 0;
      let anims = [], particles = [], rings = [];
      let shake = 0, flashA = 0, flashCol = '255,255,255', holdFlash = false;
      let iris = 0, cur = null;
      let trType = 'iris', trPhase = 'open', trLook = null;
      let Sb = 1, Z = 1, dprCap = 2, sceneT = 0, look = {}, camDX = 0, camDY = 0, quality = 1, slowT = 0, ft = .0167, acc = 0, glitchT = 0, glitchBands = [], deferOn = false;
      const later = [];
      let banner = null, callA = 0, callVol = 0, titleFx = null;
      const motes = Array.from({ length: 26 }, (_, k) => ({ x: -200 + (k * 61) % 400, y: -20 + (k * 37) % 280, v: 4 + (k % 4) * 2, r: .8 + (k % 3) * .5, ph: k * 1.3 }));
      const cam = { x: 0, y: 0 };

      function resize() {
        dpr = Math.min(global.devicePixelRatio || 1, dprCap);
        const r = cv.getBoundingClientRect();
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      // La escena se coloca por debajo de la tarjeta de texto: baja el suelo y, si hace falta, reduce la escala.
      let topY = 140, cardBot = 380, cardTop = 84, cardPos = 'top';
      function layout() {
        const S0 = Math.max(.8, Math.min(W / 330, H / 700));
        let g = H * .70, sc = S0;
        if (cardPos === 'bottom') {
          g = Math.min(H * .86, cardTop - 46); sc = Math.min(S0, Math.max(.55, (g - 92) / topY));
        } else {
          const need = cardBot + 14 + topY * sc;
          if (need > g) g = Math.min(H * .80, need);
          if (need > g) sc = Math.max(.55, (g - cardBot - 14) / topY);
        }
        Sb = sc; S = sc * Z; GROUND = g;
      }
      resize();
      global.addEventListener('resize', resize);

      const X = x => W / 2 + (x - cam.x) * S + camDX;
      const Y = y => GROUND - (y - cam.y) * S + camDY;

      /* ---------- Utilidades ---------- */
      function anim(dur, fn) {
        if (skipFlag) { fn(1); return Promise.resolve(); }
        return new Promise(res => anims.push({ t: 0, dur, fn, res }));
      }
      const wait = s => opts.sleep(s * 1000 * (opts.pace || 1));
      const say = (c, text, d) => { c.say = text; c.sayT = d || 1.4; };
      function burst(x, y, n, colors, speed, life, grav) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = (.35 + Math.random() * .65) * (speed || 120);
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + 20, life: life || .9, max: life || .9, s: 2 + Math.random() * 3.2, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * TAU, g: grav == null ? 260 : grav });
        }
      }
      const ring = (x, y, color, max) => rings.push({ x, y, r: 4, max: max || 62, life: .8, t: 0, c: color || '201,188,255' });
      const decay = (list, dt) => list.forEach(p => { p.glow = Math.max(0, (p.glow || 0) - dt * .9); p.press = Math.max(0, (p.press || 0) - dt * 2.6); });

      /* ---------- Personajes ---------- */
      const A = { name: opts.names.me, c1: '#cfe9ff', c2: '#6fa8ff', dark: '#2b4f99', x: 0, y: 0, sx: 1, sy: 1, k: 1, alpha: 0, run: 0, look: 1, blink: 1.5, say: '', sayT: 0, face: 0, bow: false, sit: false };
      const B = { name: opts.names.her, c1: '#e6dcff', c2: '#9b82ff', dark: '#4a3aa0', x: 0, y: 0, sx: 1, sy: 1, k: 1, alpha: 0, run: 0, look: -1, blink: 2.4, say: '', sayT: 0, face: 0, bow: true, sit: false };
      const chars = [A, B];
      const mkFriend = (c1, c2, dark, look) => ({ name: '', c1, c2, dark, x: 0, y: 0, sx: 1, sy: 1, k: 1, alpha: 0, run: 0, look, blink: 1 + Math.random() * 2, say: '', sayT: 0, face: 0, bow: false, sit: false });
      const reset = (c, x, y, look) => { c.x = x; c.y = y; c.gy = y; c.sx = c.sy = c.k = 1; c.alpha = 0; c.run = 0; c.look = look; c.say = ''; c.sayT = 0; c.face = 0; c.sit = false; c.sad = false; c.hideTag = false; };
      const fadeIn = (d) => anim(d || .6, t => { A.alpha = B.alpha = t; });
      const pulse = (c, amt) => anim(.22, t => { const s = Math.sin(t * Math.PI); c.sy = 1 + (amt || .14) * s; c.sx = 1 - (amt || .14) * .6 * s; });

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
        c.x = tx; c.y = ty; c.gy = ty; c.run = 0;
        burst(tx, ty, 5, ['#cfc6f0', '#9a92c4'], 55, .5, 120);
        await anim(.18, t => { const b = easeOutBack(t); c.sy = .78 + .22 * b; c.sx = 1.18 - .18 * b; });
        c.sx = 1; c.sy = 1;
      }
      const hopBoth = (tx1, tx2, ty, o) => Promise.all([hop(A, tx1, ty, o), wait(.12).then(() => hop(B, tx2, ty, o))]);

      /* ---------- Dibujo común ---------- */
      function plat(p) {
        const x = X(p.cx - p.w / 2), w = p.w * S, y = Y(p.y), th = 7 * S, fh = 15 * S;
        if (x > W + 60 || x + w < -60) return;
        const pal = p.top ? [p.top, p.front] : p.kind === 'goal' ? ['#ffffff', '#7c68d8'] : p.kind === 'pad' ? ['#d6cbff', '#4d3ba8'] : (p.alt ? ['#b9ddff', '#2f5e9e'] : ['#c9bcff', '#43348f']);
        const gl = ctx.createRadialGradient(x + w / 2, y + th + fh, 0, x + w / 2, y + th + fh, Math.min(w, 260 * S) * .9);
        gl.addColorStop(0, `rgba(${p.alt ? '120,180,255' : '150,120,255'},${.22 + (p.glow || 0) * .4})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - w * .5, y, w * 2, fh * 4);
        const press = p.tramp ? 0 : (p.press || 0) * 3 * S;
        ctx.fillStyle = pal[1]; rr(ctx, x, y + th * .5 + press, w, fh + th * .5, 4 * S); ctx.fill();
        ctx.fillStyle = pal[0]; rr(ctx, x, y + press, w, th, 3 * S); ctx.fill();
        ctx.strokeStyle = 'rgba(14,8,40,.55)'; ctx.lineWidth = 1.3; rr(ctx, x, y + press, w, th + fh, 4 * S); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 3 * S, y + press + 1, w - 6 * S, 1.2);
        if ((p.glow || 0) > .02) { ctx.strokeStyle = `rgba(255,255,255,${p.glow * .9})`; ctx.lineWidth = 2; rr(ctx, x - 1, y - 1 + press, w + 2, th + fh + 2, 4 * S); ctx.stroke(); }
      }

      const farCubes = (() => {
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        return Array.from({ length: 22 }, () => ({ x: rnd() * 900 - 450, y: rnd() * 380 - 60, s: 5 + rnd() * 17, r: rnd() * TAU, v: (rnd() - .5) * .8, a: .08 + rnd() * .16, blue: rnd() > .5 }));
      })();
      function drawFarCubes(par) {
        for (const f of farCubes) {
          let wx = f.x - cam.x * (par || .35); wx = ((wx + 450) % 900 + 900) % 900 - 450;
          const sx = wx * S + W / 2, sy = GROUND - (f.y - cam.y * (par || .35)) * S, sz = f.s * S;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(f.r + time * f.v);
          ctx.globalAlpha = f.a; ctx.strokeStyle = f.blue ? '#a9d4ff' : '#c9bcff'; ctx.lineWidth = 1.2;
          ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      function haze(col, a) {
        const g = ctx.createLinearGradient(0, H * .45, 0, H);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`);
        ctx.fillStyle = g; ctx.fillRect(0, H * .45, W, H * .55);
      }
      function sparkle(x, y, r, a, col) {
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = col || '#fff';
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .12, -r * .12, r, 0); ctx.quadraticCurveTo(r * .12, r * .12, 0, r);
        ctx.quadraticCurveTo(-r * .12, r * .12, -r, 0); ctx.quadraticCurveTo(-r * .12, -r * .12, 0, -r); ctx.fill(); ctx.restore();
      }
      function pill(text, x, y, bg, fg, size, a) {
        const go = () => {
          ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
          ctx.font = `700 ${size * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const w = ctx.measureText(text).width + size * 1.5 * S, h = size * 1.9 * S;
          ctx.fillStyle = bg; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
          ctx.fillStyle = fg; ctx.fillText(text, x, y + .5); ctx.restore();
        };
        if (deferOn) later.push(go); else go();
      }


      function drawBanner(cx, cy) {
        if (!banner) return;
        const sc = 1 + .5 * (1 - easeOutBack(Math.min(1, banner.t * 4))), al = banner.t > .3 ? clamp((.45 - banner.t) / .15, 0, 1) : 1;
        ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.scale(sc, sc);
        ctx.font = `800 ${46 * S}px "Bricolage Grotesque","DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6 * S; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,30,150,.8)'; ctx.strokeText(banner.text, 0, 0);
        ctx.fillStyle = banner.text === '¡YA!' ? '#ffe29a' : '#ffffff'; ctx.fillText(banner.text, 0, 0); ctx.restore();
      }
      function drawCall(apex) {
        if (callA <= .01) return;
        const a = callA, p0 = [X(A.x), Y(A.y + 46)], p2 = [X(B.x), Y(B.y + 46)], p1 = [X((A.x + B.x) / 2), Y(A.y + 2 * apex - 46)];
        ctx.save(); ctx.globalAlpha = a;
        ctx.setLineDash([5 * S, 6 * S]); ctx.lineDashOffset = -time * 22; ctx.strokeStyle = 'rgba(169,212,255,.65)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke(); ctx.setLineDash([]);
        for (let k = 0; k < 2; k++) {
          const u = ((time * .5 + k * .5) % 1), t2 = k ? 1 - u : u;
          const bx = (1 - t2) * (1 - t2) * p0[0] + 2 * (1 - t2) * t2 * p1[0] + t2 * t2 * p2[0], by = (1 - t2) * (1 - t2) * p0[1] + 2 * (1 - t2) * t2 * p1[1] + t2 * t2 * p2[1];
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, 9 * S); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(169,212,255,0)');
          ctx.fillStyle = g; ctx.fillRect(bx - 9 * S, by - 9 * S, 18 * S, 18 * S);
        }
        const cx = (p0[0] + p2[0]) / 2, cy = Y(A.y + apex + 8);
        for (let k = -3; k <= 3; k++) {
          const h = (4 + 14 * callVol * Math.abs(Math.sin(time * 7 + k * .9))) * S;
          ctx.fillStyle = k % 2 ? 'rgba(201,188,255,.9)' : 'rgba(169,212,255,.9)';
          rr(ctx, cx + k * 6 * S - 1.6 * S, cy - 20 * S - h / 2, 3.2 * S, h, 1.6 * S); ctx.fill();
        }
        ctx.restore();
        pill('en llamada', cx, cy, 'rgba(8,6,16,.72)', '#efeaff', 11, a);
      }

      function drawChar(c) {
        if (c.alpha <= .01) return;
        const sx = X(c.x), sy = Y(c.y);
        // sombra en el suelo (más pequeña cuanto más alto salta)
        { const gy = c.gy == null ? c.y : c.gy, sh = clamp(1 - Math.max(0, c.y - gy) / 140, .25, 1);
          ctx.save(); ctx.globalAlpha = c.alpha * .4 * sh; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(X(c.x), Y(gy) + 1, 13 * S * c.k * sh, 3 * S * sh, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.save(); ctx.globalAlpha = c.alpha; ctx.translate(sx, sy);
        const idle = c.run === 0 ? 1 + Math.sin(time * 3 + (c === B ? 1.3 : 0)) * .015 : 1;
        ctx.scale(S * c.sx * c.k, S * c.sy * c.k * idle * (c.sit ? .9 : 1));
        const sw = Math.sin(c.run * 1.4) * 3.2;
        if (!c.sit) {
          ctx.fillStyle = c.dark;
          rr(ctx, -8.5, -8 - Math.max(0, sw), 6, 8, 2); ctx.fill();
          rr(ctx, 2.5, -8 - Math.max(0, -sw), 6, 8, 2); ctx.fill();
        } else { ctx.translate(0, 6); }
        const g = ctx.createLinearGradient(0, -34, 0, -6); g.addColorStop(0, c.c1); g.addColorStop(1, c.c2);
        ctx.fillStyle = g; rr(ctx, -13, -34, 26, 27, 7); ctx.fill();
        if (look.style === 'cel') { ctx.strokeStyle = look.rim || 'rgba(12,8,36,.92)'; ctx.lineWidth = 2.2; if (look.rim) { ctx.shadowColor = look.rim; ctx.shadowBlur = 6; } }
        else if (look.style === 'neon') { ctx.strokeStyle = rgba(look.accent, .95); ctx.lineWidth = 1.8; ctx.shadowColor = look.accent; ctx.shadowBlur = 10; }
        else { ctx.strokeStyle = 'rgba(20,10,50,.5)'; ctx.lineWidth = 1.5; }
        rr(ctx, -13, -34, 26, 27, 7); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, -10, -31, 9, 3, 1.5); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,30,.10)'; rr(ctx, -13, -14, 26, 7, 6); ctx.fill();
        if (c.bow && !['hardhat', 'cowboy', 'beanie'].includes(look.hat)) {
          ctx.fillStyle = '#fff'; ctx.beginPath();
          ctx.moveTo(6, -35); ctx.lineTo(1, -41); ctx.lineTo(1, -31); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -35); ctx.lineTo(11, -41); ctx.lineTo(11, -31); ctx.closePath(); ctx.fill();
          ctx.fillStyle = c.dark; ctx.beginPath(); ctx.arc(6, -35, 1.8, 0, TAU); ctx.fill();
        }
        const lk = c.look * 1.6, eh = c.blink < 0 ? .5 : 3.6;
        ctx.fillStyle = '#1a1033';
        ctx.beginPath(); ctx.ellipse(-5 + lk, -21, 2.6, eh, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5 + lk, -21, 2.6, eh, 0, 0, TAU); ctx.fill();
        if (c.blink >= 0) { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (const ex of [-5, 5]) { ctx.beginPath(); ctx.arc(ex + lk - .9, -22.8, .95, 0, TAU); ctx.fill(); } }
        ctx.fillStyle = 'rgba(255,120,170,.28)'; for (const ex of [-8.6, 8.6]) { ctx.beginPath(); ctx.ellipse(ex + lk * .4, -15.2, 2.6, 1.5, 0, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
        if (c.face) ctx.ellipse(lk, -13, 2.4, 3, 0, 0, TAU);
        else if (c.sad) ctx.arc(lk, -10.5, 3.4, 1.18 * Math.PI, 1.82 * Math.PI);
        else ctx.arc(lk, -15, 3.6, .15 * Math.PI, .85 * Math.PI);
        ctx.stroke();
        // accesorio propio del universo
        { const h = look.hat, d = c.look >= 0 ? 1 : -1;
          if (h === 'hardhat') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -33, 12.8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillRect(-15.5, -34.4, 31, 3.8); ctx.fillStyle = '#e0a800'; ctx.fillRect(-1.6, -45.8, 3.2, 12); ctx.strokeStyle = 'rgba(40,24,0,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -33, 12.8, Math.PI, 0); ctx.stroke(); }
          else if (h === 'phones') { ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -22, 15, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke(); ctx.fillStyle = '#7df3ff'; rr(ctx, -18.5, -28, 6, 12, 2.4); ctx.fill(); rr(ctx, 12.5, -28, 6, 12, 2.4); ctx.fill(); ctx.fillStyle = '#ff7ad9'; ctx.fillRect(-17, -24, 3, 3); ctx.fillRect(14, -24, 3, 3); }
          else if (h === 'scarf') { ctx.fillStyle = '#ff7aa9'; rr(ctx, -13.5, -13.5, 27, 5.5, 2.4); ctx.fill(); ctx.fillStyle = '#e0568a'; rr(ctx, 5, -9, 5.5, 11, 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-10, -12.4, 20, 1.2); }
          else if (h === 'cowboy') { ctx.fillStyle = '#6b4a2f'; ctx.beginPath(); ctx.ellipse(0, -33.5, 21, 3.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a5636'; ctx.beginPath(); ctx.moveTo(-9.5, -34); ctx.lineTo(-7.5, -46); ctx.quadraticCurveTo(0, -43, 7.5, -46); ctx.lineTo(9.5, -34); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.fillRect(-9.2, -38.6, 18.4, 3.2); ctx.strokeStyle = 'rgba(20,10,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -33.5, 21, 3.8, 0, 0, TAU); ctx.stroke(); }
          else if (h === 'beanie') { ctx.fillStyle = '#6f8fb8'; ctx.beginPath(); ctx.arc(0, -33, 13.2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4f6f98'; ctx.fillRect(-14, -36.5, 28, 5.2); ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let q = -9; q <= 9; q += 6) ctx.fillRect(q, -36.5, 1.6, 5.2); ctx.fillStyle = '#f3f7ff'; ctx.beginPath(); ctx.arc(0, -47.6, 4.2, 0, TAU); ctx.fill(); }
          else if (h === 'torch') { ctx.fillStyle = '#33363d'; rr(ctx, d > 0 ? 9 : -19, -17.5, 10, 4.6, 1.5); ctx.fill(); ctx.fillStyle = '#ffd35c'; ctx.fillRect(d > 0 ? 18.4 : -20, -17, 1.6, 3.6); const g = ctx.createLinearGradient(d * 19, 0, d * 78, 0); g.addColorStop(0, 'rgba(255,245,200,.55)'); g.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(d * 19, -16); ctx.lineTo(d * 78, -34); ctx.lineTo(d * 78, 6); ctx.closePath(); ctx.fill(); }
          else if (h === 'star') { const gl = ctx.createRadialGradient(0, -46, 0, 0, -46, 16); gl.addColorStop(0, 'rgba(255,240,190,.75)'); gl.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = gl; ctx.fillRect(-16, -62, 32, 32); star5(0, -46 + Math.sin(time * 3) * 1.2, 5.2, '#ffe9a0', 1); }
        }
        ctx.restore();

        const overlay = () => {
        const tx = sx, ty = sy - 52 * S * c.k;
        ctx.save(); ctx.globalAlpha = c.alpha;
        ctx.font = `700 ${11 * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (c.name && !c.hideTag) {
          const tw = ctx.measureText(c.name).width + 14 * S;
          ctx.fillStyle = 'rgba(8,6,16,.62)'; rr(ctx, tx - tw / 2, ty - 9 * S, tw, 18 * S, 9 * S); ctx.fill();
          ctx.fillStyle = '#efeaff'; ctx.fillText(c.name, tx, ty + .5);
        }
        if (c.sayT > 0 && c.say) {
          const p = Math.min(1, (1.4 - Math.min(c.sayT, 1.4)) * 8 + .2), a = Math.min(1, c.sayT * 3);
          ctx.globalAlpha = c.alpha * a; ctx.font = `700 ${12.5 * S}px "DM Sans",system-ui,sans-serif`;
          const bw = ctx.measureText(c.say).width + 18 * S, by = ty - 28 * S - (1 - Math.min(1, p)) * 6 * S;
          const bx = clamp(tx, bw / 2 + 8, W - bw / 2 - 8);   // el globo nunca se sale de la pantalla
          const tl = clamp(tx, bx - bw / 2 + 12 * S, bx + bw / 2 - 12 * S);
          ctx.fillStyle = '#f3f0f9'; rr(ctx, bx - bw / 2, by - 11 * S, bw, 22 * S, 11 * S); ctx.fill();
          ctx.beginPath(); ctx.moveTo(tl - 4 * S, by + 10.5 * S); ctx.lineTo(tl + 4 * S, by + 10.5 * S); ctx.lineTo(tx, by + 16 * S); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#1b1530'; ctx.fillText(c.say, bx, by + .5);
        }
        ctx.restore();
        };
        if (deferOn) later.push(overlay); else overlay();
      }

      /* =====================================================
         ESCENAS (una por etapa)
         Cada escena: enter() · update(dt) · bg() · mid() · fg() · run(i)
         ===================================================== */

      /* ---------- 3 · CARRERA (retos y revanchas) ---------- */
      function raceScene() {
        const LAVA = -132;
        const L = { kind: 'step', cx: -92, w: 44, y: 10, alt: 1 };
        const pad = { kind: 'pad', cx: 0, w: 80, y: 0, flag: 0, glow: 0, i: 0 };
        const s1 = { kind: 'step', cx: 92, w: 44, y: 10, alt: 0 };
        const s2 = { kind: 'step', cx: 166, w: 44, y: 12, alt: 1 };
        const plats = [L, pad, s1, s2];
        const arrive = () => {
          ring(pad.cx, pad.y, '201,188,255', 70); ring(pad.cx, pad.y, '169,212,255', 46);
          burst(pad.cx, pad.y + 20, 34, PAL, 190, 1.1, 240);
          pad.glow = 1; shake = 3.5;
          anim(.9, t => { pad.flag = smooth(t); });
        };
        return {
          enter() { cam.x = 36; cam.y = 6; reset(A, L.cx, L.y, 1); reset(B, s1.cx, s1.y, -1); },
          update(dt) { decay(plats, dt); },
          bg() {
            const mx = W * .86, my = H * .105;
            const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 70 * S);
            mg.addColorStop(0, 'rgba(210,196,255,.30)'); mg.addColorStop(.35, 'rgba(160,140,240,.14)'); mg.addColorStop(1, 'rgba(160,140,240,0)');
            ctx.fillStyle = mg; ctx.fillRect(mx - 80 * S, my - 80 * S, 160 * S, 160 * S);
            ctx.fillStyle = 'rgba(225,215,255,.2)'; ctx.beginPath(); ctx.arc(mx, my, 15 * S, 0, TAU); ctx.fill();
            drawFarCubes(.35); haze('110,80,220', .16);
            const ly = Y(LAVA);
            const g = ctx.createLinearGradient(0, ly - 40 * S, 0, H);
            g.addColorStop(0, 'rgba(255,80,120,0)'); g.addColorStop(.3, '#ff5577'); g.addColorStop(.6, '#c4204a'); g.addColorStop(1, '#5c0f2c');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H + 2); ctx.lineTo(0, ly);
            for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, ly + Math.sin(x * .035 + time * 2.2) * 3 * S + Math.sin(x * .09 - time * 3) * 1.5 * S);
            ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,190,170,.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
            for (let x = 0; x <= W + 8; x += 8) { const y = ly + Math.sin(x * .035 + time * 2.2) * 3 * S + Math.sin(x * .09 - time * 3) * 1.5 * S; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.stroke();
          },
          mid() {
            plats.forEach(plat);
            const x = X(129), top = Y(22), base = Y(LAVA);
            ctx.fillStyle = '#3a3358'; ctx.fillRect(x - 2.5 * S, top, 5 * S, base - top);
            const a = time * 2.6, len = 40 * S, w = Math.abs(Math.cos(a)) * len;
            ctx.fillStyle = '#ff5c7a'; rr(ctx, x - w / 2, top - 3.5 * S, Math.max(w, 6 * S), 7 * S, 3.5 * S); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - w / 2 + 2, top - 2.5 * S, Math.max(w - 4, 2), 1.4);
            ctx.fillStyle = '#ffb3c2'; ctx.beginPath(); ctx.arc(x, top, 4 * S, 0, TAU); ctx.fill();
            const fx = X(pad.cx + 33), y = Y(pad.y);
            ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, y - 40 * S); ctx.stroke();
            const fy = y - 6 * S - 28 * S * (pad.flag || 0);
            ctx.fillStyle = '#a9d4ff'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 17 * S, fy + 5.5 * S); ctx.lineTo(fx, fy + 11 * S); ctx.closePath(); ctx.fill();
            const sx = X(pad.cx - 33);
            ctx.fillStyle = 'rgba(8,6,16,.7)'; rr(ctx, sx - 11 * S, y - 22 * S, 22 * S, 14 * S, 3 * S); ctx.fill();
            ctx.strokeStyle = 'rgba(201,188,255,.7)'; ctx.lineWidth = 1; rr(ctx, sx - 11 * S, y - 22 * S, 22 * S, 14 * S, 3 * S); ctx.stroke();
            ctx.fillStyle = '#d6cbff'; ctx.font = `700 ${8 * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('META', sx, y - 15 * S);
            ctx.strokeStyle = 'rgba(233,228,250,.6)'; ctx.beginPath(); ctx.moveTo(sx, y - 8 * S); ctx.lineTo(sx, y); ctx.stroke();
          },
          fg() { drawBanner(X(36), Y(112)); },
          async run(i) {
            await anim(.7, t => { A.alpha = B.alpha = t; });
            say(B, '¿otra carrera?', 1.5); await wait(1.0);
            say(A, '¡dale!', 1.2); await wait(.8);
            for (const w of ['3', '2', '1', '¡YA!']) { banner = { text: w, t: 0 }; await wait(.45); }
            banner = null;
            await Promise.all([hop(A, pad.cx - 20, pad.y, { h: 60, dur: .64 }), hop(B, pad.cx + 20, pad.y, { h: 56, dur: .58 })]);
            B.look = -1; A.look = 1;
            arrive();
            say(B, '¡gané!', 1.1);
            await wait(1.2); say(A, '¡revancha!', 1.4);
            await wait(1.0);
            await opts.card.show(i);
            await opts.card.hide();
          }
        };
      }

      /* ---------- 2 · CHAT (las primeras conversaciones) ---------- */
      function chatScene() {
        const IA = { kind: 'step', cx: -84, w: 76, y: 0, alt: 1 }, IB = { kind: 'step', cx: 84, w: 76, y: 0, alt: 0 };
        const msgs = []; let typing = null, vol = 0, tt = 0;
        const bubbles = Array.from({ length: 6 }, (_, k) => ({ x: -180 + k * 70 + (k % 2) * 20, y: 40 + k * 55, r: 14 + (k * 7) % 22, v: 8 + (k * 5) % 9 }));
        return {
          enter() { cam.x = 0; cam.y = 0; reset(A, IA.cx, 0, 1); reset(B, IB.cx, 0, -1); },
          update(dt) {
            tt += dt; vol = lerp(vol, typing ? .9 : (msgs.some(m => m.age < .6) ? 1 : .15), Math.min(1, dt * 6));
            msgs.forEach(m => { m.age += dt; });
            while (msgs.length && msgs[0].age > 3) msgs.shift();
            bubbles.forEach(b => { b.y += b.v * dt; if (b.y > 300) b.y = -30; });
          },
          bg() {
            for (let gx = -210; gx <= 210; gx += 28) for (let gy = -60; gy <= 330; gy += 28) {
              const o = ((gy / 28) % 2) * 14;
              ctx.fillStyle = 'rgba(169,212,255,.09)'; ctx.fillRect(X(gx + o), Y(gy + (time * 6 % 28)), 2 * S, 2 * S);
            }
            ctx.strokeStyle = 'rgba(201,188,255,.10)'; ctx.lineWidth = 1.2;
            bubbles.forEach(b => { ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), b.r * S, 0, TAU); ctx.stroke(); });
            haze('90,110,230', .12);
          },
          mid() {
            plat(IA); plat(IB);
            // línea de conexión (llamada) con un paquete que viaja
            const p0 = [X(IA.cx), Y(46)], p1 = [X(0), Y(116)], p2 = [X(IB.cx), Y(46)];
            ctx.save(); ctx.setLineDash([5 * S, 6 * S]); ctx.lineDashOffset = -time * 22; ctx.strokeStyle = 'rgba(169,212,255,.55)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke(); ctx.restore();
            for (let k = 0; k < 2; k++) {
              const u = ((time * .45 + k * .5) % 1), a = k ? 1 - u : u;
              const bx = (1 - a) * (1 - a) * p0[0] + 2 * (1 - a) * a * p1[0] + a * a * p2[0], by = (1 - a) * (1 - a) * p0[1] + 2 * (1 - a) * a * p1[1] + a * a * p2[1];
              const g = ctx.createRadialGradient(bx, by, 0, bx, by, 9 * S); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(169,212,255,0)');
              ctx.fillStyle = g; ctx.fillRect(bx - 9 * S, by - 9 * S, 18 * S, 18 * S);
            }
            // ecualizador de voz
            for (let k = -4; k <= 4; k++) {
              const h = (5 + 22 * vol * Math.abs(Math.sin(time * 6 + k * .9))) * S;
              ctx.fillStyle = k % 2 ? 'rgba(201,188,255,.85)' : 'rgba(169,212,255,.85)';
              rr(ctx, X(k * 8) - 2 * S, Y(70) - h / 2, 4 * S, h, 2 * S); ctx.fill();
            }
          },
          fg() {
            msgs.forEach(m => {
              const u = clamp(m.age / 2.6, 0, 1), a = Math.min(1, m.age * 6) * (m.age > 2.4 ? clamp((3 - m.age) / .6, 0, 1) : 1);
              const x = m.who === 'A' ? -52 : 52, y = lerp(60, 132, smooth(u));
              pill(m.text, X(x), Y(y), m.who === 'A' ? '#bfe3ff' : '#e6dcff', '#1b1530', 12, a);
            });
            if (typing) {
              const x = typing === 'A' ? -58 : 58, y = 62;
              pill('   ', X(x), Y(y), typing === 'A' ? 'rgba(191,227,255,.9)' : 'rgba(230,220,255,.9)', '#1b1530', 12, 1);
              for (let k = -1; k <= 1; k++) { ctx.fillStyle = '#4a3aa0'; ctx.beginPath(); ctx.arc(X(x + k * 7), Y(y) + Math.sin(time * 9 + k) * 2.4 * S, 1.9 * S, 0, TAU); ctx.fill(); }
            }
          },
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            const lines = [['A', '¿una partida?'], ['B', '¡dale!'], ['A', 'jajaja'], ['B', 'otra más'], ['A', 'la última…'], ['B', 'mentira']];
            for (const [who, text] of lines) {
              typing = who; await wait(.62); typing = null;
              msgs.push({ who, text, age: 0 });
              const c = who === 'A' ? A : B; pulse(c, .16); burst(c.x, 36, 5, PAL, 70, .6, 60);
              await wait(.5);
            }
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 3 · CONSTRUIR (crear juntos) ---------- */
      function buildScene() {
        const BS = 26, base = { kind: 'step', cx: 0, w: 330, y: 0, alt: 1, top: '#8f82d8', front: '#2f2766' };
        const blocks = []; const cols = ['#c9bcff', '#a9d4ff', '#9b82ff', '#d6cbff'];
        for (let r = 0; r < 4; r++) { const n = 4 - r; for (let c = 0; c < n; c++) blocks.push({ tx: (c - (n - 1) / 2) * BS, ty: r * BS + BS / 2, col: cols[r], st: 0, x: 0, y: 0, rot: 0, sq: 0 }); }
        const flag = { v: 0 };
        return {
          enter() { cam.x = 0; cam.y = 0; reset(A, -112, 0, 1); reset(B, 112, 0, -1); },
          update(dt) { blocks.forEach(b => { b.sq = Math.max(0, b.sq - dt * 3); }); },
          bg() {
            ctx.strokeStyle = 'rgba(169,212,255,.07)'; ctx.lineWidth = 1;
            for (let gx = -200; gx <= 200; gx += 26) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke(); }
            for (let gy = -80; gy <= 340; gy += 26) { ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(W, Y(gy)); ctx.stroke(); }
            haze('80,100,230', .14);
          },
          mid() {
            plat(base);
            // sombra de proyección de la pirámide
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(X(0), Y(0) + 3 * S, 62 * S, 5 * S, 0, 0, TAU); ctx.fill();
            blocks.forEach(b => {
              if (!b.st) return;
              const cx = X(b.x), cy = Y(b.y), s = (BS - 2) * S;
              ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.st === 1 ? b.rot : 0);
              const sy = 1 - .22 * b.sq, sx = 1 + .16 * b.sq; ctx.scale(sx, sy);
              ctx.fillStyle = b.col; rr(ctx, -s / 2, -s / 2, s, s, 4 * S); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, -s / 2 + 3 * S, -s / 2 + 3 * S, s - 6 * S, 4 * S, 2 * S); ctx.fill();
              ctx.strokeStyle = 'rgba(30,20,80,.45)'; ctx.lineWidth = 1.2; rr(ctx, -s / 2, -s / 2, s, s, 4 * S); ctx.stroke();
              ctx.restore();
            });
            // bandera de la cima (aparece al colocar el último bloque)
            if (blocks[blocks.length - 1].st !== 2) return;
            const fx = X(0), fy0 = Y(4 * BS);
            ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(fx, fy0); ctx.lineTo(fx, fy0 - 44 * S); ctx.stroke();
            const fy = fy0 - 6 * S - 30 * S * flag.v;
            ctx.fillStyle = '#ffb3d1'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 18 * S, fy + 6 * S); ctx.lineTo(fx, fy + 12 * S); ctx.closePath(); ctx.fill();
          },
          fg() {},
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            say(A, '¡a construir!', 1.2); await wait(.5);
            const flights = [];
            for (let k = 0; k < blocks.length; k++) {
              const b = blocks[k], c = k % 2 ? B : A;
              pulse(c, .2);
              const x0 = c.x, y0 = 38, x1 = b.tx, y1 = b.ty;
              b.st = 1; b.x = x0; b.y = y0;
              flights.push(anim(.5, t => { b.x = lerp(x0, x1, smooth(t)); b.y = lerp(y0, y1, t) + 4 * 46 * t * (1 - t); b.rot = t * 6 * (c === A ? 1 : -1); })
                .then(() => { b.st = 2; b.x = x1; b.y = y1; b.sq = 1; burst(b.x, b.y - BS / 2, 5, ['#d9d2ff', '#a9d4ff'], 50, .45, 90); shake = Math.max(shake, 1.6); }));
              await wait(.26);
            }
            await Promise.all(flights);
            await wait(.2);
            anim(.8, t => { flag.v = smooth(t); });
            burst(0, 4 * BS + 10, 40, PARTY, 200, 1.2, 240); ring(0, 4 * BS, '255,179,209', 60);
            say(A, '¡listo!', 1.3); say(B, '¡genial!', 1.5);
            hop(A, A.x, 0, { h: 40, dur: .45 }); await wait(.2); hop(B, B.x, 0, { h: 40, dur: .45 });
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 4 · NOCHE (hablar hasta la madrugada) ---------- */
      function nightScene() {
        const isle = { kind: 'step', cx: 0, w: 150, y: 0, alt: 1 };
        const N_ST = 15, stars = Array.from({ length: N_ST }, (_, k) => { const th = Math.PI - k / (N_ST - 1) * Math.PI; return { x: 108 * Math.cos(th), y: 28 + 98 * Math.sin(th), t0: 1.1 + k * .2, tw: Math.random() * TAU }; });
        let tt = 0, shoot = -1;
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; shoot = -1; reset(A, -20, 0, 1); reset(B, 20, 0, 1); },
          update(dt) { tt += dt; if (shoot >= 0) shoot += dt; },
          bg() {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, 'rgba(40,30,110,.45)'); g.addColorStop(1, 'rgba(15,10,50,.10)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            drawFarCubes(.1);
            // luna creciente baja
            const mx = X(128), my = Y(52), r = 30 * S;
            const mg = ctx.createRadialGradient(mx, my, r * .5, mx, my, r * 3); mg.addColorStop(0, 'rgba(210,196,255,.35)'); mg.addColorStop(1, 'rgba(210,196,255,0)');
            ctx.fillStyle = mg; ctx.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
            ctx.save(); ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.clip();
            ctx.beginPath(); ctx.rect(mx - r * 2, my - r * 2, r * 4, r * 4); ctx.arc(mx + r * .5, my - r * .12, r * .86, 0, TAU); ctx.clip('evenodd');
            ctx.fillStyle = '#e9e2ff'; ctx.fillRect(mx - r * 2, my - r * 2, r * 4, r * 4); ctx.restore();
            // estrellas pequeñas fijas
            for (let k = 0; k < 26; k++) { const sx = ((k * 83) % 330) - 165, sy = 40 + ((k * 57) % 210); sparkle(X(sx), Y(sy), (1.4 + (k % 3)) * S, .25 + .4 * Math.abs(Math.sin(time * 1.5 + k)), '#cfe0ff'); }
            haze('90,70,200', .14);
          },
          mid() {
            plat(isle);
            // arco de estrellas que se une sobre los dos
            let prev = null;
            stars.forEach((s, k) => {
              const a = clamp((tt - s.t0) / .35, 0, 1); if (a <= 0) return;
              const sx = X(s.x), sy = Y(s.y);
              if (prev) { ctx.strokeStyle = `rgba(190,210,255,${.55 * a})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(lerp(prev[0], sx, a), lerp(prev[1], sy, a)); ctx.stroke(); }
              const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14 * S); gl.addColorStop(0, `rgba(210,225,255,${.5 * a})`); gl.addColorStop(1, 'rgba(210,225,255,0)');
              ctx.fillStyle = gl; ctx.fillRect(sx - 14 * S, sy - 14 * S, 28 * S, 28 * S);
              sparkle(sx, sy, (4 + 2.2 * Math.sin(time * 3 + s.tw)) * S * a, a, '#fff');
              prev = [sx, sy];
            });
          },
          fg() {
            if (shoot >= 0 && shoot < 1) {
              const u = shoot, hx = lerp(160, -150, u), hy = lerp(190, 60, u);
              const g = ctx.createLinearGradient(X(hx), Y(hy), X(hx + 70), Y(hy + 28));
              g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.strokeStyle = g; ctx.lineWidth = 2.4 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(hx), Y(hy)); ctx.lineTo(X(hx + 70), Y(hy + 28)); ctx.stroke();
              sparkle(X(hx), Y(hy), 5 * S, 1, '#fff');
            }
          },
          async run(i) {
            await fadeIn(.8);
            const card = opts.card.show(i);
            A.look = 1; B.look = -1;
            await wait(1.6); say(A, 'mira las estrellas', 1.6);
            await wait(2.7); shoot = 0; say(B, '¡pide un deseo!', 1.6);
            await wait(1.4); ring(0, 126, '210,225,255', 70); burst(0, 126, 22, ['#ffffff', '#cfe0ff', '#c9bcff'], 120, 1.1, 40);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 5 · LLUVIA (cuando más lo necesité) ---------- */
      function rainScene() {
        const slab = { kind: 'step', cx: 0, w: 330, y: 0, alt: 1, top: '#6f67a8', front: '#25204f' };
        let drops = [], ripples = [], tt = 0, raining = true, um = 1, sunA = 0, rainbowA = 0, cloudX = 0, cloudA = 1, bolt = 0, boltX = 0, nextBolt = 1.4;
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -18, 0, 1); reset(B, 18, 0, 1); },
          update(dt) {
            tt += dt;
            if (raining) for (let k = 0; k < 3; k++) drops.push({ x: -200 + Math.random() * 400, y: 190 + Math.random() * 60, v: 360 + Math.random() * 120, l: 10 + Math.random() * 8 });
            for (let i = drops.length - 1; i >= 0; i--) {
              const d = drops[i]; d.y -= d.v * dt; d.x -= 50 * dt;
              const sf = 62 + 40 * (1 - Math.pow(d.x / (56 * Math.max(um, .1)), 2));
              if (um > .3 && Math.abs(d.x) < 56 * um && d.y <= sf && d.y > 44) { burst(d.x, sf, 2, ['#cfe6ff', '#ffffff'], 40, .35, 200); drops.splice(i, 1); continue; }
              if (d.y <= 0) { ripples.push({ x: d.x, t: 0 }); drops.splice(i, 1); }
            }
            for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > .6) ripples.splice(i, 1); }
            nextBolt -= dt; if (raining && nextBolt <= 0) { nextBolt = 2 + Math.random() * 1.2; bolt = .14; boltX = -60 + Math.random() * 120; flashCol = '200,190,255'; flashA = .22; shake = Math.max(shake, 2); }
            if (bolt > 0) bolt -= dt;
          },
          bg() {
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(30,30,55,${.55 * (1 - sunA * .8)})`); g.addColorStop(1, 'rgba(15,15,30,.12)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            // arcoíris
            if (rainbowA > .01) {
              const cols = ['#ffb3c7', '#ffd6a5', '#fdffb6', '#caffbf', '#a9d4ff', '#c9bcff'];
              cols.forEach((c, k) => { ctx.strokeStyle = c; ctx.globalAlpha = rainbowA * .8; ctx.lineWidth = 7 * S; ctx.beginPath(); ctx.arc(X(0), Y(-24), (156 - k * 7) * S, Math.PI, TAU); ctx.stroke(); });
              ctx.globalAlpha = 1;
            }
            // sol
            if (sunA > .01) {
              const sx = X(118), sy = Y(150), r = 15 * S;
              const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5); sg.addColorStop(0, `rgba(255,236,170,${.5 * sunA})`); sg.addColorStop(1, 'rgba(255,236,170,0)');
              ctx.fillStyle = sg; ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
              ctx.strokeStyle = `rgba(255,236,170,${.7 * sunA})`; ctx.lineWidth = 2 * S;
              for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + time * .3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 1.5, sy + Math.sin(a) * r * 1.5); ctx.lineTo(sx + Math.cos(a) * r * 2.3, sy + Math.sin(a) * r * 2.3); ctx.stroke(); }
              ctx.fillStyle = `rgba(255,240,190,${sunA})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
            }
            // nube
            if (cloudA > .01) {
              const cx = X(cloudX), cy = Y(176);
              ctx.globalAlpha = cloudA;
              [[-46, 4, 26], [-18, -8, 32], [16, -6, 34], [46, 6, 26], [0, 10, 36]].forEach(([dx, dy, r]) => { ctx.fillStyle = '#2b2745'; ctx.beginPath(); ctx.arc(cx + dx * S, cy + dy * S, r * S, 0, TAU); ctx.fill(); });
              ctx.fillStyle = 'rgba(90,80,150,.45)'; ctx.beginPath(); ctx.arc(cx - 10 * S, cy - 12 * S, 22 * S, 0, TAU); ctx.fill();
              ctx.globalAlpha = 1;
            }
          },
          mid() {
            plat(slab);
            // charcos
            ripples.forEach(r => { const a = 1 - r.t / .6; ctx.strokeStyle = `rgba(200,225,255,${a * .7})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(X(r.x), Y(0) + 1, (3 + r.t * 14) * S, (1 + r.t * 4) * S, 0, 0, TAU); ctx.stroke(); });
            // paraguas
            if (um > .02) {
              const px = X(0), py = Y(62), w = 58 * S * um, h = 34 * S;
              ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(X(B.x - 2), Y(36)); ctx.stroke();
              ctx.fillStyle = '#b9a6ff'; ctx.beginPath(); ctx.moveTo(px - w, py);
              ctx.quadraticCurveTo(px - w * .9, py - h * 1.5, px, py - h * 1.3); ctx.quadraticCurveTo(px + w * .9, py - h * 1.5, px + w, py);
              for (let k = 0; k < 4; k++) { const a = px + w - (k + 1) * w / 2; ctx.quadraticCurveTo(a + w / 4, py + 8 * S, a, py); }
              ctx.closePath(); ctx.fill();
              ctx.strokeStyle = 'rgba(60,40,140,.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
              [-.5, 0, .5].forEach(f => { ctx.moveTo(px, py - h * 1.3); ctx.lineTo(px + w * f * 1.7, py); }); ctx.stroke();
              ctx.fillStyle = '#e6dcff'; ctx.beginPath(); ctx.arc(px, py - h * 1.3, 2.4 * S, 0, TAU); ctx.fill();
            }
          },
          fg() {
            // gotas
            ctx.strokeStyle = 'rgba(190,215,255,.75)'; ctx.lineWidth = 1.3 * S; ctx.lineCap = 'round'; ctx.beginPath();
            drops.forEach(d => { ctx.moveTo(X(d.x), Y(d.y)); ctx.lineTo(X(d.x + d.l * .12), Y(d.y + d.l)); }); ctx.stroke();
            // relámpago
            if (bolt > 0) {
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * S; ctx.lineJoin = 'round'; ctx.beginPath();
              let bx = boltX, by = 168; ctx.moveTo(X(bx), Y(by));
              for (let k = 0; k < 6; k++) { bx += (k % 2 ? 1 : -1) * (10 + k * 2); by -= 28; ctx.lineTo(X(bx), Y(Math.max(by, 0))); }
              ctx.stroke();
            }
          },
          async run(i) {
            await fadeIn(.7);
            const card = opts.card.show(i);
            B.look = -1; A.look = 1;
            await wait(1.4); say(B, 'tranqui, estoy aquí', 1.8);
            await wait(2.0); say(A, 'gracias…', 1.4);
            await wait(1.1);
            // escampa
            raining = false;
            anim(1.6, t => { cloudX = -260 * smooth(t); cloudA = 1 - smooth(t); });
            await wait(.8);
            anim(1.4, t => { sunA = smooth(t); });
            anim(1.8, t => { rainbowA = smooth(t); });
            await wait(.6);
            await anim(.6, t => { um = 1 - smooth(t); });
            ring(0, 0, '255,236,170', 80); burst(0, 40, 26, ['#fff6c9', '#ffd6a5', '#fdffb6', '#ffffff'], 130, 1.2, 60);
            say(A, '¡sale el sol!', 1.5);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 6 · FIESTA (celebrar juntos) ---------- */
      function partyScene() {
        const slab = { kind: 'step', cx: 0, w: 330, y: 0, alt: 0, top: '#cbbfff', front: '#40338c' };
        const balloons = Array.from({ length: 8 }, (_, k) => ({ x: -140 + k * 40 + (k % 2) * 8, y: -30 - (k % 3) * 24, v: 20 + (k * 7) % 14, c: PARTY[k % 5], ph: k })), conf = [];
        let tt = 0, lid = 0, opened = false;
        const shoot = (side) => { for (let k = 0; k < 40; k++) { const a = (side < 0 ? 1.15 : Math.PI - 1.15) + (Math.random() - .5) * .5, v = 230 + Math.random() * 170; conf.push({ x: side * 150, y: 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: PARTY[(Math.random() * PARTY.length) | 0], r: Math.random() * TAU, vr: (Math.random() - .5) * 12, life: 3 }); } };
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; lid = 0; opened = false; reset(A, -56, 0, 1); reset(B, 56, 0, -1); },
          update(dt) {
            tt += dt;
            balloons.forEach(b => { b.y += b.v * dt; if (b.y > 190) { b.y = -40; } });
            for (let i = conf.length - 1; i >= 0; i--) { const c = conf[i]; c.life -= dt; if (c.life <= 0) { conf.splice(i, 1); continue; } c.vy -= 250 * dt; c.vx *= (1 - .6 * dt); c.vy *= (1 - .5 * dt); c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
          },
          bg() {
            // focos
            [[-1, 0], [1, 1]].forEach(([s, k]) => {
              const sw = Math.sin(time * 1.3 + k * 2) * 40, topx = X(s * 120), tx = X(sw * s);
              const g = ctx.createLinearGradient(0, 0, 0, Y(0)); g.addColorStop(0, 'rgba(220,210,255,.20)'); g.addColorStop(1, 'rgba(220,210,255,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(topx - 6 * S, 0); ctx.lineTo(topx + 6 * S, 0); ctx.lineTo(tx + 80 * S, Y(0)); ctx.lineTo(tx - 80 * S, Y(0)); ctx.closePath(); ctx.fill();
            });
            haze('150,110,240', .16);
          },
          mid() {
            // guirnalda
            ctx.strokeStyle = 'rgba(233,228,250,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(-190), Y(150));
            ctx.quadraticCurveTo(X(0), Y(50), X(190), Y(150)); ctx.stroke();
            for (let k = 0; k < 13; k++) { const u = k / 12, bx = lerp(-190, 190, u), yy = 150 - 100 * u * (1 - u) * 2; ctx.fillStyle = PARTY[k % PARTY.length]; ctx.beginPath(); ctx.moveTo(X(bx - 7), Y(yy)); ctx.lineTo(X(bx + 7), Y(yy)); ctx.lineTo(X(bx), Y(yy - 16)); ctx.closePath(); ctx.fill(); }
            plat(slab);
            // globos
            balloons.forEach(b => {
              const bx = b.x + Math.sin(time * 1.4 + b.ph) * 6, a = clamp(1 - (b.y - 110) / 60, 0, 1) * clamp((b.y + 40) / 30, 0, 1);
              if (a <= 0) return;
              ctx.globalAlpha = a * .9; ctx.strokeStyle = 'rgba(233,228,250,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(bx), Y(b.y - 18)); ctx.quadraticCurveTo(X(bx + 6), Y(b.y - 34), X(bx), Y(b.y - 48)); ctx.stroke();
              ctx.fillStyle = b.c; ctx.beginPath(); ctx.ellipse(X(bx), Y(b.y), 11 * S, 14 * S, 0, 0, TAU); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(X(bx) - 3.5 * S, Y(b.y) - 5 * S, 2.4 * S, 4 * S, -.5, 0, TAU); ctx.fill();
              ctx.globalAlpha = 1;
            });
            // regalo
            const gx = X(0), gy = Y(0), s = 30 * S;
            ctx.fillStyle = '#9b82ff'; rr(ctx, gx - s / 2, gy - s, s, s, 3 * S); ctx.fill();
            ctx.fillStyle = '#ffe29a'; ctx.fillRect(gx - 3 * S, gy - s, 6 * S, s);
            ctx.save(); ctx.translate(gx, gy - s); ctx.translate(0, -lid * 34 * S); ctx.rotate(-lid * .7);
            ctx.fillStyle = '#b9a6ff'; rr(ctx, -s / 2 - 2 * S, -9 * S, s + 4 * S, 9 * S, 3 * S); ctx.fill();
            ctx.fillStyle = '#ffe29a'; ctx.fillRect(-3 * S, -9 * S, 6 * S, 9 * S);
            ctx.beginPath(); ctx.ellipse(-6 * S, -12 * S, 6 * S, 4 * S, -.4, 0, TAU); ctx.ellipse(6 * S, -12 * S, 6 * S, 4 * S, .4, 0, TAU); ctx.fill();
            ctx.restore();
          },
          fg() {
            conf.forEach(c => { ctx.save(); ctx.translate(X(c.x), Y(c.y)); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.globalAlpha = Math.min(1, c.life); ctx.fillRect(-3 * S, -1.6 * S, 6 * S, 3.2 * S); ctx.restore(); });
            ctx.globalAlpha = 1;
          },
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            shoot(-1); shoot(1);
            await wait(.7);
            hop(A, A.x, 0, { h: 34, dur: .42 }); await wait(.22); hop(B, B.x, 0, { h: 34, dur: .42 });
            await wait(.9); say(A, '¡un regalo!', 1.3);
            await wait(.8);
            opened = true; await anim(.35, t => { lid = smooth(t); });
            burst(0, 32, 60, PARTY, 230, 1.4, 220); ring(0, 30, '255,226,154', 70); shake = 4; shoot(-1); shoot(1);
            say(B, '¡sorpresa!', 1.6);
            hop(A, A.x, 0, { h: 44, dur: .5 }); hop(B, B.x, 0, { h: 44, dur: .5 });
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 7 · HOGUERA (hoy: seguimos aquí) ---------- */
      function campScene() {
        const slab = { kind: 'step', cx: 0, w: 330, y: 0, alt: 1, top: '#4e4482', front: '#1c1740' };
        const embers = [], flies = Array.from({ length: 14 }, (_, k) => ({ x: -150 + (k * 47) % 300, y: 20 + (k * 29) % 110, ph: k * 1.7, sp: .5 + (k % 4) * .2 }));
        let tt = 0, spawn = 0;
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -16, 0, 1); reset(B, 24, 0, 1); A.sit = B.sit = true; },
          update(dt) {
            tt += dt; spawn -= dt;
            if (spawn <= 0) { spawn = .07; embers.push({ x: 66 + (Math.random() - .5) * 14, y: 14, vx: (Math.random() - .5) * 16, vy: 30 + Math.random() * 40, life: 1.6, s: 1.2 + Math.random() * 1.6 }); }
            for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.life -= dt; if (e.life <= 0) { embers.splice(i, 1); continue; } e.x += e.vx * dt + Math.sin(tt * 4 + i) * .3; e.y += e.vy * dt; }
          },
          bg() {
            const gx = X(66), gy = Y(26), fl = 1 + Math.sin(time * 14) * .04 + Math.sin(time * 23) * .03;
            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 190 * S * fl);
            g.addColorStop(0, 'rgba(255,150,80,.38)'); g.addColorStop(.35, 'rgba(255,110,90,.14)'); g.addColorStop(1, 'rgba(255,110,90,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            drawFarCubes(.2);
            flies.forEach(f => { const fx = X(f.x + Math.sin(time * f.sp + f.ph) * 14), fy = Y(f.y + Math.cos(time * f.sp * 1.3 + f.ph) * 10), a = .3 + .7 * Math.abs(Math.sin(time * 2 + f.ph)); const gg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 6 * S); gg.addColorStop(0, `rgba(235,255,170,${a})`); gg.addColorStop(1, 'rgba(235,255,170,0)'); ctx.fillStyle = gg; ctx.fillRect(fx - 6 * S, fy - 6 * S, 12 * S, 12 * S); });
          },
          mid() {
            plat(slab);
            // tienda
            const tx = X(-112), ty = Y(0), w = 64 * S, h = 52 * S;
            ctx.fillStyle = '#5a49b8'; ctx.beginPath(); ctx.moveTo(tx - w / 2, ty); ctx.lineTo(tx, ty - h); ctx.lineTo(tx + w / 2, ty); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#7a67d8'; ctx.beginPath(); ctx.moveTo(tx, ty - h); ctx.lineTo(tx + w / 2, ty); ctx.lineTo(tx + w * .1, ty); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#1a1235'; ctx.beginPath(); ctx.moveTo(tx - w * .12, ty); ctx.lineTo(tx, ty - h * .55); ctx.lineTo(tx + w * .12, ty); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.moveTo(tx, ty - h); ctx.lineTo(tx, ty - h - 8 * S); ctx.stroke();
            ctx.fillStyle = '#a9d4ff'; ctx.beginPath(); ctx.moveTo(tx, ty - h - 8 * S); ctx.lineTo(tx + 9 * S, ty - h - 5 * S); ctx.lineTo(tx, ty - h - 2 * S); ctx.closePath(); ctx.fill();
            // fogata
            const fx = X(66), fy = Y(0);
            ctx.fillStyle = '#6b4636'; ctx.save(); ctx.translate(fx, fy - 3 * S); ctx.rotate(.35); rr(ctx, -16 * S, -3 * S, 32 * S, 6 * S, 3 * S); ctx.fill(); ctx.rotate(-.7); rr(ctx, -16 * S, -3 * S, 32 * S, 6 * S, 3 * S); ctx.fill(); ctx.restore();
            [['#ff9a5c', 1, 26], ['#ffd166', .72, 20], ['#fff3c4', .42, 13]].forEach(([c, k, hh], n) => {
              const fl = 1 + Math.sin(time * (11 + n * 4) + n) * .12, w2 = 11 * k * S, h2 = hh * fl * S;
              ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(fx - w2, fy - 4 * S);
              ctx.quadraticCurveTo(fx - w2 * 1.1, fy - h2 * .6, fx + Math.sin(time * 9 + n) * 2 * S, fy - h2);
              ctx.quadraticCurveTo(fx + w2 * 1.1, fy - h2 * .6, fx + w2, fy - 4 * S); ctx.closePath(); ctx.fill();
            });
          },
          fg() {
            embers.forEach(e => { const a = clamp(e.life / 1.6, 0, 1); ctx.fillStyle = `rgba(255,${(150 + 80 * a) | 0},90,${a})`; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), e.s * S, 0, TAU); ctx.fill(); });
          },
          async run(i) {
            await fadeIn(.9);
            const card = opts.card.show(i);
            await wait(1.8); say(A, 'qué bien se está aquí', 2); 
            await wait(2.3); say(B, 'siempre contigo', 1.8);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- META · portal ---------- */
      function portalScene() {
        const p0 = { kind: 'pad', cx: -128, w: 66, y: 0, flag: 1, i: 0 }, f1 = { kind: 'step', cx: -52, w: 44, y: 10, alt: 0 }, f2 = { kind: 'step', cx: 22, w: 44, y: 14, alt: 1 };
        const goal = { kind: 'goal', cx: 112, w: 80, y: 26, glow: 0, open: 0 };
        const plats = [p0, f1, f2, goal];
        return {
          enter() { cam.x = 0; cam.y = 12; reset(A, p0.cx - 12, p0.y, 1); reset(B, p0.cx + 12, p0.y, 1); },
          update(dt) { decay(plats, dt); },
          bg() {
            skyGrad([[0, '#04031a'], [.6, '#1a0b4d'], [1, '#3a1a7a']]);
            glow(X(goal.cx), Y(goal.y + 40), 260 * S, '#a08cff', .25 * goal.open + .06);
            starsField(110, '#ffffff', .7);
            aurora(.45 + .4 * goal.open);
          },
          mid() {
            plats.forEach(plat);
            const x = X(goal.cx), y = Y(goal.y), o = goal.open;
            if (o > .01) {
              const cy = y - 38 * S, rx = 22 * S * (.4 + .6 * o), ry = 36 * S * (.4 + .6 * o);
              const g = ctx.createRadialGradient(x, cy, 0, x, cy, 90 * S * o);
              g.addColorStop(0, `rgba(255,255,255,${.55 * o})`); g.addColorStop(.4, `rgba(185,166,255,${.28 * o})`); g.addColorStop(1, 'rgba(185,166,255,0)');
              ctx.fillStyle = g; ctx.fillRect(x - 100 * S, cy - 100 * S, 200 * S, 200 * S);
              ctx.fillStyle = `rgba(20,12,50,${.85 * o})`; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill();
              for (let k = 0; k < 4; k++) { ctx.strokeStyle = `rgba(${k % 2 ? '169,212,255' : '201,188,255'},${.8 * o})`; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.ellipse(x, cy, rx * (.35 + k * .18), ry * (.35 + k * .18), 0, time * (k % 2 ? 2 : -2.4) + k, time * (k % 2 ? 2 : -2.4) + k + 3.4); ctx.stroke(); }
              ctx.strokeStyle = `rgba(233,228,250,${o})`; ctx.lineWidth = 3.5 * S; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.stroke();
            }
          },
          fg() {},
          async run() {
            await fadeIn(.6);
            await hopBoth(f1.cx - 10, f1.cx + 10, f1.y, { h: 46 });
            await hopBoth(f2.cx - 10, f2.cx + 10, f2.y, { h: 52 });
            await hopBoth(goal.cx - 20, goal.cx + 20, goal.y, { h: 50 });
            ring(goal.cx, goal.y, '201,188,255', 80);
            const cardDone = opts.card.showFinal();
            await anim(1.2, t => { goal.open = smooth(t); });
            say(A, '¡vamos!', 1.2);
            await wait(.9);
            await cardDone;
            opts.card.hide();
            const px = goal.cx, py = goal.y + 34, ax = A.x, ay = A.y, bx = B.x, by = B.y;
            await anim(1.0, t => {
              const e = smooth(t), s = Math.sin(t * Math.PI);
              A.x = lerp(ax, px, e); A.y = lerp(ay, py, e) + 30 * s; A.k = 1 - .75 * e; A.alpha = 1 - Math.max(0, (t - .6) / .4);
              B.x = lerp(bx, px, e); B.y = lerp(by, py, e) + 30 * s; B.k = 1 - .75 * e; B.alpha = A.alpha;
              A.run = B.run = t * 14;
            });
            A.alpha = B.alpha = 0;
            flashCol = '255,255,255'; holdFlash = true;
            await anim(.7, t => { flashA = Math.min(1, t * 1.4); goal.glow = 1; });
          }
        };
      }

      /* ---------- Dibujo para las escenas nuevas ---------- */
      function heartPath(cx, cy, s) {
        ctx.beginPath(); ctx.moveTo(cx, cy + s * .9);
        ctx.bezierCurveTo(cx - s * 1.3, cy - s * .1, cx - s * .7, cy - s * 1.0, cx, cy - s * .35);
        ctx.bezierCurveTo(cx + s * .7, cy - s * 1.0, cx + s * 1.3, cy - s * .1, cx, cy + s * .9);
        ctx.closePath();
      }
      function star5(cx, cy, r, col, a) {
        ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col; ctx.beginPath();
        for (let k = 0; k < 10; k++) { const q = k % 2 ? r * .45 : r, an = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(cx + Math.cos(an) * q, cy + Math.sin(an) * q); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
      function coin(x, y, r, a) {
        ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
        ctx.fillStyle = '#d99a1f'; dot(x, y, r); ctx.fillStyle = '#ffd35c'; dot(x - r * .08, y - r * .08, r * .86);
        ctx.strokeStyle = '#d99a1f'; ctx.lineWidth = Math.max(1, r * .16); ctx.beginPath(); ctx.arc(x, y, r * .55, 0, TAU); ctx.stroke(); ctx.restore();
      }
      function drawIcon(kind, x, y, r, rot, a) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const u = r / 10;
        if (kind === 'gamepad') {
          ctx.fillStyle = '#c9bcff'; rr(ctx, -11 * u, -6 * u, 22 * u, 12 * u, 5 * u); ctx.fill();
          ctx.fillStyle = '#6f5cc4'; ctx.fillRect(-7.5 * u, -1 * u, 5 * u, 1.8 * u); ctx.fillRect(-5.9 * u, -2.6 * u, 1.8 * u, 5 * u);
          ctx.fillStyle = '#ffe29a'; dot(5 * u, -1.8 * u, 1.7 * u); ctx.fillStyle = '#a9d4ff'; dot(8.2 * u, 1.2 * u, 1.7 * u);
        } else if (kind === 'dice') {
          ctx.fillStyle = '#f3f0f9'; rr(ctx, -8 * u, -8 * u, 16 * u, 16 * u, 3.5 * u); ctx.fill();
          ctx.fillStyle = '#4a3aa0'; [[-4, -4], [4, -4], [0, 0], [-4, 4], [4, 4]].forEach(([px, py]) => dot(px * u, py * u, 1.5 * u));
        } else if (kind === 'sword') {
          ctx.strokeStyle = '#d6ecff'; ctx.lineWidth = 3.2 * u; ctx.beginPath(); ctx.moveTo(-5 * u, 6 * u); ctx.lineTo(9 * u, -8 * u); ctx.stroke();
          ctx.strokeStyle = '#ffe29a'; ctx.lineWidth = 2.6 * u; ctx.beginPath(); ctx.moveTo(-7 * u, 1 * u); ctx.lineTo(-1 * u, 7 * u); ctx.stroke();
          ctx.strokeStyle = '#8f7fe0'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(-6 * u, 6 * u); ctx.lineTo(-9 * u, 9 * u); ctx.stroke();
        } else if (kind === 'star') {
          star5(0, 0, 9 * u, '#ffe29a', 1);
        } else if (kind === 'block') {
          ctx.fillStyle = '#9b82ff'; rr(ctx, -7.5 * u, -7.5 * u, 15 * u, 15 * u, 2.5 * u); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, -5.5 * u, -5.5 * u, 11 * u, 3 * u, 1.5 * u); ctx.fill();
        } else if (kind === 'trophy') {
          ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.moveTo(-6 * u, -8 * u); ctx.lineTo(6 * u, -8 * u); ctx.lineTo(4 * u, 1 * u); ctx.quadraticCurveTo(0, 5 * u, -4 * u, 1 * u); ctx.closePath(); ctx.fill();
          ctx.fillRect(-1 * u, 3 * u, 2 * u, 4 * u); ctx.fillRect(-4 * u, 7 * u, 8 * u, 2 * u);
          ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.arc(-6 * u, -4 * u, 2.6 * u, Math.PI * .5, Math.PI * 1.5); ctx.arc(6 * u, -4 * u, 2.6 * u, -Math.PI * .5, Math.PI * .5); ctx.stroke();
        }
        ctx.restore();
      }
      const dashedCurve = (p0, p1, p2, col) => {
        ctx.save(); ctx.setLineDash([5 * S, 6 * S]); ctx.lineDashOffset = -time * 22; ctx.strokeStyle = col || 'rgba(169,212,255,.55)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke(); ctx.restore();
        for (let k = 0; k < 2; k++) {
          const u = ((time * .45 + k * .5) % 1), t2 = k ? 1 - u : u;
          const bx = (1 - t2) * (1 - t2) * p0[0] + 2 * (1 - t2) * t2 * p1[0] + t2 * t2 * p2[0], by = (1 - t2) * (1 - t2) * p0[1] + 2 * (1 - t2) * t2 * p1[1] + t2 * t2 * p2[1];
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, 9 * S); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(169,212,255,0)');
          ctx.fillStyle = g; ctx.fillRect(bx - 9 * S, by - 9 * S, 18 * S, 18 * S);
        }
      };

      /* ---------- 2 · LLAMADA (muchas horas en llamada, jugamos de todo) ---------- */
      function callScene() {
        const IA = { kind: 'step', cx: -86, w: 76, y: 0, alt: 1, top: '#7df3ff', front: '#1b2a7a' }, IB = { kind: 'step', cx: 86, w: 76, y: 0, alt: 0, top: '#ff8ae6', front: '#6a1a7a' };
        const KINDS = ['gamepad', 'dice', 'sword', 'star', 'block', 'trophy'];
        const icons = [], msgs = []; let tt = 0, vol = 0, typing = null, nIcon = 0;
        const spawnIcon = who => {
          const side = who === 'A' ? -1 : 1;
          icons.push({ kind: KINDS[nIcon++ % KINDS.length], x: side * 84, y: 58, vx: -side * (16 + Math.random() * 12), vy: 24 + Math.random() * 12, rot: (Math.random() - .5), vr: (Math.random() - .5) * 2.4, age: 0 });
        };
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, IA.cx, 0, 1); reset(B, IB.cx, 0, -1); },
          update(dt) {
            tt += dt; vol = lerp(vol, typing ? .9 : (msgs.some(m => m.age < .6) ? 1 : .4), Math.min(1, dt * 6));
            icons.forEach(o => { o.age += dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; });
            while (icons.length && icons[0].age > 2.6) icons.shift();
            msgs.forEach(m => { m.age += dt; }); while (msgs.length && msgs[0].age > 3) msgs.shift();
          },
          bg() {
            skyGrad([[0, '#09001c'], [.4, '#25075a'], [.75, '#7b1d8e'], [1, '#ff3d9a']]);
            starsField(70, '#ffd9ff', .8);
            const hy = GROUND + 24 * S; retroSun(hy); synthGrid(hy);
          },
          mid() {
            plat(IA); plat(IB);
            dashedCurve([X(IA.cx), Y(46)], [X(0), Y(92)], [X(IB.cx), Y(46)]);
            for (let k = -4; k <= 4; k++) {
              const h = (5 + 20 * vol * Math.abs(Math.sin(time * 6 + k * .9))) * S;
              ctx.fillStyle = k % 2 ? 'rgba(201,188,255,.85)' : 'rgba(169,212,255,.85)'; rr(ctx, X(k * 7) - 1.8 * S, Y(80) - h / 2, 3.6 * S, h, 1.8 * S); ctx.fill();
            }
            // reloj: pasan las horas
            const cx = X(0), cy = Y(140), r = 22 * S, hr = tt * 1.1;
            ctx.fillStyle = 'rgba(8,6,16,.72)'; dot(cx, cy, r);
            ctx.strokeStyle = '#c9bcff'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
            ctx.strokeStyle = 'rgba(233,228,250,.6)'; ctx.lineWidth = 1.2;
            for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r * .8, cy + Math.sin(an) * r * .8); ctx.lineTo(cx + Math.cos(an) * r * .92, cy + Math.sin(an) * r * .92); ctx.stroke(); }
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#a9d4ff'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(hr * 12) * r * .78, cy - Math.cos(hr * 12) * r * .78); ctx.stroke();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4 * S; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(hr) * r * .5, cy - Math.cos(hr) * r * .5); ctx.stroke();
            ctx.fillStyle = '#ffe29a'; dot(cx, cy, 2.2 * S);
            const h = Math.min(14, Math.floor(tt * 2.2) + 1);
            pill(h + ' h en llamada', X(0), Y(106), 'rgba(8,6,16,.72)', '#efeaff', 11);
          },
          fg() {
            icons.forEach(o => { const a = Math.min(1, o.age * 4) * clamp((2.6 - o.age) / .6, 0, 1); drawIcon(o.kind, X(o.x), Y(o.y), 9 * S, o.rot, a); });
            msgs.forEach(m => {
              const u = clamp(m.age / 2.6, 0, 1), a = Math.min(1, m.age * 6) * (m.age > 2.4 ? clamp((3 - m.age) / .6, 0, 1) : 1);
              pill(m.text, X(m.who === 'A' ? -78 : 78), Y(lerp(64, 116, smooth(u))), m.who === 'A' ? '#bfe3ff' : '#e6dcff', '#1b1530', 12, a);
            });
            if (typing) {
              const x = typing === 'A' ? -78 : 78;
              pill('   ', X(x), Y(66), typing === 'A' ? 'rgba(191,227,255,.9)' : 'rgba(230,220,255,.9)', '#1b1530', 12, 1);
              for (let k = -1; k <= 1; k++) { ctx.fillStyle = '#4a3aa0'; dot(X(x + k * 7), Y(66) + Math.sin(time * 9 + k) * 2.4 * S, 1.9 * S); }
            }
          },
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            const lines = [['A', '¿a qué jugamos?'], ['B', '¡a todo!'], ['A', 'otra más…'], ['B', '¡y otra!']];
            for (const [who, text] of lines) {
              typing = who; await wait(.55); typing = null;
              msgs.push({ who, text, age: 0 }); spawnIcon(who); spawnIcon(who === 'A' ? 'B' : 'A');
              const c = who === 'A' ? A : B; pulse(c, .16);
              await wait(.5);
            }
            for (let n = 0; n < 5; n++) { spawnIcon(n % 2 ? 'A' : 'B'); await wait(.4); }
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 3 · CORAZÓN (empezamos a salir, no funcionó, seguimos como amigos) ---------- */
      function heartScene() {
        const slab = { kind: 'step', cx: 0, w: 340, y: 0, alt: 1, top: '#a28bd8', front: '#35296e' };
        const ZZ = [[0, -1.05], [.14, -.6], [-.16, -.2], [.14, .2], [-.12, .58], [0, .95]];
        let emote = 0, big = 0, crack = 0, split = 0, starsT = 0, label = '', labelPop = 1, tt = 0;
        const setLabel = txt => { label = txt; labelPop = 0; anim(.35, t => { labelPop = t; }); };
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -46, 0, 1); reset(B, 46, 0, -1); },
          update(dt) { tt += dt; },
          bg() {
            skyGrad([[0, '#241552'], [.34, '#7b2f86'], [.6, '#ff6f9f'], [.78, '#ffb88a'], [1, '#ffe0b0']]);
            const sx = X(0), sy = Y(-4);
            glow(sx, sy, 170 * S, '#ffd08a', .55); ctx.fillStyle = '#fff1d0'; ctx.beginPath(); ctx.arc(sx, sy, 44 * S, Math.PI, TAU); ctx.fill();
            starsField(26, '#ffe9f4', .5);
            ridge(.06, 36, 22, .011, .03, '#8f4a9c'); ridge(.16, 18, 16, .018, .05, '#6a3a8e'); ridge(.34, 2, 12, .03, .07, '#43296f');
            petals();
          },
          mid() {
            plat(slab);
            const cx = X(0), cy = Y(88), s = 21 * S;
            if (big > .01 && split < .01) {
              const k = easeOutBack(Math.min(1, big)) * (1 + Math.sin(time * 5) * .03);
              const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 3.2 * k); gl.addColorStop(0, 'rgba(255,140,180,.4)'); gl.addColorStop(1, 'rgba(255,140,180,0)');
              ctx.fillStyle = gl; ctx.fillRect(cx - s * 3.4, cy - s * 3.4, s * 6.8, s * 6.8);
              heartPath(cx, cy, s * k); ctx.fillStyle = '#ff7aa8'; ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - s * .55 * k, cy - s * .35 * k, s * .22 * k, s * .12 * k, -.7, 0, TAU); ctx.fill();
              if (crack > .01) {
                ctx.strokeStyle = `rgba(30,10,40,${crack})`; ctx.lineWidth = 2 * S; ctx.lineJoin = 'round'; ctx.beginPath();
                const n = Math.max(2, Math.ceil(ZZ.length * crack));
                for (let q = 0; q < n; q++) { const [zx, zy] = ZZ[q]; q ? ctx.lineTo(cx + zx * s, cy + zy * s) : ctx.moveTo(cx + zx * s, cy + zy * s); }
                ctx.stroke();
              }
            } else if (split > .01 && split < 1) {
              for (const side of [-1, 1]) {
                ctx.save(); ctx.translate(cx + side * split * 22 * S, cy + split * split * 48 * S); ctx.rotate(side * split * .55); ctx.globalAlpha = 1 - split * .85;
                ctx.beginPath(); ctx.moveTo(side * 300, -300); ZZ.forEach(([zx, zy]) => ctx.lineTo(zx * s, zy * s)); ctx.lineTo(side * 300, 300); ctx.closePath(); ctx.clip();
                heartPath(0, 0, s); ctx.fillStyle = '#ff7aa8'; ctx.fill(); ctx.restore();
              }
            }
            // corazón de ella (le gustas)
            if (emote > .01) {
              const k = easeOutBack(Math.min(1, emote)), bx = X(B.x), by = Y(B.y + 64 + Math.sin(time * 3) * 2);
              heartPath(bx, by, 8 * S * k); ctx.fillStyle = '#ff7aa8'; ctx.fill();
            }
            // dos estrellas: siguen juntos, como amigos
            if (starsT > .01) {
              for (const sd of [-1, 1]) {
                const px = lerp(sd * 10, sd * 24, smooth(starsT)), py = lerp(70, 140, smooth(starsT));
                const x = X(px), y = Y(py), g2 = ctx.createRadialGradient(x, y, 0, x, y, 18 * S); g2.addColorStop(0, 'rgba(255,240,190,.55)'); g2.addColorStop(1, 'rgba(255,240,190,0)');
                ctx.fillStyle = g2; ctx.fillRect(x - 18 * S, y - 18 * S, 36 * S, 36 * S);
                star5(x, y, (6.5 + Math.sin(time * 4 + sd) * 1.2) * S, sd < 0 ? '#bfe3ff' : '#e6dcff', Math.min(1, starsT * 2));
              }
              ctx.save(); ctx.setLineDash([3 * S, 4 * S]); ctx.strokeStyle = `rgba(255,255,255,${.5 * Math.max(0, starsT - .5) * 2})`; ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(X(-24), Y(140)); ctx.lineTo(X(24), Y(140)); ctx.stroke(); ctx.restore();
            }
          },
          fg() { if (label) pill(label, X(0), Y(122), 'rgba(8,6,16,.72)', '#efeaff', 12, Math.min(1, labelPop * 1.4)); },
          async run(i) {
            await fadeIn(.7);
            const card = opts.card.show(i);
            anim(.5, t => { emote = t; });
            await wait(.6); say(A, '¿yo?', 1.2); await wait(1.1);
            await Promise.all([hop(A, -26, 0, { h: 18, dur: .5 }), hop(B, 26, 0, { h: 18, dur: .5 })]);
            anim(.3, t => { emote = 1 - t; });
            setLabel('empezamos a salir');
            anim(1.1, t => { big = t; }); burst(0, 88, 18, ['#ffb3d1', '#ffd6e6', '#ffffff'], 90, 1, 30);
            await wait(2.2);
            anim(.6, t => { crack = t; }); await wait(.8);
            setLabel('no funcionó'); A.look = -1; B.look = 1;
            await anim(1.5, t => { split = t; }); split = 1;
            await wait(.2);
            setLabel('seguimos como amigos'); A.look = 1; B.look = -1;
            anim(1.4, t => { starsT = t; });
            await wait(1.0);
            hop(A, A.x, 0, { h: 24, dur: .45 }); hop(B, B.x, 0, { h: 24, dur: .45 });
            ring(0, 0, '255,240,190', 70); burst(0, 40, 16, ['#fff6c9', '#bfe3ff', '#e6dcff'], 110, 1, 40);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 4 · RIELES (un tren, sustos y mil partidas) ---------- */
      function railsScene() {
        let dist = 0, speed = 0, tt = 0; const enemies = [], bullets = [], coins = [], puffs = [];
        const wheel = (x, y, r, rot) => {
          ctx.fillStyle = '#1b1636'; dot(x, y, r); ctx.strokeStyle = '#8f82d8'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r * .72, 0, TAU); ctx.stroke();
          ctx.beginPath(); for (let k = 0; k < 3; k++) { const an = rot + k * Math.PI / 3; ctx.moveTo(x - Math.cos(an) * r * .7, y - Math.sin(an) * r * .7); ctx.lineTo(x + Math.cos(an) * r * .7, y + Math.sin(an) * r * .7); } ctx.stroke();
        };
        const spawn = (dx) => { const e = { x: -215 - (dx || 0), alive: true, ph: Math.random() * 6 }; enemies.push(e); return e; };
        const shoot = (c, e) => {
          c.gun = .3; const bx = c.x - 14, by = c.y + 18, ex = e.x + 4;
          const b = { x: bx, y: by }; bullets.push(b);
          anim(.2, t => { b.x = lerp(bx, ex, t); b.y = lerp(by, 16, t); }).then(() => {
            bullets.splice(bullets.indexOf(b), 1);
            if (e.alive) { e.alive = false; burst(e.x, 14, 14, ['#b8c9b2', '#8aa085', '#ffffff'], 110, .6, 200); coins.push({ x: e.x, y: 18, vy: 95, a: 1 }); shake = 2.5; }
          });
        };
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -92, 14, -1); reset(B, -42, 14, -1); A.gun = B.gun = 0; },
          update(dt) {
            tt += dt; dist += speed * 110 * dt;
            enemies.forEach(e => { if (e.alive) e.x += 62 * dt; }); while (enemies.length && !enemies[0].alive && enemies.length > 6) enemies.shift();
            coins.forEach(c => { c.y += c.vy * dt; c.vy -= 240 * dt; c.a -= dt * .5; }); while (coins.length && coins[0].a <= 0) coins.shift();
            if (speed > .2 && Math.random() < dt * 4) puffs.push({ x: 98, y: 84, r: 3, a: .65 });
            puffs.forEach(p => { p.x -= (40 + speed * 50) * dt; p.y += 18 * dt; p.r += 7 * dt; p.a -= dt * .45; }); while (puffs.length && puffs[0].a <= 0) puffs.shift();
            A.gun = Math.max(0, (A.gun || 0) - dt); B.gun = Math.max(0, (B.gun || 0) - dt);
          },
          bg() {
            const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, '#08141f'); g.addColorStop(.55, '#1d3140'); g.addColorStop(1, '#8a5a38');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); starsField(60, '#ffe9c8', .65);
            const mx = X(112), my = Y(150), mg = ctx.createRadialGradient(mx, my, 0, mx, my, 70 * S); mg.addColorStop(0, 'rgba(255,236,200,.4)'); mg.addColorStop(1, 'rgba(255,236,200,0)');
            ctx.fillStyle = mg; ctx.fillRect(mx - 70 * S, my - 70 * S, 140 * S, 140 * S);
            ctx.fillStyle = 'rgba(255,244,222,.92)'; dot(mx, my, 16 * S);
            // dunas lejanas y cercanas (se desplazan: el tren avanza)
            for (const [par, base, amp, col] of [[.15, 18, 26, '#27323a'], [.45, 6, 14, '#171f26']]) {
              ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, Y(-60));
              for (let x = 0; x <= W + 10; x += 10) { const wx = (x - W / 2) / S + dist * par; ctx.lineTo(x, Y(base + Math.sin(wx * .014) * amp + Math.sin(wx * .035 + 1) * amp * .35)); }
              ctx.lineTo(W, Y(-60)); ctx.closePath(); ctx.fill();
            }
            // cactus
            ctx.fillStyle = '#0b1117';
            for (let k = 0; k < 6; k++) {
              const wx = ((k * 150 - dist * .8) % 900 + 900) % 900 - 450, cx = X(wx), cy = Y(0), h = (30 + (k % 3) * 8) * S, w = 6 * S;
              rr(ctx, cx - w / 2, cy - h, w, h, w / 2); ctx.fill(); rr(ctx, cx - w * 2.2, cy - h * .65, w * 1.6, w, w / 2); ctx.fill(); rr(ctx, cx - w * 2.2, cy - h * .65 - w * 2, w, w * 3, w / 2); ctx.fill();
              rr(ctx, cx + w * .6, cy - h * .5, w * 1.6, w, w / 2); ctx.fill(); rr(ctx, cx + w * 1.2, cy - h * .5 - w * 2, w, w * 3, w / 2); ctx.fill();
            }
            // suelo + vía
            ctx.fillStyle = '#10171d'; ctx.fillRect(0, Y(-2), W, H);
            ctx.fillStyle = '#5a6672'; ctx.fillRect(0, Y(0), W, 3 * S);
            ctx.fillStyle = '#2a323a';
            for (let k = -2; k < 20; k++) { const wx = ((k * 22 - dist) % 440 + 440) % 440 - 220; ctx.fillRect(X(wx) - 3 * S, Y(-3), 6 * S, 9 * S); }
          },
          mid() {
            // monedas y enemigos
            enemies.forEach(e => {
              if (!e.alive) return;
              const x = X(e.x), y = Y(2), s = S * (1 + Math.sin(time * 9 + e.ph) * .03), jy = Math.abs(Math.sin(time * 8 + e.ph)) * 3 * S;
              ctx.save(); ctx.translate(x, y - jy); ctx.scale(s, s);
              ctx.fillStyle = '#566a52'; rr(ctx, -8, -8, 5, 8, 2); ctx.fill(); rr(ctx, 3, -8, 5, 8, 2); ctx.fill();
              const g = ctx.createLinearGradient(0, -34, 0, -6); g.addColorStop(0, '#cfdcc8'); g.addColorStop(1, '#7d9a77'); ctx.fillStyle = g; rr(ctx, -13, -34, 26, 27, 6); ctx.fill();
              ctx.fillStyle = '#7d9a77'; rr(ctx, 10, -24, 11, 4, 2); ctx.fill();
              ctx.fillStyle = '#ff4f66'; dot(-5, -23, 2.6); dot(5, -23, 2.6);
              ctx.strokeStyle = '#2a3326'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -13); ctx.lineTo(-2, -15); ctx.lineTo(1, -13); ctx.lineTo(4, -15); ctx.lineTo(6, -13); ctx.stroke();
              ctx.restore();
            });
            // vagón: suelo, ruedas y farolillo
            const wl = X(-118), ww = 124 * S;
            ctx.fillStyle = '#5a4a3a'; rr(ctx, wl, Y(14), ww, 8 * S, 2 * S); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(wl + 3 * S, Y(14) + 1, ww - 6 * S, 1.4);
            [-100, -66, -32, -2].forEach(wx => wheel(X(wx), Y(7), 7 * S, -dist * .12));
            // locomotora (mira hacia la derecha: chimenea y faro delante, cabina detrás, junto al vagón)
            const lx = X(10);
            ctx.fillStyle = '#3a4150'; rr(ctx, lx + 30 * S, Y(46), 74 * S, 38 * S, 8 * S); ctx.fill();                       // caldera
            ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, lx + 36 * S, Y(43), 62 * S, 4 * S, 2 * S); ctx.fill();          // brillo
            ctx.fillStyle = '#b8893f'; ctx.fillRect(lx + 30 * S, Y(20), 74 * S, 3 * S); ctx.fillRect(lx + 62 * S, Y(46), 3 * S, 38 * S); // franjas de latón
            ctx.fillStyle = '#4b5365'; rr(ctx, lx, Y(68), 40 * S, 60 * S, 4 * S); ctx.fill();                                // cabina (atrás)
            ctx.fillStyle = '#1b1f27'; rr(ctx, lx - 3 * S, Y(70), 46 * S, 5 * S, 2 * S); ctx.fill();                          // techo de la cabina
            ctx.fillStyle = '#ffe9a8'; rr(ctx, lx + 10 * S, Y(58), 16 * S, 14 * S, 2 * S); ctx.fill();                       // ventana encendida
            ctx.fillStyle = '#6b7280'; ctx.fillRect(lx + 17.2 * S, Y(58), 1.6 * S, 14 * S);
            ctx.fillStyle = '#14171c'; ctx.beginPath(); ctx.moveTo(lx + 84 * S, Y(46)); ctx.lineTo(lx + 82 * S, Y(72)); ctx.lineTo(lx + 98 * S, Y(72)); ctx.lineTo(lx + 96 * S, Y(46)); ctx.closePath(); ctx.fill(); // chimenea (delante)
            rr(ctx, lx + 77 * S, Y(79), 28 * S, 7 * S, 2.5 * S); ctx.fill();
            ctx.fillStyle = '#2a2f3a'; rr(ctx, lx + 52 * S, Y(53), 16 * S, 9 * S, 4.5 * S); ctx.fill();                       // domo de vapor
            ctx.fillStyle = '#3a404d'; ctx.beginPath(); ctx.moveTo(lx + 104 * S, Y(15)); ctx.lineTo(lx + 126 * S, Y(0)); ctx.lineTo(lx + 104 * S, Y(0)); ctx.closePath(); ctx.fill(); // quitapiedras
            ctx.strokeStyle = '#b8893f'; ctx.lineWidth = 1.2 * S; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(lx + (104 + k * 5) * S, Y(0)); ctx.lineTo(lx + 104 * S, Y(15 - k * 3.5)); ctx.stroke(); }
            [18, 52, 88].forEach(wx => wheel(lx + wx * S, Y(8), 9 * S, -dist * .1));
            ctx.strokeStyle = '#b8893f'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(lx + 18 * S, Y(8)); ctx.lineTo(lx + 88 * S, Y(8)); ctx.stroke(); // biela
            const hx = lx + 108 * S, hy = Y(34), hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60 * S); hg.addColorStop(0, 'rgba(255,233,168,.6)'); hg.addColorStop(1, 'rgba(255,233,168,0)');
            ctx.fillStyle = hg; ctx.fillRect(hx - 60 * S, hy - 60 * S, 120 * S, 120 * S);
            ctx.fillStyle = '#14171c'; rr(ctx, lx + 102 * S, Y(40), 8 * S, 12 * S, 2 * S); ctx.fill();                        // carcasa del faro (delante)
            ctx.fillStyle = '#ffe9a8'; dot(hx - 1.5 * S, hy, 3.6 * S);
            puffs.forEach(p => { ctx.fillStyle = `rgba(210,200,240,${Math.max(0, p.a)})`; dot(X(p.x), Y(p.y), p.r * S); });
            // enganche
            ctx.fillStyle = '#8a6a45'; ctx.fillRect(X(6), Y(11), 6 * S, 2 * S);
          },
          fg() {
            // armas y balas
            for (const c of [A, B]) if (c.gun > 0) {
              const x = X(c.x - 12), y = Y(c.y + 18); ctx.fillStyle = '#2a2548'; rr(ctx, x - 12 * S, y - 2.5 * S, 14 * S, 5 * S, 1.5 * S); ctx.fill();
              star5(x - 14 * S, y, 6 * S * (c.gun / .3), '#ffe29a', 1);
            }
            ctx.strokeStyle = '#ffe29a'; ctx.lineWidth = 2 * S; ctx.lineCap = 'round';
            bullets.forEach(b => { ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y)); ctx.lineTo(X(b.x + 10), Y(b.y - 1)); ctx.stroke(); });
            coins.forEach(c => coin(X(c.x), Y(c.y), 4.5 * S, Math.max(0, c.a)));
            // pared delantera del vagón: los cubitos van "dentro"
            const wl = X(-118), ww = 124 * S;
            ctx.fillStyle = '#4a3b2e'; rr(ctx, wl, Y(24), ww, 16 * S, 3 * S); ctx.fill();
            ctx.strokeStyle = 'rgba(20,12,60,.6)'; ctx.lineWidth = 1;
            for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(wl + ww * k / 6, Y(24)); ctx.lineTo(wl + ww * k / 6, Y(8)); ctx.stroke(); }
            ctx.fillStyle = '#8a6a45'; ctx.fillRect(wl, Y(24), ww, 2.4 * S);
            // farolillo del vagón
            const lx = X(-114), ly = Y(34), lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22 * S); lg.addColorStop(0, 'rgba(255,200,120,.5)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = lg; ctx.fillRect(lx - 22 * S, ly - 22 * S, 44 * S, 44 * S); ctx.fillStyle = '#ffc878'; rr(ctx, lx - 2.5 * S, ly - 4 * S, 5 * S, 8 * S, 1.5 * S); ctx.fill();
          },
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            anim(1.2, t => { speed = smooth(t); });
            await wait(1.1); say(A, '¡cuidado!', 1.2);
            const e1 = spawn(); await wait(1.7);
            shoot(B, e1); say(B, '¡toma!', 1.1); await wait(.9);
            const e2 = spawn(), e3 = spawn(36); await wait(1.6);
            shoot(A, e2); await wait(.3); shoot(B, e3); say(A, '¡otra horda!', 1.3);
            await wait(1.0);
            hop(A, A.x, 14, { h: 26, dur: .45 }); await wait(.2); hop(B, B.x, 14, { h: 26, dur: .45 });
            say(B, '¡sobrevivimos!', 1.5);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 5 · ÉXITO (un juego de terror que se hizo famoso; el dinero, para compartir) ---------- */
      function hitScene() {
        const slab = { kind: 'step', cx: 0, w: 350, y: 0, alt: 0, top: '#55383f', front: '#1d1115' };
        const F1 = mkFriend('#ffd9ee', '#e58fc0', '#8a3a72', -1), F2 = mkFriend('#cdf5e0', '#6fcf9f', '#2f7a5a', -1);
        let tt = 0, on = 0, players = 0, pile = 0, show = 0; const popups = [], falling = [], tosses = [];
        const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : n >= 1e5 ? Math.round(n / 1e3) + ' K' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' K' : String(Math.round(n));
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -108, 0, 1); reset(B, -22, 0, 1); reset(F2, 34, 0, -1); reset(F1, 90, 0, -1); chars.push(F1, F2); },
          update(dt) {
            tt += dt;
            popups.forEach(p => { p.age += dt; p.y += 26 * dt; }); while (popups.length && popups[0].age > 1.4) popups.shift();
            for (let i = falling.length - 1; i >= 0; i--) { const c = falling[i]; c.vy -= 330 * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.y <= 4 + Math.min(pile, 16) * .35) { falling.splice(i, 1); pile = Math.min(18, pile + 1); } }
          },
          bg() {
            skyGrad([[0, '#040004'], [.5, '#12050d'], [1, '#2a0a12']]);
            fogBanks('#8a1a28', .16);
            const fl = .55 + .45 * Math.abs(Math.sin(tt * 3.1)) * Math.min(1, on);
            glow(X(0), Y(122), 190 * S, '#ff3b4f', .13 * fl);
            starsField(16, '#ffb0b8', .35);
          },
          mid() {
            plat(slab);
            // monitor con el juego de terror
            const cx = X(0), cy = Y(122), w = 118 * S, h = 66 * S, k = Math.min(1, on);
            ctx.fillStyle = '#0d0a1a'; rr(ctx, cx - w / 2 - 5 * S, cy - h / 2 - 5 * S, w + 10 * S, h + 10 * S, 7 * S); ctx.fill();
            ctx.strokeStyle = '#8a5a64'; ctx.lineWidth = 1.6; rr(ctx, cx - w / 2 - 5 * S, cy - h / 2 - 5 * S, w + 10 * S, h + 10 * S, 7 * S); ctx.stroke();
            ctx.save(); rr(ctx, cx - w / 2, cy - h / 2 * k, w, h * k, 3 * S); ctx.clip();
            const sg = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); sg.addColorStop(0, '#120a22'); sg.addColorStop(1, '#2a1238'); ctx.fillStyle = sg; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
            // pasillo en perspectiva hacia una puerta
            ctx.strokeStyle = 'rgba(190,170,240,.45)'; ctx.lineWidth = 1;
            for (let q = -4; q <= 4; q++) { ctx.beginPath(); ctx.moveTo(cx + q * 9 * S, cy - h / 2); ctx.lineTo(cx + q * 2.2 * S, cy - 5 * S); ctx.moveTo(cx + q * 9 * S, cy + h / 2); ctx.lineTo(cx + q * 2.2 * S, cy + 5 * S); ctx.stroke(); }
            ctx.fillStyle = '#05030c'; ctx.fillRect(cx - 5 * S, cy - 8 * S, 10 * S, 16 * S);
            const fl = Math.sin(tt * 13) > .6 ? 1 : 0;           // la silueta parpadea al fondo
            if (fl || Math.sin(tt * 2.2) > .85) { ctx.fillStyle = 'rgba(230,225,245,.85)'; rr(ctx, cx - 1.4 * S, cy - 4 * S, 2.8 * S, 9 * S, 1.2 * S); ctx.fill(); dot(cx, cy - 5.4 * S, 1.8 * S); }
            ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let q = 0; q < 7; q++) ctx.fillRect(cx - w / 2, cy - h / 2 + ((tt * 40 + q * 11) % (h)), w, 1.2);
            if (Math.sin(tt * 4) > 0) { ctx.fillStyle = '#ff4f66'; dot(cx - w / 2 + 7 * S, cy - h / 2 + 7 * S, 2.2 * S); }
            ctx.restore();
            ctx.fillStyle = '#6b5aa8'; ctx.fillRect(cx - 3 * S, cy + h / 2 + 5 * S, 6 * S, 8 * S); rr(ctx, cx - 14 * S, cy + h / 2 + 12 * S, 28 * S, 3 * S, 1.5 * S); ctx.fill();
            // jugadores
            if (show > .01) {
              pill('jugadores  ' + fmt(players), X(0), Y(70), 'rgba(8,6,16,.78)', '#efeaff', 12, show);
              ctx.fillStyle = '#9be8b8'; ctx.globalAlpha = show; ctx.beginPath(); ctx.moveTo(X(52), Y(66)); ctx.lineTo(X(58), Y(66)); ctx.lineTo(X(55), Y(72)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
            }
            // montón de monedas de Mario
            for (let q = 0; q < pile; q++) coin(X(-80 + ((q % 4) - 1.5) * 6.5 + (Math.floor(q / 4) % 2) * 3), Y(3 + Math.floor(q / 4) * 3.6), 4.2 * S, 1);
          },
          fg() {
            popups.forEach(p => pill(p.text, X(p.x), Y(p.y), 'rgba(155,232,184,.92)', '#0f2a1a', 11, clamp(1.4 - p.age, 0, 1) * Math.min(1, p.age * 6)));
            falling.forEach(c => coin(X(c.x), Y(c.y), 4.4 * S, 1));
            tosses.forEach(c => coin(X(c.x), Y(c.y), 4.6 * S, 1));
          },
          async run(i) {
            await anim(.7, t => { A.alpha = B.alpha = F1.alpha = F2.alpha = t; });
            const card = opts.card.show(i);
            await anim(.6, t => { on = t; });
            show = 1; const T = ['jaja', 'a ver…'];
            await anim(3.0, t => { players = Math.pow(t, 3.2) * 310000 + t * 40; });
            // (los avisos de "+K" van apareciendo mientras sube)
            say(B, '¡¿qué?!', 1.2);
            for (let n = 0; n < 7; n++) { popups.push({ x: (n % 2 ? 1 : -1) * (40 + Math.random() * 18), y: 130 + Math.random() * 20, age: 0, text: '+' + (n + 1) + 'K' }); await wait(.18); }
            // llueven monedas
            say(A, '¡¿tanto?!', 1.3);
            for (let n = 0; n < 16; n++) { falling.push({ x: -80 + (Math.random() - .5) * 20, y: 112, vx: (Math.random() - .5) * 8, vy: -20 }); await wait(.09); }
            await wait(.6);
            // lo comparte con Anita y con los amigos
            say(A, '¡para todos!', 1.5); await wait(.9);
            for (const [who, name] of [[B, 'B'], [F2, 'F2'], [F1, 'F1']]) {
              const t0 = { x: A.x, y: 36 }, t1 = { x: who.x, y: who.y + 36 }, c = { x: t0.x, y: t0.y }; tosses.push(c);
              pulse(A, .2);
              await anim(.5, t => { c.x = lerp(t0.x, t1.x, smooth(t)); c.y = lerp(t0.y, t1.y, t) + 4 * 34 * t * (1 - t); });
              tosses.splice(tosses.indexOf(c), 1);
              burst(who.x, who.y + 34, 10, ['#ffd35c', '#fff3c4', '#ffffff'], 90, .7, 200); ring(who.x, 0, '255,211,92', 40);
              popups.push({ x: who.x, y: 60, age: 0, text: '¡gracias!' }); hop(who, who.x, 0, { h: 24, dur: .4 });
              await wait(.35);
            }
            say(B, '¡gracias!', 1.5);
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- utilidades de color ---------- */
      const shade = (hex, f) => {
        const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
        if (f >= 1) { const k = Math.min(1, f - 1); r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= f; g *= f; b *= f; }
        return `rgb(${r | 0},${g | 0},${b | 0})`;
      };

      /* ---------- 1 · OBBY CREATOR (concurso: quién construye mejor la casa) ---------- */
      function contestScene() {
        const BS = 9, R = 16, W7 = 7, HX = [-90, 90];
        const slab = { kind: 'step', cx: 0, w: 350, y: 0, alt: 1, top: '#dbe6f8', front: '#8ba0cc' };
        const F1 = mkFriend('#ffd9ee', '#e58fc0', '#8a3a72', 1), F2 = mkFriend('#cdf5e0', '#6fcf9f', '#2f7a5a', -1);
        // Casa de piedra con forma de cabeza (diseño propio): remate, ceja, dos ventanas,
        // nariz que sobresale, boca y puerta de madera.
        // T remate · # piedra · B ceja · N nariz · W ventana · M boca · D puerta · . vacío
        const ART = [
          '.TTTTT.',
          'TTTTTTT',
          '#######',
          'BBBBBBB',
          '#WW#WW#',
          '#WW#WW#',
          '###N###',
          '###N###NN',
          '##NNN##NN',
          '##NNN##N',
          '#######',
          '#MMMMM#',
          '#######',
          '.#DDD#.',
          '.#DDD#.',
          '.#DDD#.'
        ];
        const PAL2 = [{ stone: '#4f8cf0', cap: '#2f5fc4', nose: '#86b6ff' }, { stone: '#ff7aa9', cap: '#d04a82', nose: '#ffa6c6' }];
        const cellX = (h, c) => HX[h] + (h === 0 ? 1 : -1) * (c - (W7 - 1) / 2) * BS;
        const cellY = r => (R - 1 - r) * BS + BS / 2;
        const houses = [0, 1].map(h => {
          const blocks = []; const L = HX[h] - W7 * BS / 2;
          ART.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.' || ch === 'W' || ch === 'M' || ch === 'D') return;
            const x = cellX(h, c), y = cellY(r), p = PAL2[h];
            const lit = 1.1 - clamp((x - L) / (W7 * BS), 0, 1) * .2 + (R - r) * .004;   // luz desde arriba a la izquierda
            const base = ch === 'T' ? p.cap : ch === 'N' ? p.nose : p.stone;
            blocks.push({ r, c, tx: x, ty: y, col: shade(base, ch === 'B' ? .86 * lit : lit), st: 0, x: 0, y: 0, rot: 0, sq: 0 });
          }));
          return { blocks };
        });
        const det = [0, 0], score = [0, 0], NOTA = ['10', '9']; let challenge = 0, scoreFade = 1;
        function drawBlock(b) {
          const s = (BS - .6) * S;
          ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(b.st === 1 ? b.rot : 0); ctx.scale(1 + .16 * b.sq, 1 - .22 * b.sq);
          ctx.fillStyle = b.col; rr(ctx, -s / 2, -s / 2, s, s, 1.6 * S); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(-s / 2 + 1 * S, -s / 2 + .8 * S, s - 2 * S, 1.3 * S);
          ctx.fillStyle = 'rgba(20,10,60,.22)'; ctx.fillRect(-s / 2 + 1 * S, s / 2 - 1.8 * S, s - 2 * S, 1.2 * S); ctx.fillRect(s / 2 - 1.6 * S, -s / 2 + 1.2 * S, 1 * S, s - 2.4 * S);
          ctx.restore();
        }
        function drawDetails(h) {
          const d = det[h]; if (d <= .01) return;
          ctx.save(); ctx.globalAlpha = d;
          // ventanas (2x2 celdas) con marco, cruz y luz cálida
          [[1, 4], [4, 4]].forEach(([c0, r0]) => {
            const xa = Math.min(cellX(h, c0), cellX(h, c0 + 1)) - BS / 2, yt = cellY(r0) + BS / 2;
            const x = X(xa), y = Y(yt), w = 2 * BS * S, hh = 2 * BS * S;
            const gl = ctx.createRadialGradient(x + w / 2, y + hh / 2, 0, x + w / 2, y + hh / 2, w * 1.6); gl.addColorStop(0, 'rgba(255,220,140,.45)'); gl.addColorStop(1, 'rgba(255,220,140,0)');
            ctx.fillStyle = gl; ctx.fillRect(x - w, y - hh, w * 3, hh * 3);
            ctx.fillStyle = '#3a2a5c'; rr(ctx, x, y, w, hh, 2 * S); ctx.fill();
            const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffc96b');
            ctx.fillStyle = g; rr(ctx, x + 1.6 * S, y + 1.6 * S, w - 3.2 * S, hh - 3.2 * S, 1.4 * S); ctx.fill();
            ctx.fillStyle = '#3a2a5c'; ctx.fillRect(x + w / 2 - .8 * S, y + 1.6 * S, 1.6 * S, hh - 3.2 * S); ctx.fillRect(x + 1.6 * S, y + hh / 2 - .8 * S, w - 3.2 * S, 1.6 * S);
          });
          // boca
          { const xa = Math.min(cellX(h, 1), cellX(h, 5)) - BS / 2, y = Y(cellY(11) + BS / 2); ctx.fillStyle = '#1a1033'; rr(ctx, X(xa) + 1 * S, y + 2 * S, 5 * BS * S - 2 * S, BS * S - 4 * S, 3 * S); ctx.fill(); }
          // puerta de madera con arco
          {
            const xa = Math.min(cellX(h, 2), cellX(h, 4)) - BS / 2, x = X(xa), y = Y(cellY(13) + BS / 2), w = 3 * BS * S, hh = 3 * BS * S;
            ctx.fillStyle = '#4a2f5e'; ctx.beginPath(); ctx.moveTo(x + 1 * S, y + hh); ctx.lineTo(x + 1 * S, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2 - 1 * S, Math.PI, TAU); ctx.lineTo(x + w - 1 * S, y + hh); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + w * k / 3, y + w * .35); ctx.lineTo(x + w * k / 3, y + hh); ctx.stroke(); }
            ctx.fillStyle = '#ffe29a'; dot(x + (h === 0 ? w * .78 : w * .22), y + hh * .62, 1.3 * S);
            ctx.fillStyle = shade(PAL2[h].cap, .8); rr(ctx, x - 3 * S, y + hh - 1, w + 6 * S, 3 * S, 1.5 * S); ctx.fill();
          }
          ctx.restore();
        }
        return {
          enter() { cam.x = 0; cam.y = 0; reset(A, -146, 0, 1); reset(B, 10, 0, -1); reset(F2, 36, 0, -1); reset(F1, 62, 0, -1); chars.push(F1, F2); },
          update(dt) { houses.forEach(hs => hs.blocks.forEach(b => { b.sq = Math.max(0, b.sq - dt * 3); })); },
          bg() {
            skyGrad([[0, '#1d7fe6'], [.5, '#7cc6ff'], [1, '#e8f7ff']]);
            const sx = X(122), sy = Y(214); glow(sx, sy, 110 * S, '#fff2b8', .8); ctx.fillStyle = '#fffbe6'; dot(sx, sy, 20 * S);
            voxHills(.08, 56, 22, 'rgba(120,165,240,.85)'); voxHills(.22, 28, 16, 'rgba(92,140,226,.95)');
            voxClouds();
          },
          mid() {
            plat(slab); studs(slab);
            houses.forEach((hs, h) => {
              ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(X(HX[h]), Y(0) + 2 * S, 40 * S, 4 * S, 0, 0, TAU); ctx.fill();
              hs.blocks.forEach(b => { if (b.st) drawBlock(b); });
              drawDetails(h);
              const k = score[h]; if (k > .01) {
                const sc = easeOutBack(Math.min(1, k)), px = X(HX[h]), py = Y(R * BS + 22);
                ctx.save(); ctx.globalAlpha = scoreFade; ctx.translate(px, py); ctx.scale(sc, sc);
                ctx.fillStyle = '#f3f0f9'; rr(ctx, -19 * S, -12 * S, 38 * S, 24 * S, 7 * S); ctx.fill();
                ctx.lineWidth = 2 * S; ctx.strokeStyle = h === 0 ? '#ffe29a' : '#e58fc0'; rr(ctx, -19 * S, -12 * S, 38 * S, 24 * S, 7 * S); ctx.stroke();
                ctx.fillStyle = '#1b1530'; ctx.font = `800 ${15 * S}px "Bricolage Grotesque","DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(NOTA[h], 0, 1); ctx.restore();
              }
            });
            if (challenge > .01) pill('reto: la casa de Calamardo', X(0), Y(182), 'rgba(8,6,16,.72)', '#efeaff', 11.5, challenge);
          },
          fg() { drawBanner(X(0), Y(112)); drawCall(92); },
          async run(i) {
            await anim(.6, t => { B.alpha = F1.alpha = F2.alpha = t; });
            say(F2, 'jajaja', 1.1); await wait(.6);
            say(B, '¡ahí va!', 1.1); await wait(.8);
            A.y = 70; ring(A.x, 0, '155,130,255', 44);
            await anim(.5, t => { A.alpha = t; A.y = lerp(70, 0, smooth(t)); });
            A.y = 0; A.alpha = 1;
            await anim(.18, t => { const b = easeOutBack(t); A.sy = .78 + .22 * b; A.sx = 1.18 - .18 * b; });
            A.sx = A.sy = 1;
            say(A, '¡hola!', 1.2); await wait(.5);
            say(B, '¡hola!', 1.1); say(F2, '¡únete!', 1.3); await wait(.9);
            say(A, '¿un concurso?', 1.6); await wait(.8);
            say(F1, '¡yo juego!', 1.3); await wait(.5);
            await hop(F1, 146, 0, { h: 44, dur: .7 }); F1.look = -1;
            anim(.4, t => { challenge = smooth(t); }); await wait(.9);
            for (const w of ['3', '2', '1', '¡YA!']) { banner = { text: w, t: 0 }; await wait(.45); }
            banner = null;
            const build = async (h, who, gap) => {
              const list = houses[h].blocks.slice().sort((p, q) => q.r - p.r || p.c - q.c), fl = [];
              for (let k = 0; k < list.length; k += 3) {
                pulse(who, .2);
                for (const b of list.slice(k, k + 3)) {
                  const x0 = who.x, y0 = 36, x1 = b.tx, y1 = b.ty, up = 22 + y1 * .28; b.st = 1; b.x = x0; b.y = y0;
                  fl.push(anim(.45, t => { b.x = lerp(x0, x1, smooth(t)); b.y = lerp(y0, y1, t) + 4 * up * t * (1 - t); b.rot = t * 6 * (h ? -1 : 1); })
                    .then(() => { b.st = 2; b.x = x1; b.y = y1; b.sq = 1; if (Math.random() < .3) burst(b.x, b.y - BS / 2, 3, ['#d9d2ff', '#a9d4ff'], 40, .35, 90); }));
                }
                await wait(gap);
              }
              await Promise.all(fl);
            };
            const doneA = build(0, A, .1).then(() => say(A, '¡terminé!', 1.2));
            const doneB = build(1, F1, .125);
            await Promise.all([doneA, doneB]);
            await wait(.3);
            anim(.8, t => { det[0] = det[1] = smooth(t); });
            burst(HX[0], 70, 14, ['#fff3c4', '#ffc96b'], 80, .9, 40); burst(HX[1], 70, 14, ['#fff3c4', '#ffc96b'], 80, .9, 40);
            anim(.4, t => { challenge = 1 - smooth(t); });
            await wait(1.0);
            say(B, 'a ver…', 1.0); say(F2, 'mmm…', 1.0); await wait(1.0);
            anim(.5, t => { score[1] = t; }); await wait(.5);
            anim(.5, t => { score[0] = t; });
            burst(HX[0], R * BS + 16, 36, PARTY, 200, 1.2, 240); ring(HX[0], 0, '255,226,154', 80); shake = 4;
            say(A, '¡gané!', 1.5); hop(B, B.x, 0, { h: 28, dur: .4 });
            await wait(.7); say(F1, '¡bien jugado!', 1.5); hop(F2, F2.x, 0, { h: 24, dur: .4 });
            await wait(1.0);
            anim(.5, t => { scoreFade = 1 - t; });
            say(B, 'te meto en llamada', 1.9); await wait(.9);
            await hop(A, -34, 0, { h: 180, dur: 1.0 }); A.look = 1;
            ring(-12, 30, '169,212,255', 70);
            await anim(.5, t => { callA = smooth(t); });
            say(A, 'vale', 1.2);
            await wait(.7);
            await opts.card.show(i);
            await opts.card.hide();
          }
        };
      }

      /* ---------- 6 · DISTANCIA (dejamos de hablar durante mucho tiempo) ---------- */
      function distanceScene() {
        const IA = { kind: 'step', cx: -60, w: 70, y: 0, alt: 1, top: '#e6eefb', front: '#6f819f' };
        const IB = { kind: 'step', cx: 60, w: 70, y: 0, alt: 0, top: '#d8e3f5', front: '#62738f' };
        const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const flakes = Array.from({ length: 46 }, (_, k) => ({ x: -200 + ((k * 53) % 400), y: (k * 97) % 300, v: 7 + (k % 5) * 3, s: .8 + (k % 3) * .5, ph: k }));
        let tt = 0, sep = 0, link = 1, tA = 0, tB = 0, mon = 0;
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -60, 0, 1); reset(B, 60, 0, -1); },
          update(dt) {
            tt += dt; IA.cx = lerp(-60, -126, smooth(sep)); IB.cx = lerp(60, 126, smooth(sep));
            A.x = IA.cx; B.x = IB.cx; A.gy = B.gy = 0;
            flakes.forEach(f => { f.y -= f.v * dt; f.x += Math.sin(tt + f.ph) * 4 * dt; if (f.y < -40) f.y = 280; });
            mon = Math.floor(tt * 1.7) % 12;
          },
          bg() {
            skyGrad([[0, '#1d2536'], [.45, '#586680'], [.8, '#aab6cb'], [1, '#d8e0ee']]);
            const mx = X(0), my = Y(150), r = 17 * S, ph = (tt * .35) % 1;
            glow(mx, my, r * 3.4, '#dfe6f5', .25);
            ctx.save(); ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.clip(); ctx.fillStyle = 'rgba(70,80,105,.95)'; ctx.fillRect(mx - r, my - r, r * 2, r * 2);
            ctx.beginPath(); ctx.rect(mx - r * 3, my - r * 3, r * 6, r * 6); ctx.arc(mx + (ph * 2 - 1) * r * 2.1, my, r * 1.02, 0, TAU); ctx.clip('evenodd');
            ctx.fillStyle = '#eef2fb'; ctx.fillRect(mx - r, my - r, r * 2, r * 2); ctx.restore();
            ridge(.05, 60, 30, .009, .024, 'rgba(120,134,160,.95)'); fogBand(.45);
            ridge(.14, 36, 22, .013, .035, 'rgb(92,106,134)'); fogBand(.38);
            ridge(.3, 14, 14, .02, .05, 'rgb(62,74,100)');
            ctx.fillStyle = 'rgba(235,242,255,.5)'; flakes.forEach((f, k) => { if (k % 2) dot(X(f.x * .8 + 20), Y((f.y * 1.3) % 300), f.s * S * .7); });
          },
          mid() {
            plat(IA); plat(IB);
            // la llamada se rompe
            const p0 = [X(A.x), Y(46)], p1 = [X(0), Y(96)], p2 = [X(B.x), Y(46)];
            const pt = t => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
            ctx.save(); ctx.setLineDash([5 * S, 6 * S]); ctx.strokeStyle = `rgba(169,212,255,${.25 + .35 * link})`; ctx.lineWidth = 1.6;
            for (const [a, b] of [[0, .5 * link], [1 - .5 * link, 1]]) { if (b - a <= .01) continue; ctx.beginPath(); for (let k = 0; k <= 16; k++) { const q = pt(lerp(a, b, k / 16)); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); }
            ctx.restore();
            pill('sin hablar · ' + MONTHS[mon], X(0), Y(104), 'rgba(8,6,16,.7)', '#c9c7d8', 11, clamp(1 - link * 1.2, 0, 1));
          },
          fg() {
            ctx.fillStyle = 'rgba(220,225,240,.45)'; flakes.forEach(f => dot(X(f.x), Y(f.y), f.s * S));
            for (const [c, a] of [[A, tA], [B, tB]]) if (a > .01) {
              pill('   ', X(c.x), Y(70), `rgba(220,215,240,${.85 * a})`, '#1b1530', 12, a);
              for (let k = -1; k <= 1; k++) { ctx.fillStyle = `rgba(74,58,160,${a})`; dot(X(c.x + k * 7), Y(70) + Math.sin(time * 9 + k) * 2.4 * S, 1.9 * S); }
            }
          },
          async run(i) {
            await fadeIn(.7);
            const card = opts.card.show(i);
            await wait(.8);
            A.look = -1; B.look = 1;
            anim(4.4, t => { sep = t; link = 1 - smooth(Math.min(1, t * 1.5)); });
            await wait(1.0); A.sad = B.sad = true;
            await wait(.6);
            // casi nos escribimos… pero no
            await anim(.3, t => { tA = t; }); await wait(1.0); await anim(.3, t => { tA = 1 - t; });
            await wait(.5);
            await anim(.3, t => { tB = t; }); await wait(1.0); await anim(.3, t => { tB = 1 - t; });
            await wait(.6); A.look = 1; B.look = -1;
            await card;
            await opts.card.hide();
          }
        };
      }

      /* ---------- 7 · REENCUENTRO (volvimos a hablar; mejor que nunca; siempre me ha apoyado) ---------- */
      function reunionScene() {
        const IA = { kind: 'step', cx: -126, w: 70, y: 0, alt: 1 }, IB = { kind: 'step', cx: 126, w: 70, y: 0, alt: 0 };
        const ledge = { kind: 'pad', cx: 64, w: 80, y: 90, glow: 0 };
        const bridge = []; for (let k = 0; k < 8; k++) bridge.push({ tx: -77 + k * 22, ty: -1, st: 0, x: 0, y: 0, sq: 0, col: k % 2 ? '#c9bcff' : '#a9d4ff' });
        let color = 0, ledgeA = 0, starA = 0, label = '', labelPop = 1, tt = 0; const notes = [], rockets = [];
        const setLabel = txt => { label = txt; labelPop = 0; anim(.35, t => { labelPop = t; }); };
        const fly = (text, from, to) => { const n = { text, x0: from.x, x1: to.x, t: 0 }; notes.push(n); return anim(1.0, t => { n.t = t; }).then(() => { notes.splice(notes.indexOf(n), 1); burst(to.x, 60, 10, ['#ffffff', '#a9d4ff', '#c9bcff'], 70, .6, 60); }); };
        const firework = (x, y) => { rockets.push({ x, y: 0, ty: y, v: 260 }); };
        return {
          enter() { cam.x = 0; cam.y = 0; tt = 0; reset(A, -126, 0, 1); reset(B, 126, 0, -1); A.sad = B.sad = true; },
          update(dt) {
            tt += dt; bridge.forEach(b => { b.sq = Math.max(0, b.sq - dt * 3); });
            for (let k = rockets.length - 1; k >= 0; k--) { const r = rockets[k]; r.y += r.v * dt; if (r.y >= r.ty) { rockets.splice(k, 1); burst(r.x, r.y, 46, PARTY, 170, 1.4, 50); ring(r.x, r.y, '255,240,200', 40); } }
          },
          bg() {
            skyGrad([[0, '#03041a'], [.5, '#120a3e'], [1, `rgb(${lerp(20, 50, color) | 0},${lerp(18, 20, color) | 0},${lerp(40, 95, color) | 0})`]]);
            glow(X(-70), Y(90), 190 * S, '#6a3cff', .14 + .2 * color); glow(X(90), Y(150), 160 * S, '#ff4fa8', .06 + .2 * color);
            starsField(120, '#ffffff', .45 + .45 * color);
            if (color > .02) aurora(color);
          },
          mid() {
            plat(IA); plat(IB);
            bridge.forEach(b => {
              if (!b.st) return; const w = 20 * S, h = 8 * S;
              ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.scale(1 + .15 * b.sq, 1 - .25 * b.sq);
              ctx.fillStyle = b.col; rr(ctx, -w / 2, -h / 2, w, h, 2.5 * S); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-w / 2 + 2 * S, -h / 2 + 1 * S, w - 4 * S, 1.4 * S);
              ctx.restore();
            });
            if (ledgeA > .01) { ctx.save(); ctx.globalAlpha = ledgeA; plat(ledge); ctx.restore(); }
            if (starA > .01) {
              const sx = X(ledge.cx), sy = Y(150 + Math.sin(time * 2) * 3), g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 46 * S * starA);
              g.addColorStop(0, `rgba(255,240,190,${.7 * starA})`); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 50 * S, sy - 50 * S, 100 * S, 100 * S);
              star5(sx, sy, 13 * S * easeOutBack(Math.min(1, starA)), '#ffe29a', 1);
            }
          },
          fg() {
            notes.forEach(n => { const x = lerp(n.x0, n.x1, smooth(n.t)), y = 56 + 70 * 4 * n.t * (1 - n.t); pill(n.text, X(x), Y(y), '#f3f0f9', '#1b1530', 12, 1); sparkle(X(x) + 26 * S * Math.sign(n.x1 - n.x0), Y(y), 4 * S, 1, '#ffffff'); });
            ctx.fillStyle = '#fff3c4'; rockets.forEach(r => { dot(X(r.x), Y(r.y), 2 * S); ctx.fillStyle = 'rgba(255,243,196,.4)'; dot(X(r.x), Y(r.y - 10), 1.4 * S); ctx.fillStyle = '#fff3c4'; });
            if (label) pill(label, X(-56), Y(128), 'rgba(8,6,16,.75)', '#efeaff', 12, Math.min(1, labelPop * 1.4));
          },
          async run(i) {
            await fadeIn(.6);
            const card = opts.card.show(i);
            await wait(.6);
            await fly('¿hola?', A, B);
            await wait(.3);
            await fly('¡hola!', B, A);
            A.sad = B.sad = false; anim(1.6, t => { color = smooth(t); });
            // se tiende un puente
            const fl = [];
            for (const b of bridge) {
              const x1 = b.tx, y1 = b.ty; b.st = 1; b.x = x1; b.y = y1 - 90;
              fl.push(anim(.45, t => { b.y = lerp(y1 - 90, y1, easeOutBack(t)); }).then(() => { b.st = 2; b.sq = 1; burst(b.x, 2, 3, ['#d9d2ff', '#a9d4ff'], 40, .35, 90); }));
              await wait(.09);
            }
            await Promise.all(fl);
            // corren a encontrarse
            await Promise.all([hop(A, -66, 0, { h: 26, dur: .42 }), hop(B, 66, 0, { h: 26, dur: .42 })]);
            await Promise.all([hop(A, -16, 0, { h: 26, dur: .42 }), hop(B, 16, 0, { h: 26, dur: .42 })]);
            await anim(.45, t => { const s = Math.sin(t * Math.PI); A.x = -16 + 5 * s; B.x = 16 - 5 * s; A.sx = B.sx = 1 + .14 * s; A.sy = B.sy = 1 - .1 * s; });
            ring(0, 0, '255,214,230', 80); burst(0, 40, 28, PARTY, 150, 1.2, 80);
            setLabel('mejor que nunca');
            await wait(.9);
            // siempre me ha apoyado: ella le ayuda a subir hasta la estrella
            anim(.6, t => { ledgeA = t; }); anim(.9, t => { starA = t; });
            await hop(B, 40, 0, { h: 22, dur: .42 });
            B.hideTag = true;
            await hop(A, 40, 34, { h: 34, dur: .5 }); pulse(B, .25);
            setLabel('siempre me has apoyado');
            await wait(.7);
            await hop(A, 48, 90, { h: 36, dur: .55 }); B.hideTag = false;
            await hop(B, 84, 90, { h: 100, dur: .75 });
            burst(ledge.cx, 150, 40, ['#ffe29a', '#fff3c4', '#ffffff'], 160, 1.3, 60); ring(ledge.cx, 90, '255,226,154', 70);
            firework(-90, 170); await wait(.3); firework(110, 190); await wait(.3); firework(-20, 200);
            hop(A, A.x, 90, { h: 24, dur: .4 }); hop(B, B.x, 90, { h: 24, dur: .4 });
            await card;
            await opts.card.hide();
          }
        };
      }

      /* =====================================================
         UNIVERSOS · cada etapa tiene su propio cielo, luz y estilo
         ===================================================== */
      const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
      function skyGrad(stops) { const g = ctx.createLinearGradient(0, 0, 0, H); stops.forEach(([p, c]) => g.addColorStop(p, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      function glow(x, y, r, hex, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      const starPts = Array.from({ length: 130 }, (_, k) => ({ x: ((k * 73) % 997) / 997, y: ((k * 191) % 983) / 983, r: .6 + ((k * 7) % 5) * .32, ph: k * 1.7 }));
      function starsField(n, hex, a) {
        for (let k = 0; k < n; k++) {
          const p = starPts[k % starPts.length], tw = .35 + .65 * Math.abs(Math.sin(time * (.6 + (k % 5) * .25) + p.ph));
          ctx.fillStyle = rgba(hex, a * tw); dot(p.x * W, p.y * H * .82, p.r * Math.max(1, S * .8));
        }
      }
      // colinas suaves con paralaje
      function ridge(par, base, amp, f1, f2, col) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H + 2);
        for (let x = 0; x <= W + 12; x += 12) { const wx = (x - W / 2) / S + cam.x * par; ctx.lineTo(x, Y(base + Math.sin(wx * f1) * amp + Math.sin(wx * f2 + 1.7) * amp * .4)); }
        ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
      }
      // colinas de bloques (universo voxel)
      function voxHills(par, base, amp, col) {
        ctx.fillStyle = col; const bw = 16 * S;
        for (let x = -bw; x <= W + bw; x += bw) {
          const wx = (x - W / 2) / S + cam.x * par, h = Math.round((base + Math.sin(wx * .02) * amp + Math.sin(wx * .06 + 1) * amp * .4) / 9) * 9;
          ctx.fillRect(x, Y(h), bw + 1, H);
        }
      }
      function voxClouds() {
        const defs = [[-150, 196, 1, 5], [-10, 222, .8, 8], [130, 184, 1.15, 6], [60, 248, .7, 11], [-210, 240, .75, 7]];
        defs.forEach(([x0, y0, s, v]) => {
          const x = ((x0 + time * v + 420) % 840) - 420, sx = X(x), sy = Y(y0), u = s * S;
          ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(ctx, sx, sy, 56 * u, 14 * u, 3 * u); ctx.fill(); rr(ctx, sx + 8 * u, sy - 12 * u, 38 * u, 14 * u, 3 * u); ctx.fill(); rr(ctx, sx + 18 * u, sy - 22 * u, 20 * u, 12 * u, 3 * u); ctx.fill();
          ctx.fillStyle = 'rgba(180,215,250,.9)'; ctx.fillRect(sx + 3 * u, sy + 9 * u, 50 * u, 4 * u);
        });
      }
      function studs(p) {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let k = 0; k < p.w / 16; k++) { const x = X(p.cx - p.w / 2 + 8 + k * 16); if (x < -10 || x > W + 10) continue; ctx.beginPath(); ctx.ellipse(x, Y(p.y) + 3.4 * S, 4.4 * S, 1.6 * S, 0, 0, TAU); ctx.fill(); }
      }
      // synthwave
      function retroSun(hy) {
        const cx = W / 2, cy = hy - 56 * S, r = 66 * S;
        glow(cx, cy, r * 2.3, '#ff4fd8', .5);
        const g = ctx.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#ffe45e'); g.addColorStop(.55, '#ff7a6b'); g.addColorStop(1, '#ff2e93');
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#5a1488'; for (let k = 0; k < 7; k++) ctx.fillRect(cx - r, cy + r * (.05 + k * .14), r * 2, (1.2 + k * .65) * S);
        ctx.restore();
      }
      function synthGrid(hy) {
        const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, '#2a0a5e'); g.addColorStop(1, '#0d0022'); ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
        ctx.save(); ctx.beginPath(); ctx.rect(0, hy, W, H - hy); ctx.clip();
        ctx.strokeStyle = 'rgba(255,79,216,.55)'; ctx.lineWidth = 1.4;
        for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 6 * S, hy); ctx.lineTo(W / 2 + i * 62 * S, H); ctx.stroke(); }
        const off = (time * .5) % 1;
        for (let k = 0; k < 14; k++) { const u = (k + off) / 14, y = hy + Math.pow(u, 2.2) * (H - hy); ctx.globalAlpha = .2 + u * .6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore(); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,120,230,.9)'; ctx.fillRect(0, hy - 1, W, 2);
      }
      // pétalos y bruma
      const petalPts = Array.from({ length: 22 }, (_, k) => ({ x: -190 + (k * 53) % 380, y: (k * 91) % 260, v: 10 + (k % 5) * 4, ph: k * 1.4, s: 1.6 + (k % 3) * .7 }));
      function petals() {
        petalPts.forEach(p => { const y = ((p.y - time * p.v) % 280 + 280) % 280 - 10, x = p.x + Math.sin(time * .8 + p.ph) * 18; ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(time * .9 + p.ph); ctx.fillStyle = 'rgba(255,190,215,.8)'; ctx.beginPath(); ctx.ellipse(0, 0, p.s * 1.6 * S, p.s * S, 0, 0, TAU); ctx.fill(); ctx.restore(); });
      }
      function fogBanks(hex, a) {
        for (let k = 0; k < 5; k++) {
          const x = ((time * (6 + k * 3) + k * 150) % 760) - 380;
          ctx.save(); ctx.translate(X(x), Y(8 + k * 14)); ctx.scale(1, .2); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 190 * S); g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0)); ctx.fillStyle = g; ctx.fillRect(-190 * S, -190 * S, 380 * S, 380 * S); ctx.restore();
        }
      }
      function fogBand(a) {
        const y0 = Y(78), y1 = Y(-4), g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(225,235,250,0)'); g.addColorStop(.6, `rgba(225,235,250,${a})`); g.addColorStop(1, 'rgba(225,235,250,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
      }
      // aurora boreal
      function aurora(inten) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        [['#3ef0c0', 0, 128], ['#8a5cff', 1.7, 156], ['#ff6ec7', 3.2, 110]].forEach(([hex, ph, y0], k) => {
          for (let x = -8; x <= W + 8; x += 8) {
            const wx = x / W * 5.5 + time * .22 + ph, yb = Y(y0 + 34 * Math.sin(wx) + 16 * Math.sin(wx * 2.1 + k)), h = (84 + 36 * Math.sin(wx * 1.3 + k)) * S;
            const g = ctx.createLinearGradient(0, yb - h, 0, yb + 8 * S); g.addColorStop(0, rgba(hex, 0)); g.addColorStop(.7, rgba(hex, .20 * inten)); g.addColorStop(1, rgba(hex, 0));
            ctx.fillStyle = g; ctx.fillRect(x, yb - h, 9, h + 8 * S);
          }
        });
        ctx.restore();
      }

      /* ---------- Cómo se ve cada universo ---------- */
      const DEFAULT_LOOK = { accent: '#a9d4ff', scrim: .36, style: 'plush', vignette: ['0,0,0', .42] };
      const LOOKS = {
        obby: { trans: 'iris', hat: 'hardhat', fade: '#0b2c6b', accent: '#9bd8ff', scrim: .74, scrimCol: '6,22,58', style: 'cel', vignette: ['10,30,80', .26], grade: [['soft-light', '#ffe7b0', .1]], bloom: .05, mote: '255,255,255' },
        llamada: { trans: 'wipe', hat: 'phones', fade: '#12002e', accent: '#ff7ad9', scrim: .4, style: 'neon', vignette: ['20,0,40', .5], grade: [['overlay', '#7a2cff', .16]], scan: .08, bloom: .32, grain: .03, mote: '255,160,240' },
        corazon: { trans: 'fade', hat: 'scarf', fade: '#ffe3cf', accent: '#ffb48a', scrim: .42, scrimCol: '44,10,56', style: 'plush', vignette: ['70,10,60', .34], grade: [['soft-light', '#ffb199', .3]], bloom: .3, grain: .05, mote: '255,210,225' },
        rieles: { trans: 'burn', hat: 'cowboy', card: 'bottom', fade: '#f0c27c', accent: '#e6b87c', scrim: .5, scrimCol: '8,12,18', style: 'cel', vignette: ['0,0,0', .62], grade: [['saturation', '#808080', .55], ['multiply', '#e6c796', .4]], grain: .05, rim: '#ffd9a0', scratches: true, letterbox: .075, weave: true, mote: '210,180,130' },
        exito: { trans: 'glitch', hat: 'torch', fade: '#000000', accent: '#ff4f66', scrim: .5, scrimCol: '0,0,0', style: 'cel', pixel: 3, chroma: 2, glitch: true, vignette: ['0,0,0', .72], grade: [['saturation', '#808080', .45], ['multiply', '#d6a8a8', .4]], scan: .13, grain: .05, mote: null, rim: '#ff8a9a' },
        distancia: { trans: 'fade', hat: 'beanie', fade: '#dfe8f5', accent: '#a9c4e8', scrim: .5, scrimCol: '8,12,26', style: 'cel', vignette: ['8,14,30', .5], grade: [['saturation', '#808080', .6], ['soft-light', '#9bb4d8', .25]], grain: .035, mote: '235,242,255', zoom: t => 1.05 - .16 * smooth(clamp((t - .8) / 4.6, 0, 1)) },
        reencuentro: { trans: 'bang', hat: 'star', fade: '#ffffff', accent: '#7dffd8', scrim: .36, style: 'plush', vignette: ['4,0,30', .4], bloom: .42, grain: .03, mote: '255,235,255', zoom: t => 1 + .05 * smooth(clamp((t - 8) / 3.5, 0, 1)) },
        portal: { trans: 'bang', fade: '#ffffff', accent: '#c9bcff', scrim: .3, style: 'plush', vignette: ['4,0,30', .45], bloom: .3 }
      };

      /* ---------- Postproceso ---------- */
      const noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = 128;
      (() => { const g = noiseCv.getContext('2d'), im = g.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const v = (Math.random() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); })();
      const scanCv = document.createElement('canvas'); scanCv.width = 4; scanCv.height = 3;
      (() => { const g = scanCv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 4, 1); })();
      const noisePat = mainCtx.createPattern(noiseCv, 'repeat'), scanPat = mainCtx.createPattern(scanCv, 'repeat');
      let lo = null, loCtx = null, loW = 0, loH = 0, bl = null, blCtx = null; const loC = [null, null, null], loCx = [null, null, null];
      function ensureLo(f) {
        const w = Math.ceil(W / f), h = Math.ceil(H / f);
        if (!lo) { lo = document.createElement('canvas'); loCtx = lo.getContext('2d'); }
        if (lo.width !== w || lo.height !== h) { lo.width = w; lo.height = h; for (let k = 0; k < 3; k++) { loC[k] = document.createElement('canvas'); loC[k].width = w; loC[k].height = h; loCx[k] = loC[k].getContext('2d'); } }
        loW = w; loH = h;
      }
      function upscale(L, f, sh) {
        const c = mainCtx; c.imageSmoothingEnabled = false;
        if (L.chroma && quality > 0) {
          ['#ff0000', '#00ff00', '#0000ff'].forEach((col, k) => { const g = loCx[k]; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, loW, loH); g.drawImage(lo, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, loW, loH); g.globalCompositeOperation = 'source-over'; });
          c.save(); c.globalCompositeOperation = 'lighter';
          [[0, -L.chroma], [1, 0], [2, L.chroma]].forEach(([k, dx]) => c.drawImage(loC[k], 0, 0, loW, loH, sh[0] + dx, sh[1], W, H));
          c.restore();
        } else c.drawImage(lo, 0, 0, loW, loH, sh[0], sh[1], W, H);
        if (L.glitch && glitchT > 0) glitchBands.forEach(b => c.drawImage(lo, 0, b.y0, loW, b.h, b.dx, b.y0 * f, W, b.h * f));
        c.imageSmoothingEnabled = true;
      }
      function overlayTransition() {
        const c = mainCtx, cov = clamp(1 - iris, 0, 1), T = trType, NL = trLook || {};
        const acc = NL.accent || '#c9bcff', base = NL.fade || '#050409';
        c.save();
        if (T === 'iris') {
          c.strokeStyle = rgba(acc, .85 * (1 - iris)); c.lineWidth = 3 + 7 * (1 - iris); c.beginPath(); c.arc(W / 2, GROUND - 26 * Sb, Math.hypot(W, H) * .75 * iris, 0, TAU); c.stroke();
        } else if (T === 'wipe') {              // barrido de neón de izquierda a derecha
          const close = trPhase === 'close', x0 = close ? 0 : W * (1 - cov) * 0 + W * (1 - cov), x1 = close ? W * cov : W;
          const xa = close ? 0 : W * (1 - cov); c.fillStyle = base; c.fillRect(xa, 0, (close ? W * cov : W * cov), H);
          const ex = close ? W * cov : W * (1 - cov);
          const g = c.createLinearGradient(ex - 46, 0, ex + 46, 0); g.addColorStop(0, rgba(acc, 0)); g.addColorStop(.5, rgba(acc, .9)); g.addColorStop(1, rgba(acc, 0));
          c.fillStyle = g; c.fillRect(ex - 46, 0, 92, H); c.fillStyle = '#fff'; c.fillRect(ex - 1, 0, 2, H); void x0; void x1;
        } else if (T === 'fade') {              // fundido a un color cálido o frío
          c.globalAlpha = smooth(cov); c.fillStyle = base; c.fillRect(0, 0, W, H);
        } else if (T === 'burn') {              // quemadura de película
          c.globalAlpha = Math.pow(cov, 1.3); c.fillStyle = base; c.fillRect(0, 0, W, H);
          c.globalAlpha = .35 * cov; c.fillStyle = '#fff4d8'; for (let k = 0; k < 5; k++) c.fillRect(Math.random() * W, 0, 1 + Math.random() * 3, H);
          c.globalAlpha = cov * .6; c.globalCompositeOperation = 'overlay'; c.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0); c.fillStyle = noisePat; c.fillRect(-128, -128, W + 256, H + 256);
        } else if (T === 'glitch') {            // corte con cortes de imagen
          for (let k = 0; k < 11; k++) { const y = Math.random() * H, h = 4 + Math.random() * 46, col = [acc, '#ffffff', '#000000', '#00ffd0'][(Math.random() * 4) | 0]; c.globalAlpha = cov * .85; c.fillStyle = col; c.fillRect((Math.random() - .5) * 40, y, W + 40, h); }
          c.globalAlpha = smooth(clamp((cov - .78) / .22, 0, 1)); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        } else if (T === 'bang') {              // explosión de luz
          const r = Math.hypot(W, H) * 1.05 * cov; if (r > 1) { const g = c.createRadialGradient(W / 2, GROUND - 40 * Sb, 0, W / 2, GROUND - 40 * Sb, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.82, rgba(acc, .9)); g.addColorStop(1, rgba(acc, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
          if (cov > .985) { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }
        }
        c.restore();
      }

      function post(L) {
        const c = mainCtx;
        // velo oscuro arriba para que el texto se lea siempre
        const scr = L.scrim == null ? .36 : L.scrim;
        if (scr > 0 && L.card === 'bottom') { const g = c.createLinearGradient(0, H, 0, cardTop - 40), col = L.scrimCol || '6,4,16'; g.addColorStop(0, `rgba(${col},${scr})`); g.addColorStop(.7, `rgba(${col},${scr * .8})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, cardTop - 40, W, H - cardTop + 40); }
        else if (scr > 0) { const g = c.createLinearGradient(0, 0, 0, cardBot + 46), col = L.scrimCol || '6,4,16'; g.addColorStop(0, `rgba(${col},${scr})`); g.addColorStop(.72, `rgba(${col},${scr * .82})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, cardBot + 46); }
        // bloom (resplandor suave)
        if (L.bloom && quality > 0) {
          const bw = Math.ceil(W / 9), bh = Math.ceil(H / 9);
          if (!bl) { bl = document.createElement('canvas'); blCtx = bl.getContext('2d'); }
          if (bl.width !== bw || bl.height !== bh) { bl.width = bw; bl.height = bh; }
          blCtx.clearRect(0, 0, bw, bh); blCtx.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, bw, bh);
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = L.bloom; c.imageSmoothingEnabled = true; c.drawImage(bl, 0, 0, bw, bh, 0, 0, W, H); c.restore();
        }
        // gradación de color
        (L.grade || []).forEach(([op, col, a]) => { c.save(); c.globalCompositeOperation = op; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, W, H); c.restore(); });
        // viñeta
        if (L.vignette) { const vg = c.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .32, W / 2, H * .5, Math.max(W, H) * .8); vg.addColorStop(0, `rgba(${L.vignette[0]},0)`); vg.addColorStop(1, `rgba(${L.vignette[0]},${L.vignette[1]})`); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
        // grano de película
        if (L.grain && quality > 0) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = L.grain * 4; c.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0); c.fillStyle = noisePat; c.fillRect(-128, -128, W + 256, H + 256); c.restore(); }
        // arañazos de película
        if (L.scratches && Math.random() < .12) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,240,210,.18)'; c.lineWidth = 1; const x = Math.random() * W; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - .5) * 6, H); c.stroke(); c.restore(); }
        // líneas de pantalla
        if (L.scan) { c.save(); c.globalAlpha = L.scan; c.fillStyle = scanPat; c.fillRect(0, 0, W, H); c.restore(); }
        // bandas de cine
        if (L.letterbox) { const h = L.letterbox * H * smooth(clamp(sceneT / .8, 0, 1)); c.fillStyle = '#000'; c.fillRect(0, 0, W, h); c.fillRect(0, H - h, W, h); }
        // textos nítidos por encima (universo pixelado)
        while (later.length) later.shift()();
        // número grande al entrar en una etapa
        if (titleFx) {
          const t = titleFx.t, a = t < .3 ? t / .3 : clamp((1.6 - t) / .7, 0, 1);
          c.save(); c.globalAlpha = a; c.translate(W / 2, GROUND - 92 * Sb); c.scale(1 + t * .06, 1 + t * .06);
          c.font = `800 ${120 * Sb}px "Bricolage Grotesque","DM Sans",system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(255,255,255,.07)'; c.fillText(titleFx.text, 0, 0);
          c.lineWidth = 1.5; c.strokeStyle = rgba((L.accent || '#c9bcff'), .6); c.strokeText(titleFx.text, 0, 0); c.restore();
        }
        // transición entre universos (cada uno tiene la suya)
        if (iris < .999) overlayTransition();
      }

      const REG = { obby: contestScene, llamada: callScene, corazon: heartScene, rieles: railsScene, exito: hitScene, distancia: distanceScene, reencuentro: reunionScene, carrera: raceScene, chat: chatScene, build: buildScene, noche: nightScene, lluvia: rainScene, fiesta: partyScene, hoguera: campScene, portal: portalScene };
      // altura (en unidades del mundo) que necesita cada escena por encima del suelo
      const TOP = { distancia: 150, reencuentro: 178, obby: 192, llamada: 168, corazon: 150, rieles: 112, exito: 165, carrera: 112, chat: 140, build: 150, noche: 138, lluvia: 138, fiesta: 160, hoguera: 80, portal: 110 };

      /* ---------- Transición en iris entre mundos ---------- */
      async function goto(name, idx) {
        trLook = Object.assign({ id: name }, LOOKS[name] || DEFAULT_LOOK); trType = trLook.trans || 'iris';
        if (cur) { trPhase = 'close'; await anim(.6, t => { iris = 1 - smooth(t); }); iris = 0; }
        particles = []; rings = []; shake = 0; chars.length = 2; banner = null; callA = 0;
        cur = (REG[name] || REG.obby)();
        look = trLook; sceneT = 0; glitchT = 0;
        if (opts.onUniverse) opts.onUniverse(look);
        cardPos = look.card || 'top';
        const box = opts.cardBox ? opts.cardBox(idx) : { top: 84, bottom: 380 };
        cardBot = box.bottom; cardTop = box.top;
        topY = TOP[name] || 140; layout();
        cur.enter();
        titleFx = idx < N ? { text: String(idx + 1).padStart(2, '0'), t: 0 } : null;
        trPhase = 'open';
        await anim(.75, t => { iris = smooth(t); });
        iris = 1;
        burst(A.x, 20, 10, PAL, 90, .6, 80);
      }

      /* ---------- Bucle ---------- */
      function update(dt) {
        time += dt; sceneT += dt;
        if (look.glitch) { glitchT -= dt; if (glitchT <= 0 && Math.random() < dt * .9) { glitchT = .1 + Math.random() * .16; const n = 1 + ((Math.random() * 3) | 0); glitchBands = Array.from({ length: n }, () => ({ y0: (Math.random() * (loH - 10)) | 0, h: 3 + ((Math.random() * 10) | 0), dx: (Math.random() - .5) * 26 })); } }
        for (let i = anims.length - 1; i >= 0; i--) {
          const a = anims[i]; a.t += dt;
          const p = Math.min(1, a.t / a.dur); a.fn(p);
          if (p >= 1) { anims.splice(i, 1); a.res(); }
        }
        shake *= Math.pow(.02, dt);
        if (banner) banner.t += dt;
        if (titleFx) { titleFx.t += dt; if (titleFx.t > 1.6) titleFx = null; }
        motes.forEach(m => { m.y += m.v * dt; if (m.y > 280) m.y = -20; });
        callVol = lerp(callVol, callA > .5 ? 1 : 0, Math.min(1, dt * 5));
        if (!holdFlash) flashA = Math.max(0, flashA - dt * 1.8);
        for (let i = particles.length - 1; i >= 0; i--) {
          const q = particles[i]; q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; }
          q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 6;
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i]; r.t += dt; if (r.t >= r.life) { rings.splice(i, 1); continue; }
          r.r = lerp(4, r.max, 1 - Math.pow(1 - r.t / r.life, 3));
        }
        for (const c of chars) {
          c.blink -= dt; if (c.blink < -.12) c.blink = 1.6 + Math.random() * 2.4;
          if (c.sayT > 0) c.sayT -= dt;
        }
        if (cur) cur.update(dt);
      }

      function renderWorld() {
        cur.bg();
        if (look.mote !== null) {
          const mc = look.mote || '220,210,255';
          for (const m of motes) { ctx.fillStyle = `rgba(${mc},${.1 + .1 * Math.sin(time * 1.3 + m.ph)})`; ctx.beginPath(); ctx.arc(X(m.x + Math.sin(time * .6 + m.ph) * 8), Y(m.y), m.r * S, 0, TAU); ctx.fill(); }
        }
        cur.mid();
        for (const r of rings) {
          const a = 1 - r.t / r.life; ctx.strokeStyle = `rgba(${r.c},${a * .9})`; ctx.lineWidth = 2 * S;
          ctx.beginPath(); ctx.ellipse(X(r.x), Y(r.y), r.r * S, r.r * S * .28, 0, 0, TAU); ctx.stroke();
        }
        chars.slice().sort((p, q) => p.y - q.y).forEach(drawChar);
        cur.fg();
        for (const q of particles) {
          const a = Math.max(0, q.life / q.max); ctx.globalAlpha = a; ctx.fillStyle = q.c;
          ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(q.r); const s = q.s * S * (.5 + a * .5); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      function draw() {
        mainCtx.clearRect(0, 0, W, H);
        if (!cur) return;
        if (trType === 'iris' && iris <= .002) return;
        const L = look, c = mainCtx;
        // cámara: dolly de entrada + respiración (+ temblor de proyector en el universo de cine)
        const dolly = 1 + .06 * (1 - smooth(clamp(sceneT / 1.8, 0, 1))) + .004 * Math.sin(sceneT * .7);
        Z = (L.zoom ? L.zoom(sceneT) : 1) * dolly; S = Sb * Z;
        camDX = L.weave ? Math.sin(time * 37) * .45 : 0; camDY = L.weave ? Math.cos(time * 29) * .45 : 0;
        const sh = shake > .2 ? [(Math.random() - .5) * shake, (Math.random() - .5) * shake] : [0, 0];
        c.save();
        if (trType === 'iris' && iris < .999) { c.beginPath(); c.arc(W / 2, GROUND - 26 * Sb, Math.hypot(W, H) * .75 * iris, 0, TAU); c.clip(); }
        if (L.pixel > 1) {
          const f = L.pixel; ensureLo(f);
          ctx = loCtx; loCtx.setTransform(1, 0, 0, 1, 0, 0); loCtx.clearRect(0, 0, lo.width, lo.height); loCtx.setTransform(1 / f, 0, 0, 1 / f, 0, 0);
          deferOn = true; renderWorld(); deferOn = false; ctx = mainCtx;
          upscale(L, f, sh);
        } else {
          ctx = mainCtx; if (sh[0] || sh[1]) c.translate(sh[0], sh[1]);
          renderWorld();
          if (sh[0] || sh[1]) c.translate(-sh[0], -sh[1]);
        }
        post(L);
        c.restore();
        if (flashA > .01) { c.fillStyle = `rgba(${flashCol},${Math.min(1, flashA)})`; c.fillRect(0, 0, W, H); }
      }

      // Paso de tiempo fijo (1/90 s): la animación va igual de fluida en cualquier móvil.
      // Si el móvil va justo, se desactivan los efectos pesados automáticamente.
      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.1, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        ft = ft * .92 + dt * .08;
        if (ft > .027) { slowT += dt; if (slowT > 1.3 && quality > 0) { quality = 0; dprCap = 1.5; resize(); } } else slowT = Math.max(0, slowT - dt * .5);
        acc += dt; let n = 0; const h = 1 / 90;
        while (acc >= h && n < 9) { update(h); acc -= h; n++; }
        if (n === 9) acc = 0;
        draw();
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

      async function director() {
        for (let i = 0; i < N; i++) {
          if (skipFlag) return;
          await goto(names[i], i);
          if (opts.onStage) opts.onStage(i);
          await cur.run(i);
        }
        if (skipFlag) return;
        await goto('portal', N);
        await cur.run(N);
      }
      director().then(finish, finish);
    });
  }

  global.Obby = { play, skip };
})(window);
