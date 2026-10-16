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
      const cv = opts.canvas, ctx = cv.getContext('2d');
      const names = (opts.scenes && opts.scenes.length) ? opts.scenes : ['obby'];
      const N = names.length;
      let W = 0, H = 0, S = 1, dpr = 1, GROUND = 0;
      let running = true, skipFlag = false, time = 0, last = 0, raf = 0;
      let anims = [], particles = [], rings = [];
      let shake = 0, flashA = 0, flashCol = '255,255,255', holdFlash = false;
      let iris = 0, cur = null;
      let banner = null, callA = 0, callVol = 0;
      const cam = { x: 0, y: 0 };

      function resize() {
        dpr = Math.min(global.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect();
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      // La escena se coloca por debajo de la tarjeta de texto: baja el suelo y, si hace falta, reduce la escala.
      let topY = 140, cardBot = 380;
      function layout() {
        const S0 = Math.max(.8, Math.min(W / 330, H / 700));
        let g = H * .70, sc = S0;
        const need = cardBot + 14 + topY * sc;
        if (need > g) g = Math.min(H * .80, need);
        if (need > g) sc = Math.max(.55, (g - cardBot - 14) / topY);
        S = sc; GROUND = g;
      }
      resize();
      global.addEventListener('resize', resize);

      const X = x => W / 2 + (x - cam.x) * S;
      const Y = y => GROUND - (y - cam.y) * S;

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
      const reset = (c, x, y, look) => { c.x = x; c.y = y; c.sx = c.sy = c.k = 1; c.alpha = 0; c.run = 0; c.look = look; c.say = ''; c.sayT = 0; c.face = 0; c.sit = false; };
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
        c.x = tx; c.y = ty; c.run = 0;
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
        ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
        ctx.font = `700 ${size * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width + size * 1.5 * S, h = size * 1.9 * S;
        ctx.fillStyle = bg; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
        ctx.fillStyle = fg; ctx.fillText(text, x, y + .5); ctx.restore();
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

        const tx = sx, ty = sy - 52 * S * c.k;
        ctx.save(); ctx.globalAlpha = c.alpha;
        ctx.font = `700 ${11 * S}px "DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (c.name) {
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
      }

      /* =====================================================
         ESCENAS (una por etapa)
         Cada escena: enter() · update(dt) · bg() · mid() · fg() · run(i)
         ===================================================== */

      /* ---------- 1 · OBBY CREATOR (concurso: quién construye mejor la casa) ---------- */
      function contestScene() {
        const BS = 10, R = 13, HX = [-88, 88];
        const slab = { kind: 'step', cx: 0, w: 350, y: 0, alt: 1, top: '#8f82d8', front: '#2f2766' };
        const F1 = mkFriend('#ffd9ee', '#e58fc0', '#8a3a72', 1), F2 = mkFriend('#cdf5e0', '#6fcf9f', '#2f7a5a', -1);
        // Casa de piedra con forma de cabeza: frente plana, ceja marcada, ojos huecos,
        // nariz grande que sobresale, boca y puerta abajo.
        // # piedra · B ceja · N nariz · E ojo · M boca · D puerta · . vacío
        const ART = [
          '######',
          '######',
          'BBBBBB',
          '#E##E#',
          '##NN##',
          '##NN##NN',
          '##NN##NN',
          '##NN##NN',
          '######',
          '#MMMM#',
          '.####.',
          '.#DD#.',
          '.#DD#.'
        ];
        const PAL2 = [
          { base: '#9fcdfb', alt: '#b7dcff', brow: '#7fb4ee', nose: '#d6ebff' },
          { base: '#f7b6d8', alt: '#ffcbe5', brow: '#e08fbc', nose: '#ffe2f0' }
        ];
        const cellXY = (h, r, c) => { const side = h === 0 ? 1 : -1; return [HX[h] + side * (c - 2.5) * BS, (R - 1 - r) * BS + BS / 2]; };
        const houses = [0, 1].map(h => {
          const blocks = [], holes = [];
          ART.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.') return;
            const [x, y] = cellXY(h, r, c);
            if (ch === 'E' || ch === 'M' || ch === 'D') { holes.push({ x, y, ch, c }); return; }
            const p = PAL2[h];
            const col = ch === 'B' ? p.brow : ch === 'N' ? p.nose : (r % 2 ? p.alt : p.base);
            blocks.push({ r, c, tx: x, ty: y, col, st: 0, x: 0, y: 0, rot: 0, sq: 0 });
          }));
          return { blocks, holes };
        });
        const det = [0, 0], score = [0, 0], NOTA = ['10', '9']; let challenge = 0, scoreFade = 1;
        return {
          enter() { cam.x = 0; cam.y = 0; reset(A, -146, 0, 1); reset(B, 10, 0, -1); reset(F2, 36, 0, -1); reset(F1, 62, 0, -1); chars.push(F1, F2); },
          update(dt) { houses.forEach(hs => hs.blocks.forEach(b => { b.sq = Math.max(0, b.sq - dt * 3); })); },
          bg() {
            ctx.strokeStyle = 'rgba(169,212,255,.06)'; ctx.lineWidth = 1;
            for (let gx = -200; gx <= 200; gx += 26) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke(); }
            for (let gy = -80; gy <= 340; gy += 26) { ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(W, Y(gy)); ctx.stroke(); }
            drawFarCubes(.2); haze('110,80,220', .16);
          },
          mid() {
            plat(slab);
            houses.forEach((hs, h) => {
              hs.blocks.forEach(b => {
                if (!b.st) return;
                const s = (BS - .8) * S;
                ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(b.st === 1 ? b.rot : 0); ctx.scale(1 + .16 * b.sq, 1 - .22 * b.sq);
                ctx.fillStyle = b.col; rr(ctx, -s / 2, -s / 2, s, s, 1.8 * S); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-s / 2 + 1.2 * S, -s / 2 + 1.2 * S, s - 2.4 * S, 1.6 * S);
                ctx.strokeStyle = 'rgba(30,20,80,.4)'; ctx.lineWidth = 1; rr(ctx, -s / 2, -s / 2, s, s, 1.8 * S); ctx.stroke();
                ctx.restore();
              });
              const d = det[h]; if (d <= .01) return;
              ctx.globalAlpha = d;
              hs.holes.forEach(o => {
                const s = BS * S;
                const ex = X(o.x), ey = Y(o.y);
                if (o.ch === 'E') {
                  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(ex - s / 2, ey - s / 2, s, s);                 // ventana encendida
                  ctx.fillStyle = '#2a1a55'; ctx.fillRect(ex - 2 * S + (h === 0 ? 1.4 : -1.4) * S, ey - 1.6 * S, 4 * S, 4 * S); // pupila hacia el centro
                } else {
                  ctx.fillStyle = o.ch === 'D' ? '#241548' : '#150d2c'; ctx.fillRect(ex - s / 2, ey - s / 2, s, s);
                }
              });
              const k0 = hs.holes.filter(o => o.ch === 'D').sort((p, q) => p.c - q.c);
              if (k0.length) { const o = k0[h === 0 ? 3 : 0]; ctx.fillStyle = '#ffe29a'; ctx.beginPath(); ctx.arc(X(o.x) + (h === 0 ? -3 : 3) * S, Y(o.y + BS * .5), 1.3 * S, 0, TAU); ctx.fill(); }
              ctx.globalAlpha = 1;
              const k = score[h]; if (k > .01) {
                const sc = easeOutBack(Math.min(1, k)), px = X(HX[h] + (h === 0 ? 1 : -1) * BS * 1), py = Y(R * BS + 22);
                ctx.save(); ctx.globalAlpha = scoreFade; ctx.translate(px, py); ctx.scale(sc, sc);
                ctx.fillStyle = '#f3f0f9'; rr(ctx, -19 * S, -12 * S, 38 * S, 24 * S, 7 * S); ctx.fill();
                ctx.lineWidth = 2 * S; ctx.strokeStyle = h === 0 ? '#ffe29a' : '#e58fc0'; rr(ctx, -19 * S, -12 * S, 38 * S, 24 * S, 7 * S); ctx.stroke();
                ctx.fillStyle = '#1b1530'; ctx.font = `800 ${15 * S}px "Bricolage Grotesque","DM Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(NOTA[h], 0, 1); ctx.restore();
              }
            });
            if (challenge > .01) pill('reto: la casa de Calamardo', X(0), Y(172), 'rgba(8,6,16,.72)', '#efeaff', 11.5, challenge);
          },
          fg() { drawBanner(X(0), Y(112)); drawCall(92); },
          async run(i) {
            // Anita está con sus amigos, en el centro
            await anim(.6, t => { B.alpha = F1.alpha = F2.alpha = t; });
            say(F2, 'jajaja', 1.1); await wait(.6);
            say(B, '¡ahí va!', 1.1); await wait(.8);
            // llega Mario
            A.y = 70; ring(A.x, 0, '155,130,255', 44);
            await anim(.5, t => { A.alpha = t; A.y = lerp(70, 0, smooth(t)); });
            A.y = 0; A.alpha = 1;
            await anim(.18, t => { const b = easeOutBack(t); A.sy = .78 + .22 * b; A.sx = 1.18 - .18 * b; });
            A.sx = A.sy = 1;
            say(A, '¡hola!', 1.2); await wait(.5);
            say(B, '¡hola!', 1.1); say(F2, '¡únete!', 1.3); await wait(.9);
            say(A, '¿un concurso?', 1.6); await wait(.8);
            // un amigo de Anita acepta y se va a su parcela
            say(F1, '¡yo juego!', 1.3); await wait(.5);
            await hop(F1, 146, 0, { h: 44, dur: .7 }); F1.look = -1;
            anim(.4, t => { challenge = smooth(t); }); await wait(.9);
            for (const w of ['3', '2', '1', '¡YA!']) { banner = { text: w, t: 0 }; await wait(.45); }
            banner = null;
            // a construir: Mario contra el amigo de Anita (se lanzan bloques de dos en dos, de abajo arriba)
            const build = async (h, who, gap) => {
              const list = houses[h].blocks.slice().sort((p, q) => q.r - p.r || p.c - q.c), fl = [];
              for (let k = 0; k < list.length; k += 2) {
                pulse(who, .2);
                for (const b of list.slice(k, k + 2)) {
                  const x0 = who.x, y0 = 36, x1 = b.tx, y1 = b.ty, up = 22 + y1 * .28; b.st = 1; b.x = x0; b.y = y0;
                  fl.push(anim(.45, t => { b.x = lerp(x0, x1, smooth(t)); b.y = lerp(y0, y1, t) + 4 * up * t * (1 - t); b.rot = t * 6 * (h ? -1 : 1); })
                    .then(() => { b.st = 2; b.x = x1; b.y = y1; b.sq = 1; if (Math.random() < .35) burst(b.x, b.y - BS / 2, 3, ['#d9d2ff', '#a9d4ff'], 40, .35, 90); }));
                }
                await wait(gap);
              }
              await Promise.all(fl);
            };
            const doneA = build(0, A, .1).then(() => say(A, '¡terminé!', 1.2));
            const doneB = build(1, F1, .125);
            await Promise.all([doneA, doneB]);
            await wait(.3);
            anim(.7, t => { det[0] = det[1] = smooth(t); });
            anim(.4, t => { challenge = 1 - smooth(t); });
            await wait(.9);
            // Anita y su otro amigo hacen de jurado
            say(B, 'a ver…', 1.0); say(F2, 'mmm…', 1.0); await wait(1.0);
            anim(.5, t => { score[1] = t; }); await wait(.5);
            anim(.5, t => { score[0] = t; });
            burst(HX[0], R * BS + 16, 36, PARTY, 200, 1.2, 240); ring(HX[0], 0, '255,226,154', 80); shake = 4;
            say(A, '¡gané!', 1.5); hop(B, B.x, 0, { h: 28, dur: .4 });
            await wait(.7); say(F1, '¡bien jugado!', 1.5); hop(F2, F2.x, 0, { h: 24, dur: .4 });
            await wait(1.0);
            // Anita te mete en llamada: vienes saltando sobre tu casa hasta ella
            anim(.5, t => { scoreFade = 1 - t; });
            say(B, 'te meto en llamada', 1.9); await wait(.9);
            await hop(A, -34, 0, { h: 170, dur: 1.0 }); A.look = 1;
            ring(-12, 30, '169,212,255', 70);
            await anim(.5, t => { callA = smooth(t); });
            say(A, 'vale', 1.2);
            await wait(.7);
            await opts.card.show(i);
            await opts.card.hide();
          }
        };
      }

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
            const g = ctx.createRadialGradient(X(goal.cx), Y(goal.y + 40), 0, X(goal.cx), Y(goal.y + 40), 260 * S);
            g.addColorStop(0, `rgba(160,130,255,${.25 * goal.open})`); g.addColorStop(1, 'rgba(160,130,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            drawFarCubes(.35); haze('110,80,220', .18);
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
        const IA = { kind: 'step', cx: -86, w: 76, y: 0, alt: 1 }, IB = { kind: 'step', cx: 86, w: 76, y: 0, alt: 0 };
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
            const k = (Math.sin(tt * .8) + 1) / 2;   // el cielo pasa de día a noche mientras pasan las horas
            ctx.fillStyle = `rgba(${lerp(80, 30, k) | 0},${lerp(110, 30, k) | 0},${lerp(220, 100, k) | 0},.14)`; ctx.fillRect(0, 0, W, H);
            drawFarCubes(.2); haze('90,110,230', .12);
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
            // atardecer
            const g = ctx.createLinearGradient(0, H * .3, 0, GROUND);
            g.addColorStop(0, 'rgba(255,150,190,0)'); g.addColorStop(.7, 'rgba(255,150,170,.20)'); g.addColorStop(1, 'rgba(255,196,130,.32)');
            ctx.fillStyle = g; ctx.fillRect(0, H * .3, W, GROUND - H * .3);
            const sx = X(0), sy = Y(-6), sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 110 * S);
            sg.addColorStop(0, 'rgba(255,214,170,.65)'); sg.addColorStop(.4, 'rgba(255,170,150,.25)'); sg.addColorStop(1, 'rgba(255,170,150,0)');
            ctx.fillStyle = sg; ctx.fillRect(sx - 120 * S, sy - 120 * S, 240 * S, 130 * S);
            ctx.fillStyle = 'rgba(255,224,190,.85)'; ctx.beginPath(); ctx.arc(sx, sy, 38 * S, Math.PI, TAU); ctx.fill();
            drawFarCubes(.1);
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
            if (speed > .2 && Math.random() < dt * 4) puffs.push({ x: 46, y: 76, r: 3, a: .6 });
            puffs.forEach(p => { p.x -= (40 + speed * 50) * dt; p.y += 18 * dt; p.r += 7 * dt; p.a -= dt * .45; }); while (puffs.length && puffs[0].a <= 0) puffs.shift();
            A.gun = Math.max(0, (A.gun || 0) - dt); B.gun = Math.max(0, (B.gun || 0) - dt);
          },
          bg() {
            const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, 'rgba(25,20,70,.5)'); g.addColorStop(1, 'rgba(70,40,110,.25)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
            const mx = X(112), my = Y(150), mg = ctx.createRadialGradient(mx, my, 0, mx, my, 70 * S); mg.addColorStop(0, 'rgba(230,220,255,.35)'); mg.addColorStop(1, 'rgba(230,220,255,0)');
            ctx.fillStyle = mg; ctx.fillRect(mx - 70 * S, my - 70 * S, 140 * S, 140 * S);
            ctx.fillStyle = 'rgba(236,228,255,.8)'; dot(mx, my, 16 * S);
            // dunas lejanas y cercanas (se desplazan: el tren avanza)
            for (const [par, base, amp, col] of [[.15, 18, 26, 'rgba(40,28,92,.85)'], [.45, 6, 14, 'rgba(28,20,70,.95)']]) {
              ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, Y(-60));
              for (let x = 0; x <= W + 10; x += 10) { const wx = (x - W / 2) / S + dist * par; ctx.lineTo(x, Y(base + Math.sin(wx * .014) * amp + Math.sin(wx * .035 + 1) * amp * .35)); }
              ctx.lineTo(W, Y(-60)); ctx.closePath(); ctx.fill();
            }
            // cactus
            ctx.fillStyle = 'rgba(18,14,48,.95)';
            for (let k = 0; k < 6; k++) {
              const wx = ((k * 150 - dist * .8) % 900 + 900) % 900 - 450, cx = X(wx), cy = Y(0), h = (30 + (k % 3) * 8) * S, w = 6 * S;
              rr(ctx, cx - w / 2, cy - h, w, h, w / 2); ctx.fill(); rr(ctx, cx - w * 2.2, cy - h * .65, w * 1.6, w, w / 2); ctx.fill(); rr(ctx, cx - w * 2.2, cy - h * .65 - w * 2, w, w * 3, w / 2); ctx.fill();
              rr(ctx, cx + w * .6, cy - h * .5, w * 1.6, w, w / 2); ctx.fill(); rr(ctx, cx + w * 1.2, cy - h * .5 - w * 2, w, w * 3, w / 2); ctx.fill();
            }
            // suelo + vía
            ctx.fillStyle = 'rgba(22,16,56,1)'; ctx.fillRect(0, Y(-2), W, H);
            ctx.fillStyle = '#3b3270'; ctx.fillRect(0, Y(0), W, 3 * S);
            ctx.fillStyle = '#2a2356';
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
            ctx.fillStyle = '#4a3d8a'; rr(ctx, wl, Y(14), ww, 8 * S, 2 * S); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(wl + 3 * S, Y(14) + 1, ww - 6 * S, 1.4);
            [-100, -66, -32, -2].forEach(wx => wheel(X(wx), Y(7), 7 * S, -dist * .12));
            // locomotora
            const lx = X(10);
            ctx.fillStyle = '#2a2548'; rr(ctx, lx, Y(46), 100 * S, 38 * S, 8 * S); ctx.fill();            // caldera
            ctx.fillStyle = '#3a3262'; rr(ctx, lx + 62 * S, Y(66), 38 * S, 58 * S, 4 * S); ctx.fill();    // cabina
            ctx.fillStyle = '#ffe9a8'; rr(ctx, lx + 70 * S, Y(56), 14 * S, 12 * S, 2 * S); ctx.fill();     // ventana
            ctx.fillStyle = '#1b1636'; ctx.beginPath(); ctx.moveTo(lx + 26 * S, Y(46)); ctx.lineTo(lx + 22 * S, Y(70)); ctx.lineTo(lx + 44 * S, Y(70)); ctx.lineTo(lx + 40 * S, Y(46)); ctx.closePath(); ctx.fill(); // chimenea
            rr(ctx, lx + 19 * S, Y(76), 28 * S, 6 * S, 2 * S); ctx.fill();
            ctx.fillStyle = '#8f82d8'; ctx.fillRect(lx, Y(20), 100 * S, 3 * S);
            [18, 50, 84].forEach(wx => wheel(lx + wx * S, Y(8), 9 * S, -dist * .1));
            const hx = lx + 104 * S, hy = Y(32), hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60 * S); hg.addColorStop(0, 'rgba(255,233,168,.55)'); hg.addColorStop(1, 'rgba(255,233,168,0)');
            ctx.fillStyle = hg; ctx.fillRect(hx - 60 * S, hy - 60 * S, 120 * S, 120 * S);
            ctx.fillStyle = '#ffe9a8'; dot(hx, hy, 4 * S);
            puffs.forEach(p => { ctx.fillStyle = `rgba(210,200,240,${Math.max(0, p.a)})`; dot(X(p.x), Y(p.y), p.r * S); });
            // enganche
            ctx.fillStyle = '#6b5aa8'; ctx.fillRect(X(6), Y(11), 6 * S, 2 * S);
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
            ctx.fillStyle = '#3d3270'; rr(ctx, wl, Y(24), ww, 16 * S, 3 * S); ctx.fill();
            ctx.strokeStyle = 'rgba(20,12,60,.6)'; ctx.lineWidth = 1;
            for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(wl + ww * k / 6, Y(24)); ctx.lineTo(wl + ww * k / 6, Y(8)); ctx.stroke(); }
            ctx.fillStyle = '#6b5aa8'; ctx.fillRect(wl, Y(24), ww, 2.4 * S);
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
        const slab = { kind: 'step', cx: 0, w: 350, y: 0, alt: 0, top: '#cbbfff', front: '#40338c' };
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
            ctx.fillStyle = 'rgba(40,20,70,.22)'; ctx.fillRect(0, 0, W, H);
            drawFarCubes(.2); haze('120,80,220', .14);
          },
          mid() {
            plat(slab);
            // monitor con el juego de terror
            const cx = X(0), cy = Y(122), w = 118 * S, h = 66 * S, k = Math.min(1, on);
            ctx.fillStyle = '#0d0a1a'; rr(ctx, cx - w / 2 - 5 * S, cy - h / 2 - 5 * S, w + 10 * S, h + 10 * S, 7 * S); ctx.fill();
            ctx.strokeStyle = '#a99be8'; ctx.lineWidth = 1.6; rr(ctx, cx - w / 2 - 5 * S, cy - h / 2 - 5 * S, w + 10 * S, h + 10 * S, 7 * S); ctx.stroke();
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

      const REG = { obby: contestScene, llamada: callScene, corazon: heartScene, rieles: railsScene, exito: hitScene, carrera: raceScene, chat: chatScene, build: buildScene, noche: nightScene, lluvia: rainScene, fiesta: partyScene, hoguera: campScene, portal: portalScene };
      // altura (en unidades del mundo) que necesita cada escena por encima del suelo
      const TOP = { obby: 166, llamada: 168, corazon: 150, rieles: 112, exito: 165, carrera: 112, chat: 140, build: 150, noche: 138, lluvia: 138, fiesta: 160, hoguera: 80, portal: 110 };

      /* ---------- Transición en iris entre mundos ---------- */
      async function goto(name, idx) {
        if (cur) { await anim(.5, t => { iris = 1 - smooth(t); }); iris = 0; }
        particles = []; rings = []; shake = 0; chars.length = 2; banner = null; callA = 0;
        cur = (REG[name] || REG.obby)();
        topY = TOP[name] || 140; cardBot = opts.cardBottom ? opts.cardBottom(idx) : 380; layout();
        cur.enter();
        await anim(.65, t => { iris = smooth(t); });
        iris = 1;
        burst(A.x, 20, 10, PAL, 90, .6, 80);
      }

      /* ---------- Bucle ---------- */
      function update(dt) {
        time += dt;
        for (let i = anims.length - 1; i >= 0; i--) {
          const a = anims[i]; a.t += dt;
          const p = Math.min(1, a.t / a.dur); a.fn(p);
          if (p >= 1) { anims.splice(i, 1); a.res(); }
        }
        shake *= Math.pow(.02, dt);
        if (banner) banner.t += dt;
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

      function draw() {
        ctx.clearRect(0, 0, W, H);
        if (!cur || iris <= .002) return;
        ctx.save();
        if (iris < .999) {
          const rmax = Math.hypot(W, H) * .75;
          ctx.beginPath(); ctx.arc(W / 2, GROUND - 26 * S, rmax * iris, 0, TAU); ctx.clip();
        }
        if (shake > .2) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        cur.bg(); cur.mid();
        for (const r of rings) {
          const a = 1 - r.t / r.life; ctx.strokeStyle = `rgba(${r.c},${a * .9})`; ctx.lineWidth = 2 * S;
          ctx.beginPath(); ctx.ellipse(X(r.x), Y(r.y), r.r * S, r.r * S * .28, 0, 0, TAU); ctx.stroke();
        }
        chars.forEach(drawChar);
        cur.fg();
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
