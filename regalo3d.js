/* =========================================================
   EL REGALO · una caja en 3D que hay que tocar para abrir
   Tiembla, salta la tapa, sale una columna de luz y
   una lluvia de monedas... y aparece la tarjeta.
   Necesita motor3d.js cargado antes.
   ========================================================= */
(function (G) {
  'use strict';
  const M = G.M3;
  if (!M) return;
  const { TAU, clamp, lerp, ease, geo, group, box, mesh, bake, FX } = M;

  // devuelve una promesa que se cumple cuando la caja se ha abierto
  function open(canvas, hintEl) {
    return new Promise(resolve => {
      let R;
      try { R = new M.Renderer(canvas, { dpr: 2 }); } catch (e) { resolve(); return; }
      const S = M.sfx();
      const scene = group(), fx = new FX(scene);
      R.setEnv({ sky: 0xe8dcff, gnd: 0x4a2a7a, sun: 0xfff2e0, fog: 0x120a40, fogNear: 30, fogFar: 80, light: [.4, .9, .5], amb: .66, sunK: .65 });
      const st = group();
      mesh(st, geo.cyl20, 0x2c1b72, 9, .8, 9, 0, -.4, 0);
      mesh(st, geo.cyl20, 0x3a2a8a, 7.4, .3, 7.4, 0, .1, 0);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; box(st, .5, .5, .5, i % 2 ? 0xffd23f : 0xc9bcff, Math.cos(a) * 4.1, .2, Math.sin(a) * 4.1, { emis: .8 }); }
      scene.add(bake(st));
      const gift = group().at(0, .25, 0); scene.add(gift);
      const body = group(); gift.add(body);
      box(body, 3.2, 2.8, 3.2, 0x6ee07a, 0, 1.4, 0);
      box(body, .55, 2.82, 3.24, 0xffd23f, 0, 1.4, 0, { emis: .25 }); box(body, 3.24, 2.82, .55, 0xffd23f, 0, 1.4, 0, { emis: .25 });
      const lid = group().at(0, 2.8, 0); gift.add(lid);
      box(lid, 3.6, .7, 3.6, 0x4ac05a, 0, .35, 0);
      box(lid, .6, .74, 3.64, 0xffd23f, 0, .35, 0, { emis: .25 }); box(lid, 3.64, .74, .6, 0xffd23f, 0, .35, 0, { emis: .25 });
      box(lid, 1.1, .8, .5, 0xffd23f, -.55, 1, 0, { rot: [0, 0, .5], emis: .25 }); box(lid, 1.1, .8, .5, 0xffd23f, .55, 1, 0, { rot: [0, 0, -.5], emis: .25 });
      const beam = mesh(scene, geo.cyl20, 0xfff2b3, 2.6, 30, 2.6, 0, 15, 0, { emis: 1, add: true, alpha: 0 });
      const beam2 = mesh(scene, geo.cyl20, 0xffd23f, 4.4, 30, 4.4, 0, 15, 0, { emis: 1, add: true, alpha: 0 });
      const coins = [];
      const cam = { pos: [0, 6, 14], target: [0, 2.2, 0], fov: 42, shiftY: -.08 };

      let state = 'idle', t = 0, ot = 0, running = true, raf = 0, last = 0, taps = 0;
      function tap() {
        if (state !== 'idle') return;
        S.unlock(); taps++;
        state = 'shake'; ot = 0;
        if (hintEl) hintEl.classList.add('hidden');
      }
      canvas.addEventListener('pointerdown', tap);
      const kd = e => { if (e.key === 'Enter' || e.key === ' ') tap(); };
      addEventListener('keydown', kd);

      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts; t += dt;
        if (state === 'idle') {
          gift.rot[1] = Math.sin(t * .8) * .35; gift.pos[1] = .25 + Math.abs(Math.sin(t * 2.4)) * .25;
          if (Math.random() < dt * 6) fx.burst([(Math.random() - .5) * 4, 3.5, (Math.random() - .5) * 4], 1, { colors: [0xffd23f, 0xffffff], speed: .5, life: .9, size: .15, add: true, grav: -1 });
        } else if (state === 'shake') {
          ot += dt;
          const hop = Math.max(0, Math.sin(ot * 10));
          gift.pos[1] = .25 + hop * .5 * (ot / 1.1); gift.rot[2] = Math.sin(ot * 38) * .07 * (1 + ot); gift.rot[1] += dt * ot * 4;
          if (Math.random() < dt * 20) S.tone(300 + ot * 400, 300 + ot * 500, .05, 'triangle', .02);
          if (ot > 1.1) {
            state = 'open'; ot = 0;
            S.noise(.4, .15, 1500); S.tone(400, 1600, .5, 'sine', .06);
            [523, 659, 784, 1047].forEach((f, i) => S.tone(f, f, .25, 'triangle', .05, .1 + i * .1));
            fx.burst([0, 3.2, 0], 50, { colors: [0xffd23f, 0x6ee07a, 0xff4fd8, 0x7df3ff, 0xffffff], speed: 13, life: 1.6, size: .3, add: true, grav: 8 });
            fx.ring([0, 3, 0], 0xffd23f, 6, .7);
            for (let i = 0; i < 40; i++) {
              const n = mesh(scene, geo.cyl, 0xffcf3a, .9, .2, .9, 0, 2.6, 0, { emis: .4 });
              const a = Math.random() * TAU, s = 3 + Math.random() * 5;
              coins.push({ n, vx: Math.cos(a) * s, vy: 10 + Math.random() * 9, vz: Math.sin(a) * s * .6, sp: (Math.random() - .5) * 18, rest: false });
            }
            setTimeout(() => resolve(), 650);
          }
        } else if (state === 'open') {
          ot += dt;
          gift.rot[2] *= .8; gift.pos[1] = lerp(gift.pos[1], .25, .2);
          lid.pos[1] = 2.8 + ot * 14; lid.pos[0] = ot * 3; lid.rot[2] = -ot * 5; lid.rot[0] = ot * 3;
          const b = clamp(ot * 3, 0, 1) * clamp(2.6 - ot, 0, 1);
          beam.alpha = b * .8; beam2.alpha = b * .3; beam.scl[0] = beam.scl[2] = 2.6 + Math.sin(t * 20) * .2;
          if (ot > 5) { running = false; }
        }
        coins.forEach(c => {
          if (c.rest) return;
          c.vy -= 22 * dt; c.n.pos[0] += c.vx * dt; c.n.pos[1] += c.vy * dt; c.n.pos[2] += c.vz * dt; c.n.rot[0] += c.sp * dt; c.n.rot[2] += c.sp * .6 * dt;
          if (c.n.pos[1] < .25 && c.vy < 0) { if (Math.abs(c.vy) < 3) { c.rest = true; c.n.pos[1] = .12; c.n.rot = [0, c.n.rot[1], 0]; } else { c.vy *= -.35; c.vx *= .6; c.vz *= .6; S.tone(1800 + Math.random() * 600, 2400, .04, 'triangle', .008); } }
        });
        fx.update(dt);
        const k = state === 'idle' ? 0 : 1;
        R.resize();
        const hf = Math.atan(Math.tan(cam.fov * Math.PI / 360) * (R.W / R.H)), dist = Math.max(14, 4.2 / Math.tan(hf)) + k * 2;
        cam.pos = [Math.sin(t * .25) * 3, 5 + dist * .12 + k * 1.5, dist];
        R.render(scene, cam);
        if (running) raf = requestAnimationFrame(frame);
        else { canvas.removeEventListener('pointerdown', tap); removeEventListener('keydown', kd); }
      }
      raf = requestAnimationFrame(frame);
      // por si nadie toca: a los 12 s se abre sola
      setTimeout(() => { if (state === 'idle') tap(); }, 12000);
    });
  }

  G.Regalo3D = { open };
})(window);
