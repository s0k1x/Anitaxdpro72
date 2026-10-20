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
    potion: 28, betweenWaves: 35,
    ult: { gain: .3, gem: 3, meteors: 12, dmg: 46, radius: 3.6 }
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
        sk: { atk: $('#skAtk'), beam: $('#skBeam'), wave: $('#skWave'), dash: $('#skDash'), ult: $('#skUlt') },
        ultFill: $('#gUltFill'), combo: $('#gCombo'), ultFx: $('#gUltFx')
      };
      let toastT = 0;
      function toast(msg, t) { ui.toast.textContent = msg; ui.toast.classList.add('on'); toastT = t || 1.8; }

      /* ---------- el mundo: una arena flotante sobre la lava ---------- */
      const scene = group(), fx = new FX(scene);
      R.setEnv({ sky: 0xc9b8ff, gnd: 0x8a3a2a, sun: 0xfff0f8, fog: 0x3a1438, fogNear: 45, fogFar: 160, light: [.4, .85, .35], amb: .64, sunK: .72, shadowArea: 22,
        skyTop: 0x06021a, skyMid: 0x4a1a4a, skyBot: 0xa83a1a, sunDir: [-.3, .5, -.8], sunCol: 0xffd0f0, sunDisc: .5, stars: 1, clouds: .3, cloudCol: 0x8a3a6a });
      R.grade = Object.assign(R.grade, { exp: 1.14, sat: 1.12, con: 1.06, tint: [1.03, .97, 1.02], lift: [.03, 0, .04], bloom: 1, tilt: .55, tiltC: .5, vig: .4, grain: .02 });
      cv.style.background = '#000';
      const st = group();
      // suelo de losetas redondeadas, con anillos y tonos variados
      for (let x = -19; x <= 19; x += 2) for (let z = -19; z <= 19; z += 2) {
        const d = Math.hypot(x, z); if (d > 18.6) continue;
        const ring = Math.floor(d / 4.5), alt = ((x + z) / 2 & 1);
        box(st, 1.9, .7, 1.9, ring % 2 ? (alt ? 0x342a66 : 0x3a2f72) : (alt ? 0x2a2256 : 0x30275e), x, -.35, z, { r: .18, shine: .5 });
      }
      // círculo de runas brillante
      mesh(st, geo.hair, 0x9b82ff, 13, .5, 13, 0, .02, 0, { emis: .9 }); mesh(st, geo.hair, 0xff4fd8, 25, .5, 25, 0, .02, 0, { emis: .7 }); mesh(st, geo.hair, 0x7df3ff, 6.4, .5, 6.4, 0, .02, 0, { emis: .9 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; mesh(st, geo.oct, i % 2 ? 0x7df3ff : 0xff4fd8, .5, .1, .9, Math.cos(a) * 9.4, .05, Math.sin(a) * 9.4, { emis: 1, rot: [0, -a, 0] }); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; box(st, .18, .05, 6, 0x9b82ff, Math.cos(a) * 3.2, .03, Math.sin(a) * 3.2, { r: 0, emis: .8, rot: [0, -a + Math.PI / 2, 0] }); }
      // borde de piedra y base de la isla
      mesh(st, geo.cyl20, 0x241a48, 39, 3.5, 39, 0, -2.4, 0);
      mesh(st, geo.cone6, 0x2a1e50, 37, 12, 37, 0, -10, 0, { rot: [Math.PI, .2, 0] });
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; box(st, 1.6, .9 + (i % 3) * .35, 1.5, i % 2 ? 0x4a3a8a : 0x55459a, Math.cos(a) * 19.3, .35, Math.sin(a) * 19.3, { r: .35, rot: [0, -a, 0] }); }
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + .1; M.rock(st, Math.cos(a) * 18, -5 - (i % 4), Math.sin(a) * 18, 1.4 + (i % 3) * .6, 0x3a2c6a); }
      // pilares con cristales y antorchas
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + .2, x = Math.cos(a) * 20.6, z = Math.sin(a) * 20.6;
        box(st, 2.4, .8, 2.4, 0x4a3a8a, x, .4, z, { r: .3 }); box(st, 1.8, 6, 1.8, 0x3a2c6e, x, 3.6, z, { r: .4 }); box(st, 2.5, .6, 2.5, 0x55459a, x, 6.8, z, { r: .25 });
        for (let k = 0; k < 3; k++) box(st, 1.84, .14, 1.84, 0x9b82ff, x, 1.8 + k * 1.6, z, { r: .05, emis: .6 });
        mesh(st, geo.gem, i % 2 ? 0xff4fd8 : 0x7df3ff, 1.3, 2.4, 1.3, x, 8.6, z, { emis: 1 });
        // estandarte
        box(st, 1.3, 2.6, .1, i % 2 ? 0x8a2ad8 : 0x2a6ad8, x - Math.sin(a) * 0, 4.2, z, { r: .05, rot: [0, -a + Math.PI / 2, 0] });
      }
      // lava
      mesh(st, geo.cyl20, 0x9a2410, 420, .2, 420, 0, -16, 0, { emis: .9 });
      for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, d = 30 + Math.random() * 70; mesh(st, geo.cyl20, Math.random() < .5 ? 0xff6a1a : 0xd84a14, 2 + Math.random() * 5, .3, 2 + Math.random() * 5, Math.cos(a) * d, -15.8, Math.sin(a) * d, { emis: 1, vary: false }); }
      for (let i = 0; i < 22; i++) { const a = Math.random() * TAU, d = 30 + Math.random() * 40; M.rock(st, Math.cos(a) * d, -16, Math.sin(a) * d, 2 + Math.random() * 4, 0x2a2030); }
      for (let i = 0; i < 160; i++) { const a = Math.random() * TAU, e = .15 + Math.random() * 1.2, r = 150, s = .4 + Math.random() * .7; mesh(st, geo.oct, 0xffffff, s, s, s, Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, { emis: 1, vary: false }); }
      scene.add(bake(st, 31));
      // islas flotantes con cristales (se mecen)
      const floaters = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .5, d = 30 + (i % 2) * 8, g = group().at(Math.cos(a) * d, 2 + (i % 3) * 3, Math.sin(a) * d); scene.add(g);
        const s = group(); box(s, 4, 1, 4, 0x3a2c6e, 0, 0, 0, { r: .4 }); mesh(s, geo.cone6, 0x2a1e50, 4.4, 4, 4.4, 0, -2.4, 0, { rot: [Math.PI, 0, 0] });
        mesh(s, geo.gem, i % 2 ? 0xff4fd8 : 0x7df3ff, 1.2, 2.6, 1.2, -.6, 1.6, .2, { emis: 1 }); mesh(s, geo.gem, 0xc9bcff, .8, 1.6, .8, .8, 1.1, -.4, { emis: 1 });
        g.add(bake(s, 40 + i)); floaters.push({ g, y: g.pos[1], ph: i });
      }
      const embers = new M.Motes(scene, { n: 70, area: [70, 26, 70], center: [0, -2, 0], color: 0xffa040, size: .16, speed: .8, fall: -2.5 });
      const sparks = new M.Motes(scene, { n: 30, area: [34, 8, 34], center: [0, 4, 0], color: 0xc9bcff, size: .1, speed: .5 });
      // antorchas con fuego
      const torches = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2 + Math.PI / 8, x = Math.cos(a) * 19.3, z = Math.sin(a) * 19.3; mesh(scene, geo.cyl, 0x3a2c6e, .4, 2.4, .4, x, 1.9, z); mesh(scene, geo.custom(10, .55, .3), 0x55459a, .9, .5, .9, x, 3.2, z); torches.push([x, 3.6, z]); mesh(scene, geo.ball, 0xff9a3a, 1.2, 1.5, 1.2, x, 3.8, z, { emis: 1, add: true, alpha: .3, cast: false }); }
      // portales por donde salen los monstruos
      const PORTALS = [0, 1, 2, 3].map(i => { const a = i / 4 * TAU + Math.PI / 4; return [Math.cos(a) * 15, Math.sin(a) * 15]; });
      const portalNodes = PORTALS.map(([x, z]) => { mesh(scene, geo.cyl20, 0x1a0a30, 3.6, .08, 3.6, x, .04, z); const p = mesh(scene, geo.torus, 0xff4fd8, 4, 4, 4, x, .15, z, { emis: 1, add: true, alpha: .55 }); return p; });
      // la caja del regalo, encerrada en una jaula... hasta que ganes
      const cage = group().at(0, 0, -14); scene.add(cage);
      mesh(cage, geo.cyl20, 0x55459a, 6, .5, 6, 0, .25, 0); mesh(cage, geo.thin, 0xffd23f, 6, .5, 6, 0, .5, 0, { emis: .8 });
      const giftBox = group().at(0, .5, 0); cage.add(giftBox);
      box(giftBox, 2.2, 2, 2.2, 0x6ee07a, 0, 1, 0, { shine: .8 }); box(giftBox, 2.5, .55, 2.5, 0x4ac05a, 0, 2.2, 0, { shine: .8 });
      box(giftBox, .42, 2.6, 2.3, 0xffd23f, 0, 1.25, 0, { emis: .3, r: .1 }); box(giftBox, 2.3, 2.6, .42, 0xffd23f, 0, 1.25, 0, { emis: .3, r: .1 });
      box(giftBox, 1, .7, .4, 0xffd23f, -.45, 2.75, 0, { rot: [0, 0, .5], emis: .3 }); box(giftBox, 1, .7, .4, 0xffd23f, .45, 2.75, 0, { rot: [0, 0, -.5], emis: .3 });
      mesh(giftBox, geo.ball, 0xffd23f, 4, 4, 4, 0, 1.4, 0, { emis: 1, add: true, alpha: .12, cast: false });
      const bars = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; bars.push(mesh(cage, geo.cyl, 0x9aa0b8, .26, 4.4, .26, Math.cos(a) * 2.3, 2.6, Math.sin(a) * 2.3, { shine: 1 })); }
      const cageTop = mesh(cage, geo.cyl20, 0x6a6e88, 5.4, .4, 5.4, 0, 4.9, 0, { shine: .9 });
      const lock = mesh(cage, geo.ball, 0xffd23f, .9, .9, .5, 0, 2.6, 2.4, { emis: .3, shine: 1 });

      /* ---------- la heroína ---------- */
      const hero = avatar(Object.assign({ blend: 24 }, HERO)); scene.add(hero.root);
      const P = { x: 0, z: 4, face: 0, hp: TUNE.hp, inv: 0, hurtT: 0, atkT: 0, atkI: 0, atkHit: false, comboWin: 0, atkDur: .3,
        beamT: 0, beamTick: 0, dashT: 0, dashDir: [0, 0], cd: { beam: 0, wave: 0, dash: 0 }, waveT: 0, dead: false, deadT: 0, buff: 1, y: 0, vy: 0,
        slam: false, ult: 0, ultT: 0, kx: 0, kz: 0, ghostT: 0 };
      // la Espada Píxel: empuñadura dorada y hoja de cristal que cambia de color
      const sword = group(); hero.P.armR.add(sword); sword.at(0, -1.72, .12); sword.rot[0] = Math.PI / 2;
      mesh(sword, geo.cyl, 0x4a2a6a, .22, .75, .22, 0, -.38, 0); mesh(sword, geo.ballS, 0xffd23f, .3, .3, .3, 0, -.8, 0, { emis: .4, shine: 1 });
      box(sword, 1.1, .2, .36, 0xffd23f, 0, .05, 0, { emis: .3, shine: 1 }); mesh(sword, geo.gem, 0xff4fd8, .3, .3, .3, 0, .05, .2, { emis: 1 });
      const blade = box(sword, .36, 3, .12, 0xff9ae8, 0, 1.65, 0, { emis: .75, shine: 1, r: .05 });
      const tip = box(sword, .26, .26, .12, 0xff9ae8, 0, 3.15, 0, { emis: .75, r: .02, rot: [0, 0, Math.PI / 4] });
      const bladeGlow = box(sword, .8, 3.5, .36, 0xff4fd8, 0, 1.7, 0, { emis: 1, add: true, alpha: .22, r: .15, cast: false });
      // copias fantasma al esquivar
      const ghosts = [0, 1, 2, 3, 4, 5].map(() => {
        const g = group(); scene.add(g); g.visible = false;
        const o = { emis: 1, add: true, alpha: 0, cast: false };
        box(g, 2, 1.9, 1, 0xc9bcff, 0, 2.85, 0, o); box(g, 1.3, 1.25, 1.25, 0xc9bcff, 0, 4.42, 0, o); box(g, 1.9, 1.9, .9, 0xc9bcff, 0, .95, 0, o); box(g, .9, 1.85, .9, 0xff9ae8, -1.47, 2.8, 0, o); box(g, .9, 1.85, .9, 0xff9ae8, 1.47, 2.8, 0, o);
        return { g, t: 0 };
      });
      let ghostI = 0;
      function spawnGhost() { const q = ghosts[ghostI++ % ghosts.length]; q.g.visible = true; q.g.at(P.x, P.y, P.z); q.g.rot[1] = P.face; q.t = .4; }
      // gemas que sueltan los monstruos (cargan el Poder Estelar)
      const gems = [];
      function dropGems(x, z, n) {
        for (let i = 0; i < n; i++) {
          const g = mesh(scene, geo.gem, Math.random() < .5 ? 0x7df3ff : 0xff4fd8, .55, .75, .55, x, 1.5, z, { emis: .9, shine: 1, cast: false });
          const a = Math.random() * TAU, sp = 3 + Math.random() * 4;
          gems.push({ n: g, x, y: 1.5, z, vx: Math.cos(a) * sp, vy: 7 + Math.random() * 4, vz: Math.sin(a) * sp, t: 0 });
        }
      }
      // meteoritos del súper-ataque
      const meteors = [];
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
        body.outlined(0x12081e, type === 'boss' ? .09 : .055);
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
        if (k === 'u' || k === 'v') act('ult');
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
      const look = $('#gLookZone'); let lookId = null, lx = 0, ly = 0;
      look.addEventListener('pointerdown', e => { if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (_) {} });
      look.addEventListener('pointermove', e => { if (e.pointerId !== lookId) return; camYaw -= (e.clientX - lx) * .0075; camPitch = clamp(camPitch + (e.clientY - ly) * .004, .14, .85); lx = e.clientX; ly = e.clientY; lookT = 0; });
      const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
      look.addEventListener('pointerup', lookEnd); look.addEventListener('pointercancel', lookEnd);
      const hold = (el, down, up) => {
        el.addEventListener('pointerdown', e => { e.preventDefault(); S.unlock(); el.classList.add('held'); down(); });
        const end = () => { el.classList.remove('held'); if (up) up(); };
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
      };
      hold(ui.sk.atk, () => { atkHeld = true; }, () => { atkHeld = false; });
      hold(ui.sk.beam, () => act('beam'));
      hold(ui.sk.wave, () => act('wave'));
      hold(ui.sk.dash, () => act('dash'));
      hold(ui.sk.ult, () => act('ult'));

      /* ---------- estado ---------- */
      let state = 'intro', waveI = Math.max(0, Math.min(3, (opts.startCp | 0))), queue = [], spawnT = 0, breakT = 0, countT = 0, lastCount = '';
      let deaths = 0, waveDeaths = 0, time = 0, hitstop = 0, shake = 0, slowmo = 1, winT = 0, kills = 0;
      let boss = null;
      const camS = { x: 0, z: 4 };
      let camYaw = Math.PI, camPitch = .36, lookT = 9, camY = 3.4, camDist = 0;

      // controles relativos a la cámara: arriba = hacia donde mira la cámara
      function moveInput() {
        let jx = joy.x, jy = joy.y;
        if (key.a || key.arrowleft) jx -= 1; if (key.d || key.arrowright) jx += 1;
        if (key.w || key.arrowup) jy -= 1; if (key.s || key.arrowdown) jy += 1;
        let L = Math.hypot(jx, jy); if (L > 1) { jx /= L; jy /= L; L = 1; }
        const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
        return [rx * jx + fx * -jy, rz * jx + fz * -jy, L];
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
          P.cd.wave = TUNE.wave.cd; P.waveT = .7; P.vy = 13; P.slam = true; P.y = Math.max(P.y, .01);
          S.tone(300, 900, .3, 'sine', .04);
        }
        if (what === 'dash' && P.cd.dash <= 0) {
          const [mx, mz, L] = moveInput();
          P.dashDir = L > .2 ? [mx / L, mz / L] : [Math.sin(P.face), Math.cos(P.face)];
          P.face = Math.atan2(P.dashDir[0], P.dashDir[1]);
          P.cd.dash = TUNE.dash.cd; P.dashT = TUNE.dash.dur; P.inv = Math.max(P.inv, TUNE.dash.inv); P.atkT = 0;
          S.noise(.18, .08, 2500); S.tone(500, 1200, .12, 'sine', .03);
          fx.ring([P.x, .3, P.z], 0xc9bcff, 2.5, .3);
        }
        if (what === 'ult' && P.ult >= 100 && P.ultT <= 0) {
          P.ult = 0; P.ultT = 2.4; P.inv = Math.max(P.inv, 2.6); P.vy = 15; P.y = Math.max(P.y, .01); P.atkT = 0; P.beamT = 0;
          slowmo = .35; punch = 1;
          ui.ultFx.classList.remove('on'); void ui.ultFx.offsetWidth; ui.ultFx.classList.add('on');
          toast('¡LLUVIA DE ESTRELLAS!', 1.8);
          S.tone(200, 1600, .8, 'sawtooth', .04); [523, 659, 784, 1047, 1319].forEach((f, i) => S.tone(f, f, .3, 'triangle', .05, .1 + i * .08));
          const targets = enemies.filter(e => !e.dead && e.spawn >= 1);
          for (let i = 0; i < TUNE.ult.meteors; i++) {
            const e = targets.length ? targets[i % targets.length] : null;
            const a = Math.random() * TAU, d = 3 + Math.random() * 9;
            meteors.push({ x: e ? e.x + (Math.random() - .5) * 1.5 : P.x + Math.cos(a) * d, z: e ? e.z + (Math.random() - .5) * 1.5 : P.z + Math.sin(a) * d, delay: .45 + i * .12, n: null, y: 40, warn: null, track: e });
          }
        }
      }
      function doWave() {
        if (state !== 'play') return;
        {
          {
            S.noise(.5, .2, 500); S.tone(160, 50, .5, 'sine', .18); punch = .6;
            fx.ring([P.x, .4, P.z], 0x7df3ff, TUNE.wave.radius, .55); fx.ring([P.x, .6, P.z], 0xff4fd8, TUNE.wave.radius * .8, .45);
            fx.burst([P.x, 1, P.z], 46, { colors: [0x7df3ff, 0xff4fd8, 0xffffff, 0xffd23f], speed: 16, life: .6, size: .3, add: true, flat: true, grav: 4 });
            shake = Math.max(shake, .9);
            for (const e of enemies) {
              if (e.dead || e.spawn < 1) continue;
              const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
              if (d < TUNE.wave.radius + e.r) { hurtEnemy(e, TUNE.wave.dmg * P.buff, dx / (d || 1), dz / (d || 1), e.type === 'boss' ? 2 : 16); e.stun = Math.max(e.stun, e.type === 'boss' ? .25 : TUNE.wave.stun); }
            }
            for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i]; if (Math.hypot(o.x - P.x, o.z - P.z) < TUNE.wave.radius + 1) { fx.burst([o.x, o.y, o.z], 6, { colors: [0xff7a9a], speed: 4, life: .3, size: .2, add: true }); scene.remove(o.n); orbs.splice(i, 1); } }
            for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fx.burst([P.x + Math.cos(a) * 3, .4, P.z + Math.sin(a) * 3], 2, { geo: geo.rock, colors: [0x4a3a8a, 0x6a5aa8], speed: 6, life: .8, size: .45, emis: .1, grav: 20 }); }
          }
        }
      }

      function hurtEnemy(e, dmg, nx, nz, kb, crit) {
        if (e.dead) return;
        dmg = Math.round(dmg * (crit ? 1.6 : 1));
        e.hp -= dmg; e.flash = .12; e.pop = .18; e.hpShow = 2.5;
        if (state === 'play' && P.ultT <= 0) P.ult = Math.min(100, P.ult + dmg * TUNE.ult.gain);
        combo++; comboT = 2.2;
        e.kx += nx * kb * (e.type === 'golem' ? .35 : 1); e.kz += nz * kb * (e.type === 'golem' ? .35 : 1);
        if (kb >= 9 && (e.type === 'slime' || e.type === 'eye')) e.vy = Math.max(e.vy || 0, kb * .55);
        num(e.x, (e.type === 'boss' ? 8 : e.type === 'golem' ? 6.4 : 3) , e.z, dmg, crit ? 'crit' : '');
        const hy = e.type === 'boss' ? 3.5 : e.type === 'golem' ? 3 : e.type === 'eye' ? 2.6 : 1.2;
        fx.burst([e.x - nx * e.r * .6, hy, e.z - nz * e.r * .6], crit ? 12 : 7, { colors: [0xffffff, 0xffd23f, e.col], speed: 8, life: .35, size: .22, add: true, grav: 6 });
        fx.ring([e.x - nx * e.r * .5, hy, e.z - nz * e.r * .5], crit ? 0xffd23f : 0xffffff, crit ? 1.8 : 1.2, .18, { tilt: Math.PI / 2, yaw: Math.atan2(nx, nz), thin: true });
        S.tone(crit ? 380 : 260, 120, .08, 'square', .045); if (crit) S.tone(1200, 1600, .08, 'triangle', .03);
        if (e.hp <= 0) killEnemy(e);
      }
      // trozos con física (caen, rebotan, ruedan y se desvanecen)
      const debris = [];
      function shatter(e) {
        e.g.update(null);
        const list = e.meshes.slice(0, 18);
        for (const m of list) {
          const w = m.world, sx = Math.hypot(w[0], w[1], w[2]), sy = Math.hypot(w[4], w[5], w[6]), sz = Math.hypot(w[8], w[9], w[10]);
          if (sx * sy * sz < .002) continue;
          const n = new M.Node(m.geo, 0xffffff, { shine: m.shine }); n.color = m.color.slice(); n.emis = m.emis * .6; n.scl = [sx, sy, sz];
          n.pos = [w[12], w[13], w[14]]; n.rot = [0, e.face, 0]; scene.add(n);
          const dx = w[12] - e.x, dz = w[14] - e.z, d = Math.hypot(dx, dz) || 1, sp = 4 + Math.random() * 6;
          debris.push({ n, v: [dx / d * sp + (Math.random() - .5) * 3, 6 + Math.random() * 8, dz / d * sp + (Math.random() - .5) * 3], w: [(Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14], life: 2.4 + Math.random(), r: Math.min(sx, sy, sz) * .5, s: [sx, sy, sz] });
        }
      }
      function stepDebris(dt) {
        for (let i = debris.length - 1; i >= 0; i--) {
          const q = debris[i], n = q.n; q.life -= dt;
          q.v[1] -= 28 * dt; n.pos[0] += q.v[0] * dt; n.pos[1] += q.v[1] * dt; n.pos[2] += q.v[2] * dt;
          n.rot[0] += q.w[0] * dt; n.rot[1] += q.w[1] * dt; n.rot[2] += q.w[2] * dt;
          const fl = Math.hypot(n.pos[0], n.pos[2]) < 19 ? q.r : -40;
          if (n.pos[1] < fl) { n.pos[1] = fl; if (q.v[1] < 0) q.v[1] *= -.35; q.v[0] *= .7; q.v[2] *= .7; q.w = q.w.map(v => v * .6); }
          if (q.life < .5) { const k = Math.max(0, q.life / .5); n.scl = q.s.map(v => v * k); }
          if (q.life <= 0) { scene.remove(n); debris.splice(i, 1); }
        }
      }
      function killEnemy(e) {
        e.dead = true; kills++;
        const big = e.type === 'boss' ? 4 : e.type === 'golem' ? 2 : 1;
        fx.burst([e.x, 1.5 * big, e.z], 22 * big, { colors: [e.col, 0xffffff, 0x2a2a3a], speed: 9 * Math.sqrt(big), life: .9, size: .35 * Math.sqrt(big), emis: .3 });
        fx.ring([e.x, .3, e.z], 0xffffff, 3 * big, .5);
        S.noise(.3, .1 * big, 800); S.tone(500, 90, .25, 'square', .04);
        shatter(e);
        scene.remove(e.g);
        if (e.type === 'boss') { queue.length = 0; enemies.forEach(o => { if (!o.dead && o !== e) killEnemy(o); }); }
        if (e.type !== 'boss' && Math.random() < (P.hp < 50 ? .32 : .16)) dropPotion(e.x, e.z);
        dropGems(e.x, e.z, e.type === 'boss' ? 24 : e.type === 'golem' ? 6 : 3);
        if (e.bar) e.bar.remove();
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
        gems.forEach(g => scene.remove(g.n)); gems.length = 0; debris.forEach(q => scene.remove(q.n)); debris.length = 0; meteors.forEach(m => { if (m.n) scene.remove(m.n); if (m.warn) scene.remove(m.warn); }); meteors.length = 0;
        ui.dmg.querySelectorAll('.g-ehp').forEach(b => b.remove());
        camYaw = Math.PI; Object.assign(P, { x: 0, z: 4, face: Math.PI, hp: TUNE.hp, dead: false, inv: 1.2, beamT: 0, dashT: 0, atkT: 0, kx: 0, kz: 0, y: 0, vy: 0, slam: false, ultT: 0 });
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
        stepDebris(dt);
        comboT = Math.max(0, comboT - dt); if (comboT <= 0) combo = 0;
        if (P.ultT > 0) { P.ultT -= dt; slowmo = lerp(slowmo, 1, dt * 1.2); if (Math.random() < dt * 30) fx.burst([P.x, 3 + P.y, P.z], 1, { colors: [0xffd23f, 0xff4fd8, 0x7df3ff], speed: 3, life: .6, size: .25, add: true, grav: -2, floor: -99 }); }
        ghosts.forEach(q => { if (q.t <= 0) return; q.t -= dt; const a = Math.max(0, q.t / .4) * .35; q.g.children.forEach(c => { c.alpha = a; }); if (q.t <= 0) q.g.visible = false; });
        // gemas: saltan, caen y vuelan hacia ella
        for (let i = gems.length - 1; i >= 0; i--) {
          const g = gems[i]; g.t += dt;
          const dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz);
          if (g.t > .55 && !P.dead) { const sp = Math.min(30, 6 + g.t * 18); g.x += dx / (d || 1) * sp * dt; g.z += dz / (d || 1) * sp * dt; g.y = lerp(g.y, 2.5, dt * 6); }
          else { g.vy -= 28 * dt; g.x += g.vx * dt; g.z += g.vz * dt; g.y = Math.max(.5, g.y + g.vy * dt); if (g.y === .5) { g.vy *= -.4; g.vx *= .6; g.vz *= .6; } }
          g.n.at(g.x, g.y, g.z); g.n.rot[1] += dt * 6;
          if (g.t > .55 && d < 1.3) { scene.remove(g.n); gems.splice(i, 1); P.ult = Math.min(100, P.ult + TUNE.ult.gem); S.tone(1500 + Math.random() * 500, 2200, .05, 'triangle', .02); fx.burst([P.x, 3, P.z], 2, { colors: [0x7df3ff, 0xffffff], speed: 2, life: .3, size: .15, add: true, grav: 0 }); }
        }
        // meteoritos
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i]; m.delay -= dt;
          if (m.delay > 0) continue;
          if (m.track && !m.track.dead) { m.x = lerp(m.x, m.track.x, dt * 4); m.z = lerp(m.z, m.track.z, dt * 4); }
          if (!m.n) {
            m.n = group(); scene.add(m.n);
            mesh(m.n, geo.gem, 0xffd23f, 1.6, 2.4, 1.6, 0, 0, 0, { emis: 1 }); mesh(m.n, geo.ball, 0xffb03a, 3.4, 5, 3.4, 0, 1.4, 0, { emis: 1, add: true, alpha: .4, cast: false });
            m.warn = mesh(scene, geo.cyl20, 0xffd23f, TUNE.ult.radius * 2, .06, TUNE.ult.radius * 2, m.x, .09, m.z, { emis: 1, add: true, alpha: .3, cast: false });
          }
          m.y -= dt * 55; m.n.at(m.x + (m.y) * .25, m.y, m.z); m.n.rot[1] += dt * 10; m.warn.at(m.x, .09, m.z);
          if (Math.random() < .9) fx.burst([m.x + m.y * .25, m.y + 1, m.z], 2, { colors: [0xffd23f, 0xff7a2a, 0xffffff], speed: 1, life: .4, size: .5, add: true, grav: 0, floor: -99 });
          if (m.y <= 0) {
            scene.remove(m.n); scene.remove(m.warn); meteors.splice(i, 1);
            fx.ring([m.x, .3, m.z], 0xffd23f, TUNE.ult.radius + 1, .5); fx.ring([m.x, .5, m.z], 0xff4fd8, TUNE.ult.radius, .4);
            fx.burst([m.x, .8, m.z], 26, { colors: [0xffd23f, 0xff7a2a, 0xffffff, 0xff4fd8], speed: 12, life: .7, size: .32, add: true, grav: 10 });
            shake = Math.max(shake, .8); S.noise(.35, .14, 600); S.tone(120, 40, .3, 'sine', .1);
            for (const e of enemies) { if (e.dead || e.spawn < 1) continue; const dx = e.x - m.x, dz = e.z - m.z, d = Math.hypot(dx, dz); if (d < TUNE.ult.radius + e.r) { hurtEnemy(e, TUNE.ult.dmg * P.buff, dx / (d || 1), dz / (d || 1), e.type === 'boss' ? 0 : 10, Math.random() < .3); e.stun = Math.max(e.stun, e.type === 'boss' ? .2 : .6); } }
          }
        }

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
            P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = .045; spawnGhost(); }
            if (Math.random() < .9) fx.burst([P.x, 1 + Math.random() * 3, P.z], 2, { colors: [0xff4fd8, 0x7df3ff, 0x6c4cf0], speed: 1, life: .3, size: .3, add: true, grav: 0 });
          } else if (canMove && ml > .1) {
            const slow = P.beamT > 0 ? .3 : P.atkT > 0 ? .45 : 1;
            P.x += mx * TUNE.speed * slow * dt; P.z += mz * TUNE.speed * slow * dt; sp = ml * slow;
            P.stepT = (P.stepT || 0) - dt * sp; if (P.stepT <= 0 && P.y === 0) { P.stepT = .26; fx.burst([P.x - Math.sin(P.face) * .6, .2, P.z - Math.cos(P.face) * .6], 2, { geo: geo.ballS, colors: [0x8a7ab8, 0xb8a8e0], speed: 1.2, life: .45, size: .35, grav: -1.5, emis: .1, fade: true }); }
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
          if (P.vy || P.y > 0) { P.vy -= (P.slam && P.vy < 0 ? 60 : 30) * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0 && P.vy < 0) { P.vy = 0; if (P.slam) { P.slam = false; doWave(); } else fx.ring([P.x, .2, P.z], 0xffffff, 2, .3); } }

          // combo de golpes (mantener pulsado = golpes seguidos)
          P.comboWin = Math.max(0, P.comboWin - dt);
          if (state === 'play' && atkHeld && P.atkT <= 0 && P.beamT <= 0 && P.dashT <= 0) {
            P.atkI = P.comboWin > 0 ? (P.atkI + 1) % 3 : 0;
            P.atkDur = P.atkI === 2 ? .46 : .3; P.atkT = P.atkDur; P.atkHit = false; P.comboWin = .6;
            if (P.atkI === 2) { P.vy = 7; P.y = Math.max(P.y, .01); }
            const t = nearest(7.5, P.x, P.z); if (t && ml < .2) aimAt(t); else if (t) { const want = Math.atan2(t.x - P.x, t.z - P.z); let d = want - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.2) P.face = want; }
          }
          if (P.atkT > 0) {
            P.atkT -= dt;
            const k = 1 - P.atkT / P.atkDur;
            // pequeño paso adelante al golpear
            if (k > .25 && k < .5) { P.x += Math.sin(P.face) * 7 * dt; P.z += Math.cos(P.face) * 7 * dt; }
            if (!P.atkHit && k > (P.atkI === 2 ? .45 : .36)) {
              P.atkHit = true;
              const fx0 = Math.sin(P.face), fz0 = Math.cos(P.face);
              const spread = P.atkI === 2 ? 2.2 : 1.25, range = TUNE.comboRange + (P.atkI === 2 ? .8 : 0);
              fx.slash([P.x, 2.6 + P.y, P.z], P.face - .38, P.atkI === 2 ? 0xffd23f : (P.atkI ? 0x7df3ff : 0xff4fd8), range * .8, P.atkI === 2 ? .3 : .2, P.atkI === 1 ? -.35 : (P.atkI === 0 ? .35 : 0));
              for (let a = -spread; a <= spread; a += spread / 4) { const ang = P.face + a; fx.burst([P.x + Math.sin(ang) * 2.6, 2.6 + (P.atkI === 1 ? -a * .3 : a * .3), P.z + Math.cos(ang) * 2.6], 1, { colors: [P.atkI === 2 ? 0xffd23f : 0xffffff, 0xff4fd8], speed: .5, life: .22, size: .45, add: true, grav: 0 }); }
              if (P.atkI === 2) { fx.ring([P.x, 1.2, P.z], 0xffd23f, range, .3); fx.slash([P.x, 2.2 + P.y, P.z], P.face + 2.2, 0xffd23f, range * .8, .3, 0); fx.slash([P.x, 2.2 + P.y, P.z], P.face - 2.6, 0xffd23f, range * .8, .3, 0); punch = .4; }
              S.noise(.1, .09, 4500); S.tone(P.atkI === 2 ? 500 : 700, 300, .1, 'sawtooth', .02);
              for (const e of enemies) {
                if (e.dead || e.spawn < 1) continue;
                const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) - e.r;
                if (d > range) continue;
                const ang = Math.acos(clamp((dx * fx0 + dz * fz0) / (Math.hypot(dx, dz) || 1), -1, 1));
                if (ang < spread * .55 + .35 || d < .6) { hurtEnemy(e, TUNE.combo[P.atkI] * P.buff, dx / (d + e.r || 1), dz / (d + e.r || 1), P.atkI === 2 ? 13 : 5, Math.random() < .12); hitstop = Math.max(hitstop, P.atkI === 2 ? .09 : .045); shake = Math.max(shake, P.atkI === 2 ? .75 : .35); }
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
          if (e.type !== 'boss' && e.spawn >= 1 && (e.vy || e.y > 0)) { e.vy = (e.vy || 0) - 30 * dt; e.y = Math.max(0, e.y + e.vy * dt); if (e.y === 0 && e.vy < 0) { e.vy = e.vy < -6 ? -e.vy * .3 : 0; if (e.vy) fx.ring([e.x, .2, e.z], 0xffffff, 1.6, .25); } }
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
        hero.root.visible = !(P.inv > 0 && P.hurtT > 0 && !P.dead && state === 'play' && Math.sin(time * 40) > .6);
        const atkK = P.atkT > 0 ? 1 - P.atkT / P.atkDur : 0;
        const bladeCol = (Math.sin(time * 3) + 1) / 2;
        blade.color = rgb(bladeCol > .5 ? 0xff9ae8 : 0x9af0ff); tip.color = blade.color; bladeGlow.color = rgb(bladeCol > .5 ? 0xff4fd8 : 0x4fd8ff);
        bladeGlow.alpha = P.atkT > 0 || P.ultT > 0 ? .55 : .2 + Math.sin(time * 4) * .05;
        hero.animate(dt, P.dashT > 0 ? 1 : sp, (H, A) => {
          const B = A.body;
          // postura de combate con la espada lista
          H.armR.rot = [-.55, 0, .25]; H.armL.rot[2] -= .15;
          if (P.dead) { B.rot[0] = -Math.min(1.4, P.deadT * 3); B.pos[1] = .3; H.armR.rot = [0, 0, 1]; return; }
          if (state === 'intro') { H.armR.rot = [-.4, 0, 2.5 + Math.sin(A.t * 2) * .1]; H.armL.rot[2] = -.5; B.rot[1] = Math.sin(A.t * .8) * .1; }
          if (state === 'won') { H.armR.rot = [-.2, 0, 2.9 + Math.sin(A.t * 10) * .1]; H.armL.rot[2] = -2.6 - Math.sin(A.t * 10) * .2; B.pos[1] = Math.abs(Math.sin(A.t * 6)) * .6; B.rot[1] = A.t * 2; }
          if (P.dashT > 0) { B.rot[0] = .6; H.armL.rot = [1.2, 0, -.3]; H.armR.rot = [1.3, 0, .3]; H.legL.rot[0] = .8; H.legR.rot[0] = -.6; }
          if (P.atkT > 0) {
            const k = atkK, wind = ease.out(clamp(k / .3, 0, 1)), strike = ease.out(clamp((k - .3) / .25, 0, 1)), rec = clamp((k - .7) / .3, 0, 1);
            if (P.atkI === 0) {        // corte diagonal de derecha a izquierda
              H.armR.rot = [lerp(lerp(-.55, -2.6, wind), -.6, strike), lerp(0, -.5, strike), lerp(lerp(.25, 1.1, wind), -.5, strike)];
              B.rot[1] = lerp(lerp(0, .7, wind), -.6, strike) * (1 - rec); H.legL.rot[0] = -.4 * strike; H.legR.rot[0] = .3 * strike;
            } else if (P.atkI === 1) { // revés de izquierda a derecha
              H.armR.rot = [lerp(lerp(-.55, -1.4, wind), -1.5, strike), lerp(lerp(0, -1, wind), 1, strike), lerp(lerp(.25, -.6, wind), 1.3, strike)];
              B.rot[1] = lerp(lerp(0, -.8, wind), .7, strike) * (1 - rec); H.legL.rot[0] = .3 * strike; H.legR.rot[0] = -.4 * strike;
            } else {                   // giro final en el aire
              H.armR.rot = [-1.5, 0, 1.4]; H.armL.rot = [0, 0, -1.4];
              B.rot[1] = ease.inOut(clamp((k - .15) / .7, 0, 1)) * TAU; B.rot[0] = -.15;
            }
            H.head.rot[1] = -B.rot[1] * .5;
          }
          if (P.beamT > 0) { H.armL.rot = [-2.5, .5, .2]; H.armR.rot = [-1, 0, .6]; H.head.rot[0] = .05; B.rot[0] = -.12; H.legL.rot[0] = -.3; H.legR.rot[0] = .3; }
          if (P.slam) { const up = P.vy > 0; H.armR.rot = up ? [-2.9, 0, .2] : [-1, 0, .2]; H.armL.rot = up ? [-2.8, 0, -.2] : [-1.1, 0, -.2]; H.legL.rot[0] = -.9; H.legR.rot[0] = -.5; B.rot[0] = up ? -.2 : .35; }
          if (P.ultT > 0) { H.armR.rot = [-.3, 0, 2.9]; H.armL.rot = [-.3, 0, -2.6]; B.rot[1] = P.ultT * 6; H.legL.rot[0] = -.6; }
          if (P.hurtT > 0) { B.rot[0] = -.3; H.head.rot[0] = -.3; }
          H.lens.forEach(l => { l.alpha = P.beamT > 0 ? .95 : (P.cd.beam <= 0 ? .25 + Math.sin(A.t * 4) * .15 : 0); });
        });
        P.waveT = Math.max(0, P.waveT - dt);
        for (const e of enemies) poseEnemy(e, dt);
        portalNodes.forEach((p, i) => { p.rot[1] = time * (1 + i * .2); p.alpha = .4 + Math.sin(time * 3 + i) * .15; });
        floaters.forEach(f => { f.g.pos[1] = f.y + Math.sin(time * .8 + f.ph) * .8; f.g.rot[1] = time * .1 + f.ph; });
        embers.update(dt, time); sparks.update(dt, time);
        if (Math.random() < dt * 30) { const t = torches[(Math.random() * torches.length) | 0]; fx.burst(t, 1, { colors: [0xffd23f, 0xff7a2a, 0xff4a1a], speed: .8, life: .6, size: .35, add: true, grav: -5, floor: -99 }); }

        /* --- jaula del regalo --- */
        if (state === 'won') {
          const k = clamp((winT - .6) / 1.2, 0, 1);
          bars.forEach((b, i) => { b.pos[1] = 2.1 + ease.out(k) * (6 + i % 3); b.alpha = 1 - k; b.rot[2] = k * (i % 2 ? 2 : -2); });
          cageTop.pos[1] = 4.9 + ease.out(k) * 9; cageTop.alpha = 1 - k; lock.alpha = 1 - k; lock.pos[1] = 2.6 - k * 3;
          giftBox.pos[1] = .5 + Math.sin(winT * 3) * .3 + k * 1.2; giftBox.rot[1] = winT * 1.4;
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
          if (e.state === 'move') {
            e.face += df * Math.min(1, dt * 6);
            if (Math.sin(e.t * 7) > 0 && d > 2.6) { e.x += nx * EN.slime.speed * 1.6 * dt; e.z += nz * EN.slime.speed * 1.6 * dt; }
            if (d < 5.5 && e.cd <= 0) { e.state = 'wind'; e.st = 0; S.tone(300, 600, .3, 'sine', .015); }
          } else if (e.state === 'wind') {      // se aplasta (aviso) ...
            e.st += dt; e.face += df * Math.min(1, dt * 8);
            if (e.st > .5) { e.state = 'lunge'; e.st = 0; e.ld = [Math.sin(e.face), Math.cos(e.face)]; e.hitDone = false; S.tone(500, 200, .15, 'square', .02); }
          } else if (e.state === 'lunge') {     // ... y salta hacia ella
            e.st += dt; e.x += e.ld[0] * 16 * dt; e.z += e.ld[1] * 16 * dt;
            if (!e.hitDone && d < e.r + 1.1) { e.hitDone = true; hurtHero(EN.slime.touch, e.x, e.z, 10); }
            if (e.st > .3) { e.state = 'recover'; e.st = 0; fx.ring([e.x, .2, e.z], e.col, 1.6, .3); }
          } else { e.st += dt; if (e.st > .6) { e.state = 'move'; e.cd = 1.2 + Math.random() * 1.2; } }
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
        e.meshes.forEach((m, i) => { m.emis = e.flash > 0 ? 1 : (e.stun > 0 ? .45 + Math.sin(e.t * 20) * .1 : (e.state === 'wind' ? .35 + Math.sin(e.t * 30) * .2 : e.baseEmis[i])); });
        e.pop = Math.max(0, (e.pop || 0) - dt); const pp = e.pop / .18;
        if (e.type === 'slime') {
          if (e.state === 'wind') { const k = clamp(e.st / .5, 0, 1); e.body.pos[1] = 0; e.body.scl = [1 + k * .35, 1 - k * .4, 1 + k * .35]; }
          else if (e.state === 'lunge') { e.body.pos[1] = Math.sin(e.st / .3 * Math.PI) * 1.6; e.body.scl = [.85, 1.15, 1.3]; }
          else { const h = Math.max(0, Math.sin(e.t * 7)); e.body.pos[1] = h * 1.0; e.body.scl = [1 + (1 - h) * .15, 1 - (1 - h) * .15 + h * .1, 1 + (1 - h) * .15]; }
        }
        if (e.type === 'eye') { e.body.pos[1] = e.hover + Math.sin(e.t * 3) * .3; e.wl.rot[2] = Math.sin(e.t * 16) * .6; e.wr.rot[2] = -Math.sin(e.t * 16) * .6; e.pupil.scl = e.charging ? [.7, .7, .3] : [.5, .5, .3]; e.pupil.emis = e.charging ? 1 : .6; }
        if (e.type === 'golem') {
          const w = e.state === 'move' ? Math.sin(e.t * 5) * .4 : 0;
          const up = e.state === 'slam' ? -(.4 + 2.5 * ease.out(clamp(e.st / 1, 0, 1))) : (e.state === 'recover' ? -.7 + clamp(e.st / .8, 0, 1) * .7 : 0);
          e.al.rot[0] = up || -w; e.ar.rot[0] = up || w;
          e.body.pos[1] = e.state === 'slam' ? .2 + clamp(e.st, 0, 1) * .4 : Math.abs(Math.sin(e.t * 5)) * .15; e.body.rot[0] = e.state === 'slam' ? -.15 * clamp(e.st, 0, 1) : (e.state === 'recover' && e.st < .3 ? .25 : 0);
        }
        if (pp > 0 && e.type !== 'slime') e.body.scl = [1 + pp * .12, 1 - pp * .1, 1 + pp * .12];
        if (pp > 0 && e.type === 'slime') { e.body.scl = e.body.scl.map((v, i) => v * (i === 1 ? 1 - pp * .2 : 1 + pp * .2)); }
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
          ui.toast.classList.remove('on'); toastT = 0;
          $('#gWin').classList.remove('hidden');
        }, 3200);
      }

      /* ---------- dibujar ---------- */
      const cam = { pos: [0, 20, 20], target: [0, 0, 0], fov: 52 };
      let punch = 0, combo = 0, comboT = 0, comboShown = 0;
      function render(dt) {
        R.resize();
        const asp = R.W / R.H;
        const tr = Math.min(1.6, shake), tt = performance.now() / 1000, amp = tr * tr * .55;
        const shx = amp * (Math.sin(tt * 41) + Math.sin(tt * 27.3 + 1.7) * .6), shy = amp * (Math.sin(tt * 37.1 + 3.1) + Math.sin(tt * 19.7) * .6); shake = Math.max(0, shake - dt * 2.2);
        if (state === 'intro') {
          // presentación: cámara de frente que la rodea despacio
          const dist = Math.max(16, 6 / Math.tan(Math.atan(Math.tan(cam.fov * Math.PI / 360) * asp))), yaw = Math.sin(performance.now() / 3000) * .5;
          cam.target = [P.x, 3, P.z]; cam.pos = [P.x + Math.sin(yaw) * Math.cos(.28) * dist, 3 + Math.sin(.28) * dist, P.z + Math.cos(yaw) * Math.cos(.28) * dist];
          camS.x = P.x; camS.z = P.z; camYaw = Math.PI;
        } else {
          // tercera persona: detrás de ella, con muelle suave
          lookT += dt;
          const [, , ml] = moveInput();
          if (lookT > 1.3 && ml > .2 && P.dashT <= 0) { const d = Math.atan2(Math.sin(P.face - camYaw), Math.cos(P.face - camYaw)); if (Math.abs(d) < 2.4) camYaw += d * Math.min(1, dt * 1.1); }
          // suavizado estable a cualquier velocidad de fotogramas (estilo SmoothDamp)
          const sd = (cur, tgt, vk, st) => { const om = 2 / st, x = om * dt, ex = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - tgt, tp = ((camS[vk] || 0) + om * ch) * dt; camS[vk] = ((camS[vk] || 0) - om * tp) * ex; return tgt + (ch + tp) * ex; };
          camS.x = sd(camS.x, P.x, 'vx', .16); camS.z = sd(camS.z, P.z, 'vz', .16); camY = lerp(camY, 3.4 + P.y * .6, Math.min(1, dt * 6));
          let dist = asp > 1 ? 12.5 : 16.5; if (boss && !boss.dead) dist += 4; if (state === 'won') dist += 2;
          const cp = Math.cos(camPitch), fx = Math.sin(camYaw), fz = Math.cos(camYaw);
          // la cámara no atraviesa los pilares del borde: se acerca si hace falta
          for (let i = 0; i < 12; i++) { const cx = camS.x - fx * cp * dist, cz = camS.z - fz * cp * dist; if (Math.hypot(cx, cz) < 18.6 || dist < 5) break; dist *= .9; }
          camDist = lerp(camDist || dist, dist, Math.min(1, dt * (dist < (camDist || dist) ? 12 : 3))); dist = camDist;
          cam.target = [camS.x + fx * 2.5 + shx * .3, camY + shy * .3, camS.z + fz * 2.5];
          cam.pos = [camS.x - fx * cp * dist + shx, camY + Math.sin(camPitch) * dist + shy, camS.z - fz * cp * dist];
          cam.shadowCenter = [camS.x + fx * 6, 0, camS.z + fz * 6];
        }
        cam.shiftY = state === 'intro' ? -.3 : -.1;
        R.grade.tiltC = state === 'intro' ? .62 : .48; R.grade.tilt = state === 'intro' ? .55 : .22;
        punch = Math.max(0, punch - dt * 3); cam.fov = (asp > 1 ? 52 : 62) - ease.out(punch) * 6;
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
        ui.ultFill.style.width = P.ult + '%'; ui.sk.ult.classList.toggle('ready', P.ult >= 100); ui.sk.ult.style.setProperty('--u', (P.ult / 100 * 360) + 'deg');
        if (combo >= 3 && combo !== comboShown) { comboShown = combo; ui.combo.innerHTML = '<b>' + combo + '</b> golpes'; ui.combo.classList.remove('pop'); void ui.combo.offsetWidth; ui.combo.classList.add('pop', 'on'); }
        if (combo < 3) { ui.combo.classList.remove('on'); comboShown = 0; }
        // barras de vida de los monstruos (solo si les has dado)
        for (const e of enemies) {
          if (e.type === 'boss' || e.dead) continue;
          e.hpShow = Math.max(0, (e.hpShow || 0) - dt);
          if (!e.bar && e.hpShow > 0) { e.bar = document.createElement('i'); e.bar.className = 'g-ehp'; e.bar.innerHTML = '<i></i>'; ui.dmg.appendChild(e.bar); }
          if (e.bar) { const p = R.project([e.x, e.type === 'golem' ? 7.2 : e.type === 'eye' ? 4.4 : 3.2, e.z]); e.bar.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; e.bar.style.opacity = Math.min(1, e.hpShow * 2); e.bar.firstChild.style.width = Math.max(0, e.hp / e.max * 100) + '%'; }
        }
      }

      let running = true, raf = 0, last = 0, acc = 0;
      function frame(ts) {
        if (!running) return;
        let dt = Math.min(G.__pruebaRapida ? .3 : .05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        let sdt = dt * slowmo;
        if (hitstop > 0) { hitstop -= dt; sdt *= .08; }
        acc += sdt; const h = 1 / 120; let n = 0;
        const cap = G.__pruebaRapida ? 40 : 12;
        while (acc >= h && n < cap) { step(h); acc -= h; n++; }
        if (n === cap) acc = 0;
        fx.update(sdt);
        render(dt);
        raf = requestAnimationFrame(frame);
      }

      /* ---------- arranque ---------- */
      $('#gIntro').classList.remove('hidden'); $('#gWin').classList.add('hidden'); $('#gLose').classList.add('hidden');
      ui.boss.classList.add('hidden'); ui.wave.textContent = ''; ui.left.textContent = '';
      root.classList.add('g-intro');
      $('#gStart').onclick = () => { S.unlock();
        try { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (f && matchMedia('(pointer:coarse)').matches) { const pr = f.call(el); if (pr && pr.then) pr.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } } catch (e) {} $('#gIntro').classList.add('hidden'); root.classList.remove('g-intro'); state = 'count'; countT = 0; lastCount = ''; P.face = Math.PI; };
      $('#gRetry').onclick = () => { $('#gLose').classList.add('hidden'); resetWave(); state = 'count'; countT = 0; lastCount = ''; queue = []; ui.wave.textContent = ''; };
      $('#gWinBtn').onclick = () => {
        running = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku);
        nums.forEach(n => n.el.remove());
        try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        resolve({ deaths, time });
      };
      $('#gRotateSkip').onclick = () => root.classList.add('rot-ok');
      // utilidades para probar (no afectan al juego)
      G.__juego = { P, enemies, scene, cam, R, get camYaw() { return camYaw; }, get camS() { return camS; }, get state() { return state; }, set state(v) { state = v; }, start: () => $('#gStart').click(), act, setWave: i => { waveI = i; }, killAll: () => enemies.forEach(e => { if (!e.dead) killEnemy(e); }), hurtEnemy, get queue() { return queue; } };
      raf = requestAnimationFrame(frame);
    });
  }

  G.Juego = { play };
})(window);
