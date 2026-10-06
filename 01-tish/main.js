/* ==========================================================================
   Тишь — сценарий анимаций.
   GSAP + ScrollTrigger для анимаций, Lenis для плавного скролла.
   Без библиотек (офлайн) страница остаётся полностью рабочей и статичной.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  /* ?static — статичная страница без анимаций (для скриншотов в соцсети) */
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]static\b/.test(location.search);
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ---------- разбивка текста на слова ---------- */

  function appendWords(parent, text, cls) {
    /* делим только по обычным пробелам: неразрывные (&nbsp;) склеивают предлоги со словами */
    text.split(/([ \t\n\r]+)/).forEach(function (part) {
      if (!part) return;
      if (/^[ \t\n\r]+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
      var outer = document.createElement('span');
      outer.className = cls;
      if (cls === 'wm') {
        var inner = document.createElement('span');
        inner.className = 'wi';
        inner.textContent = part;
        outer.appendChild(inner);
      } else {
        outer.textContent = part;
      }
      parent.appendChild(outer);
    });
  }

  function splitWords(el, cls) {
    var nodes = [].slice.call(el.childNodes);
    el.textContent = '';
    nodes.forEach(function (n) {
      if (n.nodeType === 3) { appendWords(el, n.textContent, cls); return; }
      if (n.nodeType !== 1) return;
      var shell = n.cloneNode(false);
      el.appendChild(shell);
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) appendWords(shell, c.textContent, cls);
        else shell.appendChild(c.cloneNode(true));
      });
    });
  }

  /* ---------- меню (работает и без GSAP) ---------- */

  var burger = $('.burger');
  var menu = $('#menu');
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });

  /* ---------- форма (работает и без GSAP) ---------- */

  var form = $('.form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    $$('.field', form).forEach(function (f) {
      var input = $('input', f);
      var bad = input.name === 'phone' ? input.value.replace(/\D/g, '').length < 10 : !input.value.trim();
      f.classList.toggle('is-error', bad);
      if (bad && ok) { input.focus(); ok = false; }
    });
    if (ok) form.classList.add('is-sent');
  });
  $$('.field input', form).forEach(function (input) {
    input.addEventListener('input', function () { input.parentNode.classList.remove('is-error'); });
  });

  /* ---------- плавный скролл ---------- */

  var lenis = null;
  if (!RM && hasGsap && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  $$('a[data-scroll]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (root.classList.contains('menu-open')) setMenu(false);
      if (lenis) lenis.scrollTo(target, { duration: 1.6, offset: 0 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
    });
  });

  /* без GSAP или при reduced motion — статичная, но полная страница */
  if (!hasGsap || RM) {
    var l = $('.loader');
    if (l) l.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var ease = 'expo.out';
  /* Параллакс от прокрутки браузер умеет считать сам (CSS animation-timeline: Chrome, Safari 26+).
     Тогда он идёт вместе со скроллом и на iPhone не дёргается; GSAP — только там, где этого нет */
  var SDA = !!(window.CSS && CSS.supports('animation-timeline: view()'));
  root.classList.toggle('sda', SDA);

  /* ---------- подготовка текста ---------- */

  $$('[data-lines]').forEach(function (el) { splitWords(el, 'wm'); });
  $$('[data-words]').forEach(function (el) { splitWords(el, 'w'); });

  /* ---------- прелоадер и первый экран ---------- */

  var loader = $('.loader');
  var count = $('.loader__count b');
  var heroImg = $('.hero__media img');
  var heroWord = $('.hero__word');

  gsap.set(heroWord, { yPercent: 110 });
  gsap.set(['.hero__top', '.hero__bottom'], { autoAlpha: 0, y: 20 });
  gsap.set(heroImg, { scale: 1.18 });
  gsap.set('.header', { autoAlpha: 0 });
  if (lenis) lenis.stop();

  var imgReady = new Promise(function (resolve) {
    if (heroImg.complete) resolve();
    else { heroImg.addEventListener('load', resolve, { once: true }); heroImg.addEventListener('error', resolve, { once: true }); }
    setTimeout(resolve, 3500);
  });

  var counter = { v: 0 };
  var intro = gsap.timeline();
  intro
    .from('.loader__word span', { yPercent: 110, duration: 1.1, ease: ease, stagger: 0.07 })
    .to(counter, {
      v: 100, duration: 1.6, ease: 'power2.inOut',
      onUpdate: function () { count.textContent = Math.round(counter.v); }
    }, 0);

  Promise.all([imgReady, new Promise(function (r) { intro.eventCallback('onComplete', r); })]).then(function () {
    var out = gsap.timeline({
      onComplete: function () {
        loader.remove();
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      }
    });
    out
      .to('.loader__word span', { yPercent: -110, duration: .7, ease: 'power3.in', stagger: 0.04 })
      .to('.loader__meta', { autoAlpha: 0, duration: .4 }, '<')
      .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=.15')
      .to(heroImg, { scale: 1, duration: 2.2, ease: 'expo.out' }, '-=.75')
      .to(heroWord, { yPercent: 0, duration: 1.4, ease: ease }, '-=1.9')
      .to(['.hero__top', '.hero__bottom'], { autoAlpha: 1, y: 0, duration: 1, ease: ease, stagger: .1 }, '-=1.2')
      .to('.header', { autoAlpha: 1, duration: .8 }, '-=1');
  });

  /* ---------- hero на скролле ---------- */

  if (!SDA) {
    gsap.to('.hero__media', {
      yPercent: 22, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('.hero__title', {
      yPercent: -30, autoAlpha: .2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /* ---------- шапка: прячется при скролле вниз ---------- */

  var header = $('.header');
  var lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      var y = self.scroll();
      if (root.classList.contains('menu-open')) return;
      header.classList.toggle('is-hidden', y > lastY && y > 200);
      lastY = y;
    }
  });

  /* ---------- манифест: слова проявляются по скроллу ---------- */

  $$('[data-words]').forEach(function (el) {
    gsap.fromTo($$('.w', el), { opacity: .14 }, {
      opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
  });

  /* ---------- заголовки: слова поднимаются из маски ---------- */

  $$('[data-lines]').forEach(function (el) {
    gsap.from($$('.wi', el), {
      yPercent: 115, duration: 1.3, ease: ease, stagger: .06,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* ---------- мягкое появление блоков ---------- */

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%', once: true,
    onEnter: function (els) {
      gsap.fromTo(els, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: ease, stagger: .08, overwrite: true });
    }
  });
  gsap.set('[data-reveal]', { autoAlpha: 0, y: 40 });

  /* ---------- фото: раскрытие шторкой ---------- */

  $$('[data-clip]').forEach(function (fig) {
    var img = $('img', fig);
    var tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 85%', once: true } });
    tl.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' })
      .from(img, { scale: 1.3, duration: 2, ease: ease }, 0);
  });

  /* ---------- параллакс ---------- */

  if (!SDA) $$('.parallax').forEach(function (box) {
    var img = $('img', box);
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- счётчики ---------- */

  $$('[data-count]').forEach(function (el) {
    var to = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals || '0', 10);
    var o = { v: 0 };
    el.textContent = dec ? '0,0' : '0';
    gsap.to(o, {
      v: to, duration: 2.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: function () { el.textContent = o.v.toFixed(dec).replace('.', ','); }
    });
  });

  /* ---------- дома: горизонтальная прокрутка на десктопе ---------- */

  var mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', function () {
    var section = $('.houses');
    var track = $('.houses__track');
    section.classList.add('is-pinnable');
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };

    var tween = gsap.to(track, {
      x: function () { return -dist(); },
      ease: 'none',
      scrollTrigger: {
        trigger: '.houses__pin',
        start: 'top top',
        end: function () { return '+=' + dist(); },
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
    gsap.to('.houses__progress i', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.houses__pin', start: 'top top', end: function () { return '+=' + dist(); }, scrub: true }
    });

    return function () {
      section.classList.remove('is-pinnable');
      tween.kill();
      gsap.set(track, { clearProps: 'transform' });
    };
  });

  /* ---------- курсор ---------- */

  if (FINE) {
    var cursor = $('.cursor');
    var label = $('.cursor__label');
    var cx = innerWidth / 2, cy = innerHeight / 2;
    var xTo = gsap.quickTo(cursor, 'x', { duration: .45, ease: 'power3' });
    var yTo = gsap.quickTo(cursor, 'y', { duration: .45, ease: 'power3' });

    window.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      xTo(cx); yTo(cy);
      cursor.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('is-visible'); });

    $$('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function () { label.textContent = el.dataset.cursor; cursor.classList.add('is-big'); });
      el.addEventListener('pointerleave', function () { cursor.classList.remove('is-big'); });
    });

    /* магнитные кнопки */
    $$('[data-magnetic]').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1, .4)' });
      var my = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1, .4)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * .3);
        my((e.clientY - r.top - r.height / 2) * .3);
      });
      el.addEventListener('pointerleave', function () { mx(0); my(0); });
    });

    /* плавающее фото в списке инфраструктуры */
    var float = $('.float');
    var floatImg = $('img', float);
    var fx = gsap.quickTo(float, 'x', { duration: .7, ease: 'power3' });
    var fy = gsap.quickTo(float, 'y', { duration: .7, ease: 'power3' });
    var list = $('.amenities');

    $$('.amenity').forEach(function (item) {
      var pre = new Image();
      pre.src = item.dataset.img;
      item.addEventListener('pointerenter', function () {
        floatImg.src = item.dataset.img;
        gsap.to(float, { autoAlpha: 1, scale: 1, duration: .6, ease: ease, overwrite: 'auto' });
      });
    });
    list.addEventListener('pointerleave', function () {
      gsap.to(float, { autoAlpha: 0, scale: .6, duration: .5, ease: 'power3.out', overwrite: 'auto' });
    });
    list.addEventListener('pointermove', function (e) {
      fx(e.clientX - float.offsetWidth * .5 + 180);
      fy(e.clientY - float.offsetHeight * .5);
    });
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
