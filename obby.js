/* =========================================================
   LA HISTORIA EN 3D · animación de inicio
   Cada etapa es un mundo de bloques distinto, inspirado en un
   juego de Roblox (mundos propios: sin logos ni personajes de nadie).
   Entre etapa y etapa hay una pantalla de "teletransporte".
   Necesita motor3d.js cargado antes.
   ========================================================= */
(function (G) {
  'use strict';
  const M = G.M3;
  if (!M) return;
  const { TAU, clamp, lerp, smooth, ease, geo, group, box, mesh, bake, FX, avatar } = M;

  let current = null;
  function skip() { if (current) current.skip(); }

  /* ---------- aspecto de los dos protagonistas ---------- */
  const LOOK_HER = { skin: 0xf7d6c4, shirt: 0xc8142a, dress: true, belt: 0xffffff, shoes: 0xf2f2f6, hair: 'long', hairCol: 0x4a2c1c, hairHi: 0xc9a06a, glasses: true, necklace: true, bracelet: true, blush: true };
  const LOOK_ME = { skin: 0xf3cfb3, shirt: 0x3a6df0, sleeves: 'short', pants: 0x262a40, shoes: 0x1c1c26, hair: 'short', hairCol: 0x2a1c14 };

  // poses
  const POSE = {
    wave: (P, A) => { P.armR.rot[2] = 2.6 + Math.sin(A.t * 9) * .35; P.armR.rot[0] = 0; },
    cheer: (P, A) => { P.armR.rot[2] = 2.7 + Math.sin(A.t * 10) * .2; P.armL.rot[2] = -2.7 - Math.sin(A.t * 10) * .2; },
    clap: (P, A) => { const c = Math.abs(Math.sin(A.t * 9)) * .5; P.armL.rot[0] = -1.3; P.armR.rot[0] = -1.3; P.armL.rot[1] = .7 - c; P.armR.rot[1] = -.7 + c; },
    build: (P, A) => { P.armR.rot[0] = -1.6 - Math.abs(Math.sin(A.t * 7)) * .9; },
    sit: (P, A) => { P.legL.rot[0] = -1.55; P.legR.rot[0] = -1.55; A.body.pos[1] = -.95; },
    sad: (P, A) => { P.head.rot[0] = .45; P.armL.rot[2] = -.02; P.armR.rot[2] = .02; },
    scared: (P, A) => { P.armL.rot[2] = -2.2; P.armR.rot[2] = 2.2; P.body ? 0 : 0; A.body.rot[2] = Math.sin(A.t * 40) * .05; },
    lantern: (P) => { P.armR.rot[0] = -1.2; },
    give: (P) => { P.armR.rot[0] = -1.4; P.armL.rot[0] = -1.4; },
    high: (P, A) => { P.armR.rot[2] = 2.9; P.armR.rot[0] = -.3; }
  };

  /* ---------- decorado reutilizable ---------- */
  function tree(g, x, z, s, trunk, leaf, o) {
    s = s || 1;
    box(g, .7 * s, 2.4 * s, .7 * s, trunk || 0x7a4b2a, x, 1.2 * s, z);
    if (o && o.pine) {
      mesh(g, geo.cone, leaf || 0x2f7d4f, 3.2 * s, 2.6 * s, 3.2 * s, x, 3.0 * s, z);
      mesh(g, geo.cone, leaf || 0x2f7d4f, 2.5 * s, 2.2 * s, 2.5 * s, x, 4.2 * s, z);
      if (o.snow) mesh(g, geo.cone, 0xffffff, 1.3 * s, 1.0 * s, 1.3 * s, x, 5.1 * s, z);
    } else {
      box(g, 3 * s, 2.4 * s, 3 * s, leaf || 0x4fbf6a, x, 3.4 * s, z);
      box(g, 2 * s, 1.2 * s, 2 * s, leaf || 0x4fbf6a, x, 5.1 * s, z);
    }
  }
  function house(g, x, z, w, d, wall, roof, ry) {
    const h = group().at(x, 0, z); h.rot[1] = ry || 0; g.add(h);
    box(h, w, 3.2, d, wall, 0, 1.6, 0);
    mesh(h, geo.wedge, roof, w + .6, 1.8, d + .6, 0, 4.1, 0);
    box(h, 1.1, 2, .12, 0x6b4426, 0, 1, d / 2 + .02);
    box(h, 1, .9, .1, 0xfff2b3, -w / 4 - .3, 2.1, d / 2 + .02, { emis: .6 });
    box(h, 1, .9, .1, 0xfff2b3, w / 4 + .3, 2.1, d / 2 + .02, { emis: .6 });
    return h;
  }
  function island(g, x, y, z, w, d, top, rock) {
    box(g, w, 1, d, top, x, y - .5, z);
    box(g, w * .92, 1.4, d * .92, rock, x, y - 1.7, z);
    mesh(g, geo.cone4, rock, w * 1.2, 3.5, d * 1.2, x, y - 4.1, z, { rot: [Math.PI, Math.PI / 4, 0] });
  }
  function stars(g, n, r, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = .08 + Math.random() * 1.2, s = .25 + Math.random() * .5;
      box(g, s, s, s, col || 0xffffff, Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, { emis: 1 });
    }
  }

  /* =========================================================
     MUNDOS
     Cada uno: { look, sky, env, build(ctx) -> { update(dt, t), cam(t) } }
     ========================================================= */
  const WORLDS = {};

  /* 1 · Obby Creator: construir una casa bloque a bloque, y ganar */
  WORLDS.obby = {
    min: 7.5,
    look: { accent: '#ffd23f' },
    sky: 'linear-gradient(180deg,#5fb2ff 0%,#a8dcff 55%,#e8f7ff 100%)',
    env: { sky: 0xdff1ff, gnd: 0x6a8a5a, sun: 0xfff6e0, fog: 0xcfeaff, fogNear: 45, fogFar: 150, light: [.5, .9, .35], amb: .62, sunK: .7 },
    build(c) {
      const st = group();
      box(st, 46, 1, 46, 0x5cc96a, 0, -.5, 0);
      for (let i = -11; i <= 11; i++) { box(st, 46, .02, .06, 0x4aae58, 0, .01, i * 2); box(st, .06, .02, 46, 0x4aae58, i * 2, .01, 0); }
      // un obby al fondo
      const plats = [[-14, 3, -14, 0x7b5cff], [-9, 5, -16, 0xff5ea8], [-4, 7, -18, 0x3ad0ff], [2, 9, -18, 0xffd23f], [8, 11, -16, 0x6ee07a], [13, 13, -13, 0xff8a3a]];
      plats.forEach(([x, y, z, col]) => { box(st, 3.2, .7, 3.2, col, x, y, z); box(st, .4, y, .4, 0xffffff, x, y / 2, z, { alpha: 1 }); });
      box(st, 6, .5, 1.6, 0xff2a2a, -11.5, 4, -15, { emis: .6 });   // ladrillo de lava
      box(st, .25, 3, .25, 0xdddddd, 13, 15, -13); box(st, 1.6, 1, .1, 0x2ee86a, 13.8, 16, -13, { emis: .5 }); // bandera de meta
      tree(st, 15, 6, 1.1); tree(st, -16, 4, 1); tree(st, 12, 14, .9); tree(st, -12, 13, 1.2);
      c.scene.add(bake(st));
      const bar = box(c.scene, 7, .4, .4, 0xff2a2a, -4, 8.2, -18, { emis: .6 });
      // la casa que se construye bloque a bloque
      const blocks = [];
      const H = group().at(0, 0, -2); c.scene.add(H);
      const wall = 0xf4e1c1, wall2 = 0xead1a8;
      let k = 0;
      for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) !== 2 && Math.abs(j) !== 2) continue;
        if (j === 2 && i === 0 && row < 2) continue;              // puerta
        const win = row === 1 && j === 2 && Math.abs(i) === 1;
        const b = box(H, 1, 1, 1, win ? 0x9fdcff : ((i + j + row) % 2 ? wall : wall2), i, row + .5, j, win ? { emis: .5 } : null);
        blocks.push({ n: b, y: row + .5, t: .3 + (k++) * .1 });
      }
      const roof = mesh(H, geo.wedge, 0x7b5cff, 5.8, 2, 5.8, 0, 4, 0); blocks.push({ n: roof, y: 4, t: .3 + k * .1 + .2 });
      const door = box(H, 1, 2, .1, 0x8b5a2b, 0, 1, 2.47); blocks.push({ n: door, y: 1, t: .3 + k * .1 + .4 });
      blocks.forEach(b => { b.n.visible = false; });
      // trofeo de ganador sobre Mario
      const trophy = group(); c.scene.add(trophy);
      mesh(trophy, geo.cyl, 0xf2c14e, 1.1, 1, 1.1, 0, .5, 0, { emis: .35 });
      box(trophy, .3, .7, .3, 0xf2c14e, 0, -.3, 0, { emis: .35 }); box(trophy, .9, .25, .9, 0xc89a2a, 0, -.7, 0);
      mesh(trophy, geo.torus, 0xf2c14e, 1.1, 1, 1.1, -.65, .55, 0, { rot: [0, 0, Math.PI / 2], emis: .35 });
      mesh(trophy, geo.torus, 0xf2c14e, 1.1, 1, 1.1, .65, .55, 0, { rot: [0, 0, Math.PI / 2], emis: .35 });
      trophy.visible = false;
      c.me.root.at(-4, 0, 3); c.me.root.rot[1] = .5;
      c.her.root.at(4, 0, 3); c.her.root.rot[1] = -.5;
      const done = blocks[blocks.length - 1].t + .5;
      let won = false;
      return {
        update(dt, t) {
          bar.rot[1] = t * 1.6;
          blocks.forEach(b => {
            if (t < b.t) return;
            if (!b.n.visible) { b.n.visible = true; c.fx.burst([H.pos[0] + b.n.pos[0], b.y, H.pos[2] + b.n.pos[2]], 3, { colors: [0xffffff, 0xffe9a8], speed: 3, size: .18, life: .4 }); c.sfx(520 + Math.random() * 200, 700, .05, 'square', .015); }
            const p = clamp((t - b.t) / .35, 0, 1); b.n.pos[1] = b.y + (1 - ease.back(p)) * 2.5;
          });
          const building = t < done;
          c.me.animate(dt, 0, building ? POSE.build : (won ? POSE.cheer : null));
          c.her.animate(dt, 0, building ? null : POSE.clap);
          if (!building && !won) { won = true; trophy.visible = true; c.fx.burst([-4, 7, 3], 40, { colors: [0xffd23f, 0xff5ea8, 0x3ad0ff, 0xffffff], speed: 9, life: 1.4, size: .25 }); c.chime(); }
          if (won) { const k2 = clamp((t - done) / .6, 0, 1); trophy.at(-4, 7.2 + Math.sin(t * 3) * .2, 3); trophy.scl = [ease.back(k2), ease.back(k2), ease.back(k2)]; trophy.rot[1] = t * 2;
            c.me.root.pos[1] = Math.max(0, Math.sin((t - done) * 6)) * .8 * (t - done < 2.2 ? 1 : 0); }
        },
        cam: t => ({ target: [0, 3, 0], yaw: -.35 + t * .05, pitch: .32, dist: 19, fit: 15 })
      };
    }
  };

  /* 2 · Adopt Me: abrir un huevo y que salga una mascota legendaria */
  WORLDS.llamada = {
    min: 7,
    look: { accent: '#ff7ad9' },
    sky: 'linear-gradient(180deg,#ffb6e1 0%,#d6c4ff 50%,#bfe6ff 100%)',
    env: { sky: 0xffe6f6, gnd: 0x7a6aa0, sun: 0xfff0f6, fog: 0xe9d9ff, fogNear: 40, fogFar: 120, light: [-.4, .9, .5], amb: .66, sunK: .62 },
    build(c) {
      const st = group();
      island(st, 0, 0, 0, 34, 26, 0x8fe39a, 0xb08a6a);
      box(st, 6, .06, 26, 0xf6e7c8, 0, .03, 0);                          // caminito
      house(st, -8, -7, 7, 5, 0xffd6ea, 0xff7ab8, .25);                  // la guardería
      box(st, 3.5, .8, .2, 0xfff6a8, -7.2, 5.6, -4.2, { emis: .3, rot: [0, .25, 0] });
      house(st, 9, -8, 6, 5, 0xd6f0ff, 0x6aa8ff, -.3);
      tree(st, -13, 5, 1, 0x9a6a4a, 0xffa8d8); tree(st, 13, 4, 1.1, 0x9a6a4a, 0xb8f0c8); tree(st, 4, -11, .9, 0x9a6a4a, 0xffd6a8);
      for (let i = -15; i <= 15; i += 2.5) { box(st, .3, 1.2, .3, 0xffffff, i, .6, 11.5); }
      box(st, 31, .2, .15, 0xffffff, 0, 1, 11.5);
      [[-5, 7, 0xff7ab8], [6, 8, 0xffd23f], [-11, -1, 0x9b82ff], [11, 1, 0x7df3ff]].forEach(([x, z, col]) => { box(st, .2, .5, .2, 0x3e8a4a, x, .25, z); mesh(st, geo.ball, col, .6, .45, .6, x, .6, z); });
      c.scene.add(bake(st));
      // pedestal y huevo
      mesh(c.scene, geo.cyl, 0xffffff, 2.4, .6, 2.4, 0, .3, 0);
      const egg = group().at(0, .6, 0); c.scene.add(egg);
      const shell = mesh(egg, geo.ball2, 0xfff3d6, 1.5, 2, 1.5, 0, 1, 0);
      const spots = [[.5, 1.3, .5], [-.55, .8, .45], [.1, .5, .72], [-.2, 1.6, -.55], [.6, .7, -.4]].map(([x, y, z]) => mesh(egg, geo.ball, 0xff7ab8, .45, .45, .45, x, y, z));
      // mascota: un unicornio volador de bloques
      const pet = group(); c.scene.add(pet);
      box(pet, 1.4, 1, 2, 0xffd6f2, 0, 1.1, 0);
      box(pet, 1, 1, 1, 0xffd6f2, 0, 1.9, .95);
      mesh(pet, geo.cone, 0xf2c14e, .3, .8, .3, 0, 2.7, 1.1, { emis: .5 });
      box(pet, .14, .2, .05, 0x1b1420, -.25, 2, 1.46); box(pet, .14, .2, .05, 0x1b1420, .25, 2, 1.46);
      box(pet, .3, .5, .3, 0x9b82ff, 0, 2.35, .45); box(pet, .3, .3, .7, 0x7df3ff, 0, 1.6, -1.2);
      [[-.45, .7], [.45, .7], [-.45, -.7], [.45, -.7]].forEach(([x, z]) => box(pet, .3, .7, .3, 0xffd6f2, x, .35, z));
      const wingL = group().at(-.7, 1.5, 0), wingR = group().at(.7, 1.5, 0); pet.add(wingL, wingR);
      box(wingL, 1.6, .12, 1, 0xffffff, -.8, 0, 0, { emis: .3 }); box(wingR, 1.6, .12, 1, 0xffffff, .8, 0, 0, { emis: .3 });
      pet.visible = false;
      // la mascota de Mario (un perrito) ya le sigue desde el principio
      const dog = group(); c.scene.add(dog);
      box(dog, 1, .8, 1.6, 0xc98a4b, 0, .8, 0); box(dog, .9, .8, .8, 0xc98a4b, 0, 1.4, .8);
      box(dog, .25, .5, .2, 0x7a4b2a, -.35, 1.9, .7); box(dog, .25, .5, .2, 0x7a4b2a, .35, 1.9, .7);
      box(dog, .12, .16, .05, 0x1b1420, -.2, 1.5, 1.21); box(dog, .12, .16, .05, 0x1b1420, .2, 1.5, 1.21); box(dog, .2, .14, .1, 0x1b1420, 0, 1.3, 1.24);
      [[-.3, .5], [.3, .5], [-.3, -.5], [.3, -.5]].forEach(([x, z]) => box(dog, .25, .45, .25, 0xc98a4b, x, .22, z));
      const tail = box(dog, .15, .15, .6, 0x7a4b2a, 0, 1.1, -1);
      c.me.root.at(-4.5, 0, 3); c.me.root.rot[1] = .55;
      c.her.root.at(3.6, 0, 3.2); c.her.root.rot[1] = -.6;
      const HATCH = 2.9;
      let hatched = false;
      return {
        update(dt, t) {
          const w = t < HATCH ? Math.sin(t * (6 + t * 4)) * clamp(t / HATCH, 0, 1) * .35 : 0;
          egg.rot[2] = w; egg.rot[0] = w * .4;
          if (t > HATCH - .5 && t < HATCH) shell.emis = (t - (HATCH - .5)) * 2;
          if (t >= HATCH && !hatched) {
            hatched = true; egg.visible = false; pet.visible = true;
            c.fx.burst([0, 2, 0], 26, { colors: [0xfff3d6, 0xff7ab8], speed: 8, life: 1, size: .35 });
            c.fx.burst([0, 2.5, 0], 30, { colors: [0xff7ab8, 0xffd23f, 0x7df3ff, 0x9b82ff, 0xffffff], speed: 6, life: 1.4, size: .2, add: true, grav: 2 });
            c.fx.ring([0, .7, 0], 0xffd6f2, 6, .8); c.chime(true);
          }
          if (hatched) {
            const k = clamp((t - HATCH) / .6, 0, 1), s = ease.back(k);
            const orbit = Math.max(0, t - HATCH - 1.6) * .9;
            const px = lerp(0, 3.6 + Math.cos(orbit) * 2.6, smooth(clamp((t - HATCH - 1) / 1.2, 0, 1)));
            const pz = lerp(0, 3.2 + Math.sin(orbit) * 2.6, smooth(clamp((t - HATCH - 1) / 1.2, 0, 1)));
            pet.at(px, 1.2 + Math.sin(t * 3) * .4, pz); pet.scl = [s, s, s];
            pet.rot[1] = orbit > 0 ? -orbit + Math.PI : 0;
            wingL.rot[2] = Math.sin(t * 14) * .5; wingR.rot[2] = -Math.sin(t * 14) * .5;
            if (Math.random() < dt * 14) c.fx.burst([pet.pos[0], pet.pos[1] + 1, pet.pos[2]], 1, { colors: [0xff7ab8, 0x7df3ff, 0xffd23f], speed: 1, life: .8, size: .15, add: true, grav: -1 });
          }
          dog.at(-6.8 + Math.sin(t * 1.3) * .3, Math.abs(Math.sin(t * 6)) * .15, 4.2); dog.rot[1] = .4; tail.rot[1] = Math.sin(t * 14) * .6;
          c.me.animate(dt, 0, hatched ? POSE.cheer : null);
          c.her.animate(dt, 0, hatched ? POSE.clap : null);
          c.her.P.head.rot[1] = hatched ? Math.sin(t) * .3 : 0;
        },
        cam: t => ({ target: [0, 2.2, 1], yaw: .25 - t * .04, pitch: .28, dist: 18 - Math.min(t, 6) * .3, fit: 13 })
      };
    }
  };

  /* 3 · Brookhaven: un pueblo al atardecer, un paseo en coche */
  WORLDS.corazon = {
    min: 7,
    look: { accent: '#ffb48a' },
    sky: 'linear-gradient(180deg,#5b3a8a 0%,#ff7a8a 45%,#ffb98a 75%,#ffe0b0 100%)',
    env: { sky: 0xffc9b0, gnd: 0x5a3a5a, sun: 0xffb27a, fog: 0xffb69a, fogNear: 35, fogFar: 120, light: [-.8, .45, .3], amb: .58, sunK: .9 },
    build(c) {
      const st = group();
      box(st, 120, 1, 60, 0x7bc46a, 0, -.5, 0);
      box(st, 120, .05, 7, 0x3a3a44, 0, .03, 0);
      for (let x = -60; x < 60; x += 4) box(st, 2, .06, .25, 0xffe28a, x, .06, 0);
      box(st, 120, .3, 2.5, 0xbcb6c4, 0, .15, -4.8); box(st, 120, .3, 2.5, 0xbcb6c4, 0, .15, 4.8);
      const cols = [[0xffe0f0, 0xff7ab8], [0xd6f0ff, 0x4a7ad8], [0xfff2c6, 0xd8743a], [0xe2ffd6, 0x4aa86a], [0xf0e0ff, 0x8a5ad8]];
      for (let i = 0; i < 9; i++) { const [w, r] = cols[i % cols.length]; house(st, -36 + i * 9, -11, 6.5, 5, w, r); }
      for (let i = 0; i < 6; i++) { tree(st, -33 + i * 12, -16, .9 + (i % 2) * .2, 0x6a4a3a, i % 2 ? 0x4fbf6a : 0x3aa85a); }
      for (let i = -40; i <= 40; i += 10) { box(st, .25, 4.5, .25, 0x30303a, i, 2.25, -6.2); box(st, 1.2, .2, .25, 0x30303a, i + .5, 4.5, -6.2); box(st, .5, .3, .5, 0xfff2b3, i + 1, 4.25, -6.2, { emis: 1 }); }
      // heladería
      house(st, 14, 9, 7, 5, 0xfff6e8, 0x7df3ff, Math.PI);
      mesh(st, geo.cone, 0xf2c48a, 1, 1.6, 1, 14, 6.6, 9, { rot: [Math.PI, 0, 0] }); mesh(st, geo.ball, 0xff9fd0, 1.3, 1.3, 1.3, 14, 7.8, 9);
      c.scene.add(bake(st));
      // el coche
      const car = group(); c.scene.add(car);
      box(car, 6, 1.2, 3, 0x4fd1c5, 0, 1.1, 0);
      box(car, 3.4, 1.1, 2.8, 0x4fd1c5, -.4, 2.2, 0);
      box(car, 3.2, .9, 2.85, 0xbfe8ff, -.4, 2.25, 0, { alpha: .45 });
      box(car, .2, .4, .6, 0xfff6c0, 3.02, 1.2, .9, { emis: 1 }); box(car, .2, .4, .6, 0xfff6c0, 3.02, 1.2, -.9, { emis: 1 });
      box(car, .2, .35, .5, 0xff3a4a, -3.02, 1.2, .95, { emis: 1 }); box(car, .2, .35, .5, 0xff3a4a, -3.02, 1.2, -.95, { emis: 1 });
      const wheels = [[-2, 1.5], [2, 1.5], [-2, -1.5], [2, -1.5]].map(([x, z]) => mesh(car, geo.cyl, 0x1c1c22, 1.2, .5, 1.2, x, .6, z, { rot: [Math.PI / 2, 0, 0] }));
      const seatMe = group().at(-.1, .65, .7), seatHer = group().at(-.1, .65, -.7); car.add(seatMe, seatHer);
      c.me.root.scl = [.55, .55, .55]; c.her.root.scl = [.55, .55, .55];
      seatMe.add(c.me.root); seatHer.add(c.her.root);
      c.me.root.at(0, 0, 0); c.her.root.at(0, 0, 0); c.me.root.rot[1] = Math.PI / 2; c.her.root.rot[1] = Math.PI / 2;
      c.me.P.shadow.visible = c.her.P.shadow.visible = false;
      const STOP = 2.8;
      let out = false;
      return {
        update(dt, t) {
          const k = clamp(t / STOP, 0, 1), x = lerp(-34, 2, 1 - Math.pow(1 - k, 2.4));
          car.at(x, Math.sin(t * 9) * .03 * (1 - k), 2); wheels.forEach(w => { w.rot[1] += (1 - k) * dt * 9; });
          if (t > STOP + .4 && !out) {
            out = true;
            c.scene.add(c.me.root); c.scene.add(c.her.root);
            c.me.root.scl = [1, 1, 1]; c.her.root.scl = [1, 1, 1];
            c.me.root.at(x - 2.5, 0, 5.5); c.her.root.at(x + 1.5, 0, 5.5);
            c.me.root.rot[1] = .3; c.her.root.rot[1] = -.3;
            c.me.P.shadow.visible = c.her.P.shadow.visible = true;
            c.fx.burst([x, 1, 5.5], 12, { colors: [0xffffff], speed: 3, life: .5, size: .3, emis: .3 });
          }
          const sitting = !out;
          c.me.animate(dt, 0, sitting ? POSE.sit : POSE.wave);
          c.her.animate(dt, 0, sitting ? POSE.sit : (P, A) => { POSE.wave(P, A); P.armR.rot[2] = 2.5 + Math.sin(A.t * 8 + 1) * .3; });
          if (out) { const j = t - STOP - .4; c.me.root.pos[1] = Math.max(0, Math.sin(j * 5)) * .6 * (j < .7 ? 1 : 0); c.her.root.pos[1] = Math.max(0, Math.sin(j * 5 - .5)) * .6 * (j > .1 && j < .8 ? 1 : 0); }
          if (Math.random() < dt * 20 * (1 - k)) c.fx.burst([car.pos[0] - 3.2, .6, 2.6], 1, { colors: [0xffffff, 0xe0e0e8], speed: 1, life: .6, size: .35, grav: -2, emis: .2, fade: true });
        },
        cam: t => { const k = clamp(t / 2.8, 0, 1), x = lerp(-34, 2, 1 - Math.pow(1 - k, 2.4)); return { target: [x * .9 + .5, 2.2, 3], yaw: .18, pitch: .24, dist: 15, fit: 12 }; }
      };
    }
  };

  /* 4 · Rieles Muertos: el tren por el desierto al anochecer, y sustos */
  WORLDS.rieles = {
    min: 6.5,
    look: { accent: '#f0c27c' },
    sky: 'linear-gradient(180deg,#1b1640 0%,#5a2a5a 40%,#d8643a 78%,#f7b267 100%)',
    env: { sky: 0xd88a6a, gnd: 0x4a2a2a, sun: 0xff9a5a, fog: 0xc8704a, fogNear: 30, fogFar: 110, light: [.9, .35, .2], amb: .5, sunK: .95 },
    build(c) {
      const st = group();
      box(st, 200, 1, 80, 0xd9a066, 0, -.5, 0);
      box(st, 200, .25, 3.2, 0x8a6a4a, 0, .12, 0);
      box(st, 200, .25, .2, 0x6a6a78, 0, .4, -.8); box(st, 200, .25, .2, 0x6a6a78, 0, .4, .8);
      c.scene.add(bake(st));
      // traviesas y decorado que pasan (el mundo se mueve, el tren se queda)
      const moving = [];
      for (let i = 0; i < 40; i++) moving.push({ n: box(c.scene, .5, .2, 2.6, 0x5a3a2a, -60 + i * 3, .28, 0), sp: 1, w: 120 });
      const deco = group(); c.scene.add(deco);
      for (let i = 0; i < 14; i++) {
        const cact = group().at(-70 + i * 11 + Math.random() * 4, 0, (i % 2 ? 1 : -1) * (8 + Math.random() * 10));
        box(cact, .9, 3.5 + Math.random() * 2, .9, 0x3f8a4a, 0, 2, 0); box(cact, 1.6, .7, .7, 0x3f8a4a, .6, 2.5, 0); box(cact, .7, 1.4, .7, 0x3f8a4a, 1.2, 3.2, 0);
        deco.add(cact); moving.push({ n: cact, sp: 1, w: 154 });
      }
      for (let i = 0; i < 6; i++) { const m = group().at(-80 + i * 32, 0, -38); box(m, 14, 10 + (i % 3) * 4, 8, 0xb5543a, 0, 5, 0); box(m, 16, 1.2, 9, 0x9a4430, 0, 10.5 + (i % 3) * 4, 0); deco.add(m); moving.push({ n: m, sp: .35, w: 192 }); }
      // el tren
      const train = group().at(0, .55, 0); c.scene.add(train);
      mesh(train, geo.cyl, 0x2a2a34, 2.6, 7, 2.6, 6, 2.2, 0, { rot: [0, 0, Math.PI / 2] });
      box(train, 3.2, 4, 3, 0xa8323a, 1.6, 2.6, 0); box(train, 3.6, .4, 3.4, 0x1c1c22, 1.6, 4.7, 0);
      box(train, .7, .7, .1, 0xffd88a, 1.6, 3.4, 1.52, { emis: 1 });
      mesh(train, geo.cyl, 0x1c1c22, 1, 1.6, 1, 8.2, 4.2, 0); mesh(train, geo.cone, 0x1c1c22, 1.6, .7, 1.6, 8.2, 5.2, 0, { rot: [Math.PI, 0, 0] });
      box(train, .8, .8, .2, 0xfff2b3, 9.6, 2.2, 0, { emis: 1 });
      box(train, 10, .6, 3.2, 0x6a4a3a, -5, .9, 0);       // vagón plataforma
      box(train, 10, .7, .2, 0x4a3226, -5, 1.5, 1.55); box(train, 10, .7, .2, 0x4a3226, -5, 1.5, -1.55);
      const wh = []; [-8, -2, 1, 4, 7].forEach(x => { wh.push(mesh(train, geo.cyl, 0x1c1c22, 1.3, .3, 1.3, x, .2, 1.4, { rot: [Math.PI / 2, 0, 0] })); wh.push(mesh(train, geo.cyl, 0x1c1c22, 1.3, .3, 1.3, x, .2, -1.4, { rot: [Math.PI / 2, 0, 0] })); });
      const lamp = group(); c.me.P.armR.add(lamp); lamp.at(0, -1.9, .1); c.cleanup.push(() => c.me.P.armR.remove(lamp));
      box(lamp, .4, .5, .4, 0xffd88a, 0, 0, 0, { emis: 1 }); box(lamp, .5, .1, .5, 0x1c1c22, 0, .3, 0);
      const glow = mesh(lamp, geo.ball, 0xffb84a, 2.4, 2.4, 2.4, 0, 0, 0, { emis: 1, add: true, alpha: .25 });
      train.add(c.me.root); train.add(c.her.root);
      c.me.root.at(-6.5, 1.2, .2); c.her.root.at(-3.5, 1.2, .2); c.me.root.rot[1] = .9; c.her.root.rot[1] = .5;
      // las sombras que persiguen el tren
      const ghosts = [];
      for (let i = 0; i < 4; i++) {
        const g = group(); c.scene.add(g);
        box(g, 1.6, 3.4, 1, 0x15101c, 0, 1.7, 0); box(g, 1.2, 1.2, 1.1, 0x15101c, 0, 3.9, 0);
        box(g, .22, .12, .05, 0xff3030, -.25, 4, .57, { emis: 1 }); box(g, .22, .12, .05, 0xff3030, .25, 4, .57, { emis: 1 });
        box(g, .5, 2.2, .5, 0x15101c, -1, 2.6, .5, { rot: [-1.3, 0, 0] }); box(g, .5, 2.2, .5, 0x15101c, 1, 2.6, .5, { rot: [-1.3, 0, 0] });
        ghosts.push({ g, z: 5 + i * 2.2, x0: -26 - i * 6, ph: i });
      }
      const BOO = 3.2;
      let boo = false;
      return {
        update(dt, t) {
          const v = 16;
          moving.forEach(m => { m.n.pos[0] -= v * m.sp * dt; if (m.n.pos[0] < -m.w / 2 - 10) m.n.pos[0] += m.w; });
          wh.forEach(w => { w.rot[1] += dt * 12; });
          train.pos[1] = .55 + Math.abs(Math.sin(t * 18)) * .04;
          if (Math.random() < dt * 22) c.fx.burst([8.2, 6, 0], 1, { colors: [0x3a3440, 0x5a5460], speed: 1.5, life: 1.4, size: .9, grav: -3, emis: .1, fade: true, lift: 2 });
          glow.alpha = .2 + Math.sin(t * 17) * .04;
          ghosts.forEach((q, i) => {
            const k = clamp((t - .3 - i * .25) / 2.6, 0, 1);
            q.g.at(lerp(q.x0, -9 + i * 3, ease.out(k)) + (t > BOO ? -(t - BOO) * 14 : 0), Math.abs(Math.sin(t * 9 + q.ph)) * .3, q.z);
            q.g.rot[1] = Math.PI / 2;
          });
          if (t > BOO && !boo) { boo = true; c.thump(); c.fx.burst([-6, 4, 3], 18, { colors: [0xffd88a, 0xffffff], speed: 7, life: .6, size: .25, add: true }); c.fx.ring([-6, 3, 3], 0xffd88a, 5, .5, { tilt: Math.PI / 2 }); }
          const scared = t > BOO - .9 && t < BOO + .3;
          c.me.animate(dt, 0, scared ? (P, A) => { POSE.scared(P, A); } : POSE.lantern);
          c.her.animate(dt, 0, scared ? POSE.scared : (t > BOO + .3 ? POSE.cheer : null));
          if (scared) { c.me.root.pos[1] = 1.2 + Math.max(0, Math.sin((t - BOO + .9) * 7)) * .7; c.her.root.pos[1] = 1.2 + Math.max(0, Math.sin((t - BOO + .8) * 7)) * .7; }
          else { c.me.root.pos[1] = 1.2; c.her.root.pos[1] = 1.2; }
        },
        cam: t => ({ target: [-2, 2.8, 1], yaw: .55 + Math.sin(t * .3) * .05, pitch: .2, dist: 19, fit: 16 })
      };
    }
  };

  /* 5 · Su juego de terror: un pasillo oscuro... que se llena de monedas */
  WORLDS.exito = {
    min: 7.5,
    look: { accent: '#ff6b7f' },
    sky: 'linear-gradient(180deg,#07060c 0%,#120a14 100%)',
    env: { sky: 0x6a5a7a, gnd: 0x2a1828, sun: 0xffd8a0, fog: 0x07060c, fogNear: 16, fogFar: 52, light: [-.2, .9, -.5], amb: .46, sunK: .45 },
    build(c) {
      const st = group(), L = 44;
      box(st, 9, .4, L, 0x3a2a26, 0, -.2, -L / 2 + 8);
      for (let z = 8; z > -L + 8; z -= 2) box(st, 9, .02, .08, 0x2a1c1a, 0, .01, z);
      box(st, .4, 7, L, 0x5a3a44, -4.5, 3.5, -L / 2 + 8); box(st, .4, 7, L, 0x5a3a44, 4.5, 3.5, -L / 2 + 8);
      for (let z = 4; z > -L + 10; z -= 6) {
        [-1, 1].forEach(s => { box(st, .2, 4.4, 2.4, 0x6b4426, s * 4.3, 2.2, z); box(st, .22, .9, .7, 0xd8c8a0, s * 4.28, 3.7, z); mesh(st, geo.ball, 0xd8b04a, .25, .25, .25, s * 4.2, 2.1, z - .8); });
      }
      c.scene.add(bake(st));
      const lamps = [];
      for (let z = 6; z > -L + 10; z -= 7) lamps.push(box(c.scene, 1.6, .2, .6, 0xfff2c0, 0, 6.75, z, { emis: 1 }));
      const end = box(c.scene, 3, 5, .2, 0x6b4426, 0, 2.5, -30);
      const light = box(c.scene, 2.8, 4.8, .1, 0xfff2c0, 0, 2.5, -30.2, { emis: 1, alpha: 0, add: true });
      c.me.root.at(-1.6, 0, 2); c.her.root.at(1.6, 0, 2); c.me.root.rot[1] = Math.PI; c.her.root.rot[1] = Math.PI;
      // monedas de oro
      const coins = [];
      for (let i = 0; i < 46; i++) { const n = mesh(c.scene, geo.cyl, 0xffcf3a, .9, .18, .9, 0, -5, 0, { emis: .35, rot: [Math.PI / 2, 0, 0] }); n.visible = false; coins.push({ n, x: (Math.random() - .5) * 7.5, z: -1 - Math.random() * 10, d: Math.random() * 1.6, vy: 0, y: 9, rest: .12 + Math.random() * .25, sp: (Math.random() - .5) * 10 }); }
      // marcador de jugadores
      const pill = document.createElement('div'); pill.className = 'w3-pill'; pill.innerHTML = '<i></i><span>jugadores</span><b>0</b>'; c.ui.appendChild(pill);
      c.cleanup.push(() => pill.remove());
      const ON = 2.9, fmt = n => Math.round(n).toLocaleString('es-ES');
      let lit = false;
      return {
        update(dt, t) {
          const walk = t < 1.9;
          const z = 2 - smooth(clamp(t / 1.9, 0, 1)) * 7;
          c.me.root.pos[2] = z; c.her.root.pos[2] = z;
          const flick = !lit && (Math.sin(t * 23) > .6 || Math.random() < .08);
          lamps.forEach((l, i) => { l.emis = lit ? 1 : (flick && i % 2 ? .1 : .9); l.color = M.rgb(lit ? 0xfff2c0 : (flick ? 0x5a3030 : 0xffd8a0)); });
          c.R.envAmb = lit ? .7 : (flick ? .22 : .46);
          if (t > 2.1) { const k = clamp((t - 2.1) / .8, 0, 1); end.rot[1] = -k * 1.4; end.pos[0] = -k * 1.2; light.alpha = k; }
          if (t > ON && !lit) { lit = true; c.R.setEnv({ fog: 0x3a2030, fogNear: 25, fogFar: 80 }); c.cv.style.background = 'linear-gradient(180deg,#2a1020 0%,#5a2a3a 100%)'; c.fx.burst([0, 3, -25], 40, { colors: [0xffcf3a, 0xffffff], speed: 10, life: 1, size: .3, add: true }); c.chime(true); pill.classList.add('on'); }
          if (lit) {
            const j = t - ON;
            coins.forEach(q => {
              if (j < q.d) return; q.n.visible = true;
              if (q.y > q.rest) { q.vy -= 26 * dt; q.y = Math.max(q.rest, q.y + q.vy * dt); if (q.y === q.rest) { q.vy = 0; } q.n.rot[2] += q.sp * dt; }
              q.n.at(q.x, q.y, q.z + (z - 2) * 0);
            });
            pill.querySelector('b').textContent = fmt(Math.pow(clamp(j / 2.6, 0, 1), 2.4) * 312480 + j * 37);
          }
          c.me.animate(dt, walk ? .7 : 0, lit ? POSE.give : (walk ? null : POSE.scared));
          c.her.animate(dt, walk ? .7 : 0, lit ? POSE.cheer : null);
          if (lit) { c.me.root.rot[1] = lerp(c.me.root.rot[1], Math.PI - .5, .06); c.her.root.rot[1] = lerp(c.her.root.rot[1], Math.PI + .2, .06); }
        },
        cam: t => { const z = 2 - smooth(clamp(t / 1.9, 0, 1)) * 7; return { target: [0, 2.6, z], yaw: Math.PI - .2, pitch: .3, dist: 16, fit: 11 }; }
      };
    }
  };

  /* 6 · Dejamos de hablar: dos islas nevadas que se separan */
  WORLDS.distancia = {
    min: 6.5,
    look: { accent: '#cfe0ff' },
    sky: 'linear-gradient(180deg,#0e1630 0%,#2a3a66 55%,#6a7aa8 100%)',
    env: { sky: 0xb8c8f0, gnd: 0x2a3050, sun: 0xd8e4ff, fog: 0x34446e, fogNear: 25, fogFar: 90, light: [.3, .8, .5], amb: .55, sunK: .55 },
    build(c) {
      const mk = (x) => { const g = group().at(x, 0, 0); c.scene.add(g); const s = group(); island(s, 0, 0, 0, 7.5, 7.5, 0xf4f8ff, 0x5a6a8a); tree(s, x < 0 ? -2 : 2, -2, .7, 0x5a3a2a, 0x2f6d5f, { pine: true, snow: true }); box(s, 1.6, .5, 1.2, 0xffffff, x < 0 ? 2 : -2, .25, -2.2); g.add(bake(s)); return g; };
      const A = mk(-3.9), B = mk(3.9);
      const planks = [];
      for (let i = 0; i < 4; i++) planks.push({ n: box(c.scene, .7, .25, 2, 0x8a6a4a, -.75 + i * .5, -.1, 0), vy: 0, d: .2 + i * .15 });
      A.add(c.me.root); B.add(c.her.root);
      c.me.root.at(.8, 0, 1); c.her.root.at(-.8, 0, 1); c.me.root.rot[1] = 1.2; c.her.root.rot[1] = -1.2;
      const snow = [];
      for (let i = 0; i < 90; i++) snow.push(box(c.scene, .14, .14, .14, 0xffffff, (Math.random() - .5) * 50, Math.random() * 30 - 6, (Math.random() - .5) * 30, { emis: .7 }));
      const BREAK = 1.6;
      return {
        update(dt, t) {
          const k = smooth(clamp((t - BREAK) / 5, 0, 1));
          A.at(-3.9 - k * 7, Math.sin(t * .8) * .3, -k * 1.5); B.at(3.9 + k * 7, Math.sin(t * .8 + 2) * .3, -k * 1.5);
          A.rot[1] = -k * .25; B.rot[1] = k * .25;
          planks.forEach(p => { if (t > BREAK + p.d) { p.vy -= 16 * dt; p.n.pos[1] += p.vy * dt; p.n.rot[2] += dt * 2; } });
          snow.forEach(s => { s.pos[1] -= dt * 3; s.pos[0] += Math.sin(t + s.pos[2]) * dt * .8; if (s.pos[1] < -8) s.pos[1] = 22; });
          const apart = t > BREAK + .4;
          c.me.root.rot[1] = lerp(c.me.root.rot[1], apart ? .2 : 1.2, .04);
          c.her.root.rot[1] = lerp(c.her.root.rot[1], apart ? -.2 : -1.2, .04);
          c.me.animate(dt, 0, apart ? POSE.sad : null);
          c.her.animate(dt, 0, apart ? POSE.sad : null);
        },
        cam: t => ({ target: [0, 1.5, 0], yaw: 0, pitch: .3, dist: 22 + Math.min(t, 7) * .6, fit: 13 + Math.min(t, 7) * 2.2 })
      };
    }
  };

  /* 7 · Mejor que nunca: llegar juntos a lo más alto de la torre (y fuegos artificiales) */
  WORLDS.reencuentro = {
    min: 7,
    look: { accent: '#7dffd8' },
    sky: 'linear-gradient(180deg,#05001a 0%,#1a0a4a 45%,#3a1a6a 80%,#5a3a8a 100%)',
    env: { sky: 0xb8a8ff, gnd: 0x2a1a4a, sun: 0xe8e0ff, fog: 0x1a0a40, fogNear: 40, fogFar: 140, light: [.4, .9, .3], amb: .6, sunK: .6 },
    build(c) {
      const st = group();
      const cols = [0xff5ea8, 0x7b5cff, 0x3ad0ff, 0x6ee07a, 0xffd23f, 0xff8a3a];
      for (let i = 0; i < 12; i++) { box(st, 10, 3, 10, cols[i % cols.length], 0, -1.5 - i * 3, 0); box(st, 10.4, .3, 10.4, 0xffffff, 0, -3 * i - .15, 0); }
      box(st, 11, .6, 11, 0xffffff, 0, -.3, 0);
      stars(st, 160, 120);
      c.scene.add(bake(st));
      // escalones por los que suben
      const stepsL = [[-9, -6, 2], [-7, -3.5, 3.5], [-5.5, -1.2, 2.2]], stepsR = [[9, -6, -2], [7, -3.5, -3.5], [5.5, -1.2, -2.2]];
      [...stepsL, ...stepsR].forEach(([x, y, z], i) => box(c.scene, 2.4, .6, 2.4, cols[(i + 2) % cols.length], x, y - .3, z));
      const flag = group().at(0, 0, -3.5); c.scene.add(flag);
      box(flag, .25, 6, .25, 0xffffff, 0, 3, 0); const cloth = box(flag, 2.4, 1.4, .1, 0x7dffd8, 1.3, 5.2, 0, { emis: .6 });
      const pathL = [[-11, -6, 3], ...stepsL, [-1.6, 0, 1]], pathR = [[11, -6, -3], ...stepsR, [1.6, 0, 1]];
      const at = (path, t) => {   // saltos de escalón en escalón
        const seg = clamp(Math.floor(t / .55), 0, path.length - 2), k = clamp(t / .55 - seg, 0, 1);
        if (t >= (path.length - 1) * .55) return path[path.length - 1].slice();
        const a = path[seg], b = path[seg + 1];
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * 2.2, lerp(a[2], b[2], k)];
      };
      const MEET = (pathL.length - 1) * .55 + .3;
      let fireT = MEET, met = false;
      return {
        update(dt, t) {
          const pm = at(pathL, t), ph = at(pathR, t);
          c.me.root.at(...pm); c.her.root.at(...ph);
          c.me.root.rot[1] = t < MEET ? Math.PI / 2 : .9;
          c.her.root.rot[1] = t < MEET ? -Math.PI / 2 : -.9;
          if (t > MEET && !met) { met = true; c.fx.burst([0, 4.5, 1], 30, { colors: [0x7dffd8, 0xffffff, 0xffd23f], speed: 7, life: 1, size: .25, add: true }); c.chime(true); }
          if (t > fireT) {
            fireT += .55 + Math.random() * .4;
            const p = [(Math.random() - .5) * 26, 12 + Math.random() * 8, -6 - Math.random() * 10];
            const col = [0xff5ea8, 0x7dffd8, 0xffd23f, 0x9b82ff, 0x3ad0ff][(Math.random() * 5) | 0];
            c.fx.burst(p, 34, { colors: [col, 0xffffff], speed: 11, life: 1.3, size: .3, add: true, grav: 4, drag: 2 });
            c.fx.ring(p, col, 5, .7, { tilt: Math.PI / 2 }); c.pop();
          }
          cloth.rot[1] = Math.sin(t * 3) * .2;
          const jumping = t < MEET - .3;
          c.me.animate(dt, jumping ? .4 : 0, met ? POSE.high : null);
          c.her.animate(dt, jumping ? .4 : 0, met ? (P, A) => { P.armL.rot[2] = -2.9; P.armL.rot[0] = -.3; } : null);
        },
        cam: t => ({ target: [0, 1.5, 0], yaw: -.5 + t * .06, pitch: .3, dist: 21, fit: 17 })
      };
    }
  };

  /* Final · el portal que la lleva al último reto */
  WORLDS.portal = {
    look: { accent: '#c9bcff', id: 'reencuentro' },
    sky: 'linear-gradient(180deg,#05001a 0%,#20104a 55%,#4a2a8a 100%)',
    env: { sky: 0xc9bcff, gnd: 0x2a1a4a, sun: 0xe0d8ff, fog: 0x20104a, fogNear: 30, fogFar: 110, light: [.3, .9, .4], amb: .62, sunK: .6 },
    build(c) {
      const st = group();
      island(st, 0, 0, 0, 22, 18, 0x6a5aa8, 0x3a2a6a);
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; box(st, .8, 1.4 + (i % 3) * .6, .8, 0x9b82ff, Math.cos(a) * 9, .7, Math.sin(a) * 7.5, { emis: .4 }); }
      stars(st, 120, 110);
      c.scene.add(bake(st));
      const P = group().at(0, 4.6, -4); c.scene.add(P);
      const ring = mesh(P, geo.torus, 0xc9bcff, 8, 8, 8, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: .9 });
      const ring2 = mesh(P, geo.torus, 0x7df3ff, 7.2, 7.2, 7.2, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: 1, add: true, alpha: .7 });
      const disc = mesh(P, geo.cyl20, 0x9b82ff, 7, .1, 7, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: 1, add: true, alpha: .55 });
      P.scl = [0, 0, 0];
      c.her.root.at(0, 0, 6); c.her.root.rot[1] = Math.PI;
      c.me.root.at(-5, 0, 7); c.me.root.rot[1] = 2.4;
      const st0 = { walk: false, t0: 0 };
      c.walkIn = () => { st0.walk = true; st0.t0 = c.t; };
      return {
        update(dt, t) {
          const k = ease.back(clamp(t / 1.2, 0, 1)); P.scl = [k, k, k];
          ring.rot[1] = t * .8; ring2.rot[1] = -t * 1.3; disc.alpha = .45 + Math.sin(t * 4) * .12;
          if (Math.random() < dt * 30) { const a = Math.random() * TAU; c.fx.burst([Math.cos(a) * 5, 4.6 + Math.sin(a) * 5, -4], 1, { colors: [0xc9bcff, 0x7df3ff, 0xffffff], speed: 1, life: .7, size: .2, add: true, grav: 0 }); }
          let sp = 0;
          if (st0.walk) {
            const j = t - st0.t0, z = 6 - j * 5.5; sp = 1;
            c.her.root.pos[2] = Math.max(-4, z);
            const s = z < -1 ? clamp(1 - (-1 - z) / 3, 0, 1) : 1; c.her.root.scl = [s, s, s];
          }
          c.her.animate(dt, sp, null);
          c.me.animate(dt, 0, POSE.wave);
        },
        cam: t => ({ target: [0, 3.2, 1], yaw: .25, pitch: .2, dist: 20, fit: 15 })
      };
    }
  };

  /* =========================================================
     DIRECTOR
     ========================================================= */
  function play(opts) {
    return new Promise(resolve => {
      const cv = opts.canvas, host = cv.parentElement;
      const names = (opts.scenes && opts.scenes.length) ? opts.scenes : ['obby'];
      const worlds = opts.worlds || [];
      const N = names.length;
      let R;
      try { R = new M.Renderer(cv, { dpr: 2 }); } catch (e) { R = null; }

      let skipFlag = false, running = true, raf = 0, last = 0;
      const tweens = [];
      const tween = (dur, fn) => new Promise(res => { if (skipFlag) { fn(1); res(); return; } tweens.push({ t: 0, dur, fn, res }); });
      current = { skip() { skipFlag = true; tweens.splice(0).forEach(a => { a.fn(1); a.res(); }); } };

      // Sin WebGL: solo las tarjetas
      if (!R) {
        (async () => {
          for (let i = 0; i < N && !skipFlag; i++) { if (opts.onStage) opts.onStage(i); await opts.card.show(i); await opts.card.hide(); }
          current = null; resolve();
        })();
        return;
      }

      // capa de interfaz (nombres, cartel de teletransporte, marcadores)
      const ui = document.createElement('div'); ui.className = 'w3-ui'; host.insertBefore(ui, cv.nextSibling);
      const tag = txt => { const d = document.createElement('div'); d.className = 'w3-tag'; d.textContent = txt; ui.appendChild(d); return d; };
      const tagMe = tag(opts.names && opts.names.me || 'Yo'), tagHer = tag(opts.names && opts.names.her || 'Ella');
      const tp = document.createElement('div'); tp.className = 'w3-tp'; tp.innerHTML = '<div class="w3-tp-spin"></div><p class="w3-tp-k">Teletransportando a</p><p class="w3-tp-w"></p>'; host.appendChild(tp);
      const flash = document.createElement('div'); flash.className = 'w3-flash'; host.appendChild(flash);

      // sonidos suaves (la música va por encima)
      const S = M.sfx();
      const C = {
        R, cv, ui, fx: null, scene: null, t: 0, cleanup: [],
        me: avatar(LOOK_ME), her: avatar(LOOK_HER),
        sfx: (a, b, d, ty, v) => S.tone(a, b, d, ty, v),
        chime: big => [660, 880, 1320, big ? 1760 : 0].forEach((f, i) => f && S.tone(f, f * 1.01, .16, 'triangle', .035, i * .07)),
        pop: () => { S.noise(.25, .05, 900); S.tone(300, 900, .12, 'sine', .02); },
        thump: () => { S.noise(.3, .12, 300); S.tone(90, 40, .3, 'sine', .12); }
      };
      let world = null, worldT = 0, cardBox = { top: 84, bottom: 300 };
      const cam = { pos: [0, 5, 20], target: [0, 2, 0], fov: 46, shiftY: 0 };

      function frameCam(spec) {
        const asp = R.W / R.H, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
        // zona libre debajo de la tarjeta de texto
        let topFree = cardBox.bottom + 8, botFree = R.H - 50;
        if (cardBox.top > R.H * .45) { topFree = 70; botFree = cardBox.top - 8; }
        const avail = clamp((botFree - topFree) / R.H, .3, 1);
        const centerPx = (topFree + botFree) / 2;
        cam.shiftY = clamp(2 * centerPx / R.H - 1, -.65, .65);
        const fitDist = (spec.fit / 2) / Math.tan(hf / 2);
        const d = Math.max(spec.dist, fitDist) * clamp(.72 / avail, .95, 1.75);
        const cp = Math.cos(spec.pitch), yaw = spec.yaw;
        cam.target = spec.target;
        cam.pos = [spec.target[0] + Math.sin(yaw) * cp * d, spec.target[1] + Math.sin(spec.pitch) * d, spec.target[2] + Math.cos(yaw) * cp * d];
      }

      function teardown() {
        if (!world) return;
        C.cleanup.splice(0).forEach(f => { try { f(); } catch (e) {} });
        // devolver a los avatares a su estado normal
        [C.me, C.her].forEach(a => { a.root.scl = [1, 1, 1]; a.root.rot = [0, 0, 0]; a.root.pos = [0, 0, 0]; a.P.shadow.visible = true; if (a.root.parent) a.root.parent.remove(a.root); });
        C.scene.children.forEach(n => n.geo && n.geo.col && R.free(n.geo));
        world = null;
      }
      function buildWorld(name, idx) {
        const W = WORLDS[name] || WORLDS.obby;
        C.scene = group(); C.fx = new FX(C.scene); C.t = 0;
        C.scene.add(C.me.root); C.scene.add(C.her.root);
        R.setEnv(W.env); R.envAmb = W.env.amb; R.envSun = W.env.sunK;
        cv.style.background = W.sky;
        const look = Object.assign({ id: name }, W.look);
        if (opts.onUniverse) opts.onUniverse(look);
        cardBox = opts.cardBox ? opts.cardBox(idx) : cardBox;
        world = W.build(C); worldT = 0;
      }

      async function goto(name, idx, label) {
        if (world) {
          tp.querySelector('.w3-tp-w').textContent = label || '';
          tp.classList.toggle('no-label', !label);
          tp.classList.add('on'); await tween(.42, () => {});
          teardown();
        }
        buildWorld(name, idx);
        tp.querySelector('.w3-tp-w').textContent = label || '';
        if (skipFlag) return;
        if (!tp.classList.contains('on') && label) { tp.classList.add('on'); tp.classList.toggle('no-label', false); await tween(.6, () => {}); }
        await tween(.35, () => {});
        tp.classList.remove('on');
      }

      function placeTag(el, a, show) {
        if (!show || !a.root.parent) { el.style.opacity = 0; return; }
        const w = a.P.head.world, p = R.project([w[12], w[13] + 1.55 * Math.abs(a.root.world[5] || 1), w[14]]);
        el.style.opacity = p.vis ? 1 : 0;
        el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      }

      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        for (let i = tweens.length - 1; i >= 0; i--) { const a = tweens[i]; a.t += dt; const p = Math.min(1, a.t / a.dur); a.fn(p); if (p >= 1) { tweens.splice(i, 1); a.res(); } }
        if (world) {
          worldT += dt; C.t = worldT;
          world.update(dt, worldT);
          C.fx.update(dt);
          R.resize();
          frameCam(world.cam(worldT));
          R.render(C.scene, cam);
          const showTags = !tp.classList.contains('on');
          placeTag(tagMe, C.me, showTags); placeTag(tagHer, C.her, showTags);
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function finish() {
        if (!running) return;
        running = false; cancelAnimationFrame(raf);
        try { teardown(); } catch (e) {}
        ui.remove(); tp.remove();
        setTimeout(() => flash.remove(), 1400);
        current = null; resolve();
      }

      async function director() {
        for (let i = 0; i < N; i++) {
          if (skipFlag) return;
          await goto(names[i], i, worlds[i]);
          if (skipFlag) return;
          if (opts.onStage) opts.onStage(i);
          const minT = (WORLDS[names[i]] || WORLDS.obby).min || 6;
          await Promise.all([opts.card.show(i), tween(minT, () => {})]);
          await opts.card.hide();
        }
        if (skipFlag) return;
        await goto('portal', N, '');
        if (skipFlag) return;
        await opts.card.showFinal();
        await opts.card.hide();
        if (skipFlag) return;
        if (C.walkIn) C.walkIn();
        await tween(1.9, () => {});
        flash.classList.add('on');
        S.tone(200, 1600, .6, 'sine', .05);
        await tween(.5, () => {});
      }
      director().then(finish, err => { console.error(err); finish(); });
    });
  }

  G.Obby = { play, skip, worlds: Object.keys(WORLDS) };
})(window);
