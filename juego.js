/* =========================================================
   EL ÚLTIMO RETO · duelo de espadas estilo anime en 3D
   Cámara en tercera persona que fija al rival, combos con salto
   hacia el enemigo, combos en el aire, esquiva perfecta con cámara
   lenta, tajos de viento y una ultra cinematográfica.
   Enemigos = personajes de Roblox con espada (sombras, samuráis y
   el Ronin Carmesí como jefe final).
   Necesita motor3d.js cargado antes.
   ========================================================= */
(function (G) {
  'use strict';
  const M = G.M3;
  if (!M) return;
  const { TAU, clamp, lerp, ease, smooth, geo, group, box, mesh, bake, FX, avatar, rgb, Node } = M;
  const ARENA = 34;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const HERO = { skin: 0xf7d6c4, shirt: 0xc8142a, dress: true, belt: 0xffffff, shoes: 0xf2f2f6, hair: 'long', hairCol: 0x4a2c1c, hairHi: 0xc9a06a, glasses: true, necklace: true, bracelet: true, blush: true, cape: 0x6c4cf0, capeTrim: 0xf2c14e };

  // Ajustes de dificultad (todo en un sitio)
  const TUNE = {
    hp: 100, speed: 13,
    combo: [11, 11, 13, 22], range: 4.8,
    tajo: { cd: 4.5, dmg: 26, speed: 44, life: .85 },
    giro: { cd: 8, dmg: 22, radius: 6.8 },
    dash: { cd: 1, dur: .2, speed: 36, inv: .42 },
    potion: 30, betweenWaves: 35, ultGain: .42, ultDmg: 95
  };

  /* ---------- animaciones de espada por fotogramas clave ----------
     anticipación lenta → golpe rápido → recuperación (rotaciones en radianes) */
  const READY = { armR: [-.95, .35, .12], armL: [-.25, 0, -.3], torso: [.05, .2, 0], body: [0, 0, 0], legL: [-.15, 0, 0], legR: [.12, 0, 0] };
  const K = o => Object.assign({}, READY, o);
  const CLIPS = [
    { dur: .3, hit: .11, act: [.05, .2], spread: 1.6, range: .4, lunge: 11, keys: [
      [0, K({})],
      [.06, K({ armR: [-1.25, 1.6, .7], torso: [.05, 1.0, 0], legL: [.25, 0, 0], legR: [-.25, 0, 0] })],
      [.15, K({ armR: [-1.45, -1.55, -.2], torso: [.12, -1.05, 0], armL: [.5, 0, -.6], legL: [-.6, 0, 0], legR: [.4, 0, 0] })],
      [.3, K({ armR: [-1.3, -.9, .1], torso: [.05, -.45, 0] })]] },
    { dur: .3, hit: .11, act: [.05, .2], spread: 1.6, range: .4, lunge: 11, keys: [
      [0, K({ armR: [-1.3, -.9, .1], torso: [.05, -.45, 0] })],
      [.06, K({ armR: [-1.4, -1.6, -.3], torso: [0, -1.05, 0], legL: [-.25, 0, 0] })],
      [.15, K({ armR: [-1.7, 1.55, .9], torso: [-.05, 1.05, 0], armL: [-.6, 0, -.9], legL: [.45, 0, 0], legR: [-.55, 0, 0] })],
      [.3, K({ armR: [-1.5, .8, .2], torso: [0, .45, 0] })]] },
    // 3 · patada giratoria con la pierna estirada (como en el vídeo)
    { dur: .38, hit: .17, act: [.09, .24], spread: 1.7, range: .3, lunge: 10, kick: true, keys: [
      [0, K({ armR: [-1.5, .8, .2], torso: [0, .45, 0] })],
      [.08, K({ legR: [-.3, 0, .55], torso: [0, .7, 0], body: [0, .7, -.12], armR: [-.6, .4, .6], armL: [-.3, 0, -.9] })],
      [.18, K({ legR: [-.45, 0, 1.65], legL: [.15, 0, -.15], torso: [0, -.35, 0], body: [0, -1.0, -.4], armR: [-.2, 0, 1.3], armL: [.2, 0, -1.3] })],
      [.27, K({ legR: [-.3, 0, 1.2], torso: [0, -.3, 0], body: [0, -.8, -.25], armR: [-.4, 0, 1.0], armL: [0, 0, -1.0] })],
      [.38, K({})]] },
    // 4 · tajo ascendente que lanza al enemigo por los aires
    { dur: .46, hit: .2, act: [.1, .3], spread: 1.4, range: .6, lunge: 9, jump: 6, launcher: true, keys: [
      [0, K({})],
      [.1, K({ armR: [.2, .2, .35], armL: [-.4, 0, -.4], torso: [.3, .3, 0], body: [.18, 0, 0], legL: [-.7, 0, 0], legR: [.5, 0, 0] })],
      [.22, K({ armR: [-3.0, -.1, .15], armL: [-1.6, 0, -.6], torso: [-.35, -.2, 0], body: [-.14, 0, 0], legL: [-.35, 0, 0], legR: [.3, 0, 0] })],
      [.46, K({ armR: [-2.4, 0, .2], armL: [-.6, 0, -.4], torso: [-.1, 0, 0] })]] }
  ];
  function samplePose(clip, t) {
    const ks = clip.keys; let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
    const a = ks[i], b = ks[i + 1], u = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1), e = u * u * (3 - 2 * u), out = {};
    for (const j in a[1]) out[j] = a[1][j].map((v, n) => v + (b[1][j][n] - v) * e);
    return out;
  }

  /* ---------- enemigos: personajes de Roblox con espada ---------- */
  const EN = {
    shadow: { hp: 55, r: 1.1, speed: 9, dmg: 9, wind: .55, range: 3.4, lunge: 9, sword: 3.2, edge: 0xff3050, blade: 0x9a98b0 },
    samurai: { hp: 150, r: 1.2, speed: 7, dmg: 13, wind: .5, range: 3.8, lunge: 7, sword: 3.9, edge: 0x7ab8ff, blade: 0xe4e8f4 },
    boss: { hp: 850, r: 2.4, speed: 9, dmg: 18, wind: .5, range: 6.2, lunge: 15, sword: 6.6, edge: 0xff2a3a, blade: 0xffc0c8 }
  };
  const LOOKS = {
    shadow: { skin: 0xd8d0c8, shirt: 0x14121c, sleeves: true, pants: 0x14121c, shoes: 0x0a0a10, hair: 'short', hairCol: 0x0a0a10 },
    samurai: { skin: 0xf0d0b0, shirt: 0xf4f4fa, sleeves: true, pants: 0x2a2a3a, shoes: 0x1a1a22, hair: 'short', hairCol: 0x101018 },
    boss: { skin: 0xd8d8e8, shirt: 0x16101e, sleeves: true, pants: 0x16101e, shoes: 0x0a0810, hair: 'short', hairCol: 0xeef0ff, cape: 0x8a0a1a, capeTrim: 0xffd23f }
  };
  const WAVES = [
    { name: 'Las sombras', list: ['shadow', 'shadow', 'shadow', 'shadow'], cap: 2 },
    { name: 'La guardia', list: ['shadow', 'samurai', 'shadow', 'shadow', 'samurai'], cap: 3 },
    { name: 'Filo y sombra', list: ['samurai', 'shadow', 'samurai', 'shadow', 'shadow', 'samurai'], cap: 3 },
    { name: 'El Ronin Carmesí', list: ['boss'], cap: 1, boss: true }
  ];

  // media luna de viento (la estela blanca de los tajos del vídeo)
  function crescentGeo() {
    const P = [], N = [], seg = 16, a0 = 1.3, cx = -2.18, ri = 2.63, b0 = Math.asin(Math.sin(a0) / ri);
    const outer = [], inner = [];
    for (let i = 0; i <= seg; i++) {
      const u = -1 + 2 * i / seg;
      outer.push([Math.cos(u * a0), Math.sin(u * a0)]);
      inner.push([cx + ri * Math.cos(u * b0), ri * Math.sin(u * b0)]);
    }
    for (let i = 0; i < seg; i++) {
      const q = [outer[i], outer[i + 1], inner[i + 1], inner[i]];
      for (const k of [0, 1, 2, 0, 2, 3]) { P.push(q[k][0], q[k][1], 0); N.push(0, 0, 1); }
    }
    return new M.Geo(P, N);
  }
  const CRES = crescentGeo();
  // estrella de impacto blanca con rayos largos (el destello del vídeo)
  function starGeo() {
    const P = [], N = [], n = 14, R = M.rng(5), pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, r = i % 2 ? .16 : (.55 + R() * .8 + (i % 6 === 0 ? 1.9 : 0)); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; P.push(0, 0, 0, a[0], a[1], 0, b[0], b[1], 0); N.push(0, 0, 1, 0, 0, 1, 0, 0, 1); }
    return new M.Geo(P, N);
  }
  const STAR = starGeo();

  /* =========================================================
     AUDIO · música de batalla anime generada en directo + efectos
     (re menor, i–VI–III–VII; batería, bajo, acordes potentes,
     melodía y coros en el jefe). Sin archivos: no hay que descargar nada.
     ========================================================= */
  function makeAudio(ac) {
    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ac.destination);
    const sfxBus = ac.createGain(); sfxBus.gain.value = .9; sfxBus.connect(comp);
    const mus = ac.createGain(); mus.gain.value = 0; mus.connect(comp);
    const dl = ac.createDelay(); dl.delayTime.value = .3; const fb = ac.createGain(); fb.gain.value = .3; const wet = ac.createGain(); wet.gain.value = .2;
    const bus = ac.createGain(); bus.connect(mus); bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mus);
    const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
    const noise = (t, dur, type, f, q, peak, dec, out, f2) => {
      const s = ac.createBufferSource(); s.buffer = nb; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || .7;
      const g = ac.createGain(); env(g, t, .004, peak, dec); s.connect(fl); fl.connect(g); g.connect(out || bus); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
    };
    const osc = (t, type, f0, f1, dur, peak, a, out, filt) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, a || .005, peak, dur); let node = o;
      if (filt) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filt[0], t); fl.frequency.exponentialRampToValueAtTime(filt[1] || filt[0], t + dur); o.connect(fl); node = fl; }
      node.connect(g); g.connect(out || bus); o.start(t); o.stop(t + (a || .005) + dur + .05);
    };
    // ---- instrumentos ----
    const kick = t => osc(t, 'sine', 150, 42, .32, .95, .002);
    const snare = t => { noise(t, .2, 'bandpass', 1900, .8, .5, .17); osc(t, 'triangle', 200, 160, .1, .25, .002); };
    const hat = (t, open) => noise(t, open ? .25 : .05, 'highpass', 7500, .5, .12, open ? .22 : .035);
    const crash = t => noise(t, 1.6, 'highpass', 4500, .4, .22, 1.5);
    const bass = (t, n, d) => { osc(t, 'sawtooth', mtof(n), 0, d, .22, .005, bus, [900, 380]); osc(t, 'square', mtof(n - 12), 0, d, .08, .005, bus, [300, 200]); };
    const pad = (t, ns, d) => ns.forEach(n => { [-7, 0, 7].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1500; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.022, t + .06); g.gain.setValueAtTime(.022, t + d - .08); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); o.stop(t + d + .05); }); });
    const lead = (t, n, d) => { osc(t, 'square', mtof(n), 0, d, .06, .01, bus, [3600, 1800]); osc(t, 'sawtooth', mtof(n) * 1.004, 0, d, .045, .01, bus, [3000, 1500]); };
    const choir = (t, ns, d) => ns.forEach(n => [0, 12].forEach(o => { const os = ac.createOscillator(); os.type = 'triangle'; os.frequency.value = mtof(n + o); const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + .35); g.gain.setValueAtTime(.03, t + d - .2); g.gain.exponentialRampToValueAtTime(0.0001, t + d); os.connect(g); g.connect(bus); os.start(t); os.stop(t + d + .05); }));
    // ---- partitura: re menor, i–VI–III–VII (Dm–Bb–F–C) ----
    const CH = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];
    const BASSN = [38, 34, 41, 36];
    const MEL = [
      [74, 0, 77, 0, 81, 0, 79, 77, 76, 0, 74, 0, 72, 0, 74, 0],
      [74, 0, 72, 70, 0, 70, 72, 0, 74, 0, 77, 0, 74, 0, 0, 0],
      [77, 0, 81, 0, 84, 0, 81, 0, 79, 0, 77, 0, 76, 77, 79, 0],
      [76, 0, 72, 0, 76, 0, 79, 0, 81, 0, 0, 79, 76, 0, 72, 0]];
    const ARP = [0, 1, 2, 1];
    const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0], KICK2 = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0];
    let on = false, level = 1, step = 0, bar = 0, next = 0, timer = 0, muted = false, tempo = 150;
    function playStep(i, t) {
      const b = bar % 4, sd = 60 / tempo / 4;
      if (i === 0) {
        pad(t, CH[b].map(n => n + 12), sd * 16);
        if (level >= 2) choir(t, CH[b].map(n => n + 12), sd * 16);
        if ((bar % 4 === 0 && level >= 1) || (level >= 2 && bar % 2 === 0)) crash(t);
      }
      if (level >= 1) {
        if ((level >= 2 ? KICK2 : KICK)[i]) kick(t);
        if (i === 4 || i === 12) snare(t);
        if (level >= 2 && (i === 14 || i === 15) && bar % 2 === 1) snare(t);
        if (i % 2 === 0 || level >= 2) hat(t, i === 14);
        if (i % 2 === 0) bass(t, BASSN[b] + (i % 8 === 6 ? 12 : 0), sd * 1.8);
        const mn = MEL[b][i]; if (mn && bar % 8 >= 4 - (level >= 2 ? 4 : 0)) lead(t, mn, sd * 1.7);
      } else if (i % 4 === 0) osc(t, 'triangle', mtof(CH[b][ARP[i / 4]] + 24), 0, sd * 3.6, .05, .02);
    }
    function sched() {
      if (!on) return;
      if (next < ac.currentTime - .5) next = ac.currentTime + .05;   // tras una pausa de la pestaña, no recupera notas atrasadas
      while (next < ac.currentTime + .14) { playStep(step, next); next += 60 / tempo / 4; step++; if (step === 16) { step = 0; bar++; } }
    }
    const fade = (v, d) => { const t = ac.currentTime; mus.gain.cancelScheduledValues(t); mus.gain.setValueAtTime(mus.gain.value, t); mus.gain.linearRampToValueAtTime(v, t + d); };
    const api = {
      ac, sfxBus,
      start(l) { level = l == null ? 1 : l; tempo = level >= 2 ? 162 : 150; if (on) return; on = true; step = 0; bar = 0; next = ac.currentTime + .08; clearInterval(timer); timer = setInterval(sched, 25); fade(muted ? 0 : .5, .6); },
      stop(d) { if (!on) return; fade(0, d || .8); const me = timer; setTimeout(() => { if (timer === me) { on = false; clearInterval(timer); } }, (d || .8) * 1000 + 60); },
      mute(m) { muted = m; fade(m || !on ? 0 : .5, .2); },
      get muted() { return muted; },
      victory() { const t = ac.currentTime + .05; [74, 77, 81, 86].forEach((n, i) => lead(t + i * .14, n, .3)); pad(t + .56, [62, 65, 69, 74], 1.6); crash(t + .56); kick(t + .56); fade(muted ? 0 : .5, .05); setTimeout(() => fade(0, 1), 2400); },
      // ---- efectos de sonido (por su propio canal, más claros que los tonos de antes) ----
      slash(heavy) { const t = ac.currentTime; noise(t, .14, 'bandpass', 1400, 1.2, heavy ? .4 : .28, .12, sfxBus, 5200); osc(t, 'sine', 1100, 320, .09, .03, .002, sfxBus); },
      hit(heavy) { const t = ac.currentTime; noise(t, .1, 'lowpass', 2600, .7, heavy ? .55 : .38, .08, sfxBus); osc(t, 'sine', 170, 48, heavy ? .22 : .14, heavy ? .7 : .45, .002, sfxBus); osc(t, 'square', 1400, 900, .025, .05, .001, sfxBus); },
      clang() { const t = ac.currentTime; osc(t, 'triangle', 1900, 1880, .28, .08, .002, sfxBus); osc(t, 'triangle', 2560, 2540, .22, .06, .002, sfxBus); noise(t, .06, 'highpass', 5000, .6, .2, .05, sfxBus); },
      whoosh() { const t = ac.currentTime; noise(t, .26, 'bandpass', 450, 1.4, .3, .22, sfxBus, 1700); },
      boom() { const t = ac.currentTime; noise(t, .8, 'lowpass', 260, .7, .65, .7, sfxBus); osc(t, 'sine', 75, 28, .8, .7, .003, sfxBus); },
      tele() { const t = ac.currentTime; osc(t, 'sawtooth', 280, 1700, .14, .05, .003, sfxBus, [2500, 2500]); noise(t, .14, 'highpass', 3000, .6, .14, .12, sfxBus); },
      charge() { const t = ac.currentTime; osc(t, 'sawtooth', 120, 900, .7, .06, .2, sfxBus, [600, 3000]); noise(t, .8, 'bandpass', 600, 1, .15, .7, sfxBus, 4000); }
    };
    return api;
  }
  let AUDIO = null;

  function play(opts) {
    return new Promise(resolve => {
      const root = opts.root, $ = s => root.querySelector(s);
      const cv = $('#gameCv');
      let R;
      try { R = cv.__R || (cv.__R = new M.Renderer(cv, { dpr: 1.6, dprMin: 1 })); } catch (e) { resolve({ won: true, deaths: 0, time: 0, score: 0, rank: '-' }); return; }
      const S = M.sfx();
      const au = () => { if (!AUDIO) { const ac = S.unlock(); if (ac) AUDIO = makeAudio(ac); } return AUDIO; };
      const HARD = !!opts.hard;

      /* ---------- interfaz ---------- */
      const ui = {
        hp: $('#gHpFill'), hpTxt: $('#gHpTxt'), wave: $('#gWave'), left: $('#gLeft'),
        boss: $('#gBoss'), bossFill: $('#gBossFill'), toast: $('#gToast'), count: $('#gCount'),
        dmg: $('#gDmg'), stick: $('#gStick'), knob: $('#gKnob'), vign: $('#gHurt'),
        sk: { atk: $('#skAtk'), beam: $('#skBeam'), wave: $('#skWave'), dash: $('#skDash'), ult: $('#skUlt') },
        ultFill: $('#gUltFill'), combo: $('#gCombo'), ultFx: $('#gUltFx'),
        reticle: $('#gReticle'), banner: $('#gBanner'), bars: $('#gBars')
      };
      let toastT = 0, bannerT = 0;
      function toast(msg, t) { ui.toast.textContent = msg; ui.toast.classList.add('on'); toastT = t || 1.8; }
      function banner(txt, sub) {
        ui.banner.innerHTML = '<b>' + txt + '</b>' + (sub ? '<i>' + sub + '</i>' : '');
        ui.banner.classList.remove('on'); void ui.banner.offsetWidth; ui.banner.classList.add('on'); bannerT = 1.6;
      }

      /* ---------- estado general (declarado antes de usarse) ---------- */
      let state = 'intro', waveI = Math.max(0, Math.min(3, (opts.startCp | 0))), queue = [], spawnT = 0, breakT = 0, countT = 0, lastCount = '';
      const result = { won: false, score: 0, rank: 'D', hard: HARD };
      let deaths = 0, waveDeaths = 0, time = 0, hitstop = 0, shake = 0, slowmo = 1, slowT = 0, winT = 0, kills = 0;
      let combo = 0, comboT = 0, comboShown = 0, impactT = 0, speedK = 0, punch = 0, camRollK = 0, frozen = false, bossE = null;
      // puntuación
      let score = 0, maxCombo = 0, perfects = 0, waveHurt = false, ended = false;
      const scoreEl = $('#gScore'); let scoreShown = -1;
      function addScore(n, label) {
        if (n <= 0 || (state !== 'play' && state !== 'won')) return;
        score += Math.round(n * (HARD ? 1.5 : 1));
        if (label) { const el = document.createElement('span'); el.className = 'g-num score'; el.textContent = label; ui.dmg.appendChild(el); nums.push({ el, x: P.x, y: 7.5, z: P.z, t: 0 }); }
      }

      /* ---------- el mundo: una pradera enorme bajo un cielo de anime ---------- */
      const scene = group(), fx = new FX(scene); fx.max = 200;
      // luz de última hora de la tarde: sol cálido de frente (contraluz con borde brillante, muy anime),
      // cielo azul intenso arriba y horizonte dorado; sombras largas
      R.setEnv({ sky: 0xbcd8ff, gnd: 0x5a6a3a, sun: 0xffe2b0, fog: 0xe8cfb4, fogNear: 110, fogFar: 380, light: [.42, .52, -.74], amb: .66, sunK: 1.05, shadowArea: 28,
        skyTop: 0x1a5ed6, skyMid: 0xffd8b4, skyBot: 0xe8b890, sunDir: [.42, .3, -.86], sunCol: 0xffd28a, sunDisc: 1.5, stars: 0, clouds: .9, cloudCol: 0xfff2e4 });
      R.grade = Object.assign(R.grade, { exp: .92, sat: 1.34, con: 1.2, tint: [1.03, 1, .95], lift: [0, 0, .012], bloom: .55, tilt: .4, tiltC: .45, vig: .34, grain: .012 });
      cv.style.background = '#000';
      const T = M.terrain(300, 300, 96, { a: 0x2f8a26, b: 0x58b030, c: 0xc89a6a, amp: 2.4, scale: .03, flatR: 34, seed: 21 });
      const ground = new M.Node(T, 0xffffff, { shine: .08, vary: false }); scene.add(ground);
      const gh = (x, z) => T.height(x, z);
      const st = group();
      // caminos de tierra cruzando la pradera
      for (let i = 0; i < 70; i++) { const t = i / 69, x = lerp(-60, 60, t), z = Math.sin(t * 4) * 6 + 8; mesh(st, geo.cyl20, i % 2 ? 0xd9b48c : 0xcfa87e, 5.4, .06, 4.2, x, gh(x, z) + .03, z, { vary: true }); }
      for (let i = 0; i < 40; i++) { const t = i / 39, z = lerp(-70, 4, t), x = Math.sin(t * 3 + 1) * 5 - 6; mesh(st, geo.cyl20, i % 2 ? 0xd9b48c : 0xcfa87e, 4.4, .06, 4.8, x, gh(x, z) + .03, z); }
      // rocas rosadas (como las del vídeo)
      const RR = M.rng(77);
      for (let i = 0; i < 46; i++) {
        const a = RR() * TAU, d = 26 + RR() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, sz = 1 + RR() * 2.6;
        mesh(st, geo.rock, RR() < .5 ? 0xf0a49a : 0xe0948c, sz * 1.5, sz * 1.1, sz * 1.3, x, gh(x, z) + sz * .35, z, { rot: [RR(), RR() * 6, RR() * .4], shine: .2 });
        if (RR() < .5) mesh(st, geo.rock, 0xe8b8ae, sz * .7, sz * .6, sz * .7, x + sz, gh(x, z) + sz * .2, z + sz * .4, { rot: [RR(), RR() * 6, 0] });
      }
      // árboles frondosos de tronco rojizo
      const tree = (x, z, s, leaf) => {
        const y = gh(x, z);
        mesh(st, M.geo.custom(10, .4, .62), 0x8a3a2e, 1.1 * s, 6 * s, 1.1 * s, x, y + 3 * s, z, { rot: [0, 0, (RR() - .5) * .15] });
        mesh(st, M.geo.custom(8, .2, .4), 0x8a3a2e, .6 * s, 3 * s, .6 * s, x + 1.1 * s, y + 5.6 * s, z, { rot: [0, 0, -.7] });
        const L = [leaf, leaf + 0x0a1408 > 0xffffff ? leaf : leaf + 0x0a1408, 0x3a8a3a];
        [[0, 7.4, 0, 4.4], [2.2, 6.6, .6, 3.3], [-2.1, 6.9, -.4, 3.4], [.4, 9.1, -.3, 3.1], [-.8, 6.1, 1.8, 2.8], [1.2, 6.2, -1.9, 2.9], [-1.4, 8.4, 1, 2.4]]
          .forEach(([a, b, c, r], i) => mesh(st, geo.ballS, L[i % 3], r * s, r * .82 * s, r * s, x + a * s, y + b * s, z + c * s, { rot: [0, RR() * 6, 0] }));
      };
      for (let i = 0; i < 34; i++) { const a = i / 34 * TAU + RR() * .15, d = 40 + RR() * 45; tree(Math.cos(a) * d, Math.sin(a) * d, .9 + RR() * .6, RR() < .5 ? 0x4a9a3a : 0x5aac42); }
      [[-34, -10], [33, 16], [-28, 24], [30, -26], [8, -40], [-14, 38]].forEach(([x, z]) => tree(x, z, 1.1 + RR() * .3, 0x52a43e));
      // arbustos y flores
      for (let i = 0; i < 40; i++) { const a = RR() * TAU, d = 30 + RR() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d; M.bush(st, x, z, 1 + RR() * .8, RR() < .5 ? 0x3e9a3a : 0x52a845); st.children.slice(-3).forEach(n => { n.pos[1] += gh(x, z); }); }
      for (let i = 0; i < 90; i++) { const a = RR() * TAU, d = 6 + RR() * 34, x = Math.cos(a) * d, z = Math.sin(a) * d; M.flower(st, x, z, [0xffffff, 0xffe27a, 0xff9ad8, 0xb8a8ff][i % 4], .7); st.children.slice(-3).forEach(n => { n.pos[1] += gh(x, z); }); }
      // lago
      mesh(st, geo.cyl20, 0x3aa8e0, 46, .1, 30, 58, gh(58, -52) + .1, -52, { shine: 1.4, emis: .1 });
      mesh(st, geo.cyl20, 0xd9c8a0, 50, .06, 34, 58, gh(58, -52) + .04, -52);
      // colinas y montañas lejanas
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, d = 170 + (i % 3) * 25, h = 24 + (i * 7 % 5) * 9; mesh(st, geo.ball, i % 2 ? 0x5a9a5a : 0x4a8a5a, 90, h * 2, 70, Math.cos(a) * d, -6, Math.sin(a) * d, { rot: [0, -a, 0], shine: 0 }); }
      // isla flotante con castillo en el cielo (fondo)
      const sky = group().at(-60, 70, -210); st.add(sky);
      mesh(sky, geo.cone6, 0x8a7a70, 70, 40, 70, 0, -24, 0, { rot: [Math.PI, .3, 0] });
      mesh(sky, geo.cyl20, 0x6aaa5a, 72, 4, 72, 0, 0, 0);
      for (let i = 0; i < 6; i++) { const r = 26 - i * 3.8; mesh(sky, geo.cyl20, i % 2 ? 0xd8d4e0 : 0xc8c4d4, r * 2, 5, r * 2, 0, 3 + i * 5, 0); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mesh(sky, geo.cyl, 0xe0dcec, 4, 26, 4, Math.cos(a) * 20, 13, Math.sin(a) * 20); mesh(sky, geo.cone, 0x6a7ad8, 6, 7, 6, Math.cos(a) * 20, 29, Math.sin(a) * 20); }
      mesh(sky, geo.cyl, 0xe8e4f4, 6, 30, 6, 0, 45, 0); mesh(sky, geo.cone, 0x5a6ad0, 9, 12, 9, 0, 66, 0);
      // ---- el claro de la batalla: círculo de piedra con runas ----
      mesh(st, geo.cyl20, 0x6e685c, 30, .3, 30, 0, -.08, 0, { shine: .15 });
      mesh(st, geo.cyl20, 0x8a8474, 28, .32, 28, 0, -.06, 0, { shine: .2 });
      for (let r = 3.5; r < 14; r += 3.5) for (let i = 0, n = Math.round(r * 2.4); i < n; i++) { const a = i / n * TAU + r; box(st, 2.6, .1, 1.6, (i + r) % 2 ? 0x9a9484 : 0x847e70, Math.cos(a) * r, .12, Math.sin(a) * r, { r: .05, rot: [0, -a, 0] }); }
      mesh(st, geo.hair, 0x7df3ff, 26, .6, 26, 0, .2, 0, { emis: .9 }); mesh(st, geo.hair, 0x7df3ff, 9, .6, 9, 0, .2, 0, { emis: .9 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; box(st, .18, .05, 8.5, 0x7df3ff, Math.cos(a) * 8.6, .19, Math.sin(a) * 8.6, { r: 0, emis: .9, rot: [0, -a + Math.PI / 2, 0] }); }
      // ---- anillo de columnas en ruinas, arcos rotos y bloques caídos ----
      const PILLARS = [];
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + .13, x = Math.cos(a) * 19.5, z = Math.sin(a) * 19.5, y = gh(x, z), h = 3 + RR() * 6, broken = RR() < .45; PILLARS.push([x, z]);
        box(st, 2.2, .6, 2.2, 0x8a8478, x, y + .3, z, { r: .12 });
        box(st, 1.5, h, 1.5, 0xc0b8a8, x, y + .6 + h / 2, z, { r: .1, rot: [0, a, broken ? (RR() - .5) * .12 : 0] });
        for (let k = 1; k < h; k += 1.6) box(st, 1.6, .14, 1.6, 0xa8a090, x, y + .6 + k, z, { r: .04, rot: [0, a, 0] });
        if (!broken) box(st, 2.1, .5, 2.1, 0xa8a090, x, y + .85 + h, z, { r: .1 });
        else { box(st, 1.4, 1.6, 1.4, 0xb8b0a0, x + Math.cos(a + 1.2) * 2.4, y + .5, z + Math.sin(a + 1.2) * 2.4, { r: .1, rot: [1.4, a, .3] }); M.rock(st, x + Math.cos(a - .9) * 2, y, z + Math.sin(a - .9) * 2, .6, 0xa8a090); }
      }
      for (const a0 of [.13 + TAU / 12 * 2, .13 + TAU / 12 * 8]) {   // dos arcos
        const a1 = a0 + TAU / 12, x0 = Math.cos(a0) * 19.5, z0 = Math.sin(a0) * 19.5, x1 = Math.cos(a1) * 19.5, z1 = Math.sin(a1) * 19.5;
        box(st, 1.7, 9.2, 1.7, 0xc0b8a8, x0, 4.9, z0, { r: .1 }); box(st, 1.7, 9.2, 1.7, 0xc0b8a8, x1, 4.9, z1, { r: .1 });
        box(st, Math.hypot(x1 - x0, z1 - z0) + 2.4, 1.3, 2, 0xa8a090, (x0 + x1) / 2, 10, (z0 + z1) / 2, { r: .15, rot: [0, -Math.atan2(z1 - z0, x1 - x0), 0] });
      }
      // ---- portal japonés (torii) detrás de la jaula del regalo ----
      { const tz = -38, ty = gh(0, tz);
        [-5, 5].forEach(x => { mesh(st, geo.cyl, 0xd23a2a, 1.1, 11, 1.1, x, ty + 5.5, tz); box(st, 1.5, .8, 1.5, 0x2a1a1a, x, ty + .4, tz, { r: .1 }); });
        box(st, 14.5, 1, 1.4, 0x1e1418, 0, ty + 11.2, tz, { r: .2 }); box(st, 13, .9, 1.2, 0xd23a2a, 0, ty + 10.3, tz, { r: .15 });
        box(st, 12, .6, .9, 0xd23a2a, 0, ty + 8, tz, { r: .1 }); box(st, 1, 2.2, .7, 0x1e1418, 0, ty + 9.1, tz, { r: .08 }); }
      // ---- faroles de piedra alrededor del círculo (con luz cálida) ----
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .55, x = Math.cos(a) * 15.5, z = Math.sin(a) * 15.5;
        box(st, 1.6, .5, 1.6, 0x8a8478, x, .25, z, { r: .1 }); mesh(st, geo.cyl6, 0x9a9488, .7, 1.8, .7, x, 1.4, z);
        box(st, 1.2, 1, 1.2, 0xffcf7a, x, 2.75, z, { r: .08, emis: 1 }); box(st, 1.3, .2, 1.3, 0x8a8478, x, 2.2, z, { r: .05 });
        mesh(st, geo.cone4, 0x7a7468, 2.4, 1, 2.4, x, 3.7, z, { rot: [0, Math.PI / 4, 0] }); mesh(st, geo.ballS, 0x8a8478, .4, .4, .4, x, 4.3, z);
      }
      // ---- cerezos en flor ----
      const sakura = (x, z, s) => {
        const y = gh(x, z);
        mesh(st, M.geo.custom(9, .35, .6), 0x5a3a3a, 1 * s, 5 * s, 1 * s, x, y + 2.5 * s, z, { rot: [0, 0, .12] });
        mesh(st, M.geo.custom(7, .2, .35), 0x5a3a3a, .5 * s, 3 * s, .5 * s, x - 1 * s, y + 5 * s, z, { rot: [0, 0, .7] });
        [[0, 6.6, 0, 4.6], [2, 6, .8, 3.4], [-2.4, 6.4, -.2, 3.6], [.3, 8.2, -.4, 3.2], [-1, 5.6, 1.6, 2.8], [1.5, 7.5, -1.6, 2.6]]
          .forEach(([a, b, c, r], i) => mesh(st, geo.ballS, [0xffb8d8, 0xffa0c8, 0xffd0e4][i % 3], r * s, r * .8 * s, r * s, x + a * s, y + b * s, z + c * s));
      };
      [[-26, -18], [24, -30], [-34, 12], [36, 4], [-12, -40], [16, 34], [-30, 34], [40, -12]].forEach(([x, z], i) => sakura(x, z, .95 + (i % 3) * .15));
      // ---- acantilado con cascada (al fondo a la izquierda) y estanque ----
      { const cx = -78, cz = -70;
        for (let i = 0; i < 9; i++) box(st, 26 + RR() * 10, 18 + RR() * 14, 14, i % 2 ? 0x8a7a6a : 0x7a6a5e, cx + (i - 4) * 16, 10 + RR() * 4, cz - 8 - RR() * 6, { r: 1.2, rot: [0, .5 + (RR() - .5) * .3, 0] });
        mesh(st, geo.cyl20, 0x3ab0e8, 22, .2, 16, cx + 14, gh(cx + 14, cz + 10) + .15, cz + 10, { shine: 1.4, emis: .15 });
        for (let i = 0; i < 10; i++) M.rock(st, cx + 14 + Math.cos(i) * 11, gh(cx + 14, cz + 10), cz + 10 + Math.sin(i) * 8, 1 + (i % 3) * .5, 0x8a8478); }
      // ---- puente de madera sobre el lago ----
      { const bx = 58, bz = -52, by = gh(bx, bz);
        for (let i = -7; i <= 7; i++) { const yy = by + 1.6 + Math.cos(i / 7 * 1.57) * 1.6; box(st, 1.2, .25, 5, i % 2 ? 0xa86a3a : 0x985a2e, bx + i * 1.25, yy, bz, { r: .04, rot: [0, 0, -Math.sin(i / 7 * 1.57) * .35] }); }
        [-1, 1].forEach(sd => { for (let i = -7; i <= 7; i += 2) { const yy = by + 1.6 + Math.cos(i / 7 * 1.57) * 1.6; box(st, .25, 1.6, .25, 0xd23a2a, bx + i * 1.25, yy + .8, bz + sd * 2.4, { r: .04 }); } }); }
      // ---- estandartes en el borde del claro ----
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .8, x = Math.cos(a) * 23, z = Math.sin(a) * 23, y = gh(x, z); mesh(st, geo.cyl, 0x2a1a1a, .3, 9, .3, x, y + 4.5, z); box(st, 2, 5, .12, i % 2 ? 0xd23a2a : 0x2a3a8a, x + Math.cos(a + 1.57) * 1.1, y + 6, z + Math.sin(a + 1.57) * 1.1, { r: .02, rot: [0, -a, 0] }); }
      scene.add(bake(st, 31));
      // ---- rayos de sol entre los árboles y cascada animada ----
      const beams = [];
      for (let i = 0; i < 7; i++) { const x = -40 + i * 13 + RR() * 6, z = -30 - RR() * 25; const n = box(scene, 3 + RR() * 3, 60, .2, 0xffe8b8, x, 22, z, { r: 0, emis: 1, add: true, alpha: .06, cast: false, rot: [.45, .1 * i, .25] }); beams.push({ n, ph: RR() * 6 }); }
      const falls = [0, 1, 2].map(i => box(scene, 7 - i * 1.5, 30, .5, i ? 0xbff0ff : 0x7ad8ff, -64, 15, -73 + i * .3, { r: 0, emis: 1, add: true, alpha: .35 - i * .08, cast: false, rot: [0, .5, 0] }));
      const mist = new M.Motes(scene, { n: 40, area: [12, 6, 6], center: [-64, 3, -66], color: 0xffffff, size: .35, speed: 1.2, fall: -1.5, alpha: .5 });
      const petals = new M.Motes(scene, { n: 70, area: [70, 14, 70], center: [0, 7, -6], color: 0xffb8d8, size: .16, speed: .7, fall: 1.1, alpha: .9 });
      // hierba alta que se mueve con el viento
      const grassNear = M.grassField({ n: 22000, r: 40, inner: 15, h: 1.15, w: .14, root: 0x1e5a14, tip: 0x8cd23a, seed: 3 }); scene.add(grassNear);
      const grassFar = M.grassField({ n: 9000, r: 80, inner: 40, h: 1.4, w: .22, root: 0x22621a, tip: 0x84c838, seed: 4, height: gh }); scene.add(grassFar);
      // nubes 3D grandes por encima
      const cl = group(); [[-80, 60, -150, 7], [40, 70, -170, 8], [120, 55, -90, 6], [-140, 50, -40, 6], [90, 64, 120, 7], [-60, 58, 140, 6]].forEach(([x, y, z, s]) => M.cloud(cl, x, y, z, s, 0xffffff)); const clouds = bake(cl, 9); clouds.cast = false; scene.add(clouds);
      const floaters = [{ g: clouds, y: 0, ph: 0 }];
      const embers = new M.Motes(scene, { n: 60, area: [70, 10, 70], center: [0, 4, 0], color: 0xfff8c0, size: .12, speed: .5, fall: -.3, alpha: .7 });
      const sparks = new M.Motes(scene, { n: 30, area: [40, 5, 40], center: [0, 2.5, 0], color: 0xffffff, size: .08, speed: .9, alpha: .6 });
      const torches = [];
      // portales de aparición (círculos mágicos en el suelo)
      const PORTALS = [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * TAU + .3; return [Math.cos(a) * 24, Math.sin(a) * 24]; });
      const portalNodes = PORTALS.map(([x, z]) => { const p = mesh(scene, geo.hair, 0xc84aff, 5, .5, 5, x, .12, z, { emis: 1, add: true, alpha: .5, cast: false }); return p; });
      // el regalo, encerrado en una jaula sobre una colina
      const CAGE_Z = -26;
      const cage = group().at(0, gh(0, CAGE_Z), CAGE_Z); scene.add(cage);
      mesh(cage, geo.cyl20, 0xc8b8a8, 6, .6, 6, 0, .3, 0); mesh(cage, geo.hair, 0xffd23f, 6, .5, 6, 0, .62, 0, { emis: .9 });
      const giftBox = group().at(0, .6, 0); cage.add(giftBox);
      box(giftBox, 2.2, 2, 2.2, 0x6ee07a, 0, 1, 0, { shine: .8 }); box(giftBox, 2.5, .55, 2.5, 0x4ac05a, 0, 2.2, 0, { shine: .8 });
      box(giftBox, .42, 2.6, 2.3, 0xffd23f, 0, 1.25, 0, { emis: .3, r: .1 }); box(giftBox, 2.3, 2.6, .42, 0xffd23f, 0, 1.25, 0, { emis: .3, r: .1 });
      box(giftBox, 1, .7, .4, 0xffd23f, -.45, 2.75, 0, { rot: [0, 0, .5], emis: .3 }); box(giftBox, 1, .7, .4, 0xffd23f, .45, 2.75, 0, { rot: [0, 0, -.5], emis: .3 });
      mesh(giftBox, geo.ball, 0xffd23f, 4, 4, 4, 0, 1.4, 0, { emis: 1, add: true, alpha: .12, cast: false });
      const bars = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; bars.push(mesh(cage, geo.cyl, 0x9aa0b8, .26, 4.4, .26, Math.cos(a) * 2.3, 2.8, Math.sin(a) * 2.3, { shine: 1 })); }
      const cageTop = mesh(cage, geo.cyl20, 0x6a6e88, 5.4, .4, 5.4, 0, 5.1, 0, { shine: .9 });
      const lock = mesh(cage, geo.ball, 0xffd23f, .9, .9, .5, 0, 2.8, 2.4, { emis: .3, shine: 1 });

      /* ---------- espada: katana con empuñadura, tsuba y hoja de cristal ---------- */
      function makeSword(arm, L, bladeCol, glowCol) {
        const g = group(); arm.add(g); g.at(0, -1.45, 0); g.rot = [Math.PI / 2, 0, 0];
        mesh(g, geo.cyl, 0x2a1a3a, .2, .95, .2, 0, -.2, 0, { shine: .5 });
        for (let i = 0; i < 4; i++) box(g, .23, .09, .23, 0xe8e0f0, 0, -.5 + i * .22, 0, { r: .02 });
        mesh(g, geo.ballS, 0xffd23f, .34, .34, .34, 0, -.7, 0, { emis: .4, shine: 1 });
        box(g, .95, .12, .5, 0xffd23f, 0, .32, 0, { r: .05, emis: .25, shine: 1 });
        const blade = box(g, .16, L, .07, bladeCol, 0, .38 + L / 2, 0, { emis: .7, shine: 1, r: .02 });
        box(g, .05, L, .1, 0xffffff, 0, .38 + L / 2, 0, { emis: 1, r: .01 });
        const glow = box(g, .6, L + .5, .35, glowCol, 0, .38 + L / 2, 0, { emis: 1, add: true, alpha: .22, r: .2, cast: false });
        M.bakeInto(g, new Set([blade, glow]), { toon: 1, shine: .9 });
        g.children.forEach(n => { if (!n.additive) n.toon = 1; });
        return { g, blade, glow, L };
      }

      /* ---------- la heroína ---------- */
      const hero = avatar(Object.assign({ blend: 26 }, HERO)); scene.add(hero.root); hero.root.outlined(0x1a0c24, .045);
      const P = {
        x: 0, z: 6, y: 0, vy: 0, face: Math.PI, hp: TUNE.hp, inv: 0, hurtT: 0, kx: 0, kz: 0,
        atkT: 0, atkI: 0, atkHit: true, atkDur: .3, comboWin: 0, lunge: 0, lx: 0, lz: 0,
        dashT: 0, dashDir: [0, 0], dodgeT: 0, cd: { tajo: 0, giro: 0, dash: 0 },
        castT: 0, castKind: '', castDur: 1, castFired: false,
        dead: false, deadT: 0, buff: 1, ult: 0, counter: 0, target: null,
        airSeq: null, plunge: false, ultSeq: null, ghostT: 0, stepT: 0, grip: Math.PI / 2
      };
      const sword = makeSword(hero.P.armR, 3.9, 0xe4fbff, 0x4fd8ff);
      const trail = new M.Trail(scene, 0xffffff, 18), trail2 = new M.Trail(scene, 0x6ae8ff, 12);
      // imágenes residuales al esquivar / saltar hacia el enemigo
      const ghosts = [0, 1, 2, 3, 4, 5, 6, 7].map(() => {
        const g = group(); scene.add(g); g.visible = false;
        const o = { emis: 1, add: true, alpha: 0, cast: false };
        box(g, 2, 2, 1, 0x7a5ad8, 0, 3, 0, o); box(g, 1.3, 1.25, 1.25, 0x7a5ad8, 0, 4.6, 0, o); box(g, 1, 2, 1, 0x7a5ad8, -.5, 1, 0, o); box(g, 1, 2, 1, 0x7a5ad8, .5, 1, 0, o);
        box(g, 1, 2, 1, 0xb04ab0, -1.5, 3, 0, o); box(g, 1, 2, 1, 0xb04ab0, 1.5, 3, 0, o);
        return { g, t: 0 };
      });
      let ghostI = 0;
      function spawnGhost() { const q = ghosts[ghostI++ % ghosts.length]; q.g.visible = true; q.g.at(P.x, P.y, P.z); q.g.rot[1] = P.face; q.t = .35; }

      const nums = [];
      function num(x, y, z, txt, cls) {
        const el = document.createElement('span'); el.className = 'g-num ' + (cls || ''); el.textContent = txt; ui.dmg.appendChild(el);
        nums.push({ el, x: x + (Math.random() - .5) * .8, y, z, t: 0 });
      }

      /* ---------- enemigos ---------- */
      const enemies = [], potions = [], projs = [], warns = [], lines = [];
      function meshesOf(n, out) { out = out || []; if (n.geo) out.push(n); n.children.forEach(c => meshesOf(c, out)); return out; }

      function makeEnemy(type, x, z) {
        const d = EN[type];
        const av = avatar(Object.assign({ blend: 30 }, LOOKS[type]));
        scene.add(av.root);
        const sw = makeSword(av.P.armR, d.sword, d.blade, d.edge);
        const H = av.P.hc;
        if (type === 'shadow') {
          box(H, 1.3, .62, 1.28, 0x14121c, 0, -.3, 0, { r: .16 });
          box(H, .32, .12, .06, 0xff3050, -.24, .12, .64, { r: 0, emis: 1 }); box(H, .32, .12, .06, 0xff3050, .24, .12, .64, { r: 0, emis: 1 });
          box(H, 1.36, .22, 1.3, 0xb01830, 0, .32, 0, { r: .05 });
          box(H, .22, .22, 1.1, 0xb01830, 0, .3, -1.0, { r: .05, rot: [.5, 0, 0] });
        } else if (type === 'samurai') {
          mesh(H, geo.cone, 0xd8b878, 3.8, 1.2, 3.8, 0, 1.0, 0, { shine: .1 });
          mesh(H, geo.cyl20, 0xc8a868, 3.8, .12, 3.8, 0, .46, 0);
          box(H, 1.3, .1, 1.3, 0x6a1a1a, 0, .42, 0, { r: .03 });
        } else {
          for (let i = 0; i < 5; i++) { const a = -.8 + i * .4; mesh(H, geo.cone4, 0xc01830, .34, 1.4, .34, Math.sin(a) * .7, .82 + Math.cos(a) * .3, -.1, { rot: [-.35, 0, -a * .9], emis: .4 }); }
          box(H, .34, .12, .06, 0xff2a3a, -.24, .12, .64, { r: 0, emis: 1 }); box(H, .34, .12, .06, 0xff2a3a, .24, .12, .64, { r: 0, emis: 1 });
          av.root.scl = [1.75, 1.75, 1.75];
        }
        av.rebakeHead(); av.root.outlined(0x0e0814, type === 'boss' ? .05 : .045);
        const e = {
          type, d: HARD ? Object.assign({}, d, { dmg: Math.round(d.dmg * 1.25), wind: d.wind - .08, speed: d.speed * 1.12 }) : d, av, sw, root: av.root, x, z, y: type === 'boss' ? 36 : -4, vy: 0, kx: 0, kz: 0, hp: Math.round(d.hp * (HARD ? 1.45 : 1)), max: Math.round(d.hp * (HARD ? 1.45 : 1)), r: d.r,
          face: Math.atan2(P.x - x, P.z - z), state: 'spawn', st: 0, cd: rnd(.6, 1.4), stun: 0, flash: 0, pop: 0, hpShow: 0, side: Math.random() < .5 ? -1 : 1, sideT: rnd(1.5, 3),
          windT: d.wind, combo: 0, hitDone: false, ld: [0, 1], dodgedThis: false, guard: 0, guardCd: 0, recent: 0, poise: 0, phase: 1, sub: 0, spd: 0, dead: false, spin: 0, pat: 0, patI: 0, spawnK: 0, tele: 0
        };
        e.meshes = meshesOf(av.root); e.baseEmis = e.meshes.map(m => m.emis);
        e.shadowN = av.P.shadow;
        enemies.push(e);
        smokeFx([x, 2, z], 14, true, true); fx.ring([x, .3, z], 0xc84aff, 4, .6, { thin: true });
        return e;
      }

      function dropPotion(x, z) {
        const n = group().at(x, .6, z); scene.add(n);
        box(n, .7, .8, .7, 0x6ee07a, 0, 0, 0, { emis: .5 }); box(n, .3, .4, .3, 0xffffff, 0, .55, 0); box(n, .34, .14, .34, 0x8a5a3a, 0, .8, 0);
        const halo = mesh(n, geo.ball, 0x6ee07a, 2, 2, 2, 0, 0, 0, { emis: 1, add: true, alpha: .25, cast: false });
        potions.push({ n, x, z, t: 0, halo });
      }

      // aviso rojo en el suelo (círculo) con espada que cae opcional
      function warn(x, z, r, time, onEnd, withSword) {
        const n = mesh(scene, geo.cyl20, 0xff2a3a, r * 2, .06, r * 2, x, .1, z, { alpha: .25, cast: false });
        const fill = mesh(scene, geo.cyl20, 0xff5a3a, .1, .07, .1, x, .11, z, { alpha: .45, cast: false });
        let drop = null;
        if (withSword) {
          drop = group().at(x, 34, z); scene.add(drop);
          box(drop, .55, 6, .16, 0xe8e8f4, 0, 0, 0, { emis: .6, shine: 1, r: .03 }); mesh(drop, geo.cone4, 0xe8e8f4, .55, 1.1, .16, 0, -3.5, 0, { rot: [0, 0, Math.PI] });
          box(drop, 1.7, .22, .5, 0xffd23f, 0, 3, 0, { r: .06 }); box(drop, .3, 1.6, .3, 0x2a1a3a, 0, 4, 0);
          mesh(drop, geo.ball, 0xff2a3a, 1.6, 8, 1.6, 0, -.5, 0, { emis: 1, add: true, alpha: .2, cast: false });
        }
        warns.push({ n, fill, drop, t: 0, time, onEnd, r });
      }

      /* ---------- proyectiles: tajo lunar (suyo) y ola del jefe ---------- */
      function fireProj(kind, x, y, z, ang, o) {
        const n = new Node(CRES, 0xffffff, { emis: 1, add: true, cast: false, alpha: .95 });
        const s = o.size || 3.4; n.scl = [s, s, 1]; n.rot = [0, ang, o.roll == null ? Math.PI / 2 : o.roll]; n.color = rgb(o.color); n.at(x, y, z); scene.add(n);
        const core = new Node(CRES, 0xffffff, { emis: 1, add: true, cast: false, alpha: .9 }); core.scl = [.78, .78, 1]; core.at(.12, 0, .02); n.add(core);
        projs.push({ kind, n, x, y, z, dx: Math.sin(ang), dz: Math.cos(ang), sp: o.speed, life: o.life, dmg: o.dmg, hit: new Set(), r: o.r || 3.4, col: o.color });
      }

      // corte de espada: media luna plana y fina que barre y se desvanece (no tapa la pantalla)
      const nodePool = [];
      function pnode(g, col, o) {
        const n = nodePool.pop() || new Node(g, col);
        n.geo = g; n.color = rgb(col); n.emis = o && o.emis != null ? o.emis : 1; n.additive = !(o && o.add === false); n.alpha = o && o.alpha != null ? o.alpha : 1;
        n.cast = false; n.shine = .3; n.toon = 0; n.wind = 0; n.outline = null; n.visible = true; n.rot = [0, 0, 0]; n.scl = [1, 1, 1]; n.pos = [0, 0, 0];
        n.children.length = 0; scene.add(n); return n;
      }
      function release(n) { scene.remove(n); if (nodePool.length < 160) nodePool.push(n); }
      function slashFx(p, yawArg, col, r, life, tilt) {
        if (lines.length > 70) return;
        const f = yawArg + .38, n = pnode(CRES, col, { alpha: .9 });
        n.scl = [r * .62, r * .62, 1]; n.at(p[0], p[1], p[2]);
        const bank = Math.PI / 2 - (tilt || 0) * .55;
        n.rot = [bank, f - Math.PI / 2 - .7, 0];
        lines.push({ n, t: 0, life: life || .22, sweep: { y0: f - Math.PI / 2 - .7, dy: 1.4, s: r * .62 } });
      }
      function starFx(p, s, col) {
        if (lines.length > 70) return;
        const n = pnode(STAR, col || 0xffffff); n.at(p[0], p[1], p[2]);
        lines.push({ n, t: 0, life: .17, bill: true, s, roll: Math.random() * TAU });
      }
      function smokeFx(p, n, dark, big) {
        fx.burst(p, n, dark ? { geo: geo.ballS, colors: [0x101016, 0x22222c, 0x18181f], speed: 3.2, life: .9, size: big ? 1.1 : .75, grow: .8, grav: -2.5, emis: 0, fade: true, drag: 3, floor: -99, alpha: .85 }
          : { geo: geo.ballS, colors: [0xf09050, 0xf4a868, 0xe8783e], speed: big ? 7 : 4.5, life: 1.3, size: big ? 1.8 : 1.1, grow: 1.3, grav: -.6, emis: .6, fade: true, drag: 3.2, floor: .3, alpha: .5 });
      }
      function streakFx(p, n, up) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, el = up ? .7 + Math.random() * .8 : (Math.random() - .3) * .9;
          const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], L = 1.6 + Math.random() * 2.6;
          if (lines.length > 70) break;
          const nd = pnode(geo.box, 0xffffff); nd.scl = [.07, L, .07]; nd.at(p[0], p[1], p[2]);
          nd.rot = [Math.atan2(Math.hypot(d[0], d[2]), d[1]), Math.atan2(d[0], d[2]), 0];
          const sp = 16 + Math.random() * 14; lines.push({ n: nd, t: 0, life: .28 + Math.random() * .15, v: [d[0] * sp, d[1] * sp, d[2] * sp], streak: true, L });
        }
      }
      // golpe fuerte: estrella grande + humo naranja + estrías blancas + impact frame
      function heavyImpact(p, s) {
        starFx(p, 2.6 * (s || 1)); smokeFx([p[0], Math.max(.6, p[1] - 1), p[2]], (s || 1) > 1 ? 10 : 6, false, (s || 1) > 1); streakFx(p, 9);
        impactT = Math.max(impactT, .07); shake = Math.max(shake, 1.1); camRollK = (Math.random() < .5 ? -1 : 1) * .1; if (AUDIO) AUDIO.boom();
      }
      function lineFx(p, len, col, life, rot) {
        const n = pnode(geo.box, col); n.scl = [.16, len, .16]; n.at(p[0], p[1], p[2]);
        n.rot = rot; lines.push({ n, t: 0, life, w: 1, len });
      }

      /* ---------- daño ---------- */
      function hurtHero(dmg, fx0, fz0, kb) {
        if (P.inv > 0 || P.dead || state !== 'play' || P.ultSeq) return;
        P.hp = Math.max(0, P.hp - dmg); P.inv = .75; P.hurtT = .4; combo = 0; waveHurt = true;
        const dx = P.x - fx0, dz = P.z - fz0, d = Math.hypot(dx, dz) || 1;
        P.kx = dx / d * (kb || 8); P.kz = dz / d * (kb || 8);
        P.atkT = 0; P.castT = 0; P.lunge = 0; if (P.airSeq) endAir(); P.plunge = false;
        num(P.x, 6.5, P.z, '-' + dmg, 'hurt');
        shake = Math.max(shake, .9); camRollK = (Math.random() < .5 ? -1 : 1) * .14;
        ui.vign.classList.remove('on'); void ui.vign.offsetWidth; ui.vign.classList.add('on');
        fx.burst([P.x, 3, P.z], 12, { colors: [0xffffff, 0xff3050], speed: 7, life: .4, size: .25, add: true });
        S.tone(220, 80, .25, 'sawtooth', .06); hitstop = Math.max(hitstop, .06);
        if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {}
        if (P.hp <= 0) { P.dead = true; P.deadT = 0; deaths++; waveDeaths++; slowT = .8; S.tone(400, 60, .9, 'triangle', .08); }
      }

      function perfectDodge() {
        if (P.counter > 0) return;
        P.counter = 1.8; slowT = .65; P.ult = Math.min(100, P.ult + 20); punch = 1; impactT = .05; perfects++; addScore(500, '+500');
        banner('ESQUIVA PERFECTA', 'contraataque listo');
        S.tone(1200, 2200, .25, 'triangle', .05); S.tone(600, 1200, .3, 'sine', .04, .05);
        fx.ring([P.x, 1.5, P.z], 0x7df3ff, 4.5, .45, { thin: true }); fx.burst([P.x, 3, P.z], 24, { colors: [0x7df3ff, 0xffffff], speed: 9, life: .6, size: .22, add: true, grav: 0 });
      }

      // ¿le da a la heroína? (también detecta la esquiva perfecta)
      function strikeCheck(e, range, dmg, arc) {
        const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz);
        if (d > range + .9 || Math.abs(P.y - e.y) > 3.6 || (P.y > 1.6 && e.y < 1)) return false;
        if (Math.abs(angDiff(Math.atan2(dx, dz), e.face)) > arc) return false;
        if (P.dashT > 0 || P.inv > .12 || P.ultSeq) { if (P.dodgeT > 0 && !e.dodgedThis) { e.dodgedThis = true; perfectDodge(); } return false; }
        hurtHero(dmg, e.x, e.z, 13); return true;
      }

      function hurtEnemy(e, dmg, nx, nz, kb, o) {
        o = o || {};
        if (e.dead || e.state === 'spawn') return;
        const guarded = e.guard > 0 && !o.brk && e.type !== 'boss';
        let crit = !!o.crit;
        if (P.counter > 0 && !o.noCounter) { dmg *= 2; o.launch = e.type !== 'boss'; P.counter = 0; crit = true; banner('CONTRAATAQUE'); impactT = .06; }
        if (e.state === 'bDaze') dmg *= 1.4;
        dmg = Math.round(dmg * (crit ? 1.6 : 1) * (guarded ? .25 : 1));
        e.hp -= dmg; e.flash = .12; e.pop = .15; e.hpShow = 3;
        addScore(dmg * (1 + Math.min(combo, 40) * .05) * (P.airSeq ? 1.5 : 1));
        if (P.ultSeq == null) P.ult = Math.min(100, P.ult + dmg * TUNE.ultGain);
        combo++; comboT = 2.4; if (combo > maxCombo) maxCombo = combo;
        const hy = e.type === 'boss' ? 5 : 3.4;
        num(e.x, hy + 1.5, e.z, dmg, crit ? 'crit' : '');
        if (guarded) {
          fx.burst([e.x, hy - .8, e.z], 8, { colors: [0x7ab8ff, 0xffffff], speed: 8, life: .3, size: .2, add: true });
          fx.ring([e.x, hy - .8, e.z], 0x7ab8ff, 2, .2, { thin: true, tilt: Math.PI / 2 }); if (AUDIO) AUDIO.clang(); else S.tone(1500, 900, .12, 'square', .04);
          e.kx += nx * 2; e.kz += nz * 2; return;
        }
        // estrella blanca de impacto + chispas
        starFx([e.x - nx * e.r * .5, hy - .6, e.z - nz * e.r * .5], (crit || o.brk ? 2 : 1.3) * (e.type === 'boss' ? 1.4 : 1));
        fx.burst([e.x - nx * e.r * .5, hy - .6, e.z - nz * e.r * .5], crit ? 14 : 8, { colors: [0xffffff, 0xffe27a, 0xff8ae8], speed: 9, life: .35, size: .2, add: true, grav: 4 });
        fx.ring([e.x - nx * e.r * .5, hy - .6, e.z - nz * e.r * .5], crit ? 0xffd23f : 0xffffff, crit ? 2.4 : 1.6, .2, { thin: true, tilt: Math.PI / 2, yaw: Math.atan2(nx, nz) });
        if (AUDIO) AUDIO.hit(crit || !!o.brk); else S.tone(crit ? 380 : 260, 120, .08, 'square', .045);
        e.recent = 1.2;
        if (e.type === 'boss') {
          e.poise += dmg * (o.brk ? 1.6 : 1);
          e.kx += nx * kb * .15; e.kz += nz * kb * .15;
          if (e.poise >= 240 && !/^b(Combo|Wave|Rain|Leap)/.test(e.state)) { e.poise = 0; e.state = 'bDaze'; e.st = 0; banner('¡GUARDIA ROTA!'); slowT = .35; }
        } else {
          e.kx += nx * kb; e.kz += nz * kb;
          if (o.launch) { e.vy = o.launchV || 13; e.state = 'launched'; e.st = 0; e.tumble = 0; streakFx([e.x, 2.5, e.z], 6, true); }
          else if (e.state !== 'launched' && e.state !== 'down') { e.state = 'stagger'; e.stun = o.stun || .35; e.st = 0; }
          if (e.type === 'samurai' && e.guardCd <= 0 && !o.launch && e.hitsRecent >= 2) { e.guard = 1.1; e.guardCd = 5; e.state = 'guard'; e.st = 0; }
        }
        e.hitsRecent = (e.hitsRecent || 0) + 1;
        if (e.hp <= 0) killEnemy(e, nx, nz);
      }

      function killEnemy(e, nx, nz) {
        e.dead = true; e.state = 'dead'; e.st = 0; kills++; addScore(e.type === 'boss' ? 5000 : e.type === 'samurai' ? 600 : 300);
        e.kx = nx * 22; e.kz = nz * 22; e.vy = e.type === 'boss' ? 6 : 13; e.hpShow = 0; heavyImpact([e.x, 2.6, e.z], e.type === 'boss' ? 1.6 : .9); if (e.bar) { e.bar.remove(); e.bar = null; }
        hitstop = Math.max(hitstop, e.type === 'boss' ? .35 : .07); shake = Math.max(shake, e.type === 'boss' ? 1.4 : .5);
        S.noise(.3, .1, 800); S.tone(500, 90, .25, 'square', .04);
        if (e.type === 'boss') { queue.length = 0; enemies.forEach(o => { if (!o.dead && o !== e) hurtEnemy(o, 9999, 0, 1, 0, { brk: true, noCounter: true }); }); slowT = 1; }
        if (e.type !== 'boss' && Math.random() < (P.hp < 50 ? .35 : .16)) dropPotion(e.x, e.z);
      }

      /* ---------- inteligencia de los enemigos ---------- */
      function attackers() { let n = 0; for (const e of enemies) if (!e.dead && (e.state === 'wind' || e.state === 'strike')) n++; return n; }
      function beginEnemyAttack(e) {
        e.state = 'wind'; e.st = 0; e.tele = 1; e.dodgedThis = false; e.combo = e.type === 'samurai' ? 1 : 0;
        e.windT = Math.max(.32, e.d.wind - waveI * .04);
        S.tone(900, 1300, .18, 'sine', .02); fx.ring([e.x, .3, e.z], 0xff3050, 2.2, .3, { thin: true });
      }
      function enemySlashFx(e, big) {
        const sx = Math.sin(e.face), sz = Math.cos(e.face), h = e.type === 'boss' ? 4.2 : 2.6;
        slashFx([e.x + sx * 1.2, h, e.z + sz * 1.2], e.face - .38, big ? 0xff2a3a : 0xff6a7a, big ? 7 : 4.2, .22, (Math.random() - .5) * 1.2);
        S.noise(.12, .09, 3000);
      }

      function updateEnemy(e, dt) {
        e.st += dt; e.cd -= dt; e.guard = Math.max(0, e.guard - dt); e.guardCd = Math.max(0, e.guardCd - dt);
        e.flash = Math.max(0, e.flash - dt); e.pop = Math.max(0, e.pop - dt); e.recent = Math.max(0, e.recent - dt); if (e.recent <= 0) e.hitsRecent = 0;
        // física: retroceso + caída
        e.x += e.kx * dt; e.z += e.kz * dt; const dr = Math.pow(e.state === 'launched' || e.dead ? .3 : .008, dt); e.kx *= dr; e.kz *= dr;
        if (e.state !== 'spawn' && e.state !== 'bLeap' && (e.y > .02 || e.vy > 0)) {
          const hold = P.airSeq && P.airSeq.tgt === e && !P.plunge;
          if (hold) e.vy = 0; else e.vy -= (e.dead ? 26 : 30) * dt;
          e.y += e.vy * dt;
          if (e.y <= 0) {
            const hard = e.vy < -9; e.y = 0; e.vy = 0;
            if (hard) { fx.ring([e.x, .2, e.z], 0xffffff, 3, .3); smokeFx([e.x, .8, e.z], 6, false); fx.burst([e.x, .4, e.z], 8, { geo: geo.rock, colors: [0x8a7a5a, 0x6a5a4a], speed: 7, life: .6, size: .35, emis: .05, grav: 18 }); shake = Math.max(shake, .35); }
            if (e.state === 'launched') { e.state = 'down'; e.st = 0; }
          }
        }
        const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d, want = Math.atan2(dx, dz);
        const turn = k => { e.face += angDiff(want, e.face) * Math.min(1, dt * k); };
        const bound = () => { const rr = Math.hypot(e.x, e.z); if (rr > ARENA + 4) { e.x *= (ARENA + 4) / rr; e.z *= (ARENA + 4) / rr; } };
        switch (e.state) {
          case 'spawn': {
            const T = e.type === 'boss' ? 1.1 : .7; e.spawnK = Math.min(1, e.st / T);
            e.y = e.type === 'boss' ? lerp(36, 0, e.spawnK * e.spawnK) : lerp(-4, 0, ease.back(e.spawnK));
            if (e.spawnK >= 1) {
              e.y = 0; e.state = 'approach'; e.st = 0; e.cd = e.type === 'boss' ? 1.2 : rnd(.6, 1.4);
              if (e.type === 'boss') { shake = 1.6; fx.ring([e.x, .3, e.z], 0xff2a3a, 12, .8); fx.burst([e.x, 1, e.z], 50, { colors: [0xff2a3a, 0xffd23f, 0xffffff], speed: 13, life: 1, size: .4 }); S.noise(.8, .25, 300); S.tone(70, 30, 1, 'sawtooth', .1); banner('RONIN CARMESÍ', 'jefe final'); }
            }
            break;
          }
          case 'dead': {
            e.spin += dt * 9; if (e.st > 1.1) { smokeFx([e.x, 1.5, e.z], 10, true, true); fx.burst([e.x, 2, e.z], e.type === 'boss' ? 90 : 26, { colors: [0xffffff, e.d.edge, 0x2a2a3a, 0xc84aff], speed: 11, life: 1, size: .4, emis: .5 }); fx.ring([e.x, 1.5, e.z], 0xffffff, e.type === 'boss' ? 14 : 5, .5); scene.remove(e.root); e.remove = true; }
            return;
          }
          case 'stagger': if (e.st >= e.stun) { e.state = 'approach'; e.st = 0; e.cd = Math.min(e.cd, rnd(.3, .9)); } break;
          case 'launched': break;
          case 'down': if (e.st > .9) { e.state = 'approach'; e.st = 0; e.cd = .5; fx.ring([e.x, .2, e.z], 0xffffff, 2, .25, { thin: true }); } break;
          case 'guard': turn(10); if (e.guard <= 0) { e.state = 'approach'; e.st = 0; } break;
          case 'approach': {
            turn(11);
            if (e.type === 'boss') { bossAI(e, dt, d, nx, nz); break; }
            e.sideT -= dt; if (e.sideT <= 0) { e.side = -e.side; e.sideT = rnd(1.5, 3); }
            const hold = e.d.range + 1.4; let mv = 0;
            if (d > hold + .6) mv = e.d.speed; else if (d < hold - .9) mv = -e.d.speed * .45;
            const sw = d < hold + 5 ? e.side * e.d.speed * .5 : 0;
            e.spd = Math.abs(mv) + Math.abs(sw) * .2; e.x += (nx * mv - nz * sw) * dt; e.z += (nz * mv + nx * sw) * dt;
            if (e.cd <= 0 && d < e.d.range + 6 && attackers() < 2) beginEnemyAttack(e);
            break;
          }
          case 'wind': {
            turn(14); e.tele = .5 + Math.sin(e.st * 40) * .5;
            if (e.st >= e.windT) { e.state = 'strike'; e.st = 0; e.ld = [Math.sin(e.face), Math.cos(e.face)]; e.hitDone = false; e.tele = 0; S.tone(500, 200, .12, 'square', .02); }
            break;
          }
          case 'strike': {
            if (e.st < .16 && d > 1.8) { e.x += e.ld[0] * e.d.lunge * 2.6 * dt; e.z += e.ld[1] * e.d.lunge * 2.6 * dt; }
            if (!e.hitDone && e.st >= .09) { e.hitDone = true; enemySlashFx(e, false); strikeCheck(e, e.d.range, e.d.dmg, 1.15); }
            if (e.st > .34) { if (e.combo > 0) { e.combo--; e.state = 'wind'; e.st = 0; e.windT = .26; e.dodgedThis = false; } else { e.state = 'approach'; e.st = 0; e.cd = rnd(1.1, 2.2) - waveI * .12; e.recoverT = .5; } }
            break;
          }
          default: if (e.type === 'boss') updateBoss(e, dt, want, d, nx, nz);
        }
        bound();
      }

      /* ---------- el jefe: Ronin Carmesí ---------- */
      const BOSS_PAT = [['combo', 'wave', 'combo', 'leap'], ['combo', 'rain', 'wave', 'leap', 'combo'], ['combo5', 'rain', 'wave', 'leap', 'rain']];
      function bossAI(e, dt, d, nx, nz) {
        const ph = e.hp < e.max * .3 ? 3 : e.hp < e.max * .6 ? 2 : 1;
        if (ph !== e.phase) {
          e.phase = ph; e.patI = 0; toast(ph === 2 ? '¡El Ronin se pone serio!' : '¡El Ronin desata su furia!', 2); shake = 1.2; S.tone(80, 40, 1.2, 'sawtooth', .1);
          fx.ring([e.x, .3, e.z], 0xff2a3a, 14, .8); impactT = .06;
          queue.push('shadow', 'shadow'); WAVES[3].cap = 3; spawnT = .5;
        }
        const spd = e.d.speed * (1 + .12 * (ph - 1));
        e.spd = d > 6 ? spd : 0;
        if (d > 5.5) { e.x += nx * spd * dt; e.z += nz * spd * dt; }
        if (e.cd <= 0) {
          const pat = BOSS_PAT[ph - 1][e.patI++ % BOSS_PAT[ph - 1].length];
          e.st = 0; e.dodgedThis = false; e.sub = 0; e.tele = 1;
          if (pat === 'combo' || pat === 'combo5') { e.state = 'bCombo'; e.n = pat === 'combo5' ? 5 : 3; e.stage = 'wind'; e.windT = Math.max(.3, .5 - .06 * ph); }
          else if (pat === 'wave') { e.state = 'bWave'; e.stage = 'wind'; }
          else if (pat === 'rain') { e.state = 'bRain'; e.stage = 'wind'; toast('¡LLUVIA DE ESPADAS!', 1.4); }
          else { e.state = 'bLeap'; e.stage = 'wind'; e.leapTo = [P.x, P.z]; warn(P.x, P.z, 6.5, .95, () => {}); }
          S.tone(700, 1100, .3, 'sine', .03);
        }
      }
      function updateBoss(e, dt, want, d, nx, nz) {
        const turn = k => { e.face += angDiff(want, e.face) * Math.min(1, dt * k); };
        const ph = e.phase;
        switch (e.state) {
          case 'bCombo':
            if (e.stage === 'wind') { turn(14); e.tele = .5 + Math.sin(e.st * 36) * .5; if (e.st >= e.windT) { e.stage = 'strike'; e.st = 0; e.ld = [Math.sin(e.face), Math.cos(e.face)]; e.hitDone = false; e.dodgedThis = false; e.tele = 0; } }
            else {
              if (e.st < .2 && d > 3) { e.x += e.ld[0] * 38 * dt; e.z += e.ld[1] * 38 * dt; }
              if (!e.hitDone && e.st >= .1) { e.hitDone = true; enemySlashFx(e, true); strikeCheck(e, e.d.range, e.d.dmg, 1.3); shake = Math.max(shake, .5); }
              if (e.st > .36) { if (--e.n > 0) { e.stage = 'wind'; e.st = 0; e.windT = Math.max(.22, .36 - .04 * ph); e.tele = 1; } else { e.state = 'bRecover'; e.st = 0; } }
            }
            break;
          case 'bWave':
            if (e.stage === 'wind') {
              turn(8); e.tele = .5 + Math.sin(e.st * 30) * .5;
              if (!e.line) { e.line = mesh(scene, geo.box, 0xff2a3a, 7, .05, 34, 0, .12, 0, { alpha: .22, cast: false, emis: 1, add: true }); }
              e.line.at(e.x + Math.sin(e.face) * 18, .12, e.z + Math.cos(e.face) * 18); e.line.rot = [0, e.face, 0];
              if (e.st >= .75 - .08 * ph) { scene.remove(e.line); e.line = null; e.stage = 'fire'; e.st = 0; e.tele = 0; enemySlashFx(e, true); fireProj('boss', e.x + Math.sin(e.face) * 3, 2, e.z + Math.cos(e.face) * 3, e.face, { color: 0xff2a3a, size: 4.4, speed: 24, life: 1.5, dmg: 20, roll: Math.PI / 2, r: 3.8 }); shake = .7; }
            } else if (e.st > .4) { e.state = 'bRecover'; e.st = 0; }
            break;
          case 'bRain':
            if (e.stage === 'wind') {
              turn(8); e.tele = .5 + Math.sin(e.st * 30) * .5;
              if (e.st >= .55) {
                e.stage = 'rain'; e.st = 0; e.tele = 0; const N = ph === 3 ? 10 : 7;
                for (let i = 0; i < N; i++) {
                  const a = Math.random() * TAU, rr = i === 0 ? 0 : rnd(2, 11), x = P.x + Math.cos(a) * rr, z = P.z + Math.sin(a) * rr;
                  warn(x, z, 3.4, 1.0 + i * .12, () => {
                    fx.ring([x, .3, z], 0xff2a3a, 5, .4); fx.burst([x, 1, z], 20, { colors: [0xff2a3a, 0xffd23f, 0xffffff], speed: 10, life: .6, size: .3, add: true, grav: 8 }); shake = Math.max(shake, .6); S.noise(.3, .14, 400); S.tone(120, 40, .3, 'sine', .1);
                    if (Math.hypot(P.x - x, P.z - z) < 3.6 && P.y < 2.6) { if (P.dashT > 0 || P.inv > .12) { if (P.dodgeT > 0) perfectDodge(); } else hurtHero(18, x, z, 12); }
                  }, true);
                }
              }
            } else if (e.st > 1.2) { e.state = 'bRecover'; e.st = 0; }
            break;
          case 'bLeap': {
            if (e.stage === 'wind') { turn(8); e.tele = .5 + Math.sin(e.st * 30) * .5; if (e.st >= .45) { e.stage = 'air'; e.st = 0; e.from = [e.x, e.z]; e.tele = 0; S.tone(200, 700, .5, 'sawtooth', .04); } }
            else if (e.stage === 'air') {
              const k = clamp(e.st / .85, 0, 1); e.x = lerp(e.from[0], e.leapTo[0], ease.inOut(k)); e.z = lerp(e.from[1], e.leapTo[1], ease.inOut(k)); e.y = Math.sin(k * Math.PI) * 11;
              if (k >= 1) {
                e.y = 0; e.stage = 'land'; e.st = 0; shake = 1.6; fx.ring([e.x, .3, e.z], 0xff2a3a, 8, .6); fx.ring([e.x, .3, e.z], 0xffd23f, 5.5, .45); fx.burst([e.x, .5, e.z], 40, { colors: [0xff2a3a, 0xffd23f, 0xffffff, 0xc8b88a], speed: 13, life: .8, size: .4, grav: 14 }); S.noise(.6, .3, 220); S.tone(70, 30, .6, 'sine', .16);
                if (Math.hypot(P.x - e.x, P.z - e.z) < 7 && P.y < 2.6) { if (P.dashT > 0 || P.inv > .12) { if (P.dodgeT > 0) perfectDodge(); } else hurtHero(22, e.x, e.z, 16); }
              }
            } else if (e.st > .8) { e.state = 'bRecover'; e.st = 0; }
            break;
          }
          case 'bRecover': if (e.st > (ph === 3 ? .6 : ph === 2 ? .9 : 1.2)) { e.state = 'approach'; e.st = 0; e.cd = ph === 3 ? .4 : .8; } break;
          case 'bDaze': if (e.st > 1.6) { e.state = 'approach'; e.st = 0; e.cd = .6; } break;
        }
      }
      /* ---------- controles ---------- */
      // registra un manejador sustituyendo el de la partida anterior (al volver a jugar no se duplican)
      const on = (el, ev, fn) => { el.__h = el.__h || {}; if (el.__h[ev]) el.removeEventListener(ev, el.__h[ev]); el.__h[ev] = fn; el.addEventListener(ev, fn); };
      const key = {}, joy = { x: 0, y: 0, id: null, ox: 0, oy: 0, on: false };
      let atkHeld = false;
      const cam = { pos: [0, 10, 20], target: [0, 3, 0], fov: 60, up: [0, 1, 0] };
      const camS = { x: 0, z: 6, vx: 0, vz: 0 };
      let camYaw = Math.PI, camPitch = .2, manualT = 0, camDist = 9, camRoll = 0, camY = 3.7;
      const cine = { on: false, pos: [0, 0, 0], tgt: [0, 0, 0], roll: 0, k: 0 };
      const cineCut = (pos, tgt, roll) => { cine.on = true; cine.pos = pos; cine.tgt = tgt; cine.roll = roll || 0; cine.k = 1; };

      const kd = e => {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
        key[k] = true;
        if (k === 'j' || k === 'z') atkHeld = true;
        if (k === 'k' || k === 'x') act('tajo');
        if (k === 'l' || k === 'c') act('giro');
        if (k === ' ' || k === 'shift') act('dash');
        if (k === 'u' || k === 'v') act('ult');
        if (k === 'e') act('jump');
        if (k === 'f' || k === 'q') act('lock');
        if (k === 'escape' || k === 'p') togglePause();
      };
      const ku = e => { const k = e.key.toLowerCase(); key[k] = false; if (k === 'j' || k === 'z') atkHeld = false; };
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      const zone = $('#gJoyZone');
      on(zone, 'pointerdown', e => {
        if (joy.id !== null) return; joy.id = e.pointerId; joy.on = true; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
        try { zone.setPointerCapture(e.pointerId); } catch (_) {}
        ui.stick.style.left = e.clientX + 'px'; ui.stick.style.top = e.clientY + 'px'; ui.stick.classList.add('on'); ui.stick.classList.remove('idle'); ui.knob.style.transform = 'translate(-50%,-50%)';
        S.unlock();
      });
      on(zone, 'pointermove', e => {
        if (e.pointerId !== joy.id) return;
        let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const L = Math.hypot(dx, dy), max = 46;
        if (L > max) { dx *= max / L; dy *= max / L; }
        joy.x = dx / max; joy.y = dy / max;
        ui.knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
      });
      const stickHome = () => { const r = root.getBoundingClientRect(); ui.stick.style.left = (r.width * .14 + 40) + 'px'; ui.stick.style.top = (r.height - 110) + 'px'; ui.knob.style.transform = 'translate(-50%,-50%)'; ui.stick.classList.add('idle'); };
      const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.on = false; joy.x = joy.y = 0; ui.stick.classList.remove('on'); stickHome(); };
      stickHome(); on(window, 'resize', stickHome);
      on(zone, 'pointerup', joyEnd); on(zone, 'pointercancel', joyEnd);
      const look = $('#gLookZone'); let lookId = null, lx = 0, ly = 0;
      const hint = $('#gLookHint'); let hinted = false;
      on(look, 'pointerdown', e => { if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (_) {} });
      on(look, 'pointermove', e => {
        if (e.pointerId !== lookId) return; hint.classList.add('off'); hinted = true;
        camYaw -= (e.clientX - lx) * .009; camPitch = clamp(camPitch + (e.clientY - ly) * .005, .04, .9); lx = e.clientX; ly = e.clientY; manualT = 2.4;
      });
      const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
      on(look, 'pointerup', lookEnd); on(look, 'pointercancel', lookEnd);
      const hold = (el, down, up) => {
        on(el, 'pointerdown', e => { e.preventDefault(); S.unlock(); el.classList.add('held'); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} down(); });
        const end = () => { el.classList.remove('held'); if (up) up(); };
        on(el, 'pointerup', end); on(el, 'pointercancel', end); on(el, 'pointerleave', end);
      };
      hold(ui.sk.atk, () => { atkHeld = true; }, () => { atkHeld = false; });
      hold(ui.sk.beam, () => act('tajo'));
      hold(ui.sk.wave, () => act('giro'));
      hold(ui.sk.dash, () => act('dash'));
      hold(ui.sk.ult, () => act('ult'));
      hold($('#skJump'), () => act('jump'));
      hold($('#skLock'), () => act('lock'));

      // controles relativos a la cámara: arriba = hacia donde mira la cámara
      function moveInput() {
        let jx = joy.x, jy = joy.y;
        if (key.a || key.arrowleft) jx -= 1; if (key.d || key.arrowright) jx += 1;
        if (key.w || key.arrowup) jy -= 1; if (key.s || key.arrowdown) jy += 1;
        let L = Math.hypot(jx, jy); if (L > 1) { jx /= L; jy /= L; L = 1; }
        const fx0 = Math.sin(camYaw), fz0 = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
        return [rx * jx + fx0 * -jy, rz * jx + fz0 * -jy, L];
      }
      // fija al enemigo más cercano (con histéresis, el jefe tiene prioridad)
      function pickTarget() {
        if (P.lockPref && !P.lockPref.dead && Math.hypot(P.lockPref.x - P.x, P.lockPref.z - P.z) < 45) { P.target = P.lockPref; return; }
        P.lockPref = null;
        let best = null, bs = 1e9;
        for (const e of enemies) {
          if (e.dead || e.state === 'spawn') continue;
          const d = Math.hypot(e.x - P.x, e.z - P.z), sc = d - (e === P.target ? 7 : 0) - (e.type === 'boss' ? 4 : 0);
          if (sc < bs) { bs = sc; best = e; }
        }
        P.target = best && Math.hypot(best.x - P.x, best.z - P.z) < 45 ? best : null;
      }
      function aimDir() {
        const t = P.target;
        if (t && !t.dead) { const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, d]; }
        return [Math.sin(P.face), Math.cos(P.face), 99];
      }

      /* ---------- combate: espada ---------- */
      function startSwing(idx, lunge) {
        const C = CLIPS[idx]; P.atkI = idx; P.atkDur = C.dur; P.atkT = C.dur; P.atkHit = false; P.comboWin = C.dur + .45;
        const [ax, az, ad] = aimDir();
        if (P.target && ad < 20) P.face = Math.atan2(ax, az);
        else { const [mx, mz, ml] = moveInput(); if (ml > .2) P.face = Math.atan2(mx, mz); }
        if (lunge) {
          const dist = P.target ? Math.max(0, ad - 2.4) : C.lunge * .22;
          P.lunge = .11; P.lx = Math.sin(P.face) * clamp(dist / .11, 0, 46); P.lz = Math.cos(P.face) * clamp(dist / .11, 0, 46);
          if (dist > 3.5) { spawnGhost(); smokeFx([P.x, 2.2, P.z], 6, true); S.tone(700, 1500, .1, 'sine', .03); }
        }
        if (C.jump) { P.vy = C.jump; P.y = Math.max(P.y, .01); }
        S.noise(.08, .05, 5000); if (AUDIO) AUDIO.slash(idx >= 2);
      }
      function swingHit(idx) {
        const C = CLIPS[idx], fin = idx === 3 && !P.airSeq, air = !!P.airSeq, range = TUNE.range + C.range;
        const tilt = [.45, -.5, .3, 2.6][idx];
        if (C.kick) { slashFx([P.x, 2.2 + P.y, P.z], P.face - .38, 0xffffff, range * .9, .2, .2); S.noise(.1, .12, 1800); }
        else {
          slashFx([P.x, 2.9 + P.y, P.z], P.face - .38, 0xffffff, range * 1.1, fin ? .3 : .22, tilt);
          slashFx([P.x, 2.9 + P.y, P.z], P.face - .38, fin ? 0xffd23f : (idx % 2 ? 0x7df3ff : 0xff8ae8), range * .85, .18, tilt);
          S.noise(.12, .1, 4500);
        }
        if (fin) { punch = .5; }
        S.tone(fin ? 420 : C.kick ? 300 : 760, 200, .12, 'sawtooth', .02);
        let hits = 0;
        for (const e of enemies) {
          if (e.dead || e.state === 'spawn' || Math.abs(e.y - P.y) > 4.6) continue;
          const dx = e.x - P.x, dz = e.z - P.z, dd = Math.hypot(dx, dz), d = dd - e.r;
          if (d > range) continue;
          if (Math.abs(angDiff(Math.atan2(dx, dz), P.face)) < C.spread * .6 + .3 || d < .8) {
            hits++;
            hurtEnemy(e, TUNE.combo[idx] * P.buff, dx / (dd || 1), dz / (dd || 1), fin ? 4 : C.kick ? 14 : 5, { launch: fin, launchV: 15, stun: C.kick ? .55 : .35, crit: Math.random() < .12, brk: fin || C.kick });
            if (fin) heavyImpact([e.x, 2.6, e.z], .8);
          }
        }
        if (hits) { hitstop = Math.max(hitstop, fin ? .09 : (C.kick ? .06 : .035)); shake = Math.max(shake, fin ? .9 : C.kick ? .6 : .35); }
      }
      function tickAttack(dt) {
        if (P.lunge > 0) { P.lunge -= dt; P.x += P.lx * dt; P.z += P.lz * dt; if (P.lx * P.lx + P.lz * P.lz > 700) { P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = .05; spawnGhost(); } } }
        if (P.atkT > 0) {
          P.atkT -= dt; const C = CLIPS[P.atkI], tt = P.atkDur - P.atkT;
          if (!P.atkHit && tt >= C.hit) { P.atkHit = true; swingHit(P.atkI); }
        }
      }

      /* ---------- combo en el aire: salta hacia el enemigo lanzado ---------- */
      function beginAir(t) {
        P.airSeq = { t: 0, tgt: t, k: 0 }; P.plunge = false;
        const dx = P.x - t.x, dz = P.z - t.z, d = Math.hypot(dx, dz) || 1;
        spawnGhost(); smokeFx([P.x, 2.5, P.z], 10, true);
        P.x = t.x + dx / d * 2.3; P.z = t.z + dz / d * 2.3; P.y = Math.max(t.y, 1); P.vy = 0; P.lunge = 0;
        P.face = Math.atan2(t.x - P.x, t.z - P.z); smokeFx([P.x, P.y + 2.5, P.z], 10, true); if (AUDIO) AUDIO.tele(); airCam(t);
        punch = .4;
      }
      // cámara de lado e inclinada durante la persecución aérea
      function airCam(t) {
        const mx = (P.x + t.x) / 2, mz = (P.z + t.z) / 2, dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz) || 1, sx = -dz / d, sz = dx / d;
        const side = Math.sin(time * 7) > 0 ? 1 : -1, my = (P.y + t.y) / 2 + 2.6;
        cineCut([mx + sx * 10 * side, my + 1.5, mz + sz * 10 * side], [mx, my, mz], .14 * side); cine.air = true;
      }
      function endAir() { P.airSeq = null; P.plunge = false; if (cine.air && !P.ultSeq) { cine.on = false; cine.air = false; } }
      function updateAir(dt) {
        const A = P.airSeq, t = A.tgt; A.t += dt;
        if (!t || t.dead || A.t > 1.8) { endAir(); return; }
        if (!P.plunge) {
          const dx = P.x - t.x, dz = P.z - t.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, dt * 16);
          P.x = lerp(P.x, t.x + dx / d * 2.3, k); P.z = lerp(P.z, t.z + dz / d * 2.3, k); P.y = lerp(P.y, t.y + .1, Math.min(1, dt * 18)); P.vy = 0;
          P.face = Math.atan2(t.x - P.x, t.z - P.z); P.inv = Math.max(P.inv, .15);
          if (cine.air) { const mx = (P.x + t.x) / 2, mz = (P.z + t.z) / 2, my = (P.y + t.y) / 2 + 2.6; cine.tgt = [mx, my, mz]; cine.pos[1] = lerp(cine.pos[1], my + 1.5, Math.min(1, dt * 6)); }
          const times = [.12, .3, .48];
          if (A.k < 3 && A.t >= times[A.k]) { startSwing([0, 1, 2][A.k], false); A.k++; }
          if (A.t >= .68) {
            P.plunge = true; P.atkT = 0; P.vy = -38; t.vy = -38; fx.ring([P.x, P.y + 1, P.z], 0xffd23f, 3, .3, { thin: true }); S.tone(1200, 200, .4, 'sawtooth', .05); punch = .6;
            lineFx([t.x, t.y + 6, t.z], 14, 0xffffff, .3, [0, 0, 0]);
          }
        } else {
          P.y += P.vy * dt; P.x = lerp(P.x, t.x, Math.min(1, dt * 10)); P.z = lerp(P.z, t.z, Math.min(1, dt * 10));
          if (Math.random() < .8) fx.burst([P.x, P.y + 2, P.z], 1, { colors: [0xffffff, 0xffd23f], speed: 1, life: .3, size: .3, add: true, grav: 0, floor: -99 });
          if (P.y <= 0) {
            P.y = 0; P.vy = 0; endAir(); P.inv = Math.max(P.inv, .35); P.comboWin = 0; P.atkT = 0;
            fx.ring([P.x, .3, P.z], 0xffffff, 9, .5); heavyImpact([P.x, 1.2, P.z], 1.3); fx.burst([P.x, .5, P.z], 30, { geo: geo.rock, colors: [0x8a7a5a, 0x6a5a4a], speed: 12, life: .8, size: .45, emis: .05, grav: 22 }); hitstop = Math.max(hitstop, .1);
            S.noise(.5, .25, 260); S.tone(80, 35, .5, 'sine', .15);
            for (const e of enemies) { if (e.dead || e.state === 'spawn') continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d < 7.5 + e.r && e.y < 3) hurtEnemy(e, 26 * P.buff, dx / (d || 1), dz / (d || 1), 10, { stun: .7, brk: true }); }
          }
        }
      }

      /* ---------- habilidades ---------- */
      function act(what) {
        if (state !== 'play' || P.dead || P.ultSeq) return;
        if (what === 'tajo' && P.cd.tajo <= 0 && P.castT <= 0 && !P.airSeq) {
          P.cd.tajo = TUNE.tajo.cd; P.castT = P.castDur = .42; P.castKind = 'tajo'; P.castFired = false; P.atkT = 0; P.lunge = 0;
          const [ax, az] = aimDir(); P.face = Math.atan2(ax, az); banner('TAJO LUNAR'); S.tone(300, 1200, .3, 'sawtooth', .03);
        }
        if (what === 'giro' && P.cd.giro <= 0 && P.castT <= 0 && !P.airSeq) {
          P.cd.giro = TUNE.giro.cd; P.castT = P.castDur = .7; P.castKind = 'giro'; P.castFired = false; P.atkT = 0; P.lunge = 0; P.vy = 11; P.y = Math.max(P.y, .01);
          banner('TORBELLINO'); S.tone(200, 900, .4, 'sawtooth', .04);
        }
        if (what === 'dash' && P.cd.dash <= 0 && !P.airSeq) {
          const [mx, mz, ml] = moveInput();
          P.dashDir = ml > .2 ? [mx / ml, mz / ml] : [-Math.sin(P.face), -Math.cos(P.face)];
          P.face = ml > .2 ? Math.atan2(P.dashDir[0], P.dashDir[1]) : P.face;
          hero.capeKick = .9; P.cd.dash = TUNE.dash.cd; P.dashT = TUNE.dash.dur; P.inv = Math.max(P.inv, TUNE.dash.inv); P.dodgeT = .3; P.atkT = 0; P.castT = 0; P.lunge = 0;
          spawnGhost(); smokeFx([P.x, 2, P.z], 7, true); if (AUDIO) AUDIO.whoosh();
        }
        if (what === 'ult' && P.ult >= 100 && !P.airSeq) ultStart();
        if (what === 'jump' && P.y <= .05 && !P.airSeq && P.dashT <= 0) { P.vy = 14.5; P.y = .02; hero.capeKick = .7; fx.ring([P.x, .2, P.z], 0xffffff, 2.2, .25, { thin: true }); smokeFx([P.x, .6, P.z], 4, false); if (AUDIO) AUDIO.whoosh(); }
        if (what === 'lock') {
          const list = enemies.filter(e => !e.dead && e.state !== 'spawn').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
          if (list.length) { const i = list.indexOf(P.target); P.lockPref = list[(i + 1) % list.length]; P.target = P.lockPref; manualT = 0; S.tone(1200, 1600, .06, 'triangle', .03); }
        }
      }
      function castTick(dt) {
        P.castT -= dt; const k = 1 - P.castT / P.castDur;
        if (P.castKind === 'tajo' && !P.castFired && k >= .45) {
          P.castFired = true; const [ax, az] = aimDir(), ang = Math.atan2(ax, az);
          fireProj('tajo', P.x + ax * 2.2, 3 + P.y, P.z + az * 2.2, ang, { color: 0xffffff, size: 3.8, speed: TUNE.tajo.speed, life: TUNE.tajo.life, dmg: TUNE.tajo.dmg, roll: Math.PI / 2 + (Math.random() - .5) * .4, r: 3.8 });
          slashFx([P.x, 3 + P.y, P.z], P.face - .38, 0xffffff, 6, .3, .3); shake = Math.max(shake, .5); punch = .35; S.noise(.2, .12, 3000); S.tone(1000, 300, .25, 'sawtooth', .04);
        }
        if (P.castKind === 'giro' && !P.castFired && k >= .22) {
          P.castFired = true; const R2 = TUNE.giro.radius;
          fx.ring([P.x, .4, P.z], 0xffffff, R2 + 1, .4, { thin: true }); fx.ring([P.x, 1.5, P.z], 0x7df3ff, R2, .35, { thin: true });
          for (let i = 0; i < 3; i++) slashFx([P.x, 2.4 + P.y, P.z], P.face + i * 2.1, 0xffffff, 6.5, .3, 0);
          fx.burst([P.x, 2, P.z], 30, { colors: [0xffffff, 0x7df3ff, 0xff8ae8], speed: 14, life: .5, size: .25, add: true, flat: true, grav: 4 });
          shake = Math.max(shake, .9); hitstop = Math.max(hitstop, .05); S.noise(.3, .15, 2500);
          for (const e of enemies) {
            if (e.dead || e.state === 'spawn') continue;
            const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
            if (d < R2 + e.r && Math.abs(e.y - P.y) < 7) hurtEnemy(e, TUNE.giro.dmg * P.buff, dx / (d || 1), dz / (d || 1), 12, { launch: e.type !== 'boss', launchV: 12, brk: true });
          }
        }
      }

      /* ---------- ULTRA: Filo Celestial (secuencia de cine) ---------- */
      function ultStart() {
        const t = P.target || enemies.find(e => !e.dead && e.state !== 'spawn'); if (!t) return;
        P.ult = 0; P.ultSeq = { t: 0, tgt: t, i: 0, a0: Math.random() * TAU, fin: false };
        P.inv = 99; frozen = true; P.atkT = 0; P.castT = 0; P.dashT = 0; P.lunge = 0; endAir();
        banner('FILO CELESTIAL', 'zan · ten · setsu'); ui.bars.classList.add('on'); root.classList.add('ulting');
        ui.ultFx.classList.remove('on'); void ui.ultFx.offsetWidth; ui.ultFx.classList.add('on');
        if (AUDIO) AUDIO.charge(); impactT = .05;
        const fx0 = Math.sin(P.face), fz0 = Math.cos(P.face);
        cineCut([P.x + fx0 * 5.2 + Math.cos(P.face) * 1.6, 2.2, P.z + fz0 * 5.2 - Math.sin(P.face) * 1.6], [P.x, 3.8, P.z], .12);
      }
      function ultSlash(U, i) {
        const t = U.tgt, a = U.a0 + i * 2.39 + Math.random() * .5, r = 3.4;
        spawnGhost();
        P.x = t.x + Math.sin(a) * r; P.z = t.z + Math.cos(a) * r; P.y = i % 3 === 2 ? 2.4 : 0; P.face = Math.atan2(t.x - P.x, t.z - P.z);
        P.atkI = i % 3; P.atkDur = .16; P.atkT = .16; P.atkHit = true;
        const c = [t.x, 2.8 + t.y, t.z], rot = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];
        lineFx(c, 11, 0xffffff, .28, rot); lineFx(c, 7, 0x7df3ff, .22, [rot[0] + .4, rot[1], rot[2] - .5]);
        slashFx(c, Math.random() * TAU, 0xffffff, 5, .25, (Math.random() - .5) * 2);
        fx.burst(c, 14, { colors: [0xffffff, 0xff8ae8, 0x7df3ff], speed: 12, life: .4, size: .22, add: true, grav: 0 });
        t.flash = .1; t.hpShow = 3; const dmg = Math.round(6 * P.buff); if (t.hp - dmg > 1) t.hp -= dmg; num(t.x, 7, t.z, dmg, '');
        shake = Math.max(shake, .35); S.tone(1400 + i * 120, 600, .1, 'triangle', .035); S.noise(.1, .08, 5000);
        if (i % 2 === 0) { const b = Math.random() * TAU, rr = rnd(6, 9); cineCut([t.x + Math.sin(b) * rr, rnd(1.2, 4.5), t.z + Math.cos(b) * rr], [t.x, 3 + t.y, t.z], rnd(-.25, .25)); }
        if (i === 3) impactT = .04;
      }
      function ultFinish(U) {
        const t = U.tgt, a = U.a0 + 1;
        impactT = .14; hitstop = .25; shake = 2;
        P.x = t.x + Math.sin(a) * 6; P.z = t.z + Math.cos(a) * 6; P.y = 0; P.face = Math.atan2(t.x - P.x, t.z - P.z); P.atkI = 3; P.atkDur = .6; P.atkT = .6; P.atkHit = true;
        lineFx([t.x, 10, t.z], 26, 0xffffff, .6, [0, 0, .22]); lineFx([t.x, 10, t.z], 26, 0x7df3ff, .5, [0, 0, -.18]); lineFx([t.x, 3, t.z], 22, 0xffd23f, .45, [0, 0, Math.PI / 2 + .1]);
        fx.ring([t.x, .4, t.z], 0xffffff, 14, .6); fx.ring([t.x, .4, t.z], 0xffd23f, 10, .5); fx.burst([t.x, 3, t.z], 90, { colors: [0xffffff, 0xffd23f, 0x7df3ff, 0xff8ae8], speed: 16, life: 1.1, size: .35, add: true, grav: 6 });
        S.noise(.8, .28, 400); S.tone(60, 30, .9, 'sine', .18); [523, 659, 784, 1047].forEach((f, i) => S.tone(f, f, .3, 'triangle', .05, .05 + i * .08));
        for (const e of enemies) {
          if (e.dead || e.state === 'spawn') continue;
          const dx = e.x - t.x, dz = e.z - t.z, d = Math.hypot(dx, dz);
          if (d < 14) hurtEnemy(e, TUNE.ultDmg * P.buff * (e.type === 'boss' ? 1.2 : 1), dx / (d || 1), dz / (d || 1), 14, { launch: e.type !== 'boss', brk: true, noCounter: true, crit: true });
        }
        cineCut([t.x + Math.sin(a + 1.2) * 15, 6, t.z + Math.cos(a + 1.2) * 15], [t.x, 3.5, t.z], .08);
        slowT = .7;
      }
      function ultEnd() {
        P.ultSeq = null; frozen = false; P.inv = 1.2; cine.on = false; P.atkT = 0; ui.bars.classList.remove('on'); root.classList.remove('ulting');
      }
      function updateUlt(dt) {
        const U = P.ultSeq; U.t += dt;
        if (U.t < .6) { if (Math.random() < dt * 70) fx.burst([P.x, .5, P.z], 1, { colors: [0x7df3ff, 0xffffff, 0xff8ae8], speed: 3, life: .8, size: .25, add: true, grav: -6, floor: -99 }); return; }
        const T0 = .6, DT = .16, N = 7, idx = Math.floor((U.t - T0) / DT);
        while (U.i <= idx && U.i < N) { ultSlash(U, U.i); U.i++; }
        if (U.i >= N && !U.fin && U.t >= T0 + N * DT + .25) { U.fin = true; ultFinish(U); }
        if (U.t >= T0 + N * DT + 1.5) ultEnd();
      }

      /* ---------- la heroína, cada paso ---------- */
      function updateHero(dt) {
        const [mx, mz, ml] = moveInput();
        let sp = 0;
        if (P.dead) { P.deadT += dt; if (P.deadT > 1.5 && state === 'play') { state = 'lost'; if (AUDIO) AUDIO.start(0); $('#gLose').classList.remove('hidden'); $('#gLoseTxt').textContent = waveDeaths >= 2 ? 'Esta vez vuelves con tus golpes un 25 % más fuertes. ¡Tú puedes!' : 'Vuelves al principio de esta oleada con la vida llena.'; } return 0; }
        const free = state === 'play' || state === 'break';
        tickAttack(dt);
        if (P.ultSeq) { updateUlt(dt); return 0; }
        if (P.airSeq) { updateAir(dt); return 0; }
        if (P.kx || P.kz) { P.x += P.kx * dt; P.z += P.kz * dt; P.kx *= Math.pow(.02, dt); P.kz *= Math.pow(.02, dt); if (Math.abs(P.kx) + Math.abs(P.kz) < .1) P.kx = P.kz = 0; }
        if (P.dashT > 0) {
          P.dashT -= dt; P.x += P.dashDir[0] * TUNE.dash.speed * dt; P.z += P.dashDir[1] * TUNE.dash.speed * dt;
          P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = .045; spawnGhost(); }
          fx.burst([P.x, 1 + Math.random() * 3, P.z], 1, { colors: [0xc9bcff, 0xffffff], speed: 1, life: .3, size: .3, add: true, grav: 0 });
        } else if (free && P.lunge <= 0 && ml > .1) {
          const slow = P.atkT > 0 ? .5 : P.castT > 0 ? .3 : 1;
          P.x += mx * TUNE.speed * slow * dt; P.z += mz * TUNE.speed * slow * dt; sp = ml * slow;
          if (P.atkT <= 0 && P.castT <= 0) P.face += angDiff(Math.atan2(mx, mz), P.face) * Math.min(1, dt * 16);
          P.stepT -= dt * sp; if (P.stepT <= 0 && P.y === 0) { P.stepT = .24; fx.burst([P.x - Math.sin(P.face) * .6, .2, P.z - Math.cos(P.face) * .6], 2, { geo: geo.ballS, colors: [0xd8d0a8, 0xb8b088], speed: 1.4, life: .5, size: .4, grav: -1.2, emis: .1, fade: true }); }
        }
        // choque con los enemigos (no atraviesa, salvo al esquivar)
        if (P.dashT <= 0 && P.lunge <= 0) for (const e of enemies) { if (e.dead || e.state === 'spawn' || e.y > 2) continue; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz), m = e.r + .9; if (d < m && d > .001) { P.x = e.x + dx / d * m; P.z = e.z + dz / d * m; } }
        { const dx = P.x, dz = P.z - CAGE_Z, d = Math.hypot(dx, dz); if (d < 3.4 && d > .001) { P.x = dx / d * 3.4; P.z = CAGE_Z + dz / d * 3.4; } }
        for (const [px, pz] of PILLARS) { const dx = P.x - px, dz = P.z - pz, d = Math.hypot(dx, dz); if (d < 1.9 && d > .001) { P.x = px + dx / d * 1.9; P.z = pz + dz / d * 1.9; } }
        const pd = Math.hypot(P.x, P.z); if (pd > ARENA) { P.x *= ARENA / pd; P.z *= ARENA / pd; }
        // gravedad / salto
        if (!P.plunge) { P.vy -= 34 * dt; P.y += P.vy * dt; if (P.y <= 0) { if (P.vy < -9) fx.ring([P.x, .2, P.z], 0xffffff, 2, .25, { thin: true }); P.y = 0; P.vy = 0; } }
        // iniciar ataque (mantener pulsado = combo seguido; contra un enemigo lanzado: combo aéreo)
        P.comboWin = Math.max(0, P.comboWin - dt);
        if (state === 'play' && atkHeld && P.atkT <= 0 && P.dashT <= 0 && P.castT <= 0) {
          const t = P.target;
          if (t && !t.dead && t.state === 'launched' && t.y > 1.7 && Math.hypot(t.x - P.x, t.z - P.z) < 15) beginAir(t);
          else startSwing(P.comboWin > 0 ? (P.atkI + 1) % 4 : 0, true);
        }
        if (P.castT > 0) castTick(dt);
        return sp;
      }

      /* ---------- enemigos, proyectiles, avisos... ---------- */
      function updateEnemies(dt) {
        if (!frozen) {
          for (const e of enemies) updateEnemy(e, dt);
          for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i], b = enemies[j]; if (a.dead || b.dead || a.state === 'spawn' || b.state === 'spawn') continue;
            const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
            if (d < m && d > .001) { const p = (m - d) / 2, nx = dx / d, nz = dz / d, wa = a.type === 'boss' ? 0 : 1, wb = b.type === 'boss' ? 0 : 1; a.x -= nx * p * wa * (wb ? 1 : 2); a.z -= nz * p * wa * (wb ? 1 : 2); b.x += nx * p * wb * (wa ? 1 : 2); b.z += nz * p * wb * (wa ? 1 : 2); }
          }
        } else for (const e of enemies) { e.flash = Math.max(0, e.flash - dt); if (e.dead) updateEnemy(e, dt); }
        for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].remove) { enemies.splice(i, 1); updateLeft(); }
      }
      function updateProjs(dt) {
        if (frozen) return;
        for (let i = projs.length - 1; i >= 0; i--) {
          const q = projs[i]; q.life -= dt; q.x += q.dx * q.sp * dt; q.z += q.dz * q.sp * dt; q.n.at(q.x, q.y, q.z); q.n.alpha = clamp(q.life * 4, 0, .95);
          if (Math.random() < .9) fx.burst([q.x - q.dx * 1.2, q.y + (Math.random() - .5) * 2.4, q.z - q.dz * 1.2], 1, { colors: [q.col, 0xffffff], speed: 1, life: .35, size: .3, add: true, grav: 0, floor: -99 });
          if (q.kind === 'tajo') {
            for (const e of enemies) {
              if (e.dead || e.state === 'spawn' || q.hit.has(e)) continue;
              const dx = e.x - q.x, dz = e.z - q.z;
              if (Math.hypot(dx, dz) < q.r + e.r && Math.abs(e.y + 2 - q.y) < 6) { q.hit.add(e); hurtEnemy(e, q.dmg * P.buff, q.dx, q.dz, 10, { stun: .5, brk: true, launch: e.type !== 'boss' && Math.random() < .5 }); hitstop = Math.max(hitstop, .04); }
            }
          } else if (!P.dead && !q.hit.has('p') && Math.hypot(P.x - q.x, P.z - q.z) < q.r * .85 && P.y < 2.6) {
            if (P.dashT > 0 || P.inv > .12) { if (P.dodgeT > 0) { q.hit.add('p'); perfectDodge(); } }
            else { q.hit.add('p'); hurtHero(q.dmg, q.x - q.dx * 3, q.z - q.dz * 3, 14); }
          }
          if (q.life <= 0 || Math.hypot(q.x, q.z) > 70) { scene.remove(q.n); projs.splice(i, 1); }
        }
      }
      function updateWarns(dt) {
        if (frozen) return;
        for (let i = warns.length - 1; i >= 0; i--) {
          const w = warns[i]; w.t += dt; const k = w.t / w.time;
          w.n.alpha = .18 + .2 * (Math.sin(w.t * 22) * .5 + .5); const s = w.r * 2 * Math.min(1, k); w.fill.scl = [s, .07, s];
          if (w.drop) w.drop.pos[1] = lerp(34, 4.2, Math.pow(clamp((w.t - (w.time - .3)) / .3, 0, 1), 2));
          if (k >= 1) { scene.remove(w.n); scene.remove(w.fill); if (w.drop) scene.remove(w.drop); warns.splice(i, 1); if (state === 'play') w.onEnd(); }
        }
      }
      function updateLines(dt) {
        for (let i = lines.length - 1; i >= 0; i--) {
          const q = lines[i]; q.t += dt; const k = q.t / q.life;
          if (q.bill) {
            const n = q.n, dx = cam.pos[0] - n.pos[0], dy = cam.pos[1] - n.pos[1], dz = cam.pos[2] - n.pos[2];
            n.rot = [-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), q.roll]; const sc = q.s * (.55 + .9 * ease.out(Math.min(1, k * 1.6))); n.scl = [sc, sc, 1]; n.alpha = 1 - k * k;
          } else if (q.streak) {
            q.n.pos[0] += q.v[0] * dt; q.n.pos[1] += q.v[1] * dt; q.n.pos[2] += q.v[2] * dt; q.n.scl[1] = q.L * (1 - k * .8); q.n.alpha = 1 - k;
          } else if (q.sweep) { q.n.rot[1] = q.sweep.y0 + q.sweep.dy * ease.out(k); const s = q.sweep.s * (1 + k * .2); q.n.scl = [s, s, 1]; const cd = Math.hypot(cam.pos[0] - q.n.pos[0], cam.pos[1] - q.n.pos[1], cam.pos[2] - q.n.pos[2]); q.n.alpha = (1 - k) * .9 * clamp((cd - 3.5) / 5, .12, 1); }
          else { q.n.alpha = 1 - k; q.n.scl = [.16 * (1 - k * .7), q.len * (1 + k * .2), .16 * (1 - k * .7)]; }
          if (k >= 1) { release(q.n); lines.splice(i, 1); }
        }
      }
      function updatePotions(dt) {
        for (let i = potions.length - 1; i >= 0; i--) {
          const q = potions[i]; q.t += dt; q.n.pos[1] = .7 + Math.sin(q.t * 3) * .2; q.n.rot[1] = q.t * 2; q.halo.alpha = .2 + Math.sin(q.t * 5) * .08;
          if (Math.hypot(q.x - P.x, q.z - P.z) < 2 && !P.dead) {
            const before = P.hp; P.hp = Math.min(TUNE.hp, P.hp + TUNE.potion);
            num(P.x, 6.5, P.z, '+' + (P.hp - before), 'heal'); fx.burst([P.x, 2.5, P.z], 16, { colors: [0x6ee07a, 0xffffff], speed: 4, life: .7, size: .25, add: true, grav: -4 });
            S.tone(660, 990, .18, 'triangle', .05); scene.remove(q.n); potions.splice(i, 1);
          } else if (q.t > 14) { scene.remove(q.n); potions.splice(i, 1); }
        }
      }

      /* ---------- oleadas ---------- */
      function updateLeft() {
        const alive = enemies.filter(e => !e.dead).length, n = alive + queue.length;
        ui.left.textContent = WAVES[waveI].boss ? '' : n + (n === 1 ? ' enemigo' : ' enemigos');
      }
      function startWave(i) {
        waveI = i; const W = WAVES[i]; if (W.baseCap == null) W.baseCap = W.cap; W.cap = W.baseCap + (HARD && !W.boss ? 1 : 0); waveHurt = false;
        if (AUDIO) AUDIO.start(W.boss ? 2 : 1);
        queue = W.list.slice(); if (HARD && !W.boss) queue.push(i ? 'samurai' : 'shadow'); spawnT = .6; state = 'play';
        ui.wave.textContent = W.boss ? 'Jefe final' : 'Oleada ' + (i + 1) + ' de 3';
        ui.boss.classList.toggle('hidden', !W.boss);
        toast(W.boss ? '¡Cuidado! Llega el Ronin Carmesí' : 'Oleada ' + (i + 1) + ': ' + W.name, 2.2);
        if (W.boss) { S.tone(90, 45, 1.2, 'sawtooth', .07); shake = 1.2; }
        updateLeft();
      }
      function resetWave() {
        enemies.forEach(e => { scene.remove(e.root); if (e.bar) e.bar.remove(); if (e.line) scene.remove(e.line); }); enemies.length = 0;
        projs.forEach(q => scene.remove(q.n)); projs.length = 0;
        warns.forEach(w => { scene.remove(w.n); scene.remove(w.fill); if (w.drop) scene.remove(w.drop); }); warns.length = 0;
        lines.forEach(q => release(q.n)); lines.length = 0;
        potions.forEach(q => scene.remove(q.n)); potions.length = 0;
        ui.dmg.querySelectorAll('.g-ehp').forEach(b => b.remove()); bossE = null; frozen = false; cine.on = false; ultEndSafe();
        Object.assign(P, { x: 0, z: 6, y: 0, vy: 0, face: Math.PI, hp: TUNE.hp, dead: false, inv: 1.2, dashT: 0, atkT: 0, lunge: 0, castT: 0, kx: 0, kz: 0, airSeq: null, plunge: false, ultSeq: null, counter: 0 });
        P.cd.tajo = P.cd.giro = P.cd.dash = 0; camYaw = Math.PI; hero.root.rot = [0, 0, 0];
        if (waveDeaths >= 2 && P.buff < 1.25) P.buff = 1.25;
      }
      function ultEndSafe() { ui.bars.classList.remove('on'); root.classList.remove('ulting'); }
      function updateWaves(dt) {
        if (state === 'play' && !frozen) {
          spawnT -= dt;
          let alive = 0; for (const e of enemies) if (!e.dead) alive++;
          if (queue.length && spawnT <= 0 && alive < WAVES[waveI].cap) {
            const type = queue.shift(), pt = type === 'boss' ? [0, -12] : PORTALS[(Math.random() * PORTALS.length) | 0];
            const e = makeEnemy(type, pt[0], pt[1]); if (type === 'boss') bossE = e;
            spawnT = 1.2; updateLeft();
          }
        }
        if (state === 'play' && !queue.length && !enemies.some(e => !e.dead) && !P.dead) {
          if (WAVES[waveI].boss) { state = 'won'; winT = 0; win(); }
          else {
            state = 'break'; breakT = 2.8; const before = P.hp; P.hp = Math.min(TUNE.hp, P.hp + TUNE.betweenWaves);
            addScore(1000); if (!waveHurt) { addScore(1500, '¡SIN DAÑO! +1500'); }
            toast('¡Oleada superada! +' + (P.hp - before) + ' de vida', 2.4); S.tone(660, 660, .12, 'triangle', .05); S.tone(990, 990, .2, 'triangle', .05, .12);
            waveDeaths = 0;
          }
        }
        if (state === 'break') { breakT -= dt; if (breakT <= 0) startWave(waveI + 1); }
        if (state === 'won') winT += dt;
      }
      const RANKS = [['S', 28000], ['A', 21000], ['B', 15000], ['C', 9000], ['D', 0]];
      function win() {
        if (ended) return; ended = true;
        addScore(Math.max(0, 6000 - time * 20)); score = Math.max(0, score - deaths * 1000);
        const rank = RANKS.find(r => score >= r[1])[0];
        let best = 0; try { best = +localStorage.getItem('anita_record') || 0; if (score > best) localStorage.setItem('anita_record', String(score)); } catch (e) {}
        result.score = score; result.rank = rank; result.best = Math.max(best, score); result.newBest = score > best;
        if (AUDIO) { AUDIO.stop(.4); setTimeout(() => AUDIO && AUDIO.victory(), 450); }
        S.tone(523, 523, .15, 'triangle', .06); S.tone(659, 659, .15, 'triangle', .06, .15); S.tone(784, 784, .15, 'triangle', .06, .3); S.tone(1047, 1047, .4, 'triangle', .07, .45);
        toast('¡Has derrotado al Ronin Carmesí!', 3); ui.boss.classList.add('hidden'); slowT = .8;
        projs.forEach(q => scene.remove(q.n)); projs.length = 0; warns.forEach(w => { scene.remove(w.n); scene.remove(w.fill); if (w.drop) scene.remove(w.drop); }); warns.length = 0;
        setTimeout(() => {
          const m = Math.floor(time / 60), s = Math.round(time % 60);
          $('#gWinStats').textContent = `Tiempo: ${m} min ${s} s · ${kills} enemigos · combo máx. ${maxCombo} · ${perfects} esquivas perfectas`;
          $('#gRank').textContent = result.rank; $('#gRank').dataset.r = result.rank;
          $('#gScoreFinal').textContent = result.score.toLocaleString('es-ES') + ' puntos' + (HARD ? ' · Modo Pesadilla' : '');
          $('#gBest').textContent = result.newBest ? '¡Nuevo récord!' : 'Récord: ' + result.best.toLocaleString('es-ES');
          ui.toast.classList.remove('on'); toastT = 0; $('#gWin').classList.remove('hidden');
        }, 3200);
      }

      /* ---------- un paso de lógica ---------- */
      function step(dt) {
        time += state === 'play' ? dt : 0;
        for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
        P.inv = Math.max(0, P.inv - dt); P.hurtT = Math.max(0, P.hurtT - dt); P.dodgeT = Math.max(0, P.dodgeT - dt); P.counter = Math.max(0, P.counter - dt);
        comboT = Math.max(0, comboT - dt); if (comboT <= 0) combo = 0;
        if (state === 'count') {
          countT += dt; const n = countT < .8 ? '3' : countT < 1.6 ? '2' : countT < 2.4 ? '1' : countT < 3 ? '¡YA!' : '';
          if (n !== lastCount) { lastCount = n; ui.count.textContent = n; ui.count.classList.remove('pop'); void ui.count.offsetWidth; if (n) { ui.count.classList.add('pop'); S.tone(n === '¡YA!' ? 880 : 440, n === '¡YA!' ? 880 : 440, .15, 'triangle', .05); } }
          if (countT >= 3) startWave(waveI);
        }
        pickTarget();
        P._sp = updateHero(dt);
        updateEnemies(dt); updateProjs(dt); updateWarns(dt); updateLines(dt); updatePotions(dt); updateWaves(dt);
        ghosts.forEach(q => { if (q.t <= 0) return; q.t -= dt; const a = Math.max(0, q.t / .35) * .26; q.g.children.forEach(c => { c.alpha = a; }); if (q.t <= 0) q.g.visible = false; });
        // ambiente
        portalNodes.forEach((p, i) => { p.rot[1] = time * (1 + i * .2); p.alpha = .4 + Math.sin(time * 3 + i) * .15; });
        embers.update(dt, time); sparks.update(dt, time); petals.update(dt, time); mist.update(dt, time);
        beams.forEach(b => { b.n.alpha = .045 + Math.sin(time * .6 + b.ph) * .025; });
        falls.forEach((f, i) => { f.scl[0] = 1 + Math.sin(time * 9 + i) * .04; f.alpha = (.3 - i * .07) + Math.sin(time * 14 + i * 2) * .04; }); clouds.pos[0] = Math.sin(time * .02) * 20;
        if (state === 'won') {
          const k = clamp((winT - .6) / 1.2, 0, 1);
          bars.forEach((b, i) => { b.pos[1] = 2.8 + ease.out(k) * (6 + i % 3); b.alpha = 1 - k; b.rot[2] = k * (i % 2 ? 2 : -2); });
          cageTop.pos[1] = 5.1 + ease.out(k) * 9; cageTop.alpha = 1 - k; lock.alpha = 1 - k; lock.pos[1] = 2.8 - k * 3;
          giftBox.pos[1] = .6 + Math.sin(winT * 3) * .3 + k * 1.2; giftBox.rot[1] = winT * 1.4;
          if (winT > .6 && winT < .7) fx.burst([0, 3, CAGE_Z], 40, { colors: [0xffd23f, 0x6ee07a, 0xff4fd8, 0x7df3ff, 0xffffff], speed: 12, life: 1.6, size: .35, add: true, grav: 6 });
        } else giftBox.rot[1] = time * .6;
      }

      /* ---------- posturas (una vez por fotograma) ---------- */
      function poseHero(dt) {
        const sp = P._sp || 0;
        hero.rateOverride = P.atkT > 0 || P.dashT > 0 || P.castT > 0 || P.ultSeq ? 75 : 26;
        let gripT = Math.PI / 2;
        hero.animate(dt, P.dashT > 0 ? 1 : sp, (H, A) => {
          const B = A.body;
          if (P.dead) { B.rot[0] = -Math.min(1.4, P.deadT * 3); B.pos[1] = .3; H.armR.rot = [0, 0, 1]; return; }
          if (state === 'intro') { H.armR.rot = [-.4, 0, 2.5 + Math.sin(A.t * 2) * .1]; H.armL.rot[2] = -.5; B.rot[1] = Math.sin(A.t * .8) * .1; gripT = 0; return; }
          if (state === 'won') { H.armR.rot = [-.2, 0, 2.9 + Math.sin(A.t * 10) * .1]; H.armL.rot[2] = -2.6 - Math.sin(A.t * 10) * .2; B.pos[1] = Math.abs(Math.sin(A.t * 6)) * .6; B.rot[1] = A.t * 2; return; }
          if (P.ultSeq) {
            if (P.atkT > 0) { const C = CLIPS[P.atkI], p = samplePose(C, C.dur - P.atkT); H.armR.rot = p.armR; H.armL.rot = p.armL; H.torso.rot = p.torso; B.rot = p.body.slice(); H.legL.rot = p.legL; H.legR.rot = p.legR; }
            else { H.armR.rot = [-3.0, 0, .2]; H.armL.rot = [-2.6, 0, -.2]; H.torso.rot = [-.25, 0, 0]; B.rot = [-.06, 0, 0]; H.legL.rot = [-.3, 0, 0]; H.legR.rot = [.3, 0, 0]; }
            return;
          }
          if (P.plunge) { H.armR.rot = [-1.1, 0, .1]; H.armL.rot = [-2.6, 0, -.1]; B.rot[0] = .9; H.legL.rot = [-.4, 0, 0]; H.legR.rot = [-.2, 0, 0]; return; }
          if (P.dashT > 0) { B.rot[0] = .55; H.armL.rot = [1.2, 0, -.3]; H.armR.rot = [1.3, 0, .3]; H.legL.rot = [.8, 0, 0]; H.legR.rot = [-.6, 0, 0]; gripT = -2.2; return; }
          if (P.castT > 0) {
            const k = 1 - P.castT / P.castDur;
            if (P.castKind === 'tajo') { const C = CLIPS[0], p = samplePose(C, clamp(k * 1.1, 0, 1) * C.dur); H.armR.rot = p.armR; H.armL.rot = p.armL; H.torso.rot = p.torso; B.rot = p.body.slice(); H.legL.rot = p.legL; H.legR.rot = p.legR; }
            else { H.armR.rot = [-1.55, 0, 1.5]; H.armL.rot = [-.3, 0, -1.4]; B.rot[1] = -TAU * 2 * ease.inOut(clamp(k * 1.1, 0, 1)); H.legL.rot = [-.7, 0, 0]; H.legR.rot = [-.3, 0, 0]; }
            return;
          }
          if (P.atkT > 0) {
            const C = CLIPS[P.atkI], p = samplePose(C, P.atkDur - P.atkT);
            H.armR.rot = p.armR; H.armL.rot = p.armL; H.torso.rot = p.torso; B.rot = p.body.slice(); H.legL.rot = p.legL; H.legR.rot = p.legR;
            if (C.spin) B.rot[1] = -TAU * ease.inOut(clamp((P.atkDur - P.atkT - C.spin[0]) / (C.spin[1] - C.spin[0]), 0, 1));
            H.head.rot[1] = -H.torso.rot[1] * .5; return;
          }
          if (P.hurtT > 0) { B.rot[0] = -.3; H.head.rot[0] = -.3; }
          if (sp > .55) { H.armR.rot = [1.15, 0, .35]; H.armL.rot = [1.05, 0, -.35]; B.rot[0] = .32; H.head.rot[0] = -.28; H.torso.rot[1] = 0; gripT = -2.2; }
          else if (sp > .05) { H.armR.rot = [-.7 + Math.sin(A.walk) * .25, .3, .15]; }
          else { H.armR.rot = READY.armR.slice(); H.armL.rot = READY.armL.slice(); H.torso.rot = READY.torso.slice(); H.legL.rot = [Math.sin(A.t * 2) * .02 - .15, 0, 0]; H.legR.rot = [.12, 0, 0]; }
        });
        sword.g.rot[0] = lerp(sword.g.rot[0], gripT, Math.min(1, dt * 16));
        hero.root.at(P.x, P.y, P.z); hero.root.rot[1] = P.face;
        { const fast = (P.lunge > 0 && P.lx * P.lx + P.lz * P.lz > 600) || P.dashT > 0; const sm = fast ? 1.45 : 1; hero.root.scl = [fast ? .86 : 1, 1, lerp(hero.root.scl[2] || 1, sm, Math.min(1, dt * 30))]; }
        hero.root.visible = !(P.inv > 0 && P.hurtT > 0 && !P.dead && state === 'play' && Math.sin(time * 40) > .6);
        sword.glow.alpha = P.atkT > 0 || P.castT > 0 || P.ultSeq ? .5 : .22 + Math.sin(time * 4) * .05;
        sword.glow.color = rgb(Math.sin(time * 3) > 0 ? 0x4fd8ff : 0xb07aff);
        hero.root.update(null);
        const w = sword.blade.world, hx = w[4] * .5, hy = w[5] * .5, hz = w[6] * .5, c0 = [w[12], w[13], w[14]];
        const tip = [c0[0] + hx, c0[1] + hy, c0[2] + hz], base = [c0[0] - hx * .3, c0[1] - hy * .3, c0[2] - hz * .3];
        let on = false;
        if (P.atkT > 0) { const C = CLIPS[P.atkI], tt = P.atkDur - P.atkT; on = tt > C.act[0] && tt < C.act[1]; }
        if (P.castT > 0 && P.castKind === 'tajo') on = true;
        trail.update(base, tip, on, dt); trail2.update([lerp(base[0], tip[0], .5), lerp(base[1], tip[1], .5), lerp(base[2], tip[2], .5)], tip, on, dt);
      }

      function poseEnemy(e, dt) {
        const A = e.av, st = e.state, boss = e.type === 'boss';
        A.rateOverride = st === 'strike' || e.stage === 'strike' ? 70 : st === 'wind' || e.stage === 'wind' ? 30 : 22;
        const sp = st === 'approach' ? clamp((e.spd || 0) / 9, 0, 1) : 0;
        let gripT = Math.PI / 2;
        A.animate(dt, sp, (H, AA) => {
          const B = AA.body, ws = st === 'wind' || e.stage === 'wind', ss = st === 'strike' || e.stage === 'strike';
          if (st === 'spawn') { B.rot[0] = -.2; return; }
          if (st === 'dead') { B.rot[0] = -.6; H.armR.rot = [-.3, 0, 1.9]; H.armL.rot = [-.3, 0, -1.9]; H.legL.rot = [.3, 0, -.6]; H.legR.rot = [-.2, 0, .6]; return; }
          if (st === 'down') { B.rot[0] = -1.5; B.pos[1] = .5; H.armR.rot = [-.3, 0, 1.2]; H.armL.rot = [-.3, 0, -1.2]; return; }
          if (st === 'launched') { B.rot[0] = -.5; H.armR.rot = [-.3, 0, 1.9]; H.armL.rot = [-.3, 0, -1.9]; H.legL.rot = [.3, 0, -.55]; H.legR.rot = [-.2, 0, .55]; H.head.rot[0] = -.4; return; }
          if (st === 'stagger') { H.head.rot[0] = -.5; B.rot[0] = -.35; H.armR.rot = [-.3, 0, .8]; H.armL.rot = [-.3, 0, -.8]; return; }
          if (st === 'guard') { H.armR.rot = [-1.5, .5, .2]; H.armL.rot = [-1.45, -.5, -.2]; B.rot[0] = .1; return; }
          if (st === 'bDaze') { B.rot[0] = .5; B.pos[1] = -.8; H.legL.rot = [-1.4, 0, 0]; H.legR.rot = [-1.2, 0, 0]; H.armR.rot = [.4, 0, .3]; H.armL.rot = [.4, 0, -.3]; H.head.rot[0] = .5; return; }
          if (e.stage === 'air') { H.armR.rot = [-3, 0, .3]; H.armL.rot = [-2.8, 0, -.3]; H.legL.rot = [-.6, 0, 0]; return; }
          if (st === 'bWave' && e.stage === 'fire') { H.armR.rot = [-1.3, -.8, .1]; H.torso.rot = [.2, -.8, 0]; return; }
          if (st === 'bRain' && e.stage === 'rain') { H.armR.rot = [-3.1, 0, .1]; H.armL.rot = [-2.9, 0, -.1]; H.torso.rot = [-.3, 0, 0]; return; }
          if (ws) { H.armR.rot = [-2.8, 0, .3]; H.armL.rot = [-.6, 0, -.5]; H.torso.rot = [-.3, .3, 0]; B.rot[0] = -.08; return; }
          if (ss) { const k = clamp(e.st / .34, 0, 1), s = ease.out(clamp(k * 3.5, 0, 1)); H.armR.rot = [lerp(-2.8, -.3, s), lerp(.3, -.9, s), .2]; H.torso.rot = [.4 * s, -.7 * s, 0]; B.rot[0] = .2 * s; H.legL.rot = [-.6 * s, 0, 0]; H.legR.rot = [.4 * s, 0, 0]; return; }
          if (st === 'bRecover' || e.recoverT > 0) { H.armR.rot = [-1, 0, .2]; H.armL.rot = [-.4, 0, -.2]; }
          if (sp > .5) { H.armR.rot = [1.1, 0, .3]; H.armL.rot = [1, 0, -.3]; B.rot[0] = .28; gripT = -2.2; }
          else { H.armR.rot = READY.armR.slice(); H.armL.rot = READY.armL.slice(); H.torso.rot = READY.torso.slice(); }
        });
        e.recoverT = Math.max(0, (e.recoverT || 0) - dt);
        e.sw.g.rot[0] = lerp(e.sw.g.rot[0], gripT, Math.min(1, dt * 14));
        e.root.at(e.x, e.y, e.z); e.root.rot[1] = e.face + (st === 'dead' ? e.spin * .3 : 0);
        if ((st === 'launched' || st === 'dead') && e.y > .3) { e.tumble = (e.tumble || 0) - dt * (st === 'dead' ? 7 : 4.5); } else e.tumble = lerp(e.tumble || 0, 0, Math.min(1, dt * 10));
        e.root.rot[0] = e.tumble;
        const tele = e.tele > 0 ? e.tele : 0, fl = e.flash > 0;
        e.meshes.forEach((m, i) => { m.emis = fl ? 1 : tele > 0 && i % 3 === 0 ? .55 : e.baseEmis[i]; });
        e.sw.glow.alpha = .22 + (tele > 0 ? .4 : 0); if (e.shadowN) e.shadowN.visible = e.y < 1;
        if (e.pop > 0) { const pp = e.pop / .15; e.root.scl = boss ? [1.75 + pp * .08, 1.75 - pp * .06, 1.75 + pp * .08] : [1 + pp * .1, 1 - pp * .08, 1 + pp * .1]; }
        else if (st !== 'spawn') e.root.scl = boss ? [1.75, 1.75, 1.75] : [1, 1, 1];
        if (st === 'spawn') { const s = (boss ? 1.75 : 1) * (.6 + .4 * e.spawnK); e.root.scl = [s, s, s]; }
      }

      /* ---------- cámara en tercera persona con fijación de objetivo ---------- */
      function updateCamera(dt) {
        const asp = R.W / R.H;
        const tr = Math.min(1.6, shake), tt = performance.now() / 1000, amp = tr * tr * .5;
        const shx = amp * (Math.sin(tt * 41) + Math.sin(tt * 27.3 + 1.7) * .6), shy = amp * (Math.sin(tt * 37.1 + 3.1) + Math.sin(tt * 19.7) * .6); shake = Math.max(0, shake - dt * 2.2);
        camRoll = lerp(camRoll, camRollK + (P.dashT > 0 ? (P.dashDir[0] * Math.cos(camYaw) - P.dashDir[1] * Math.sin(camYaw)) * .08 : 0), Math.min(1, dt * 9)); camRollK *= Math.pow(.02, dt);
        if (state === 'intro') {
          const dist = Math.max(15, 6 / Math.tan(Math.atan(Math.tan(cam.fov * Math.PI / 360) * asp))), yaw = Math.sin(performance.now() / 3000) * .5;
          cam.target = [P.x, 3.2, P.z]; cam.pos = [P.x + Math.sin(yaw) * Math.cos(.24) * dist, 3.2 + Math.sin(.24) * dist, P.z + Math.cos(yaw) * Math.cos(.24) * dist];
          camS.x = P.x; camS.z = P.z; camYaw = Math.PI; camDist = 9;
        } else {
          manualT = Math.max(0, manualT - dt);
          const t = P.target && !P.target.dead ? P.target : null;
          if (t && manualT <= 0) camYaw += angDiff(Math.atan2(t.x - P.x, t.z - P.z), camYaw) * Math.min(1, dt * 4.5);
          const sd = (cur, tgt, vk, stt) => { const om = 2 / stt, x = om * dt, ex = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - tgt, tp = ((camS[vk] || 0) + om * ch) * dt; camS[vk] = ((camS[vk] || 0) - om * tp) * ex; return tgt + (ch + tp) * ex; };
          camS.x = sd(camS.x, P.x, 'vx', .11); camS.z = sd(camS.z, P.z, 'vz', .11);
          camY = lerp(camY, 3.7 + P.y * .75, Math.min(1, dt * 7));
          const dT = t ? Math.hypot(t.x - P.x, t.z - P.z) : 0;
          const wantD = (asp > 1 ? 7.2 : 12.5) + Math.min(dT, 20) * .2 + (bossE && !bossE.dead ? 2.6 : 0) + (state === 'won' ? 3 : 0);
          { let d = wantD; const cpp = Math.cos(camPitch), fx1 = Math.sin(camYaw), fz1 = Math.cos(camYaw);
            for (let it = 0; it < 10; it++) { const cx = camS.x - fx1 * cpp * d, cz = camS.z - fz1 * cpp * d; let hit = false; for (const [px, pz] of PILLARS) if ((cx - px) * (cx - px) + (cz - pz) * (cz - pz) < 8) { hit = true; break; } if (!hit || d < 4) break; d *= .85; }
            camDist = lerp(camDist, d, Math.min(1, dt * (d < camDist ? 10 : 3))); }
          const pitch = clamp(camPitch + (manualT > 0 ? 0 : Math.min(dT, 14) * .005), .04, .9), cp = Math.cos(pitch), fx0 = Math.sin(camYaw), fz0 = Math.cos(camYaw);
          const rx = -Math.cos(camYaw), rz = Math.sin(camYaw), off = (asp > 1 ? 1.6 : 1) + (t ? Math.max(0, 7 - dT) * (asp > 1 ? .5 : .3) : 0);
          let tx = camS.x, tz = camS.z, ty = camY;
          if (t) { tx = lerp(tx, t.x, .4); tz = lerp(tz, t.z, .4); ty = lerp(ty, 2.8 + t.y * .6, .3); }
          cam.target = [tx + rx * off + shx * .3, ty + shy * .3, tz + rz * off];
          cam.pos = [camS.x - fx0 * cp * camDist + rx * off + shx, Math.max(1.2, camY + Math.sin(pitch) * camDist + shy), camS.z - fz0 * cp * camDist + rz * off];
          cam.shadowCenter = [(P.x + (t ? t.x : P.x)) / 2, 0, (P.z + (t ? t.z : P.z)) / 2];
        }
        cine.k = cine.on ? 1 : lerp(cine.k, 0, Math.min(1, dt * 6));
        let roll = camRoll;
        if (cine.k > .001) { const k = cine.k; cam.pos = cam.pos.map((v, i) => lerp(v, cine.pos[i], k)); cam.target = cam.target.map((v, i) => lerp(v, cine.tgt[i], k)); roll = lerp(roll, cine.roll, k); }
        const f = [cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]], fl = Math.hypot(f[0], f[1], f[2]) || 1;
        const rgt = [-f[2] / fl, 0, f[0] / fl], rl = Math.hypot(rgt[0], rgt[2]) || 1;
        cam.up = [rgt[0] / rl * Math.sin(roll), Math.cos(roll), rgt[2] / rl * Math.sin(roll)];
        cam.shiftY = state === 'intro' ? -.3 : -.1;
        punch = Math.max(0, punch - dt * 3);
        cam.fov = (asp > 1 ? 60 : 68) - ease.out(Math.min(1, punch)) * 7 + speedK * 8;
        R.grade.tiltC = state === 'intro' ? .62 : .45; R.grade.tilt = baseTilt > 0 ? (state === 'intro' ? .55 : baseTilt) : 0;
      }

      /* ---------- dibujar ---------- */
      function render(dt) {
        R.resize();
        updateCamera(dt);
        impactT = Math.max(0, impactT - dt);
        R.grade.impact = impactT > 0 ? (impactT > .035 ? 1 : .6) : 0;
        speedK = lerp(speedK, (P.dashT > 0 ? .8 : 0) + (P.ultSeq && P.ultSeq.t < .7 ? .6 : 0) + (P.plunge ? 1 : 0) + (P.lunge > 0 && P.lx * P.lx + P.lz * P.lz > 900 ? .7 : 0), Math.min(1, dt * 12));
        R.grade.speed = Math.min(1, speedK) * .8;
        R.render(scene, cam);
        { const p = R.project([P.x, 3 + P.y, P.z]); R.grade.speedC = [clamp(p.x / R.W, .2, .8), clamp(1 - p.y / R.H, .2, .8)]; }
        // fijación de objetivo
        const t = P.target;
        if (t && !t.dead && state === 'play' && !P.ultSeq) { const p = R.project([t.x, (t.type === 'boss' ? 4.5 : 3) + t.y, t.z]); ui.reticle.style.transform = `translate(${p.x}px,${p.y}px)`; ui.reticle.classList.toggle('on', p.vis); } else ui.reticle.classList.remove('on');
        for (let i = nums.length - 1; i >= 0; i--) {
          const n = nums[i]; n.t += dt; const p = R.project([n.x, n.y + n.t * 2.2, n.z]);
          n.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${1 + Math.max(0, .25 - n.t) * 2})`; n.el.style.opacity = Math.min(1, (1 - n.t / .9) * 2);
          if (n.t > .9) { n.el.remove(); nums.splice(i, 1); }
        }
        const hpI = Math.ceil(P.hp); if (ui._hp !== hpI) { ui._hp = hpI; ui.hp.style.width = (P.hp / TUNE.hp * 100) + '%'; ui.hpTxt.textContent = hpI; ui.hp.parentElement.classList.toggle('low', P.hp < 35); }
        const setCd = (el, cd, max) => { const deg = Math.round(cd / max * 90) * 4, txt = cd > 0 ? '' + Math.ceil(cd) : ''; if (el._deg !== deg) { el._deg = deg; el.style.setProperty('--cd', deg + 'deg'); el.classList.toggle('ready', cd <= 0); } if (el._txt !== txt) { el._txt = txt; el.dataset.s = txt; } };
        setCd(ui.sk.beam, P.cd.tajo, TUNE.tajo.cd); setCd(ui.sk.wave, P.cd.giro, TUNE.giro.cd); setCd(ui.sk.dash, P.cd.dash, TUNE.dash.cd);
        if (score !== scoreShown) { scoreShown = score; scoreEl.textContent = score.toLocaleString('es-ES'); }
        const ultI = Math.round(P.ult); if (ui._ult !== ultI) { ui._ult = ultI; ui.ultFill.style.width = ultI + '%'; ui.sk.ult.classList.toggle('ready', P.ult >= 100); ui.sk.ult.style.setProperty('--u', (ultI * 3.6) + 'deg'); }
        if (combo >= 3 && combo !== comboShown) { comboShown = combo; ui.combo.innerHTML = '<b>' + combo + '</b> golpes'; ui.combo.classList.remove('pop'); void ui.combo.offsetWidth; ui.combo.classList.add('pop', 'on'); }
        if (combo < 3) { ui.combo.classList.remove('on'); comboShown = 0; }
        if (bossE && !bossE.dead) ui.bossFill.style.width = Math.max(0, bossE.hp / bossE.max * 100) + '%';
        for (const e of enemies) {
          if (e.type === 'boss' || e.dead) continue;
          e.hpShow = Math.max(0, (e.hpShow || 0) - dt);
          if (!e.bar && e.hpShow > 0) { e.bar = document.createElement('i'); e.bar.className = 'g-ehp'; e.bar.innerHTML = '<i></i>'; ui.dmg.appendChild(e.bar); }
          if (e.bar) { const p = R.project([e.x, 6.6 + e.y, e.z]); e.bar.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; e.bar.style.opacity = Math.min(1, e.hpShow * 2); e.bar.firstChild.style.width = Math.max(0, e.hp / e.max * 100) + '%'; }
        }
      }

      let running = true, raf = 0, last = 0, acc = 0;
      function frame(ts) {
        if (!running) return;
        const dt = Math.min(G.__pruebaRapida ? .3 : .05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.classList.remove('on'); }
        slowT = Math.max(0, slowT - dt);
        slowmo = lerp(slowmo, slowT > 0 ? .22 : 1, Math.min(1, dt * 14));
        let sdt = dt * slowmo * (G.__lento || 1);
        if (hitstop > 0) { hitstop -= dt; sdt *= .06; }
        if (state === 'paused') sdt = 0;
        acc += sdt; const h = 1 / 120, cap = G.__pruebaRapida ? 40 : 12; let n = 0;
        while (acc >= h && n < cap) { step(h); acc -= h; n++; }
        if (n === cap) acc = 0;
        fx.update(sdt);
        poseHero(sdt); enemies.forEach(e => poseEnemy(e, sdt));
        const _c0 = performance.now(); render(dt); G.__cpu = performance.now() - _c0;
        raf = requestAnimationFrame(frame);
      }

      /* ---------- pausa y calidad gráfica ---------- */
      let pausedFrom = null;
      function togglePause(force) {
        const want = force != null ? force : pausedFrom == null;
        if (want && pausedFrom == null && (state === 'play' || state === 'break' || state === 'count') && !P.ultSeq) {
          pausedFrom = state; state = 'paused'; $('#gPause').classList.remove('hidden'); if (AUDIO && !G.__musicaApagada) AUDIO.mute(true); syncMenu();
        } else if (!want && pausedFrom != null) {
          state = pausedFrom; pausedFrom = null; $('#gPause').classList.add('hidden'); if (AUDIO && !G.__musicaApagada) AUDIO.mute(false); last = 0;
        }
      }
      // Auto = resolución dinámica · Alta = máxima fija · Media = menos resolución, sin desenfoque de maqueta, sombras cada 2 fotogramas, sin hierba lejana · Baja = sin sombras ni postprocesado
      function applyQuality(q) {
        const hi = q === 'alta', md = q === 'media', lo = q === 'baja';
        R.autoDRS = q === 'auto'; R.dprCap = lo ? 1 : md ? 1.25 : 1.6; R.dprNow = R.dprCap; R.dprMin = lo ? .85 : 1;
        R.shadows = !lo && !!R.sm; R.shadowEvery = md ? 2 : 1; R.post = !lo; R.quality = 2; R._shOnce = false;
        baseTilt = md || lo ? 0 : .35; grassFar.visible = hi || q === 'auto'; fx.max = lo ? 90 : md ? 150 : 200;
        try { localStorage.setItem('anita_calidad', q); } catch (e) {}
        curQ = q; syncMenu();
      }
      let curQ = 'auto', baseTilt = .35;
      function syncMenu() {
        $('#gQuality').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.q === curQ));
        $('#gMusicSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.m === '1') === !G.__musicaApagada));
      }
      $('#gQuality').querySelectorAll('button').forEach(b => { b.onclick = () => applyQuality(b.dataset.q); });
      $('#gMusicSeg').querySelectorAll('button').forEach(b => { b.onclick = () => { const wantOn = b.dataset.m === '1'; if (wantOn === !!G.__musicaApagada) G.Juego.toggleMusic(); if (AUDIO) AUDIO.mute(true); syncMenu(); const mb = document.getElementById('musicBtn'); if (mb) mb.classList.toggle('is-off', !!G.__musicaApagada); }; });
      $('#gPauseBtn').onclick = () => togglePause();
      $('#gResume').onclick = () => togglePause(false);
      $('#gRestart').onclick = () => { togglePause(false); if (state === 'play' || state === 'break') { resetWave(); state = 'count'; countT = 0; lastCount = ''; queue = []; } };
      try { applyQuality(localStorage.getItem('anita_calidad') || 'auto'); } catch (e) { applyQuality('auto'); }

      /* ---------- arranque ---------- */
      $('#gIntro').classList.remove('hidden'); $('#gWin').classList.add('hidden'); $('#gLose').classList.add('hidden');
      ui.boss.classList.add('hidden'); ui.wave.textContent = ''; ui.left.textContent = '';
      root.classList.add('g-intro');
      $('#gStart').onclick = () => {
        S.unlock(); const A = au(); if (A) { A.start(1); A.mute(!!G.__musicaApagada); }
        if (HARD) banner('MODO PESADILLA', 'enemigos más fuertes · puntos ×1,5');
        try { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (f && matchMedia('(pointer:coarse)').matches) { const pr = f.call(el); if (pr && pr.then) pr.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } } catch (e) {}
        $('#gIntro').classList.add('hidden'); root.classList.remove('g-intro'); state = 'count'; countT = 0; lastCount = ''; P.face = Math.PI; camYaw = Math.PI;
      };
      $('#gRetry').onclick = () => { $('#gLose').classList.add('hidden'); resetWave(); state = 'count'; countT = 0; lastCount = ''; queue = []; ui.wave.textContent = ''; };
      $('#gWinBtn').onclick = () => {
        running = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku);
        nums.forEach(n => n.el.remove()); ui.dmg.querySelectorAll('.g-ehp,.g-num').forEach(n => n.remove());
        if (AUDIO) AUDIO.stop(1.2);
        // libera la memoria de la tarjeta gráfica de esta partida (por si se vuelve a jugar)
        const seen = new Set(); const fr = n => { if (n.geo && !seen.has(n.geo)) { seen.add(n.geo); R.free(n.geo); } n.children.forEach(fr); }; fr(scene);
        result.won = true; result.deaths = deaths; result.time = time;
        try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        resolve(result);
      };
      $('#gRotateSkip').onclick = () => root.classList.add('rot-ok');
      // utilidades para probar (no afectan al juego)
      G.__juego = { P, enemies, scene, cam, R, hero, get stats() { return Object.assign({ nodes: (function c(n) { let k = 1; n.children.forEach(x => { k += c(x); }); return k; })(scene), cpu: G.__cpu }, R.stats); }, setSlow: v => { slowmo = v; }, get camYaw() { return camYaw; }, get state() { return state; }, set state(v) { state = v; }, start: () => $('#gStart').click(), act, setWave: i => { waveI = i; }, killAll: () => enemies.forEach(e => { if (!e.dead) killEnemy(e, 0, 1); }), hurtEnemy, get queue() { return queue; }, get target() { return P.target; }, get frozen() { return frozen; } };
      raf = requestAnimationFrame(frame);
    });
  }

  G.Juego = { play, toggleMusic() { G.__musicaApagada = !G.__musicaApagada; if (AUDIO) AUDIO.mute(G.__musicaApagada); return !G.__musicaApagada; } };
})(window);
