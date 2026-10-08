/* CHINGATE — главная: сканер X-RAY, блок покупки, лукбук, каталог с быстрым выбором размера */
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
    scan(CG.model('x-ray-puffer-jacket'));
    look();
    catalog();
  });

  /* ---------- сканер и покупка ---------- */
  function scan(model) {
    var section = $('.scan'), img = $('[data-stage-img]'), xray = $('[data-stage-xray]'), notes = $('[data-notes]');
    var toggle = $('[data-xray-toggle]'), frame = $('[data-scan-frame]');
    var white = model.colors.filter(function (c) { return c.name === 'белый'; })[0] || model.colors[0];
    /* снимок всегда по белому: крой у всех цветов один, а прозрачный рипстоп «просвечивается» лучше всего */
    xray.src = CG.img(white.images[0]);
    if (RM || !CSS.supports('animation-timeline: view()') || innerHeight <= 560) $('[data-hint]').textContent = 'Нажмите «Весь снимок», чтобы просветить пуховик';

    toggle.addEventListener('click', function () {
      var on = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', on);
      section.classList.toggle('is-full', on);
    });

    /* подписи деталей: появляются, когда луч доходит до их высоты; по нажатию — макро и текст */
    var detail = document.createElement('div');
    detail.className = 'detail';
    detail.setAttribute('role', 'region');
    detail.setAttribute('aria-live', 'polite');
    detail.innerHTML = '<div class="detail__macro"></div><div><p class="detail__title"></p><p class="detail__text"></p></div>';
    frame.append(detail);
    var open = null;
    SPOTS.forEach(function (s) {
      var li = document.createElement('li');
      var from = 8 + 74 * s.y / 100 - 1;
      li.className = 'note' + (s.x > 60 ? ' note--left' : '');
      li.style.cssText = '--x:' + s.x + '%;--y:' + s.y + '%;--from:' + from + '%;--to:' + (from + 5) + '%';
      li.innerHTML = '<button class="note__btn" type="button" aria-expanded="false"><span class="note__dot"></span><span class="note__label"></span></button>';
      var b = $('button', li);
      $('.note__label', li).textContent = s.title;
      b.addEventListener('click', function () {
        if (open === b) return closeDetail();
        if (open) open.setAttribute('aria-expanded', 'false');
        open = b;
        b.setAttribute('aria-expanded', 'true');
        $('.detail__title', detail).textContent = s.title;
        $('.detail__text', detail).textContent = s.text;
        var macro = $('.detail__macro', detail);
        macro.style.backgroundImage = `url(${img.currentSrc || img.src})`;
        macro.style.backgroundSize = '420%';
        macro.style.backgroundPosition = s.x + '% ' + s.y + '%';
        detail.classList.add('is-open');
      });
      notes.append(li);
    });
    function closeDetail() {
      if (open) open.setAttribute('aria-expanded', 'false');
      open = null;
      detail.classList.remove('is-open');
    }
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

    /* покупка — общая панель (app.js); при смене цвета меняются фото снаружи и в блоке покупки, снимок — нет */
    var buyImg = $('[data-buy-img]');
    CG.buy($('[data-buy]'), model, white, function (c) {
      img.src = CG.img(c.images[0]);
      img.alt = model.name + ', цвет ' + c.name;
      buyImg.src = CG.img(c.images[1] || c.images[0]);
      buyImg.alt = model.name + ', цвет ' + c.name + ', другой ракурс';
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
      fig.innerHTML = '<div class="frame__img"><img loading="lazy" decoding="async" alt="" width="900" height="1200"></div><figcaption></figcaption>';
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

  /* ---------- каталог: одна карточка на модель; цвет и «Размер» — отдельные кнопки, не внутри ссылки ---------- */
  function catalog() {
    var grid = $('[data-grid]'), chips = $('[data-chips]'), count = $('[data-count]');
    var cats = ['Все'].concat(CG.models.map(function (m) { return m.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    cats.forEach(function (c, i) {
      var n = CG.models.filter(function (m) { return c === 'Все' || m.category === c; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.innerHTML = c + ' <small>' + n + '</small>';
      b.setAttribute('aria-pressed', i === 0);
      b.addEventListener('click', function () {
        $$('.chip', chips).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        show(c);
        /* к началу сетки, если она ушла вверх */
        if (CG.lenis) CG.lenis.resize();
        if ($('.catalog').getBoundingClientRect().top < 0) CG.scrollTo($('.catalog'));
      });
      chips.append(b);
    });

    function card(m) {
      var li = document.createElement('li');
      li.className = 'card';
      li.innerHTML = '<a class="card__link"><div class="card__img"><img class="card__a" loading="lazy" decoding="async" alt="" width="1100" height="1100"><img class="card__b" loading="lazy" decoding="async" alt="" width="1100" height="1100"></div><p class="card__name"></p></a>' +
        '<div class="card__row"><p class="card__price"></p><button class="card__add" type="button">Размер</button></div><div class="card__colors" role="group"></div><p class="card__note"></p>';
      $('.card__name', li).textContent = m.name;
      $('.card__add', li).setAttribute('aria-label', 'Выбрать размер: ' + m.name);
      $('.card__colors', li).setAttribute('aria-label', 'Цвет: ' + m.name);
      var current;
      function set(c) {
        current = c;
        $('.card__link', li).href = 'product.html?m=' + m.key + '&c=' + m.colors.indexOf(c);
        $('.card__a', li).src = CG.img(c.images[0]);
        $('.card__a', li).alt = m.name + ', ' + c.name;
        var second = CG.img(c.images[1] || '');
        $('.card__b', li).src = second || CG.img(c.images[0]);
        li.classList.toggle('has-b', !!second);
        $('.card__price', li).textContent = CG.rub(CG.price(c));
        $('.card__note', li).textContent = !CG.hasStock(c) ? 'Нет в наличии' : c.preorder.enabled ? 'Предзаказ' : '';
        $('.card__add', li).disabled = !CG.hasStock(c);
        $$('.card__color', li).forEach(function (b, i) { b.setAttribute('aria-pressed', m.colors[i] === c); });
      }
      if (m.colors.length > 1) m.colors.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'card__color';
        b.style.setProperty('--c', CG.swatch(c.name));
        b.setAttribute('aria-label', c.name);
        b.addEventListener('click', function () { set(c); });
        $('.card__colors', li).append(b);
      });
      $('.card__add', li).addEventListener('click', function (e) { CG.quick(m, current, e.currentTarget); });
      set(m.colors.filter(CG.hasStock)[0] || m.colors[0]);
      return li;
    }

    function show(cat) {
      grid.innerHTML = '';
      var list = CG.models.filter(function (m) { return cat === 'Все' || m.category === cat; });
      list.forEach(function (m) { grid.append(card(m)); });
      count.textContent = 'Показано моделей: ' + list.length;
    }
    show('Все');
  }
})();
