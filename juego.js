/* =========================================================
   EL ÚLTIMO RETO · combate en 3D
   Anita, versión superheroína (con sus gafas píxel), contra los
   monstruos de bloques que han robado su regalo:
   3 oleadas + el jefe final, el Rey Cubo.
   Poderes: combo de golpes, Rayo Píxel (láser de las gafas),
   Onda Estelar (empuja y aturde) y Esquiva (invencible un instante).
   Necesita motor3d.js cargado antes.
   ========================================================= */
(function (G) {
  'use strict';
  const M = G.M3;
  if (!M) return;
  const { TAU, clamp, lerp, ease, geo, group, box, mesh, bake, FX, avatar, rgb } = M;
  const ARENA = 17;

  const HERO = { skin: 0xf7d6c4, shirt: 0xc8142a, dress: true, belt: 0xffffff, shoes: 0xf2f2f6, hair: 'long', hairCol: 0x4a2c1c, hairHi: 0xc9a06a, glasses: true, necklace: true, bracelet: true, blush: true, cape: 0x6c4cf0, capeTrim: 0xf2c14e };

  // Ajustes de dificultad (todo en un sitio, por si hay que tocarla)
  const TUNE = {
    hp: 100, speed: 9.5,
    combo: [12, 12, 24], comboRange: 3.6,
    beam: { cd: 5.5, dur: 1.2, tick: .1, dmg: 7, len: 26, width: 1.3 },
    wave: { cd: 9, dmg: 32, radius: 7.5, stun: .9 },
    dash: { cd: 1.3, dur: .2, speed: 30, inv: .38 },
    potion: 28, betweenWaves: 35
  };
  const WAVES = [
    { name: 'Los slimes', list: ['slime', 'slime', 'slime', 'slime', 'slime', 'slime', 'slime'], cap: 3 },
    { name: 'Ojos que vuelan', list: ['slime', 'eye', 'slime', 'eye', 'slime', 'slime', 'eye'], cap: 4 },
    { name: 'Los gólems', list: ['golem', 'slime', 'eye', 'slime', 'golem', 'eye', 'slime'], cap: 4 },
    { name: 'El Rey Cubo', list: ['boss'], cap: 1, boss: true }
  ];
  const EN = {
    slime: { hp: 36, r: 1, speed: 4.4, touch: 9 },
    eye: { hp: 42, r: .9, speed: 4, orb: 10 },
    golem: { hp: 150, r: 1.7, speed: 2.5, slam: 24 },
    boss: { hp: 950, r: 3, speed: 3.6 }
  };

  function play(opts) {
    return new Promise(resolve => {
      const root = opts.root, $ = s => root.querySelector(s);
      const cv = $('#gameCv');
      let R;
      try { R = new M.Renderer(cv, { dpr: 1.75 }); } catch (e) { resolve({ deaths: 0, time: 0 }); return; }
      const S = M.sfx();

      /* ---------- interfaz ---------- */
      const ui = {
        hp: $('#gHpFill'), hpTxt: $('#gHpTxt'), wave: $('#gWave'), left: $('#gLeft'),
        boss: $('#gBoss'), bossFill: $('#gBossFill'), toast: $('#gToast'), count: $('#gCount'),
        dmg: $('#gDmg'), stick: $('#gStick'), knob: $('#gKnob'), vign: $('#gHurt'),
        sk: { atk: $('#skAtk'), beam: $('#skBeam'), wave: $('#skWave'), dash: $('#skDash') }
      };
      let toastT = 0;
      function toast(msg, t) { ui.toast.textContent = msg; ui.toast.classList.add('on'); toastT = t || 1.8; }

      /* ---------- el mundo: una arena flotante sobre la lava ---------- */
      const scene = group(), fx = new FX(scene);
      R.setEnv({ sky: 0xc9b8ff, gnd: 0x6a2a3a, sun: 0xfff0f8, fog: 0x1a0c3a, fogNear: 38, fogFar: 110, light: [.35, .9, .45], amb: .62, sunK: .62 });
      cv.style.background = 'radial-gradient(120% 80% at 50% 0%,#3a1a7a 0%,#1a0c3a 55%,#0a0418 100%)';
      const st = group();
      for (let x = -19; x <= 19; x += 2) for (let z = -19; z <= 19; z += 2) {
        const d = Math.hypot(x, z); if (d > 18.6) continue;
        const ring = Math.floor(d / 4);
        box(st, 1.94, .7, 1.94, (ring + ((x + z) / 2 & 1)) % 2 ? 0x2c2258 : 0x382c6e, x, -.35, z);
      }
      for (let i = 0; i < 3; i++) box(st, 30, .04, .18, 0x9b82ff, 0, .01, -7 + i * 7, { emis: .5 });
      mesh(st, geo.cyl20, 0x241a48, 39, 3.5, 39, 0, -2.4, 0);
      mesh(st, geo.cone, 0x241a48, 36, 9, 36, 0, -8.6, 0, { rot: [Math.PI, 0, 0] });
      for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; box(st, 1.4, .8 + (i % 3) * .3, 1.4, 0x4a3a8a, Math.cos(a) * 19.2, .3, Math.sin(a) * 19.2); }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + .2, x = Math.cos(a) * 20.5, z = Math.sin(a) * 20.5;
        box(st, 1.8, 6, 1.8, 0x3a2c6e, x, 3, z); box(st, 2.3, .5, 2.3, 0x4a3a8a, x, 6.2, z);
        mesh(st, geo.oct, i % 2 ? 0xff4fd8 : 0x7df3ff, 1.2, 2, 1.2, x, 7.6, z, { emis: 1 });
      }
      mesh(st, geo.cyl20, 0xff6a2a, 400, .2, 400, 0, -14, 0, { emis: 1 });
      for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, d = 28 + Math.random() * 30; box(st, 2 + Math.random() * 3, 1.5 + Math.random() * 2, 2 + Math.random() * 3, 0x3a2a4a, Math.cos(a) * d, -10 + Math.random() * 5, Math.sin(a) * d); }
      for (let i = 0; i < 150; i++) { const a = Math.random() * TAU, e = .15 + Math.random() * 1.2, r = 130, s = .4 + Math.random() * .6; box(st, s, s, s, 0xffffff, Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, { emis: 1 }); }
      scene.add(bake(st));
      // portales por donde salen los monstruos
      const PORTALS = [0, 1, 2, 3].map(i => { const a = i / 4 * TAU + Math.PI / 4; return [Math.cos(a) * 15, Math.sin(a) * 15]; });
      const portalNodes = PORTALS.map(([x, z]) => { const p = mesh(scene, geo.torus, 0xff4fd8, 4, 4, 4, x, .15, z, { emis: 1, add: true, alpha: .55 }); return p; });
      // la caja del regalo, encerrada en una jaula en el centro... hasta que ganes
      const cage = group().at(0, 0, -14); scene.add(cage);
      const giftBox = group(); cage.add(giftBox);
      box(giftBox, 2.2, 2, 2.2, 0x6ee07a, 0, 1, 0); box(giftBox, 2.4, .5, 2.4, 0x4ac05a, 0, 2.2, 0);
      box(giftBox, .4, 2.55, 2.3, 0xffd23f, 0, 1.25, 0, { emis: .3 }); box(giftBox, 2.3, 2.55, .4, 0xffd23f, 0, 1.25, 0, { emis: .3 });
      const bars = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; bars.push(box(cage, .25, 4.2, .25, 0x9aa0b8, Math.cos(a) * 2.2, 2.1, Math.sin(a) * 2.2)); }
      const cageTop = mesh(cage, geo.cyl, 0x6a6e88, 5, .35, 5, 0, 4.3, 0);

      /* ---------- la heroína ---------- */
      const hero = avatar(HERO); scene.add(hero.root);
      const P = { x: 0, z: 4, face: 0, hp: TUNE.hp, inv: 0, hurtT: 0, atkT: 0, atkI: 0, atkHit: false, comboWin: 0,
        beamT: 0, beamTick: 0, dashT: 0, dashDir: [0, 0], cd: { beam: 0, wave: 0, dash: 0 }, waveT: 0, dead: false, deadT: 0, buff: 1, y: 0, vy: 0 };
      const beam = group(); scene.add(beam);
      const beamCore = mesh(beam, geo.box, 0xffffff, .35, .35, 1, 0, 0, .5, { emis: 1, add: true });
      const beamA = mesh(beam, geo.box, 0xff4fd8, .9, .9, 1, 0, 0, .5, { emis: 1, add: true, alpha: .55 });
      const beamB = mesh(beam, geo.box, 0x7df3ff, 1.4, 1.4, 1, 0, 0, .5, { emis: 1, add: true, alpha: .3 });
      beam.visible = false;

      /* ---------- monstruos ---------- */
      const enemies = [], orbs = [], warns = [], potions = [];
      function meshesOf(n, out) { out = out || []; if (n.geo) out.push(n); n.children.forEach(c => meshesOf(c, out)); return out; }
      function eyes(g, y, z, sep, col, s) { box(g, .3 * s, .4 * s, .06, 0xffffff, -sep, y, z, { emis: .3 }); box(g, .3 * s, .4 * s, .06, 0xffffff, sep, y, z, { emis: .3 }); box(g, .14 * s, .22 * s, .07, col || 0x1b1420, -sep, y - .04, z + .01, { emis: col ? 1 : 0 }); box(g, .14 * s, .22 * s, .07, col || 0x1b1420, sep, y - .04, z + .01, { emis: col ? 1 : 0 }); }
      function makeEnemy(type, x, z) {
        const d = EN[type], g = group(); scene.add(g);
        const body = group(); g.add(body);
        const e = { type, x, z, y: -4, vx: 0, vz: 0, hp: d.hp, max: d.hp, r: d.r, g, body, t: Math.random() * 5, cd: 1 + Math.random(), stun: 0, flash: 0, face: 0, spawn: 0, state: 'move', st: 0, touchCd: 0, kx: 0, kz: 0 };
        if (type === 'slime') {
          const c = [0x6ee07a, 0x4fd1c5, 0xb18aff][(Math.random() * 3) | 0];
          box(body, 2, 1.7, 2, c, 0, .85, 0, { alpha: 1 }); box(body, 1.4, .3, 1.4, 0xffffff, 0, 1.7, 0, { alpha: .35, emis: .4 });
          eyes(body, 1.1, 1.02, .38, 0, 1); box(body, .4, .1, .06, 0x1b1420, 0, .65, 1.02);
          e.col = c;
        } else if (type === 'eye') {
          mesh(body, geo.ball, 0x8a4ad8, 1.8, 1.8, 1.8, 0, 0, 0);
          mesh(body, geo.ball, 0xffffff, 1.1, 1.1, .5, 0, .05, .7, { emis: .3 });
          e.pupil = mesh(body, geo.ball, 0xff2a5a, .5, .5, .3, 0, .05, .93, { emis: 1 });
          e.wl = group().at(-.8, .2, 0); e.wr = group().at(.8, .2, 0); body.add(e.wl, e.wr);
          box(e.wl, 1.6, .1, .9, 0x4a2a7a, -.8, 0, 0); box(e.wr, 1.6, .1, .9, 0x4a2a7a, .8, 0, 0);
          e.col = 0x8a4ad8; e.hover = 2.6;
        } else if (type === 'golem') {
          box(body, 3, 2.6, 2, 0x7a7e8e, 0, 3.2, 0); box(body, 2, 1.6, 1.6, 0x8a8e9e, 0, 5.2, .1);
          box(body, 2.2, .4, .3, 0x5aa04a, 0, 4.4, 1.01); eyes(body, 5.25, .91, .45, 0xff8a2a, 1.2);
          e.al = group().at(-2, 4.2, 0); e.ar = group().at(2, 4.2, 0); body.add(e.al, e.ar);
          box(e.al, 1.2, 2.8, 1.2, 0x6a6e7e, 0, -1.3, 0); box(e.ar, 1.2, 2.8, 1.2, 0x6a6e7e, 0, -1.3, 0);
          box(e.al, 1.4, 1, 1.4, 0x5a5e6e, 0, -2.8, 0); box(e.ar, 1.4, 1, 1.4, 0x5a5e6e, 0, -2.8, 0);
          box(body, 1.1, 2, 1.1, 0x6a6e7e, -.8, 1, 0); box(body, 1.1, 2, 1.1, 0x6a6e7e, .8, 1, 0);
          e.col = 0x7a7e8e;
        } else {
          box(body, 6, 5.4, 6, 0x5a2ad8, 0, 3.2, 0);
          box(body, 6.1, .6, 6.1, 0x3a1a9a, 0, 1, 0);
          box(body, 3.2, .5, .1, 0x1b1420, 0, 4.9, 3.01, { rot: [0, 0, .25] });
          eyes(body, 4, 3.02, 1.1, 0xff2a5a, 2.4);
          box(body, 3, .5, .1, 0xffffff, 0, 2.2, 3.02); for (let i = 0; i < 5; i++) box(body, .3, .5, .12, 0x1b1420, -1.2 + i * .6, 2.2, 3.03);
          const crown = group().at(0, 6.2, 0); body.add(crown); e.crown = crown;
          box(crown, 4.2, .9, 4.2, 0xffd23f, 0, 0, 0, { emis: .4 });
          for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const s = i % 2 ? 1 : -1; const along = -1.6 + j * 1.6; box(crown, .7, 1.1, .7, 0xffd23f, i < 2 ? along : s * 1.75, .9, i < 2 ? s * 1.75 : along, { emis: .4 }); }
          mesh(crown, geo.oct, 0xff4fd8, .8, 1, .4, 0, .1, 2.15, { emis: 1 });
          e.al = group().at(-3.4, 3.6, 0); e.ar = group().at(3.4, 3.6, 0); body.add(e.al, e.ar);
          box(e.al, 1.4, 1.4, 1.4, 0x4a1ab8, 0, 0, .3); box(e.ar, 1.4, 1.4, 1.4, 0x4a1ab8, 0, 0, .3);
          e.col = 0x5a2ad8; e.phase = 1; e.summon = [.66, .33]; e.next = 'slam';
        }
        e.shadow = mesh(g, geo.cyl20, 0x000000, d.r * 2.4, .02, d.r * 2.4, 0, .04, 0, { alpha: .3 });
        e.meshes = meshesOf(body); e.baseEmis = e.meshes.map(m => m.emis);
        enemies.push(e);
        fx.ring([x, .3, z], 0xff4fd8, 3, .6); fx.burst([x, 1, z], 16, { colors: [0xff4fd8, 0x9b82ff, 0xffffff], speed: 6, life: .6, size: .25, add: true });
        return e;
      }
      function warn(kind, x, z, r, time, onEnd, o) {
        const n = kind === 'line' ? mesh(scene, geo.box, 0xff2a3a, r, .06, o.len, x, .08, z, { alpha: .25, rot: [0, o.ang, 0] }) : mesh(scene, geo.cyl20, 0xff2a3a, r * 2, .06, r * 2, x, .08, z, { alpha: .25 });
        const fill = kind === 'line' ? null : mesh(scene, geo.cyl20, 0xff5a3a, .1, .07, .1, x, .09, z, { alpha: .45 });
        const w = { n, fill, t: 0, time, onEnd, r, kind };
        warns.push(w); return w;
      }
      function shoot(x, y, z, ang, sp, dmg) {
        const n = mesh(scene, geo.ball, 0xff2a5a, .9, .9, .9, x, y, z, { emis: 1 });
        const halo = mesh(n, geo.ball, 0xff7a9a, 1.8, 1.8, 1.8, 0, 0, 0, { emis: 1, add: true, alpha: .4 });
        orbs.push({ n, halo, x, y, z, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, dmg, life: 5 });
      }
      function dropPotion(x, z) {
        const n = group().at(x, .6, z); scene.add(n);
        box(n, .7, .8, .7, 0x6ee07a, 0, 0, 0, { emis: .5 }); box(n, .3, .4, .3, 0xffffff, 0, .55, 0); box(n, .34, .14, .34, 0x8a5a3a, 0, .8, 0);
        const halo = mesh(n, geo.ball, 0x6ee07a, 2, 2, 2, 0, 0, 0, { emis: 1, add: true, alpha: .25 });
        potions.push({ n, x, z, t: 0, halo });
      }

      /* ---------- números de daño ---------- */
      const nums = [];
      function num(x, y, z, txt, cls) {
        const el = document.createElement('span'); el.className = 'g-num ' + (cls || ''); el.textContent = txt; ui.dmg.appendChild(el);
        nums.push({ el, x: x + (Math.random() - .5) * .8, y, z, t: 0 });
      }

      /* ---------- controles ---------- */
      const key = {}, joy = { x: 0, y: 0, id: null, ox: 0, oy: 0, on: false };
      let atkHeld = false;
      const kd = e => {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
        key[k] = true;
        if (k === 'j' || k === 'z') atkHeld = true;
        if (k === 'k' || k === 'x') act('beam');
        if (k === 'l' || k === 'c') act('wave');
        if (k === ' ' || k === 'shift') act('dash');
      };
      const ku = e => { const k = e.key.toLowerCase(); key[k] = false; if (k === 'j' || k === 'z') atkHeld = false; };
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      // joystick flotante: donde pongas el dedo en la mitad izquierda
      const zone = $('#gJoyZone');
      zone.addEventListener('pointerdown', e => {
        if (joy.id !== null) return; joy.id = e.pointerId; joy.on = true; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
        try { zone.setPointerCapture(e.pointerId); } catch (_) {}
        ui.stick.style.left = e.clientX + 'px'; ui.stick.style.top = e.clientY + 'px'; ui.stick.classList.add('on'); ui.knob.style.transform = 'translate(-50%,-50%)';
        S.unlock();
      });
      zone.addEventListener('pointermove', e => {
        if (e.pointerId !== joy.id) return;
        let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const L = Math.hypot(dx, dy), max = 46;
        if (L > max) { dx *= max / L; dy *= max / L; }
        joy.x = dx / max; joy.y = dy / max;
        ui.knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
      });
      const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.on = false; joy.x = joy.y = 0; ui.stick.classList.remove('on'); };
      zone.addEventListener('pointerup', joyEnd); zone.addEventListener('pointercancel', joyEnd);
      const hold = (el, down, up) => {
        el.addEventListener('pointerdown', e => { e.preventDefault(); S.unlock(); el.classList.add('held'); down(); });
        const end = () => { el.classList.remove('held'); if (up) up(); };
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
      };
      hold(ui.sk.atk, () => { atkHeld = true; }, () => { atkHeld = false; });
      hold(ui.sk.beam, () => act('beam'));
      hold(ui.sk.wave, () => act('wave'));
      hold(ui.sk.dash, () => act('dash'));

      /* ---------- estado ---------- */
      let state = 'intro', waveI = Math.max(0, Math.min(3, (opts.startCp | 0))), queue = [], spawnT = 0, breakT = 0, countT = 0, lastCount = '';
      let deaths = 0, waveDeaths = 0, time = 0, hitstop = 0, shake = 0, slowmo = 1, winT = 0, kills = 0;
      let boss = null;
      const camS = { x: 0, z: 4 };

      function moveInput() {
        let x = joy.x, z = joy.y;
        if (key.a || key.arrowleft) x -= 1; if (key.d || key.arrowright) x += 1;
        if (key.w || key.arrowup) z -= 1; if (key.s || key.arrowdown) z += 1;
        const L = Math.hypot(x, z); if (L > 1) { x /= L; z /= L; }
        return [x, z, L];
      }
      function nearest(maxD, fromX, fromZ) {
        let best = null, bd = maxD;
        for (const e of enemies) { if (e.dead || e.spawn < 1) continue; const d = Math.hypot(e.x - fromX, e.z - fromZ) - e.r; if (d < bd) { bd = d; best = e; } }
        return best;
      }
      function aimAt(e) { if (e) P.face = Math.atan2(e.x - P.x, e.z - P.z); }

      function act(what) {
        if (state !== 'play' || P.dead) return;
        if (what === 'beam' && P.cd.beam <= 0 && P.beamT <= 0) {
          P.cd.beam = TUNE.beam.cd; P.beamT = TUNE.beam.dur; P.beamTick = 0; aimAt(nearest(30, P.x, P.z));
          S.tone(900, 300, .5, 'sawtooth', .03); S.tone(1400, 700, .9, 'square', .015, .05);
        }
        if (what === 'wave' && P.cd.wave <= 0) {
          P.cd.wave = TUNE.wave.cd; P.waveT = .55; P.vy = 9;
          S.noise(.5, .16, 500); S.tone(160, 50, .5, 'sine', .16);
          setTimeout(() => {
            if (state !== 'play') return;
            fx.ring([P.x, .4, P.z], 0x7df3ff, TUNE.wave.radius, .55); fx.ring([P.x, .6, P.z], 0xff4fd8, TUNE.wave.radius * .8, .45);
            fx.burst([P.x, 1, P.z], 46, { colors: [0x7df3ff, 0xff4fd8, 0xffffff, 0xffd23f], speed: 16, life: .6, size: .3, add: true, flat: true, grav: 4 });
            shake = Math.max(shake, .9);
            for (const e of enemies) {
              if (e.dead || e.spawn < 1) continue;
              const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
              if (d < TUNE.wave.radius + e.r) { hurtEnemy(e, TUNE.wave.dmg * P.buff, dx / (d || 1), dz / (d || 1), e.type === 'boss' ? 2 : 16); e.stun = Math.max(e.stun, e.type === 'boss' ? .25 : TUNE.wave.stun); }
            }
            for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i]; if (Math.hypot(o.x - P.x, o.z - P.z) < TUNE.wave.radius + 1) { fx.burst([o.x, o.y, o.z], 6, { colors: [0xff7a9a], speed: 4, life: .3, size: .2, add: true }); scene.remove(o.n); orbs.splice(i, 1); } }
          }, 260);
        }
        if (what === 'dash' && P.cd.dash <= 0) {
          const [mx, mz, L] = moveInput();
          P.dashDir = L > .2 ? [mx / L, mz / L] : [Math.sin(P.face), Math.cos(P.face)];
          P.face = Math.atan2(P.dashDir[0], P.dashDir[1]);
          P.cd.dash = TUNE.dash.cd; P.dashT = TUNE.dash.dur; P.inv = Math.max(P.inv, TUNE.dash.inv);
          S.noise(.18, .08, 2500); S.tone(500, 1200, .12, 'sine', .03);
        }
      }

      function hurtEnemy(e, dmg, nx, nz, kb, crit) {
        if (e.dead) return;
        dmg = Math.round(dmg * (crit ? 1.6 : 1));
        e.hp -= dmg; e.flash = .1;
        e.kx += nx * kb * (e.type === 'golem' ? .35 : 1); e.kz += nz * kb * (e.type === 'golem' ? .35 : 1);
        num(e.x, (e.type === 'boss' ? 8 : e.type === 'golem' ? 6.4 : 3) , e.z, dmg, crit ? 'crit' : '');
        fx.burst([e.x - nx * e.r * .6, 2, e.z - nz * e.r * .6], crit ? 10 : 6, { colors: [0xffffff, 0xffd23f, e.col], speed: 7, life: .35, size: .22, add: true, grav: 6 });
        S.tone(crit ? 380 : 260, 120, .08, 'square', .045); if (crit) S.tone(1200, 1600, .08, 'triangle', .03);
        if (e.hp <= 0) killEnemy(e);
      }
      function killEnemy(e) {
        e.dead = true; kills++;
        const big = e.type === 'boss' ? 4 : e.type === 'golem' ? 2 : 1;
        fx.burst([e.x, 1.5 * big, e.z], 22 * big, { colors: [e.col, 0xffffff, 0x2a2a3a], speed: 9 * Math.sqrt(big), life: .9, size: .35 * Math.sqrt(big), emis: .3 });
        fx.ring([e.x, .3, e.z], 0xffffff, 3 * big, .5);
        S.noise(.3, .1 * big, 800); S.tone(500, 90, .25, 'square', .04);
        scene.remove(e.g);
        if (e.type === 'boss') { queue.length = 0; enemies.forEach(o => { if (!o.dead && o !== e) killEnemy(o); }); }
        if (e.type !== 'boss' && Math.random() < (P.hp < 50 ? .32 : .16)) dropPotion(e.x, e.z);
        hitstop = Math.max(hitstop, e.type === 'boss' ? .4 : .05);
      }
      function hurtHero(dmg, fromX, fromZ, kb) {
        if (P.inv > 0 || P.dead || state !== 'play') return;
        P.hp = Math.max(0, P.hp - dmg); P.inv = .7; P.hurtT = .35;
        const dx = P.x - fromX, dz = P.z - fromZ, d = Math.hypot(dx, dz) || 1;
        P.kx = dx / d * (kb || 8); P.kz = dz / d * (kb || 8);
        num(P.x, 6, P.z, '-' + dmg, 'hurt');
        shake = Math.max(shake, .7); ui.vign.classList.remove('on'); void ui.vign.offsetWidth; ui.vign.classList.add('on');
        S.tone(220, 80, .25, 'sawtooth', .06);
        if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {}
        if (P.hp <= 0) { P.dead = true; P.deadT = 0; deaths++; waveDeaths++; S.tone(400, 60, .9, 'triangle', .08); }
      }

      function startWave(i) {
        waveI = i; const W = WAVES[i]; if (W.baseCap == null) W.baseCap = W.cap; W.cap = W.baseCap;
        queue = W.list.slice(); spawnT = .6; state = 'play';
        ui.wave.textContent = W.boss ? 'Jefe final' : 'Oleada ' + (i + 1) + ' de 3';
        ui.boss.classList.toggle('hidden', !W.boss);
        toast(W.boss ? '¡Cuidado! Llega el Rey Cubo' : 'Oleada ' + (i + 1) + ': ' + W.name, 2.2);
        if (W.boss) { S.tone(90, 45, 1.2, 'sawtooth', .07); shake = 1.2; }
        updateLeft();
      }
      function resetWave() {
        enemies.forEach(e => scene.remove(e.g)); enemies.length = 0;
        orbs.forEach(o => scene.remove(o.n)); orbs.length = 0;
        warns.forEach(w => { scene.remove(w.n); if (w.fill) scene.remove(w.fill); }); warns.length = 0;
        boss = null;
        Object.assign(P, { x: 0, z: 4, hp: TUNE.hp, dead: false, inv: 1.2, beamT: 0, dashT: 0, atkT: 0, kx: 0, kz: 0, y: 0, vy: 0 });
        P.cd.beam = P.cd.wave = P.cd.dash = 0;
        hero.root.rot = [0, 0, 0];
        if (waveDeaths >= 2 && P.buff < 1.25) { P.buff = 1.25; }
      }
      function updateLeft() {
        const alive = enemies.filter(e => !e.dead).length;
        ui.left.textContent = WAVES[waveI].boss ? '' : (alive + queue.length) + (alive + queue.length === 1 ? ' monstruo' : ' monstruos');
      }

      /* ---------- bucle principal ---------- */
      function step(dt) {
        time += state === 'play' ? dt : 0;
        if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.classList.remove('on'); }
        for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
        P.inv = Math.max(0, P.inv - dt); P.hurtT = Math.max(0, P.hurtT - dt);

        if (state === 'count') {
          countT += dt; const n = countT < .8 ? '3' : countT < 1.6 ? '2' : countT < 2.4 ? '1' : countT < 3 ? '¡YA!' : '';
          if (n !== lastCount) { lastCount = n; ui.count.textContent = n; ui.count.classList.remove('pop'); void ui.count.offsetWidth; if (n) { ui.count.classList.add('pop'); S.tone(n === '¡YA!' ? 880 : 440, n === '¡YA!' ? 880 : 440, .15, 'triangle', .05); } }
          if (countT >= 3) startWave(waveI);
        }

        /* --- heroína --- */
        const [mx, mz, ml] = moveInput();
        let sp = 0;
        if (P.dead) {
          P.deadT += dt;
          if (P.deadT > 1.4 && state === 'play') { state = 'lost'; $('#gLose').classList.remove('hidden'); $('#gLoseTxt').textContent = waveDeaths >= 2 ? 'Esta vez vuelves con tus golpes un 25 % más fuertes. ¡Tú puedes!' : 'Vuelves al principio de esta oleada con la vida llena.'; }
        } else if (state === 'play' || state === 'intro' || state === 'count' || state === 'break' || state === 'won') {
          const canMove = state === 'play' || state === 'break';
          if (P.dashT > 0) {
            P.dashT -= dt; P.x += P.dashDir[0] * TUNE.dash.speed * dt; P.z += P.dashDir[1] * TUNE.dash.speed * dt;
            if (Math.random() < .9) fx.burst([P.x, 2.5, P.z], 2, { colors: [0xff4fd8, 0x7df3ff, 0x6c4cf0], speed: 1, life: .3, size: .5, add: true, grav: 0 });
          } else if (canMove && ml > .1) {
            const slow = P.beamT > 0 ? .3 : P.atkT > 0 ? .45 : 1;
            P.x += mx * TUNE.speed * slow * dt; P.z += mz * TUNE.speed * slow * dt; sp = ml * slow;
            const want = Math.atan2(mx, mz); let d = want - P.face; d = Math.atan2(Math.sin(d), Math.cos(d));
            P.face += d * Math.min(1, dt * (P.beamT > 0 ? 3 : 16));
          } else if (P.beamT > 0) {
            const t = nearest(30, P.x, P.z); if (t) { let d = Math.atan2(t.x - P.x, t.z - P.z) - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); P.face += d * Math.min(1, dt * 2.5); }
          }
          if (P.kx || P.kz) { P.x += P.kx * dt; P.z += P.kz * dt; P.kx *= Math.pow(.02, dt); P.kz *= Math.pow(.02, dt); if (Math.abs(P.kx) + Math.abs(P.kz) < .1) P.kx = P.kz = 0; }
          // empuje con los monstruos (no se les atraviesa, salvo esquivando)
          if (P.dashT <= 0) for (const e of enemies) { if (e.dead || e.spawn < 1) continue; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz), m = e.r + .9; if (d < m && d > .001) { P.x = e.x + dx / d * m; P.z = e.z + dz / d * m; } }
          { const dx = P.x, dz = P.z + 14, d = Math.hypot(dx, dz); if (d < 3.2 && d > .001) { P.x = dx / d * 3.2; P.z = -14 + dz / d * 3.2; } }
          const pd = Math.hypot(P.x, P.z); if (pd > ARENA) { P.x *= ARENA / pd; P.z *= ARENA / pd; }
          // salto de la onda
          if (P.vy || P.y > 0) { P.vy -= 30 * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0 && P.vy < 0) { P.vy = 0; } }

          // combo de golpes (mantener pulsado = golpes seguidos)
          P.comboWin = Math.max(0, P.comboWin - dt);
          if (state === 'play' && atkHeld && P.atkT <= 0 && P.beamT <= 0 && P.dashT <= 0) {
            P.atkI = P.comboWin > 0 ? (P.atkI + 1) % 3 : 0;
            P.atkT = P.atkI === 2 ? .38 : .27; P.atkHit = false; P.comboWin = .55;
            const t = nearest(7.5, P.x, P.z); if (t && ml < .2) aimAt(t); else if (t) { const want = Math.atan2(t.x - P.x, t.z - P.z); let d = want - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.2) P.face = want; }
            S.noise(.12, .07, 3200);
          }
          if (P.atkT > 0) {
            const dur = P.atkI === 2 ? .38 : .27; P.atkT -= dt;
            const k = 1 - P.atkT / dur;
            if (!P.atkHit && k > .4) {
              P.atkHit = true;
              const fx0 = Math.sin(P.face), fz0 = Math.cos(P.face);
              const spread = P.atkI === 2 ? 2.2 : 1.25, range = TUNE.comboRange + (P.atkI === 2 ? .8 : 0);
              for (let a = -spread; a <= spread; a += spread / 4) { const ang = P.face + a; fx.burst([P.x + Math.sin(ang) * 2.6, 2.6 + (P.atkI === 1 ? -a * .3 : a * .3), P.z + Math.cos(ang) * 2.6], 1, { colors: [P.atkI === 2 ? 0xffd23f : 0xffffff, 0xff4fd8], speed: .5, life: .22, size: .45, add: true, grav: 0 }); }
              if (P.atkI === 2) fx.ring([P.x, 1.2, P.z], 0xffd23f, range, .3);
              for (const e of enemies) {
                if (e.dead || e.spawn < 1) continue;
                const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) - e.r;
                if (d > range) continue;
                const ang = Math.acos(clamp((dx * fx0 + dz * fz0) / (Math.hypot(dx, dz) || 1), -1, 1));
                if (ang < spread * .55 + .35 || d < .6) { hurtEnemy(e, TUNE.combo[P.atkI] * P.buff, dx / (d + e.r || 1), dz / (d + e.r || 1), P.atkI === 2 ? 13 : 5, Math.random() < .12); hitstop = Math.max(hitstop, P.atkI === 2 ? .07 : .035); }
              }
            }
          }
          // Rayo Píxel
          if (P.beamT > 0) {
            P.beamT -= dt; P.beamTick -= dt;
            const hy = 4.55 + P.y, fx0 = Math.sin(P.face), fz0 = Math.cos(P.face), ox = P.x + fx0 * .7, oz = P.z + fz0 * .7;
            let len = TUNE.beam.len;
            beam.visible = true; beam.at(ox, hy, oz); beam.rot = [.07, P.face, 0];
            const wob = 1 + Math.sin(time * 60) * .15;
            beamCore.scl = [.35 * wob, .35 * wob, len]; beamA.scl = [.9 * wob, .9 * wob, len]; beamB.scl = [1.5, 1.5, len];
            beamA.color = rgb(Math.sin(time * 30) > 0 ? 0xff4fd8 : 0x7df3ff);
            const fade = Math.min(1, P.beamT * 5, (TUNE.beam.dur - P.beamT) * 8); beam.children.forEach((c, i) => { c.alpha = [1, .55, .3][i] * fade; });
            if (Math.random() < .8) { const k = Math.random() * len * .9; fx.burst([ox + fx0 * k, hy - k * .07, oz + fz0 * k], 1, { colors: [0xff4fd8, 0x7df3ff, 0xffffff], speed: 2, life: .3, size: .35, add: true, grav: 0 }); }
            if (P.beamTick <= 0) {
              P.beamTick = TUNE.beam.tick;
              for (const e of enemies) {
                if (e.dead || e.spawn < 1) continue;
                const dx = e.x - ox, dz = e.z - oz, along = dx * fx0 + dz * fz0;
                if (along < -e.r || along > len) continue;
                const perp = Math.abs(dx * fz0 - dz * fx0);
                if (perp < TUNE.beam.width + e.r) hurtEnemy(e, TUNE.beam.dmg * P.buff, fx0, fz0, e.type === 'boss' ? 0 : 3, Math.random() < .08);
              }
              S.tone(1500 + Math.random() * 400, 900, .06, 'square', .012);
            }
          } else beam.visible = false;
        }

        /* --- monstruos --- */
        if (state === 'play') {
          spawnT -= dt;
          const alive = enemies.filter(e => !e.dead).length;
          if (queue.length && spawnT <= 0 && alive < WAVES[waveI].cap) {
            const type = queue.shift(), pt = type === 'boss' ? [0, -5] : PORTALS[(Math.random() * 4) | 0];
            const e = makeEnemy(type, pt[0], pt[1]); if (type === 'boss') { boss = e; e.y = 18; }
            spawnT = 1.1; updateLeft();
          }
        }
        for (const e of enemies) {
          if (e.dead) continue;
          e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt); e.touchCd = Math.max(0, e.touchCd - dt);
          if (e.spawn < 1) {
            e.spawn = Math.min(1, e.spawn + dt * (e.type === 'boss' ? .6 : 1.6));
            if (e.type === 'boss') { e.y = lerp(18, 0, ease.out(e.spawn)); if (e.spawn >= 1) { shake = 1.6; fx.ring([e.x, .3, e.z], 0xff4fd8, 10, .8); fx.burst([e.x, 1, e.z], 50, { colors: [0x5a2ad8, 0xffd23f, 0xffffff], speed: 12, life: 1, size: .4 }); S.noise(.8, .25, 300); S.tone(70, 30, 1, 'sawtooth', .1); e.cd = 1.5; } }
            else e.y = lerp(-4, 0, ease.back(e.spawn));
          } else if (state === 'play' && !P.dead) think(e, dt);
          // retroceso
          e.x += e.kx * dt; e.z += e.kz * dt; e.kx *= Math.pow(.01, dt); e.kz *= Math.pow(.01, dt);
          const d = Math.hypot(e.x, e.z), lim = ARENA + .5 - e.r * .3; if (d > lim) { e.x *= lim / d; e.z *= lim / d; }
        }
        // que no se amontonen
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
          const a = enemies[i], b = enemies[j]; if (a.dead || b.dead) continue;
          const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
          if (d < m && d > .001) { const p = (m - d) / 2, nx = dx / d, nz = dz / d; const wa = a.type === 'boss' ? 0 : 1, wb = b.type === 'boss' ? 0 : 1; a.x -= nx * p * wa * (wb ? 1 : 2); a.z -= nz * p * wa * (wb ? 1 : 2); b.x += nx * p * wb * (wa ? 1 : 2); b.z += nz * p * wb * (wa ? 1 : 2); }
        }
        for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) { enemies.splice(i, 1); updateLeft(); }

        /* --- avisos (círculos rojos) --- */
        for (let i = warns.length - 1; i >= 0; i--) {
          const w = warns[i]; w.t += dt; const k = w.t / w.time;
          w.n.alpha = .18 + .2 * (Math.sin(w.t * 22) * .5 + .5);
          if (w.fill) { const s = w.r * 2 * k; w.fill.scl = [s, .07, s]; }
          if (k >= 1) { scene.remove(w.n); if (w.fill) scene.remove(w.fill); warns.splice(i, 1); if (state === 'play') w.onEnd(); }
        }
        /* --- bolas de energía --- */
        for (let i = orbs.length - 1; i >= 0; i--) {
          const o = orbs[i]; o.life -= dt; o.x += o.vx * dt; o.z += o.vz * dt;
          o.n.at(o.x, o.y, o.z); o.halo.alpha = .3 + Math.sin(time * 20) * .1;
          if (Math.hypot(o.x - P.x, o.z - P.z) < 1.3 && P.y < 2.5 && !P.dead) { hurtHero(o.dmg, o.x - o.vx, o.z - o.vz, 6); fx.burst([o.x, o.y, o.z], 8, { colors: [0xff2a5a, 0xffffff], speed: 5, life: .35, size: .22, add: true }); scene.remove(o.n); orbs.splice(i, 1); continue; }
          if (o.life <= 0 || Math.hypot(o.x, o.z) > 26) { scene.remove(o.n); orbs.splice(i, 1); }
        }
        /* --- pociones --- */
        for (let i = potions.length - 1; i >= 0; i--) {
          const q = potions[i]; q.t += dt; q.n.pos[1] = .7 + Math.sin(q.t * 3) * .2; q.n.rot[1] = q.t * 2; q.halo.alpha = .2 + Math.sin(q.t * 5) * .08;
          if (Math.hypot(q.x - P.x, q.z - P.z) < 1.8 && !P.dead) {
            const before = P.hp; P.hp = Math.min(TUNE.hp, P.hp + TUNE.potion);
            num(P.x, 6, P.z, '+' + (P.hp - before), 'heal'); fx.burst([P.x, 2.5, P.z], 16, { colors: [0x6ee07a, 0xffffff], speed: 4, life: .7, size: .25, add: true, grav: -4 });
            S.tone(660, 990, .18, 'triangle', .05); scene.remove(q.n); potions.splice(i, 1);
          } else if (q.t > 14) { scene.remove(q.n); potions.splice(i, 1); }
        }

        /* --- fin de oleada --- */
        if (state === 'play' && !queue.length && !enemies.length && !P.dead) {
          if (WAVES[waveI].boss) { state = 'won'; winT = 0; slowmo = .25; win(); }
          else {
            state = 'break'; breakT = 2.8; const before = P.hp; P.hp = Math.min(TUNE.hp, P.hp + TUNE.betweenWaves);
            toast('¡Oleada superada! +' + (P.hp - before) + ' de vida', 2.4); S.tone(660, 660, .12, 'triangle', .05); S.tone(990, 990, .2, 'triangle', .05, .12);
            waveDeaths = 0;
          }
        }
        if (state === 'break') { breakT -= dt; if (breakT <= 0) startWave(waveI + 1); }
        if (state === 'won') { winT += dt; slowmo = lerp(slowmo, 1, dt * 1.5); }

        /* --- poner los modelos en su sitio --- */
        hero.root.at(P.x, P.y, P.z); hero.root.rot[1] = P.face;
        hero.root.visible = !(P.inv > 0 && !P.dead && P.dashT <= 0 && state === 'play' && Math.sin(time * 40) > .6);
        const atkK = P.atkT > 0 ? 1 - P.atkT / (P.atkI === 2 ? .38 : .27) : 0;
        hero.animate(dt, P.dashT > 0 ? 1 : sp, (H, A) => {
          if (P.dead) { A.body.rot[0] = -Math.min(1.4, P.deadT * 3); A.body.pos[1] = .3; return; }
          if (state === 'intro') { H.armR.rot[2] = 2.6 + Math.sin(A.t * 8) * .3; }
          if (state === 'won') { H.armR.rot[2] = 2.8 + Math.sin(A.t * 10) * .2; H.armL.rot[2] = -2.8 - Math.sin(A.t * 10) * .2; A.body.pos[1] = Math.abs(Math.sin(A.t * 6)) * .6; }
          if (P.dashT > 0) { A.body.rot[0] = .5; H.armL.rot[0] = 1; H.armR.rot[0] = 1; }
          if (P.atkT > 0) {
            const s = Math.sin(atkK * Math.PI);
            if (P.atkI === 0) { H.armR.rot[0] = -1.6 * s - .2; A.body.rot[1] = .3 * s; }
            else if (P.atkI === 1) { H.armL.rot[0] = -1.6 * s - .2; A.body.rot[1] = -.3 * s; }
            else { A.body.rot[1] = atkK * TAU; H.armL.rot[2] = -1.5; H.armR.rot[2] = 1.5; A.body.pos[1] += s * .8; }
          }
          if (P.beamT > 0) { H.head.rot[0] = .1; H.armL.rot[0] = -.4; H.armR.rot[0] = -.4; }
          if (P.waveT > 0) { H.armL.rot[2] = -2.9; H.armR.rot[2] = 2.9; }
          if (P.hurtT > 0) { A.body.rot[0] = -.25; }
          H.lens.forEach(l => { l.alpha = P.beamT > 0 ? .9 : (P.cd.beam <= 0 ? .25 + Math.sin(A.t * 4) * .15 : 0); });
        });
        P.waveT = Math.max(0, P.waveT - dt);
        for (const e of enemies) poseEnemy(e, dt);
        portalNodes.forEach((p, i) => { p.rot[1] = time * (1 + i * .2); p.alpha = .4 + Math.sin(time * 3 + i) * .15; });

        /* --- jaula del regalo --- */
        if (state === 'won') {
          const k = clamp((winT - .6) / 1.2, 0, 1);
          bars.forEach((b, i) => { b.pos[1] = 2.1 + ease.out(k) * (6 + i % 3); b.alpha = 1 - k; b.rot[2] = k * (i % 2 ? 2 : -2); });
          cageTop.pos[1] = 4.3 + ease.out(k) * 9; cageTop.alpha = 1 - k;
          giftBox.pos[1] = Math.sin(winT * 3) * .3 + k * 1.2; giftBox.rot[1] = winT * 1.4;
          if (winT > .6 && winT < .7) fx.burst([0, 3, -14], 40, { colors: [0xffd23f, 0x6ee07a, 0xff4fd8, 0x7df3ff, 0xffffff], speed: 12, life: 1.6, size: .35, add: true, grav: 6 });
        } else giftBox.rot[1] = time * .6;
      }

      /* ---------- inteligencia de los monstruos ---------- */
      function think(e, dt) {
        if (e.stun > 0) return;
        const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
        const want = Math.atan2(dx, dz); let df = want - e.face; df = Math.atan2(Math.sin(df), Math.cos(df));
        e.cd -= dt;
        if (e.type === 'slime') {
          e.face += df * Math.min(1, dt * 6);
          const hop = Math.sin(e.t * 7) > 0;
          if (hop) { e.x += nx * EN.slime.speed * 1.6 * dt; e.z += nz * EN.slime.speed * 1.6 * dt; }
          if (d < e.r + 1.2 && e.touchCd <= 0) { e.touchCd = 1.1; hurtHero(EN.slime.touch, e.x, e.z, 9); }
        } else if (e.type === 'eye') {
          e.face += df * Math.min(1, dt * 5);
          const keep = d < 8 ? -1 : d > 11 ? 1 : 0;
          const side = Math.sin(e.t * .8 + e.x) > 0 ? 1 : -1;
          e.x += (nx * keep + -nz * side * .6) * EN.eye.speed * dt; e.z += (nz * keep + nx * side * .6) * EN.eye.speed * dt;
          if (e.cd < .55 && !e.charging) { e.charging = true; S.tone(700, 1100, .4, 'sine', .015); }
          if (e.cd <= 0) { e.cd = 2.4 + Math.random() * .8; e.charging = false; shoot(e.x + nx * 1, 2.6, e.z + nz * 1, want, 10, EN.eye.orb); S.tone(600, 200, .2, 'square', .025); }
        } else if (e.type === 'golem') {
          if (e.state === 'move') {
            e.face += df * Math.min(1, dt * 3);
            if (d > 3.5) { e.x += nx * EN.golem.speed * dt; e.z += nz * EN.golem.speed * dt; }
            if (d < 5 && e.cd <= 0) {
              e.state = 'slam'; e.st = 0;
              const cx = e.x + Math.sin(e.face) * 2.6, cz = e.z + Math.cos(e.face) * 2.6;
              warn('circle', cx, cz, 4, 1.05, () => {
                shake = Math.max(shake, 1); fx.ring([cx, .3, cz], 0xffd88a, 4.5, .5); fx.burst([cx, .5, cz], 24, { colors: [0x7a7e8e, 0xb0a890], speed: 9, life: .6, size: .35, emis: .2 });
                S.noise(.4, .2, 250); S.tone(80, 40, .4, 'sine', .14);
                if (Math.hypot(P.x - cx, P.z - cz) < 4.5) hurtHero(EN.golem.slam, cx, cz, 14);
                e.state = 'recover'; e.st = 0;
              });
            }
          } else if (e.state === 'slam') { e.st += dt; }
          else if (e.state === 'recover') { e.st += dt; if (e.st > .8) { e.state = 'move'; e.cd = 2.2; } }
        } else if (e.type === 'boss') bossThink(e, dt, d, nx, nz, want, df);
      }
      function bossThink(e, dt, d, nx, nz, want, df) {
        const fast = e.hp < e.max * .5;
        if (fast && e.phase === 1) { e.phase = 2; toast('¡El Rey Cubo se ha enfadado!', 2); shake = 1.4; S.tone(80, 40, 1.2, 'sawtooth', .1); e.meshes[0].setColor(0x8a1ad8); }
        if (e.summon.length && e.hp < e.max * e.summon[0]) {
          e.summon.shift(); toast('¡Llama a sus esbirros!', 1.6);
          ['slime', 'slime', 'eye'].forEach((t, i) => queue.push(t));
          WAVES[waveI].cap = 5; spawnT = .4;
        }
        const tele = fast ? .75 : 1.05;
        if (e.state === 'move') {
          e.face += df * Math.min(1, dt * 2.5);
          if (d > 7) { e.x += nx * EN.boss.speed * (fast ? 1.25 : 1) * dt; e.z += nz * EN.boss.speed * (fast ? 1.25 : 1) * dt; }
          if (e.cd <= 0) {
            const a = e.next; e.next = { slam: 'orbs', orbs: 'charge', charge: 'slam' }[a];
            if (a === 'slam') {
              e.state = 'jump'; e.st = 0; e.from = [e.x, e.z]; e.to = [P.x, P.z];
              warn('circle', P.x, P.z, 5.2, tele + .25, () => {}, {});
              S.tone(200, 500, .5, 'sawtooth', .04);
            } else if (a === 'orbs') {
              e.state = 'orbs'; e.st = 0; e.shots = fast ? 3 : 2;
            } else {
              e.state = 'aim'; e.st = 0; e.ang = want;
              e.w = warn('line', e.x + Math.sin(want) * 13, e.z + Math.cos(want) * 13, 5.6, tele, () => { e.state = 'charge'; e.st = 0; S.noise(.6, .12, 600); }, { ang: want, len: 26 });
            }
          }
        } else if (e.state === 'jump') {
          e.st += dt; const T = tele + .25, k = clamp(e.st / T, 0, 1);
          e.x = lerp(e.from[0], e.to[0], ease.inOut(k)); e.z = lerp(e.from[1], e.to[1], ease.inOut(k)); e.y = Math.sin(k * Math.PI) * 9;
          if (k >= 1) {
            e.y = 0; e.state = 'recover'; e.st = 0; shake = 1.6;
            fx.ring([e.x, .3, e.z], 0xff4fd8, 7, .6); fx.ring([e.x, .3, e.z], 0xffd23f, 5, .45);
            fx.burst([e.x, .5, e.z], 40, { colors: [0x5a2ad8, 0xffd23f, 0xffffff], speed: 12, life: .8, size: .4 });
            S.noise(.6, .3, 220); S.tone(70, 30, .6, 'sine', .16);
            if (Math.hypot(P.x - e.x, P.z - e.z) < 5.2 + .6) hurtHero(22, e.x, e.z, 16);
          }
        } else if (e.state === 'orbs') {
          e.st += dt; e.crown.rot[1] += dt * 8;
          if (e.st > .7) {
            e.st = 0; e.shots--;
            const n = fast ? 14 : 12, off = e.shots * .22;
            for (let i = 0; i < n; i++) shoot(e.x, 2.6, e.z, i / n * TAU + off, fast ? 9.5 : 8, 12);
            S.tone(300, 900, .25, 'square', .04); fx.ring([e.x, 2.6, e.z], 0xff2a5a, 4, .3);
            if (e.shots <= 0) { e.state = 'recover'; e.st = 0; }
          }
        } else if (e.state === 'aim') {
          e.face = e.ang;
        } else if (e.state === 'charge') {
          e.st += dt; const v = 30;
          e.x += Math.sin(e.ang) * v * dt; e.z += Math.cos(e.ang) * v * dt;
          if (Math.random() < .7) fx.burst([e.x, 1, e.z], 2, { colors: [0x5a2ad8, 0xffffff], speed: 3, life: .4, size: .5 });
          if (Math.hypot(P.x - e.x, P.z - e.z) < e.r + 1) hurtHero(20, e.x - Math.sin(e.ang) * 3, e.z - Math.cos(e.ang) * 3, 18);
          if (e.st > .85 || Math.hypot(e.x, e.z) > ARENA - 1) { e.state = 'recover'; e.st = 0; shake = .8; }
        } else if (e.state === 'recover') {
          e.st += dt; if (e.st > (fast ? .9 : 1.4)) { e.state = 'move'; e.cd = fast ? .5 : 1; }
        }
        ui.bossFill.style.width = Math.max(0, e.hp / e.max * 100) + '%';
      }
      function poseEnemy(e, dt) {
        e.g.at(e.x, e.y, e.z); e.g.rot[1] = e.face;
        const s = e.type === 'boss' ? 1 : clamp(e.spawn * 1.2, 0, 1);
        e.g.scl = [s, s, s];
        e.meshes.forEach((m, i) => { m.emis = e.flash > 0 ? 1 : (e.stun > 0 ? .5 : e.baseEmis[i]); });
        if (e.type === 'slime') { const h = Math.max(0, Math.sin(e.t * 7)); e.body.pos[1] = h * 1.2; e.body.scl = [1 + (1 - h) * .15, 1 - (1 - h) * .15 + h * .1, 1 + (1 - h) * .15]; }
        if (e.type === 'eye') { e.body.pos[1] = e.hover + Math.sin(e.t * 3) * .3; e.wl.rot[2] = Math.sin(e.t * 16) * .6; e.wr.rot[2] = -Math.sin(e.t * 16) * .6; e.pupil.scl = e.charging ? [.7, .7, .3] : [.5, .5, .3]; e.pupil.emis = e.charging ? 1 : .6; }
        if (e.type === 'golem') {
          const w = e.state === 'move' ? Math.sin(e.t * 5) * .4 : 0;
          e.al.rot[0] = e.state === 'slam' ? -2.6 : -w; e.ar.rot[0] = e.state === 'slam' ? -2.6 : w;
          e.body.pos[1] = e.state === 'slam' ? .3 : Math.abs(Math.sin(e.t * 5)) * .15;
        }
        if (e.type === 'boss') {
          e.body.scl = e.state === 'recover' && e.st < .2 ? [1.12, .85, 1.12] : [1, 1 + Math.sin(e.t * 3) * .03, 1];
          e.al.pos[1] = 3.6 + Math.sin(e.t * 4) * .3; e.ar.pos[1] = 3.6 - Math.sin(e.t * 4) * .3;
          e.shadow.scl = [EN.boss.r * 2.4 * (1 - e.y / 14), .02, EN.boss.r * 2.4 * (1 - e.y / 14)];
          e.shadow.pos[1] = .04 - e.y;
        }
      }

      /* ---------- victoria ---------- */
      function win() {
        S.tone(523, 523, .15, 'triangle', .06); S.tone(659, 659, .15, 'triangle', .06, .15); S.tone(784, 784, .15, 'triangle', .06, .3); S.tone(1047, 1047, .4, 'triangle', .07, .45);
        toast('¡Has derrotado al Rey Cubo!', 3);
        ui.boss.classList.add('hidden');
        orbs.forEach(o => scene.remove(o.n)); orbs.length = 0;
        warns.forEach(w => { scene.remove(w.n); if (w.fill) scene.remove(w.fill); }); warns.length = 0;
        setTimeout(() => {
          const m = Math.floor(time / 60), s = Math.round(time % 60);
          $('#gWinStats').textContent = `Tiempo: ${m} min ${s} s · ${kills} monstruos · ${deaths} ${deaths === 1 ? 'derrota' : 'derrotas'}`;
          $('#gWin').classList.remove('hidden');
        }, 3200);
      }

      /* ---------- dibujar ---------- */
      const cam = { pos: [0, 20, 20], target: [0, 0, 0], fov: 44 };
      function render(dt) {
        R.resize();
        const asp = R.W / R.H;
        let tx = P.x, tz = P.z, dist, pitch = .98, fit = 23;
        if (state === 'intro') { tx = P.x; tz = P.z; dist = 15; pitch = .3; fit = 10; }
        camS.x = lerp(camS.x, tx, Math.min(1, dt * 6)); camS.z = lerp(camS.z, tz, Math.min(1, dt * 6));
        const vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
        if (state !== 'intro') { if (boss && !boss.dead) fit = 27; dist = Math.max(22, (fit / 2) / Math.tan(hf / 2)); }
        else dist = Math.max(dist, (fit / 2) / Math.tan(hf / 2));
        const shx = (Math.random() - .5) * shake, shy = (Math.random() - .5) * shake; shake *= Math.pow(.015, dt);
        const yaw = state === 'intro' ? Math.sin(time * .3 + performance.now() / 4000) * .5 : 0;
        cam.target = [camS.x + shx * .3, (state === 'intro' ? 3 : 1) + shy * .3, camS.z - (state === 'intro' ? 0 : 1.5)];
        cam.pos = [cam.target[0] + Math.sin(yaw) * Math.cos(pitch) * dist + shx, cam.target[1] + Math.sin(pitch) * dist + shy, cam.target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
        cam.shiftY = state === 'intro' ? -.42 : -.05;
        R.render(scene, cam);
        // números flotantes
        for (let i = nums.length - 1; i >= 0; i--) {
          const n = nums[i]; n.t += dt; const p = R.project([n.x, n.y + n.t * 2.2, n.z]);
          n.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${1 + Math.max(0, .25 - n.t) * 2})`;
          n.el.style.opacity = Math.min(1, (1 - n.t / .9) * 2);
          if (n.t > .9) { n.el.remove(); nums.splice(i, 1); }
        }
        // interfaz
        ui.hp.style.width = (P.hp / TUNE.hp * 100) + '%'; ui.hpTxt.textContent = Math.ceil(P.hp);
        ui.hp.parentElement.classList.toggle('low', P.hp < 35);
        const setCd = (el, cd, max) => { el.style.setProperty('--cd', (cd / max * 360) + 'deg'); el.classList.toggle('ready', cd <= 0); el.dataset.s = cd > 0 ? Math.ceil(cd) : ''; };
        setCd(ui.sk.beam, P.cd.beam, TUNE.beam.cd); setCd(ui.sk.wave, P.cd.wave, TUNE.wave.cd); setCd(ui.sk.dash, P.cd.dash, TUNE.dash.cd);
      }

      let running = true, raf = 0, last = 0, acc = 0;
      function frame(ts) {
        if (!running) return;
        let dt = Math.min(.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        let sdt = dt * slowmo;
        if (hitstop > 0) { hitstop -= dt; sdt *= .08; }
        acc += sdt; const h = 1 / 120; let n = 0;
        while (acc >= h && n < 12) { step(h); acc -= h; n++; }
        if (n === 12) acc = 0;
        fx.update(sdt);
        render(dt);
        raf = requestAnimationFrame(frame);
      }

      /* ---------- arranque ---------- */
      $('#gIntro').classList.remove('hidden'); $('#gWin').classList.add('hidden'); $('#gLose').classList.add('hidden');
      ui.boss.classList.add('hidden'); ui.wave.textContent = ''; ui.left.textContent = '';
      root.classList.add('g-intro');
      $('#gStart').onclick = () => { S.unlock(); $('#gIntro').classList.add('hidden'); root.classList.remove('g-intro'); state = 'count'; countT = 0; lastCount = ''; P.face = Math.PI; };
      $('#gRetry').onclick = () => { $('#gLose').classList.add('hidden'); resetWave(); state = 'count'; countT = 0; lastCount = ''; queue = []; ui.wave.textContent = ''; };
      $('#gWinBtn').onclick = () => {
        running = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku);
        nums.forEach(n => n.el.remove());
        resolve({ deaths, time });
      };
      // utilidades para probar (no afectan al juego)
      G.__juego = { P, enemies, get state() { return state; }, set state(v) { state = v; }, start: () => $('#gStart').click(), act, setWave: i => { waveI = i; }, killAll: () => enemies.forEach(e => { if (!e.dead) killEnemy(e); }), hurtEnemy, get queue() { return queue; } };
      raf = requestAnimationFrame(frame);
    });
  }

  G.Juego = { play };
})(window);
