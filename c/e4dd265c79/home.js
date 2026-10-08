/* CHINGATE — главная: рентген X-RAY, панель покупки, лукбук, каталог */
(function () {
  'use strict';
  var CG = window.CG, $ = CG.$, $$ = CG.$$, RM = CG.RM;

  /* шапка светлая, пока под ней первый экран */
  var hdr = $('[data-hdr]'), hero = $('.hero');
  new IntersectionObserver(function (e) { hdr.classList.toggle('is-over', e[0].isIntersecting); }, { rootMargin: '-64px 0px 0px 0px' }).observe(hero);

  /* единственный момент при загрузке: название проявляется из размытия */
  if (!RM && window.gsap) {
    gsap.from('.hero__title', { opacity: 0, y: 24, filter: 'blur(8px)', duration: 0.9, ease: 'power3.out' });
    gsap.from('.hero__lead, .hero__actions', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out', delay: 0.35, stagger: 0.08 });
  }

  /* детали X-RAY — пересказ описания с их сайта; x/y — точка на фото в процентах */
  var SPOTS = [
    { x: 50, y: 10, title: 'Шерстяной козырёк', text: 'Отстёгивается, держится на кнопках и закрывает лицо от снега и ветра.' },
    { x: 50, y: 33, title: 'Кнопки в форме логотипа', text: 'Вся фурнитура из окисленного металла — как в каждой вещи CHINGATE.' },
    { x: 37, y: 47, title: 'Прозрачный рипстоп', text: 'Водоотталкивающая ткань из Европы, прошита в три слоя, чтобы наполнитель не лез наружу.' },
    { x: 36, y: 71, title: 'Бегунок-логотип', text: 'Молнии на карманах и центральная — с бегунком в форме знака бренда.' },
    { x: 76, y: 87, title: 'Фиксаторы на поясе', text: 'Регулируют ширину. Наполнитель 600 г держит до −30.' },
  ];

  CG.ready.then(function () {
    stage(CG.model('x-ray-puffer-jacket'));
    look();
    catalog();
  });

  /* ---------- рентген и покупка ---------- */
  function stage(model) {
    var frame = $('[data-lens-area]'), film = $('[data-film]'), img = $('[data-stage-img]'), xray = $('[data-stage-xray]');
    var toggle = $('[data-xray-toggle]'), hint = $('[data-hint]'), spots = $('[data-spots]');
    var color = model.colors.filter(function (c) { return c.name === 'белый'; })[0] || model.colors[0];

    if (matchMedia('(hover: none)').matches) hint.textContent = 'Нажмите «Рентген» или проведите пальцем по куртке';

    /* линза: следует за указателем мягко, при «уменьшить движение» — сразу */
    var target = { x: 50, y: 45 }, pos = { x: 50, y: 45 }, scanning = false, raf = 0;
    function draw() {
      pos.x += (target.x - pos.x) * (RM ? 1 : 0.22);
      pos.y += (target.y - pos.y) * (RM ? 1 : 0.22);
      if (!frame.classList.contains('is-full')) film.style.clipPath = 'circle(' + (scanning ? '22%' : '0%') + ' at ' + pos.x + '% ' + pos.y + '%)';
      raf = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.1 ? requestAnimationFrame(draw) : 0;
    }
    function aim(e) {
      var r = frame.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width * 100;
      target.y = (e.clientY - r.top) / r.height * 100;
      if (!raf) raf = requestAnimationFrame(draw);
    }
    frame.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { scanning = true; pos.x = target.x; pos.y = target.y; aim(e); } });
    frame.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons) { scanning = true; aim(e); } });
    frame.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' && !e.target.closest('.spot, .detail')) { scanning = true; pos.x = target.x = 0; aim(e); pos.x = target.x; pos.y = target.y; } });
    function release() { scanning = false; if (!raf) raf = requestAnimationFrame(draw); }
    frame.addEventListener('pointerleave', release);
    frame.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') release(); });
    frame.addEventListener('pointercancel', release);

    /* кнопка: весь снимок в рентгене — для телефона и клавиатуры */
    function setFull(on) {
      toggle.setAttribute('aria-pressed', on);
      frame.classList.toggle('is-full', on);
      film.style.clipPath = on ? 'circle(150% at 50% 45%)' : 'circle(0% at 50% 45%)';
    }
    toggle.addEventListener('click', function () { setFull(toggle.getAttribute('aria-pressed') !== 'true'); });
    $('[data-xray-jump]').addEventListener('click', function () { setTimeout(function () { setFull(true); }, RM ? 0 : 700); });

    /* точки деталей: макро — то же фото, увеличенное в нужном месте */
    var detail = document.createElement('div');
    detail.className = 'detail';
    detail.setAttribute('role', 'region');
    detail.setAttribute('aria-live', 'polite');
    detail.innerHTML = '<div class="detail__macro"></div><div><p class="detail__title"></p><p class="detail__text"></p></div>';
    frame.append(detail);
    var open = null;
    SPOTS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'spot';
      b.style.left = s.x + '%';
      b.style.top = s.y + '%';
      b.setAttribute('aria-label', s.title);
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () {
        if (open === b) return closeDetail();
        if (open) open.setAttribute('aria-expanded', 'false');
        open = b;
        b.setAttribute('aria-expanded', 'true');
        $('.detail__title', detail).textContent = s.title;
        $('.detail__text', detail).textContent = s.text;
        var macro = $('.detail__macro', detail);
        macro.style.backgroundImage = `url(${img.currentSrc})`;
        macro.style.backgroundSize = '420%';
        macro.style.backgroundPosition = s.x + '% ' + s.y + '%';
        detail.classList.add('is-open');
      });
      spots.append(b);
    });
    function closeDetail() {
      if (open) open.setAttribute('aria-expanded', 'false');
      open = null;
      detail.classList.remove('is-open');
    }
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

    /* панель покупки — общая (app.js); здесь только фото и рентген при смене цвета */
    CG.buy($('[data-buy]'), model, color, function (c) {
      /* смена цвета — короткое затухание, чтобы было видно, что поменялось */
      if (!RM && window.gsap && img.src) gsap.fromTo([img, xray], { opacity: 0.35 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      img.src = xray.src = CG.img(c.images[0]);
      img.alt = model.name + ', цвет ' + c.name;
      xray.classList.toggle('is-dark', /черн|зелен/.test(c.name));
      $('[data-more]').href = 'product.html?m=' + model.key + '&c=' + model.colors.indexOf(c);
      closeDetail();
    });
  }

  /* ---------- лукбук: кадры со съёмок, подписи ведут к вещам ---------- */
  function look() {
    var FRAMES = [
      { src: 'img/78530938-b613-4c00-89f2-5d118cd21895.webp', alt: 'Модель в двусторонней дублёнке у моря', key: 'dublya-double-sided-jacket' },
      { src: 'img/6ed848e1-3560-49cc-8bd1-d286bbcbedfe.webp', alt: 'Модель в голубом пуховике BAZA на чёрном пляже', key: 'baza-puffer-jacket' },
      { src: 'img/7e61ebd8-1f9c-42ae-b354-6d02b469c6f4.webp', alt: 'Чёрная сумка ZAMSHA на полосатом диване', key: 'zamsha-shoulder-bag' },
      { src: 'img/f1689ba6-ebee-42b1-aaaf-704db0a3f97d.webp', alt: 'Модель в чёрном пуховике X-RAY у скалы', key: 'x-ray-puffer-jacket' },
      { src: 'img/9afd2710-d1f7-4485-a736-34d7c597c43b.webp', alt: 'Дублёнка CHINGATE в высокой траве', key: 'dublya-double-sided-jacket' },
      { src: 'img/fb3de1af-2079-4a5e-b50e-9e896bba83e8.webp', alt: 'Зелёная сумка ZAMSHA на полосатом диване', key: 'zamsha-shoulder-bag' },
      { src: 'img/4530aded-b394-4a80-9cfa-4c909a91f9c2.webp', alt: 'Девушка в длинном чёрном пуховике PALTO', soon: 'PALTO PUFFER — скоро в продаже' },
    ];
    var track = $('[data-look]');
    FRAMES.forEach(function (f) {
      var m = f.key && CG.model(f.key);
      var fig = document.createElement('figure');
      fig.className = 'frame';
      fig.innerHTML = '<img loading="lazy" decoding="async" alt="" width="900" height="1200"><figcaption></figcaption>';
      $('img', fig).src = f.src;
      $('img', fig).alt = f.alt;
      var cap = $('figcaption', fig);
      if (m) {
        var a = document.createElement('a');
        a.href = 'product.html?m=' + m.key;
        a.textContent = m.name;
        cap.append(a, document.createTextNode(' — ' + CG.rub(CG.price(m.colors[0]))));
      } else cap.textContent = f.soon;
      track.append(fig);
    });
  }

  /* ---------- каталог: одна карточка на модель, цвета — точками ---------- */
  function catalog() {
    var grid = $('[data-grid]'), chips = $('[data-chips]');
    var cats = ['Все'].concat(CG.models.map(function (m) { return m.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    cats.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c;
      b.setAttribute('aria-pressed', i === 0);
      b.addEventListener('click', function () {
        $$('.chip', chips).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        show(c);
      });
      chips.append(b);
    });
    function show(cat) {
      grid.innerHTML = '';
      CG.models.filter(function (m) { return cat === 'Все' || m.category === cat; }).forEach(function (m) {
        var lead = m.colors.filter(CG.hasStock)[0] || m.colors[0];
        var li = document.createElement('li');
        li.className = 'card';
        li.innerHTML = '<a><div class="card__img"><img loading="lazy" decoding="async" alt="" width="1100" height="1100"></div><div class="card__dots"></div><p class="card__name"></p><p class="card__price"></p><p class="card__note"></p></a>';
        $('a', li).href = 'product.html?m=' + m.key + '&c=' + m.colors.indexOf(lead);
        $('img', li).src = CG.img(lead.images[0]);
        $('img', li).alt = m.name;
        $('.card__name', li).textContent = m.name;
        $('.card__price', li).textContent = CG.rub(CG.price(lead));
        var dots = $('.card__dots', li);
        m.colors.forEach(function (c) { var i = document.createElement('i'); i.style.setProperty('--c', CG.swatch(c.name)); i.title = c.name; dots.append(i); });
        dots.setAttribute('aria-label', 'Цвета: ' + m.colors.map(function (c) { return c.name; }).join(', '));
        var any = m.colors.some(CG.hasStock), allPre = m.colors.every(function (c) { return c.preorder.enabled; });
        $('.card__note', li).textContent = !any ? 'Нет в наличии' : allPre ? 'Предзаказ' : '';
        grid.append(li);
      });
    }
    show('Все');
  }
})();
