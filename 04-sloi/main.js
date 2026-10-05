/* ==========================================================================
   Слои — механики сайта (всё, кроме 3D-блюд: они в dishes.js).
   GSAP + ScrollTrigger, Lenis, Matter.js. Без библиотек страница остаётся рабочей.
   Идеи механик: Skiper UI (стопка карточек, параллакс-колонки, текст в перспективе,
   gooey-фильтр), MotionSites «Hover Ink» (капли за курсором), Animmaster
   (физика, шейдерный фон, след из фото).
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add(!FINE ? 'touch' : RM ? 'fine' : 'has-cursor');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var hasG = !!(window.gsap && window.ScrollTrigger);
  if (hasG) gsap.registerPlugin(ScrollTrigger);
  var tick = function (fn) { if (hasG) gsap.ticker.add(fn); else (function loop() { fn(); requestAnimationFrame(loop); })(); };

  /* ---------- плавный скролл ---------- */
  var lenis = null;
  if (hasG && window.Lenis && !RM) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  window.SLOI = { lenis: lenis, RM: RM, FINE: FINE };

  $$('a[data-scroll]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.8 });
      else if (target === 0) scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  var pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener('pointermove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

  /* ---------- курсор: капли соуса (gooey) ---------- */
  if (FINE && !RM) {
    var goo = $('.cursor__goo'), drops = $$('.cursor__goo i'), label = $('.cursor__label'), cursor = $('.cursor');
    var SIZES = [30, 24, 19, 14, 10], BOX = 420;
    var pts = drops.map(function () { return { x: pointer.x, y: pointer.y }; });
    var big = 0, bigNow = 0;
    goo.style.inset = 'auto';
    goo.style.width = goo.style.height = BOX + 'px';
    drops.forEach(function (d, i) { d.style.width = d.style.height = SIZES[i] + 'px'; });
    /* до первого движения мыши капель не видно — иначе они висят в центре экрана */
    cursor.style.visibility = 'hidden';
    addEventListener('pointermove', function show(e) {
      if (e.pointerType !== 'mouse') return;
      pts.forEach(function (p) { p.x = e.clientX; p.y = e.clientY; });
      cursor.style.visibility = '';
      removeEventListener('pointermove', show);
    });
    tick(function () {
      for (var i = 0; i < pts.length; i++) {
        var t = i === 0 ? pointer : pts[i - 1];
        var k = i === 0 ? 0.32 : 0.4;
        pts[i].x += (t.x - pts[i].x) * k;
        pts[i].y += (t.y - pts[i].y) * k;
      }
      bigNow += (big - bigNow) * 0.16;
      /* фильтр применяется к небольшому квадрату вокруг курсора, а не ко всему экрану */
      var ox = pts[0].x - BOX / 2, oy = pts[0].y - BOX / 2;
      goo.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';
      for (var j = 0; j < pts.length; j++) {
        var s = SIZES[j];
        var sc = j === 0 ? 1 + bigNow * 2.4 : 1 - bigNow * 0.6;
        drops[j].style.transform = 'translate(' + (pts[j].x - ox - s / 2) + 'px,' + (pts[j].y - oy - s / 2) + 'px) scale(' + sc + ')';
      }
      label.style.transform = 'translate(' + pts[0].x + 'px,' + pts[0].y + 'px) translate(-50%,-50%)';
    });
    document.addEventListener('pointerover', function (e) {
      var el = e.target.closest('[data-cursor], a, button, .menu3d__canvas, .pill');
      if (!el) { big = 0; cursor.classList.remove('is-label'); return; }
      var text = el.dataset.cursor || (el.classList.contains('menu3d__canvas') ? 'Крутить' : el.classList.contains('pill') ? 'Бросить' : '');
      big = text ? 1 : 0.45;
      label.textContent = text;
      cursor.classList.toggle('is-label', !!text);
    });
    document.addEventListener('pointerleave', function () { pts.forEach(function (p) { p.x = -200; p.y = -200; }); pointer.x = pointer.y = -200; });
  }

  /* ---------- разбивка заголовков на слова ---------- */
  function splitWords(el) {
    var nodes = [].slice.call(el.childNodes);
    el.textContent = '';
    nodes.forEach(function (n) {
      var target = el, text = n.textContent;
      if (n.nodeType === 1) { target = n.cloneNode(false); el.appendChild(target); }
      else if (n.nodeType !== 3) return;
      text.split(/([ \t\n\r]+)/).forEach(function (part) {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
        var o = document.createElement('span'); o.className = 'wm';
        var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
        o.appendChild(i); target.appendChild(o);
      });
    });
  }

  /* ---------- 01 · стирание фона ---------- */
  var hero = $('.hero'), veil = $('.hero__veil'), heroImg = $('.hero__img');
  var vctx = veil.getContext('2d'), off = document.createElement('canvas'), octx = off.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5), vw = 0, vh = 0, veilReady = false, heroOn = true, lastPt = null, lastT = 0;
  /* мазок = список точек; каждая гаснет по своему возрасту, поэтому нет полос от накопления прозрачности */
  var marks = [], LIFE = 1900, MAXM = 420, dirty = true, brush = document.createElement('canvas'), br = 0;

  function drawCover(ctx, img, w, h, scale) {
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * scale;
    var iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  }
  function buildVeil() {
    vw = veil.width = off.width = Math.round(hero.clientWidth * dpr);
    vh = veil.height = off.height = Math.round(hero.clientHeight * dpr);
    octx.globalCompositeOperation = 'source-over';
    octx.fillStyle = '#120e0b'; octx.fillRect(0, 0, vw, vh);
    if (heroImg.complete && heroImg.naturalWidth) {
      drawCover(octx, heroImg, vw, vh, 1.06);
      octx.globalCompositeOperation = 'saturation';            /* обесцвечиваем */
      octx.fillStyle = '#7f7f7f'; octx.fillRect(0, 0, vw, vh);
      octx.globalCompositeOperation = 'source-over';
    }
    octx.fillStyle = 'rgba(18,14,11,.8)'; octx.fillRect(0, 0, vw, vh);
    var g = octx.createRadialGradient(vw * .5, vh * .42, vh * .15, vw * .5, vh * .5, Math.max(vw, vh) * .75);
    g.addColorStop(0, 'rgba(18,14,11,0)'); g.addColorStop(1, 'rgba(8,6,5,.75)');
    octx.fillStyle = g; octx.fillRect(0, 0, vw, vh);
    br = Math.round((FINE ? 120 : 90) * dpr);
    brush.width = brush.height = br * 2;
    var bctx = brush.getContext('2d'), bg = bctx.createRadialGradient(br, br, 0, br, br, br);
    bg.addColorStop(0, 'rgba(0,0,0,.85)'); bg.addColorStop(.5, 'rgba(0,0,0,.42)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = bg; bctx.fillRect(0, 0, br * 2, br * 2);
    marks = []; dirty = true; veilReady = true;
  }
  function erase(x, y) {
    if (!veilReady) return;
    x *= dpr; y *= dpr;
    var now = performance.now();
    if (lastPt) {
      var dx = x - lastPt.x, dy = y - lastPt.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (br * .3)));
      for (var i = 1; i <= n; i++) marks.push({ x: lastPt.x + dx * i / n, y: lastPt.y + dy * i / n, t: now });
    } else marks.push({ x: x, y: y, t: now });
    if (marks.length > MAXM) marks.splice(0, marks.length - MAXM);
    lastPt = { x: x, y: y }; lastT = now;
  }
  /* тёмный слой «затягивается» обратно — получается след; кадр рисуется, только пока след не исчез */
  tick(function () {
    if (!veilReady || !heroOn) return;
    var now = performance.now();
    if (now - lastT > 80) lastPt = null;
    while (marks.length && now - marks[0].t > LIFE) marks.shift();
    if (!marks.length && !dirty) return;
    vctx.globalCompositeOperation = 'copy'; vctx.globalAlpha = 1;
    vctx.drawImage(off, 0, 0);
    vctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < marks.length; i++) {
      var a = 1 - (now - marks[i].t) / LIFE;
      vctx.globalAlpha = a * a * (3 - 2 * a);
      vctx.drawImage(brush, marks[i].x - br, marks[i].y - br);
    }
    vctx.globalCompositeOperation = 'source-over'; vctx.globalAlpha = 1;
    dirty = marks.length > 0;
  });
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(); erase(e.clientX - r.left, e.clientY - r.top);
  });
  hero.addEventListener('touchmove', function (e) {
    var r = hero.getBoundingClientRect(), t = e.touches[0]; erase(t.clientX - r.left, t.clientY - r.top);
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { lastPt = null; });
  if (heroImg.complete) buildVeil(); else { heroImg.addEventListener('load', buildVeil); heroImg.addEventListener('error', buildVeil); }
  var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(buildVeil, 200); });

  /* подсказка: кисть сама проходит волной после заставки */
  function autoStroke() {
    if (!hasG || RM) return;
    var o = { t: 0 }, w = hero.clientWidth, h = hero.clientHeight;
    lastPt = null;
    gsap.to(o, {
      t: 1, duration: 1.8, ease: 'power1.inOut',
      onUpdate: function () { erase(w * (.12 + .76 * o.t), h * (.46 + .16 * Math.sin(o.t * Math.PI * 2.4))); },
      onComplete: function () { lastPt = null; },
    });
  }

  /* ---------- форма брони (работает и без GSAP) ---------- */
  var form = $('.form');
  var DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var DSHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var dayBox = $('.chips[data-name="day"]'), timeBox = $('.chips[data-name="time"]');
  function chip(box, text, value, on) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = text; b.dataset.value = value;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', function () {
      $$('.chip', box).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
    });
    box.appendChild(b);
  }
  for (var d = 0; d < 7; d++) {
    var dt = new Date(); dt.setDate(dt.getDate() + d);
    var full = DAYS[dt.getDay()] + ', ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()];
    chip(dayBox, d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : DSHORT[dt.getDay()] + ' ' + dt.getDate(), full, d === 0);
  }
  ['18:00', '19:00', '20:00', '21:00', '22:00'].forEach(function (t, i) { chip(timeBox, t, t, i === 1); });
  var guests = 2, out = $('.stepper output');
  $$('.stepper button').forEach(function (b) {
    b.addEventListener('click', function () { guests = Math.max(1, Math.min(8, guests + Number(b.dataset.step))); out.textContent = guests; });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    $$('.field', form).forEach(function (f) {
      var inp = $('input', f);
      var bad = inp.name === 'phone' ? inp.value.replace(/\D/g, '').length < 10 : !inp.value.trim();
      f.classList.toggle('is-error', bad);
      if (bad && ok) { inp.focus(); ok = false; }
    });
    if (!ok) return;
    var day = $('.chip[aria-pressed="true"]', dayBox).dataset.value, time = $('.chip[aria-pressed="true"]', timeBox).dataset.value;
    var g = guests === 1 ? 'гость' : guests < 5 ? 'гостя' : 'гостей';
    $('.form__done span').textContent = day.charAt(0).toUpperCase() + day.slice(1) + ' · ' + time + ' · ' + guests + ' ' + g;
    form.classList.add('is-sent');
  });

  /* ---------- статус «открыто» в подвале ---------- */
  var st = $('.open-status'), h = new Date().getHours();
  if (h >= 12) st.textContent = 'Открыто до 00:00';
  else { st.textContent = 'Откроемся в 12:00'; st.classList.add('is-closed'); }

  /* ---------- шейдерный фон брони ---------- */
  var shader = setupShader();

  if (!hasG || RM) {
    var ld = $('.loader'); if (ld) ld.remove();
    return;
  }

  /* ---------- заставка: «лестница» ---------- */
  var loaderEl = $('.loader');
  if (lenis) lenis.stop();
  var cnt = $('.loader__count em'), word = $('.loader__word'), o = { v: 0 };
  gsap.set('.loader__word b', { yPercent: 120 });
  gsap.set('.hero__title span', { yPercent: 110 });
  gsap.set(['.hero .eyebrow', '.hero__lead', '.hero__hint', '.hero__meta', '.header'], { autoAlpha: 0, y: 16 });
  gsap.timeline()
    .to('.loader__word b', { yPercent: 0, duration: 1, ease: 'expo.out', stagger: .07 })
    .to(o, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: function () { cnt.textContent = Math.round(o.v); } }, 0)
    .to(word, { '--lay': '0.075em', duration: .8, ease: 'expo.out' }, .75)
    .to(word, { '--lay': '0em', duration: .45, ease: 'power2.in' }, 1.75)
    .to('.loader__mark', { autoAlpha: 0, duration: .3 }, 2.2)
    .to('.loader__bars i', { yPercent: -100, duration: 1, ease: 'expo.inOut', stagger: .06 }, 2.2)
    .fromTo('.hero__img', { scale: 1.2 }, { scale: 1.06, duration: 2.2, ease: 'expo.out' }, 2.4)
    .to('.hero__title span', { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .06 }, 2.6)
    .to(['.header', '.hero .eyebrow', '.hero__lead', '.hero__hint', '.hero__meta'], { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .06 }, 2.9)
    .add(autoStroke, 3.0)
    .add(function () { loaderEl.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); }, 3.5);

  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onToggle: function (s) { heroOn = s.isActive; } });
  gsap.to('.hero__content', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- шапка ---------- */
  var header = $('.header'), lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (s) {
      var y = s.scroll();
      header.classList.toggle('is-hidden', y > lastY && y > 300);
      header.classList.toggle('is-solid', y > 80);
      lastY = y;
    },
  });

  /* ---------- заголовки: слова поднимаются из маски ---------- */
  $$('.h2').forEach(function (el) {
    splitWords(el);
    gsap.from($$('.wi', el), { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* ---------- 03 · зум сквозь слово ВКУС ---------- */
  var mask = $('.zoom__mask'), zword = $('.zoom__word');
  /* точка зума — внутри толстого штриха буквы: ищем самый длинный белый отрезок в средней строке текста */
  function zoomOrigin() {
    var cs = getComputedStyle(zword), W = zword.offsetWidth, H = zword.offsetHeight;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    try { x.letterSpacing = cs.letterSpacing; } catch (e) { /* старые браузеры */ }
    x.textBaseline = 'middle'; x.fillStyle = '#fff';
    x.fillText(zword.textContent, 0, H / 2);
    var row = x.getImageData(0, Math.floor(H * .5), W, 1).data, best = [0, 0], run = -1;
    for (var i = 0; i <= W; i++) {
      var on = i < W && row[i * 4 + 3] > 200;
      if (on && run < 0) run = i;
      if (!on && run >= 0) { if (i - run > best[1] - best[0]) best = [run, i]; run = -1; }
    }
    var cx = best[1] ? (best[0] + best[1]) / 2 : W / 2;
    return (zword.offsetLeft + cx) + 'px ' + (zword.offsetTop + H / 2) + 'px';
  }
  document.fonts.ready.then(function () {
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.zoom', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    tl.fromTo(mask, { scale: 1, transformOrigin: zoomOrigin }, { scale: 90, ease: 'power3.in', duration: 1 }, 0)
      .fromTo('.zoom__img', { scale: 1.3 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .to(mask, { autoAlpha: 0, duration: .04 }, .94)
      .fromTo('.zoom__after', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .12 }, .86);
  });

  /* ---------- 04 · манифест в перспективе (Skiper UI · 3D perspective text) ---------- */
  gsap.fromTo('.crawl__text', { y: function () { return innerHeight * 0.95; } }, {
    y: function () { return -$('.crawl__text').offsetHeight * 1.05; }, ease: 'none',
    scrollTrigger: { trigger: '.crawl', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });

  /* ---------- 05 · стопка карточек (Skiper UI · card stack with rotate) ---------- */
  var cards = $$('.stack .card');
  cards.forEach(function (c, i) { if (i) gsap.set(c, { y: function () { return innerHeight; } }); });
  var stl = gsap.timeline({
    scrollTrigger: {
      trigger: '.stack__pin', start: 'top top', end: function () { return '+=' + innerHeight * (cards.length - 1); },
      pin: true, scrub: .6, invalidateOnRefresh: true,
    },
  });
  for (var ci = 0; ci < cards.length - 1; ci++) {
    stl.fromTo(cards[ci], { scale: 1, rotation: 0, filter: 'brightness(1)' }, { scale: .74, rotation: ci % 2 ? -5 : 5, filter: 'brightness(0.45)', duration: 1, ease: 'none' }, ci)
       .fromTo(cards[ci + 1], { y: function () { return innerHeight; } }, { y: 0, duration: 1, ease: 'none' }, ci);
  }

  /* ---------- 06 · бегущая строка: скорость и наклон от скорости скролла ---------- */
  var mq = gsap.to('.marquee__track', { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
  mq.totalTime(26 * 400);   /* запас, чтобы можно было крутить назад */
  var skew = gsap.quickTo('.marquee__track', 'skewX', { duration: .5, ease: 'power3' }), relax;
  ScrollTrigger.create({
    onUpdate: function (s) {
      var v = s.getVelocity(), dir = v < 0 ? -1 : 1;
      gsap.to(mq, { timeScale: dir * (1 + Math.min(Math.abs(v) / 260, 6)), duration: .25, overwrite: true });
      skew(gsap.utils.clamp(-14, 14, -v / 140));
      clearTimeout(relax);
      relax = setTimeout(function () { gsap.to(mq, { timeScale: dir, duration: 1.4 }); skew(0); }, 140);
    },
  });

  /* ---------- 07 · параллакс-колонки (Skiper UI · Oliver parallax) ---------- */
  var SPEED = [2, 3.3, 1.25, 3];
  $$('.col').forEach(function (col, i) {
    gsap.fromTo(col, { y: 0 }, {
      y: function () { return innerHeight * SPEED[i]; }, ease: 'none',
      scrollTrigger: { trigger: '.cols', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });

  /* ---------- 08 · след из фото за курсором ---------- */
  var trail = $('.trail'), pool = $('.trail__imgs');
  var TRAIL = ['1565686481561-d8ceaa689e01', '1777891257586-48c73950a1f2', '1544510807-d0289d40b17c', '1625604086816-4bfaf603e842',
    '1622713142003-3c1e675e5748', '1776018396028-d40694777383', '1588168333986-5078d3ae3976', '1681270496598-13c5365730c8'];
  var timgs = TRAIL.map(function (id) {
    var im = new Image(); im.alt = ''; im.decoding = 'async';
    im.src = 'img/u-' + id + '-w500.webp';
    pool.appendChild(im); return im;
  });
  var tIdx = 0, tLast = null, tZ = 1;
  function spawn(x, y) {
    var im = timgs[tIdx++ % timgs.length];
    var w = im.offsetWidth || 220, hh = w * 1.25;
    gsap.killTweensOf(im);
    gsap.set(im, { x: x - w / 2, y: y - hh / 2, rotation: gsap.utils.random(-10, 10), zIndex: tZ++ });
    gsap.fromTo(im, { scale: .35, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'expo.out' });
    gsap.to(im, { scale: .25, opacity: 0, duration: .7, delay: .6, ease: 'power3.in' });
  }
  if (FINE) {
    trail.addEventListener('pointermove', function (e) {
      var r = trail.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!tLast || Math.hypot(x - tLast.x, y - tLast.y) > 90) { spawn(x, y); tLast = { x: x, y: y }; }
    });
  } else {
    var autoT, ph = 0;
    ScrollTrigger.create({
      trigger: trail, start: 'top 70%', end: 'bottom 30%',
      onToggle: function (s) {
        clearInterval(autoT);
        if (s.isActive) autoT = setInterval(function () {
          ph += .42; spawn(trail.clientWidth * (.5 + .34 * Math.sin(ph)), trail.clientHeight * (.5 + .26 * Math.sin(ph * 1.7)));
        }, 240);
      },
    });
  }

  /* ---------- 09 · физика ингредиентов ---------- */
  ScrollTrigger.create({ trigger: '.season', start: 'top 65%', once: true, onEnter: setupPhysics });

  function setupPhysics() {
    if (!window.Matter) return;
    var M = Matter, box = $('.season__box');
    var ITEMS = ['Тыква', 'Мёд с Луги', 'Белые грибы', 'Облепиха', 'Брусника', 'Мраморная говядина', 'Ряженка', 'Кедровый орех',
      'Сыр из Ленобласти', 'Корюшка', 'Ржаной хлеб', 'Хрен', 'Клюква', 'Пастернак', 'Щавель', 'Сморчки'];
    var engine = M.Engine.create(), W = box.clientWidth, H = box.clientHeight;
    engine.gravity.y = 1.1;
    var items = ITEMS.map(function (t, i) {
      var el = document.createElement('span');
      el.className = 'pill'; el.dataset.c = i % 5; el.textContent = t;
      el.style.transform = 'translate(-999px,-999px)';
      box.appendChild(el);
      return { el: el, w: el.offsetWidth, h: el.offsetHeight };
    });
    items.forEach(function (it, i) {
      it.body = M.Bodies.rectangle(gsap.utils.random(it.w / 2 + 10, W - it.w / 2 - 10), -120 - i * 80, it.w, it.h, {
        chamfer: { radius: it.h / 2 }, restitution: .35, friction: .25, frictionAir: .012, density: .0018, angle: gsap.utils.random(-.6, .6),
      });
    });
    var walls = [
      M.Bodies.rectangle(W / 2, H + 40, W * 3, 80, { isStatic: true }),
      M.Bodies.rectangle(-40, H / 2, 80, H * 4, { isStatic: true }),
      M.Bodies.rectangle(W + 40, H / 2, 80, H * 4, { isStatic: true }),
    ];
    M.Composite.add(engine.world, items.map(function (i) { return i.body; }).concat(walls));
    if (FINE) {
      var mouse = M.Mouse.create(box);
      /* Matter перехватывает колесо мыши — отдаём его обратно странице */
      ['wheel', 'mousewheel', 'DOMMouseScroll'].forEach(function (ev) { mouse.element.removeEventListener(ev, mouse.mousewheel); });
      M.Composite.add(engine.world, M.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: .18, render: { visible: false } } }));
    }
    var on = true;
    ScrollTrigger.create({ trigger: '.season', start: 'top bottom', end: 'bottom top', onToggle: function (s) { on = s.isActive; } });
    gsap.ticker.add(function () {
      if (!on) return;
      M.Engine.update(engine, 1000 / 60);
      items.forEach(function (it) {
        var b = it.body;
        it.el.style.transform = 'translate(' + (b.position.x - it.w / 2) + 'px,' + (b.position.y - it.h / 2) + 'px) rotate(' + b.angle + 'rad)';
      });
    });
    addEventListener('resize', function () {
      W = box.clientWidth; H = box.clientHeight;
      M.Body.setPosition(walls[0], { x: W / 2, y: H + 40 });
      M.Body.setPosition(walls[1], { x: -40, y: H / 2 });
      M.Body.setPosition(walls[2], { x: W + 40, y: H / 2 });
    });
  }

  /* ---------- шейдер включается только в зоне видимости ---------- */
  if (shader) ScrollTrigger.create({ trigger: '.book', start: 'top bottom', end: 'bottom top', onToggle: function (s) { shader.run(s.isActive); } });

  /* ---------- магнитные кнопки ---------- */
  if (FINE) $$('[data-magnetic]').forEach(function (el) {
    var mx = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1,.4)' }), my = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1,.4)' });
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * .3); my((e.clientY - r.top - r.height / 2) * .3); });
    el.addEventListener('pointerleave', function () { mx(0); my(0); });
  });

  /* ---------- подвал: слои букв расходятся по скроллу ---------- */
  gsap.fromTo('.footer__word span', { y: 80 }, { y: 0, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });

  addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* ==========================================================================
     Шейдер: тёплый «жидкий» градиент (fbm с искажением координат), реагирует на мышь
     ========================================================================== */
  function setupShader() {
    var c = $('.book__bg'), gl = c.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = [
      'precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}',
      'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.7;',
      'vec2 q=vec2(fbm(p+t*.05),fbm(p+vec2(5.2,1.3)-t*.04));',
      'vec2 w=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*.03),fbm(p+3.*q+vec2(8.3,2.8)-t*.025));',
      'float f=fbm(p+2.6*w+(m-.5)*.8);',
      'vec3 bg=vec3(.07,.055,.043),plum=vec3(.28,.08,.1),pap=vec3(.894,.341,.18),saf=vec3(.949,.694,.204);',
      'vec3 col=mix(bg,plum,smoothstep(.25,.62,f));col=mix(col,pap,smoothstep(.52,.82,f)*.8);',
      'col=mix(col,saf,smoothstep(.72,.95,f*length(w))*.55);',
      'col*=.45+.55*smoothstep(1.25,.15,length(uv-vec2(.72,.5)));',
      'gl_FragColor=vec4(col,1.);}',
    ].join('\n');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm');
    var mouse = [.5, .5], mNow = [.5, .5], running = false, t0 = performance.now();
    function size() {
      var s = .5;   /* половинное разрешение: фон мягкий, а GPU отдыхает */
      c.width = Math.round(c.clientWidth * s); c.height = Math.round(c.clientHeight * s);
      gl.viewport(0, 0, c.width, c.height);
    }
    size(); addEventListener('resize', size);
    c.parentNode.addEventListener('pointermove', function (e) {
      var rr = c.getBoundingClientRect(); mouse = [(e.clientX - rr.left) / rr.width, 1 - (e.clientY - rr.top) / rr.height];
    });
    function frame() {
      if (!running) return;
      mNow[0] += (mouse[0] - mNow[0]) * .05; mNow[1] += (mouse[1] - mNow[1]) * .05;
      gl.uniform2f(uR, c.width, c.height);
      gl.uniform1f(uT, RM ? 0 : (performance.now() - t0) / 1000);
      gl.uniform2f(uM, mNow[0], mNow[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (RM) { running = false; return; }   /* без анимации — один статичный кадр */
      requestAnimationFrame(frame);
    }
    var api = { run: function (on) { if (on && !running) { running = true; requestAnimationFrame(frame); } else if (!on) running = false; } };
    if (!window.gsap || RM) api.run(true);
    return api;
  }
})();
