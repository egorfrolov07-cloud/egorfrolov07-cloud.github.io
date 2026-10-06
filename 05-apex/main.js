/* ==========================================================================
   Апекс — всё, кроме 3D (оно в car.js): заставка-спидометр, плавная прокрутка,
   счётчики, конфигуратор и цена, «В наличии», кредит, трейд-ин, тест-драйв.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var A = window.APEX = window.APEX || {};
  var rub = function (v) { return Math.round(v).toLocaleString('ru-RU') + ' ₽'; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- плавная прокрутка; скорость наклоняет заголовки ---------- */
  var lenis = null;
  if (window.Lenis && !RM) {
    lenis = new Lenis({ lerp: 0.09 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    lenis.on('scroll', function (e) { root.style.setProperty('--vel', clamp(e.velocity / 60, -1, 1).toFixed(3)); });
  }
  $$('[data-scroll]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'), t = id === '#top' ? 0 : $(id);
      if (t === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { duration: 2 });
      else if (t === 0) scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      else t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
    });
  });

  /* ---------- заставка: спидометр показывает загрузку модели ---------- */
  var loader = $('.loader'), speed = $('.loader__speed b'), arc = $('.gauge__val'), shown = 0, target = 0, done = false;
  root.classList.add('is-loading');
  if (lenis) lenis.stop();
  (function tickLoader() {
    if (done) return;
    shown += (target - shown) * 0.12;
    speed.textContent = Math.round(shown);
    arc.style.strokeDashoffset = (1 - shown / 100).toFixed(3);
    requestAnimationFrame(tickLoader);
  })();
  addEventListener('apex:progress', function (e) { target = Math.max(target, e.detail * 96); });
  function finish() {
    if (done) return;
    done = true;
    speed.textContent = '100';
    arc.style.strokeDashoffset = 0;
    $('.loader__cap').textContent = '0–100 км/ч за 2,1 с';
    setTimeout(function () {
      loader.classList.add('is-done');
      root.classList.remove('is-loading');
      root.classList.add('is-ready');
      if (lenis) lenis.start();
      if (A.relayout) A.relayout();
    }, RM ? 0 : 650);
  }
  addEventListener('apex:ready', function (e) { finish(); fillStock(e.detail.snaps); });
  addEventListener('apex:error', function () { root.classList.add('no3d'); finish(); fillStock({}); });
  /* если 3D не загрузилось за 15 секунд — показываем сайт без него */
  setTimeout(function () { if (!done) { root.classList.add('no3d'); finish(); fillStock({}); } }, 15000);

  /* ---------- шапка прячется при прокрутке вниз ---------- */
  var hdr = $('.hdr'), lastY = 0;
  addEventListener('scroll', function () {
    var y = scrollY;
    hdr.classList.toggle('is-hidden', y > lastY && y > 300);
    lastY = y;
  }, { passive: true });

  /* ---------- появление ракурсов и счётчики ---------- */
  function count(el) {
    var to = +el.dataset.to, dec = +(el.dataset.dec || 0), t0 = performance.now(), D = RM ? 0 : 1600;
    (function step(now) {
      var k = D ? Math.min(1, (now - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec).replace('.', ',');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      $$('.cnt', en.target).forEach(count);
      io.unobserve(en.target);
    });
  }, { threshold: 0.35 });
  $$('.shot').forEach(function (el) { io.observe(el); });

  /* ---------- кредит: общая формула для конфигуратора и калькулятора ---------- */
  var RATE = 0.099 / 12;
  function monthly(sum, months) { return sum * RATE / (1 - Math.pow(1 + RATE, -months)); }

  /* ---------- конфигуратор ---------- */
  var cfg = $('.cfg'), priceEl = $('[data-price]'), monthEl = $('[data-month]');
  var price = 14900000, priceShown = price;
  function setAccent(input) {
    var c = input.dataset.acc;
    root.style.setProperty('--acc', c);
    /* на светлых акцентах (перламутр, графит) текст кнопок тёмный */
    root.style.setProperty('--acc-ink', c === '#e2213c' ? '#ffffff' : '#0a0b0d');
  }
  function roll(el, from, to, fmt) {
    var t0 = performance.now(), D = RM ? 0 : 700;
    (function step(now) {
      var k = D ? Math.min(1, (now - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function updatePrice() {
    var paint = $('input[name="paint"]:checked', cfg), trim = $('input[name="trim"]:checked', cfg);
    var next = +trim.value + +paint.dataset.add;
    roll(priceEl, priceShown, next, rub);
    priceShown = price = next;
    monthEl.textContent = 'от ' + rub(monthly(price * 0.7, 60));
    credit();
  }
  cfg.addEventListener('change', function (e) {
    if (e.target.name === 'paint') {
      setAccent(e.target);
      if (A.paint) A.paint(e.target.value);
    }
    updatePrice();
  });
  $$('.tgl', cfg).forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      if (A.set) A.set(b.dataset.tgl, on);
      /* салон и разбор вместе не работают: камера оказалась бы внутри разобранной машины */
      var other = { interior: 'explode', explode: 'interior' }[b.dataset.tgl], ob = other && $('[data-tgl=' + other + ']', cfg);
      if (on && ob && ob.getAttribute('aria-pressed') === 'true') { ob.setAttribute('aria-pressed', 'false'); A.set(other, false); }
      root.classList.toggle('is-inside', $('[data-tgl=interior]', cfg).getAttribute('aria-pressed') === 'true');
    });
  });

  /* ---------- в наличии: снимки 3D-модели + фильтры ---------- */
  var STOCK = [
    { name: 'GT-e', paint: 'Carmine Candy', view: 'front', st: 'now', price: 14900000, meta: '2026 · 760 л. с. · 0 км · VIN …4817' },
    { name: 'GT-e Performance', paint: 'Torched Graphite', view: 'front', st: 'now', price: 17890000, meta: '2026 · 1 020 л. с. · 0 км · VIN …5204' },
    { name: 'GT-e', paint: 'Pearly Swirly', view: 'rear', st: 'way', price: 15250000, meta: 'Прибудет в декабре · 760 л. с.' },
    { name: 'Launch Edition', paint: 'Carmine Candy', view: 'rear', st: 'now', price: 19900000, meta: '2026 · последний экземпляр · VIN …0001' },
    { name: 'GT-e', paint: 'Torched Graphite', view: 'rear', st: 'now', price: 13600000, meta: 'Демо-автомобиль · 1 200 км · VIN …3390' },
    { name: 'GT-e Performance', paint: 'Pearly Swirly', view: 'front', st: 'way', price: 17750000, meta: 'Прибудет в январе · 1 020 л. с.' },
  ];
  var PAINT_RU = { 'Carmine Candy': 'Красный кэнди', 'Pearly Swirly': 'Белый перламутр', 'Torched Graphite': 'Графит' };
  var cars = $('.cars');
  function fillStock(snaps) {
    if (cars.children.length) return;
    cars.innerHTML = STOCK.map(function (c) {
      var img = snaps[c.paint + '|' + c.view];
      return '<article class="car" data-st="' + c.st + '" data-c="' + c.paint + '">' +
        '<div class="car__img">' + (img ? '<img src="' + img + '" alt="Апекс ' + c.name + ', ' + PAINT_RU[c.paint].toLowerCase() + '" loading="lazy">' : '<i class="ph"></i>') + '</div>' +
        '<div class="car__top"><h3 class="car__name">' + c.name + '</h3><span class="car__st" data-st="' + c.st + '">' + (c.st === 'now' ? 'В наличии' : 'В пути') + '</span></div>' +
        '<p class="car__meta">' + PAINT_RU[c.paint] + ' · ' + c.meta + '</p>' +
        '<p class="car__price">' + rub(c.price) + '<small>или от ' + rub(monthly(c.price * 0.7, 60)) + ' в месяц</small></p>' +
        '</article>';
    }).join('');
    applyFilter();
  }
  var fSt = 'all', fC = null;
  function applyFilter() {
    $$('.car', cars).forEach(function (el) {
      var ok = (fSt === 'all' || el.dataset.st === fSt) && (!fC || el.dataset.c === fC);
      el.classList.toggle('is-hidden', !ok);
    });
  }
  $$('.filters .chip').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.f) {
        fSt = b.dataset.f;
        $$('.filters [data-f]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      } else {
        fC = fC === b.dataset.c ? null : b.dataset.c;
        $$('.filters [data-c]').forEach(function (x) {
          var on = x.dataset.c === fC;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      }
      applyFilter();
    });
  });

  /* ---------- ползунки: заливка дорожки ---------- */
  function fillRange(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  $$('input[type="range"]').forEach(function (r) { fillRange(r); r.addEventListener('input', function () { fillRange(r); }); });

  /* ---------- кредит ---------- */
  var cf = $('.credit');
  function credit() {
    var down = +cf.down.value, term = +cf.term.value, sum = price * (1 - down / 100);
    $('[data-credit-price]').textContent = rub(price);
    $('[data-out="down"]', cf).textContent = down + '% · ' + rub(price * down / 100);
    $('[data-out="term"]', cf).textContent = term + ' мес.';
    $('[data-out="month"]', cf).textContent = rub(monthly(sum, term));
  }
  cf.addEventListener('input', credit);

  /* ---------- трейд-ин (формула вымышленная, для концепта) ---------- */
  var tf = $('.trade'), now = new Date().getFullYear();
  for (var yr = now; yr >= now - 15; yr--) tf.year.add(new Option(yr, yr, yr === now - 4, yr === now - 4));
  function trade() {
    var age = now - +tf.year.value, km = +tf.km.value;
    $('[data-out="km"]', tf).textContent = km.toLocaleString('ru-RU') + ' км';
    if (!tf.model.value.trim()) { $('[data-out="trade"]', tf).textContent = '—'; return; }
    var v = 5200000 * Math.pow(0.87, age) * (1 - km / 500000);
    var lo = Math.round(v * 0.93 / 10000) * 10000, hi = Math.round(v * 1.07 / 10000) * 10000;
    $('[data-out="trade"]', tf).textContent = (lo / 1e6).toFixed(2).replace('.', ',') + '–' + (hi / 1e6).toFixed(2).replace('.', ',') + ' млн ₽';
  }
  tf.addEventListener('input', trade);
  tf.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- тест-драйв ---------- */
  var book = $('.book'), days = $('.days', book);
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  for (var i = 1; i <= 14; i++) {
    var d = new Date();
    d.setDate(d.getDate() + i);
    var lab = document.createElement('label');
    lab.className = 'day';
    lab.innerHTML = '<input type="radio" name="day" value="' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + '"' + (i === 1 ? ' checked' : '') + '><span><small>' + (i === 1 ? 'завтра' : WD[d.getDay()]) + '</small><b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') + '</small></span>';
    days.appendChild(lab);
  }
  book.addEventListener('submit', function (e) {
    e.preventDefault();
    var who = book.elements['name'].value.trim();
    var ok = who && book.phone.value.replace(/\D/g, '').length >= 10;
    $('.book__err', book).hidden = !!ok;
    if (!ok) return;
    var done = $('.book__done', book);
    done.textContent = who + ', так выглядела бы запись на ' + book.day.value + ', ' + book.time.value + ' — маршрут «' + book.route.value + '». Это концепт-проект: заявка никуда не отправляется.';
    done.hidden = false;
    $('.book__row', book).hidden = true;
  });

  updatePrice();
  trade();
})();
