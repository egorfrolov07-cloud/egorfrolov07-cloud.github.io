/* Canape Club — концепт By Egor: калькулятор стола, состав сета, меню, доставка. Без библиотек. */
(function () {
  'use strict';
  var D = window.CC_DATA;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SITE = 'https://canapeclub.ru';
  var money = function (n) { return n.toLocaleString('ru-RU') + ' ₽'; };
  var kg = function (n) { return (Math.round(n * 100) / 100).toLocaleString('ru-RU') + ' кг'; };
  var img = function (name) { return 'img/tile-' + name + '-400.webp'; };

  /* ---------- расчёт ---------- */
  var state = { guests: 25, mode: 'sets', occasion: 'premium', tariff: 'standard' };
  var MIN = 5, MAX = 150, PART = 30;  /* самый большой сет в линейках — на 26–30 гостей */

  /* сеты: гостей делим на равные части не больше 30, каждой части — сет, в диапазон которого она попадает */
  function pickSets(n, line) {
    var k = Math.ceil(n / PART), parts = [];
    for (var i = 0; i < k; i++) parts.push(Math.floor(n / k) + (i < n % k ? 1 : 0));
    return parts.map(function (p) {
      return line.items.filter(function (s) { return p >= s[0] && p <= s[1]; })[0];
    });
  }

  function calc() {
    var n = state.guests;
    if (state.mode === 'sets') {
      var line = D.sets[state.occasion], sets = pickSets(n, line);
      var sum = function (i) { return sets.reduce(function (a, s) { return a + s[i]; }, 0); };
      return { mode: 'sets', n: n, line: line, sets: sets, price: sum(2), weight: sum(3), pieces: sum(4) };
    }
    var t = D.tariffs.filter(function (x) { return x.id === state.tariff; })[0];
    return { mode: 'service', n: n, tariff: t, price: n * t.price, weight: n * t.grams / 1000 };
  }

  /* группируем одинаковые сеты: «2 × на 21–25 персон» */
  function grouped(sets) {
    var out = [];
    sets.forEach(function (s) {
      var g = out.filter(function (x) { return x.s === s; })[0];
      if (g) g.k++; else out.push({ s: s, k: 1 });
    });
    return out;
  }
  var range = function (s) { return s[0] + '–' + s[1] + ' персон'; };
  var guestsWord = function (n) {
    var a = n % 10, b = n % 100;
    return n + (a === 1 && b !== 11 ? ' гость' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? ' гостя' : ' гостей');
  };

  function summary(r) {
    var head = 'Canape Club — расчёт на ' + guestsWord(r.n) + ' (цены с canapeclub.ru на ' + D.date + ')';
    if (r.mode === 'sets') {
      return [head, 'Готовые сеты, без официантов: ' + r.line.title,
        grouped(r.sets).map(function (g) { return '• ' + (g.k > 1 ? g.k + ' × ' : '') + r.line.title + ' на ' + range(g.s) + ' — ' + money(g.s[2] * g.k); }).join('\n'),
        'Итого: ' + money(r.price) + ' · ' + kg(r.weight) + ' · ' + r.pieces + ' закусок',
        'На гостя: ' + Math.round(r.weight * 1000 / r.n) + ' г и ' + Math.round(r.pieces / r.n) + ' закусок',
        'Доставка по Москве бесплатно от 3 500 ₽'].join('\n');
    }
    return [head, r.tariff.title + ' с обслуживанием',
      'От ' + money(r.price) + ' (от ' + money(r.tariff.price) + ' на гостя)',
      'Еды от ' + kg(r.weight) + ' (от ' + r.tariff.grams + ' г на гостя)',
      'Входит: ' + r.tariff.includes].join('\n');
  }

  /* ---------- вывод итога ---------- */
  var result = $('[data-result]'), note = $('[data-note]'), dockText = $('[data-dock-text]'), live = $('[data-live]');
  function renderResult(r) {
    var html;
    if (r.mode === 'sets') {
      var g = grouped(r.sets), main = r.sets[0];
      html = '<div class="res">' +
        '<p class="res__label">' + (r.sets.length > 1 ? 'Подойдут ' + r.sets.length + (r.sets.length < 5 ? ' сета' : ' сетов') : 'Подойдёт') + '</p>' +
        '<h3 class="res__title">' + r.line.title + '</h3>' +
        '<ul class="res__sets">' + g.map(function (x) {
          return '<li><a href="' + SITE + x.s[5] + '" target="_blank" rel="noopener">' + (x.k > 1 ? x.k + ' × ' : '') + 'на ' + range(x.s) + '</a><span>' + money(x.s[2] * x.k) + '</span></li>';
        }).join('') + '</ul>' +
        '<dl class="res__nums"><div><dt>итого</dt><dd>' + money(r.price) + '</dd></div><div><dt>еды</dt><dd>' + kg(r.weight) + '</dd></div><div><dt>закусок</dt><dd>' + r.pieces + '</dd></div></dl>' +
        '<p class="res__per">На каждого гостя — ' + Math.round(r.weight * 1000 / r.n) + ' г и ' + Math.round(r.pieces / r.n) + ' закусок</p>' +
        '<p class="res__note">Без официантов: закуски приезжают в боксах, их можно сразу ставить на стол. Доставка по Москве бесплатно от 3 500 ₽, в день заказа.' + (r.n > PART ? ' Сетов больше чем на 30 гостей в этой линейке нет, поэтому складываем несколько.' : '') + '</p>' +
        '<div class="res__actions"><a class="btn btn--main" href="' + SITE + main[5] + '" target="_blank" rel="noopener">Сет на canapeclub.ru <span aria-hidden="true">↗</span></a><button class="btn btn--ghost" type="button" data-copy>Скопировать расчёт</button></div>' +
        '<p class="res__src">Цены и составы — с canapeclub.ru на ' + D.date + '.</p></div>';
      dockText.textContent = guestsWord(r.n) + ' · ' + money(r.price);
    } else {
      html = '<div class="res">' +
        '<p class="res__label">С обслуживанием</p>' +
        '<h3 class="res__title">' + r.tariff.title + '</h3>' +
        '<dl class="res__nums"><div><dt>итого</dt><dd>от ' + money(r.price) + '</dd></div><div><dt>еды</dt><dd>от ' + kg(r.weight) + '</dd></div><div><dt>на гостя</dt><dd>' + r.tariff.grams + ' г</dd></div></dl>' +
        '<p class="res__per">Входит: ' + r.tariff.includes + '</p>' +
        '<p class="res__note">Цена «от»: точную смету считает менеджер — по меню, площадке и числу официантов.</p>' +
        '<div class="res__actions"><a class="btn btn--main" href="#contact" data-to-contact>Получить смету</a><button class="btn btn--ghost" type="button" data-copy>Скопировать расчёт</button></div>' +
        '<p class="res__src">Тарифы — со страницы «Кейтеринг» на canapeclub.ru, ' + D.date + '.</p></div>';
      dockText.textContent = guestsWord(r.n) + ' · от ' + money(r.price);
    }
    result.innerHTML = html;
    note.value = summary(r);
    /* скринридеру — одна короткая строка, а не вся карточка при каждом нажатии ± */
    live.textContent = dockText.textContent + (r.mode === 'sets' ? ', ' + r.line.title : ', ' + r.tariff.title);
  }

  result.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var done = function () { b.textContent = 'Скопировано'; setTimeout(function () { b.textContent = 'Скопировать расчёт'; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(note.value).then(done, function () { note.select(); });
  });

  /* ---------- доска: плитки-закуски, их число растёт с гостями ---------- */
  var MIX = {
    premium: ['salmon', 'antipasto', 'cheese', 'verrine', 'bruschetta', 'macaron', 'tartlet', 'roll'],
    office: ['bruschetta', 'roll', 'cheese', 'verrine', 'tartlet', 'salmon', 'antipasto', 'eclair'],
    birthday: ['burger', 'salmon', 'skewer', 'tartlet', 'cheese', 'macaron', 'bruschetta', 'roll'],
    wedding: ['salmon', 'cheese', 'macaron', 'tartlet', 'verrine', 'antipasto', 'eclair'],
    coffee: ['eclair', 'macaron', 'tartlet', 'bruschetta', 'roll', 'cheese'],
    't-coffee': ['eclair', 'macaron', 'tartlet', 'bruschetta', 'cheese'],
    't-standard': ['bruschetta', 'roll', 'tartlet', 'cheese', 'skewer', 'salmon', 'verrine'],
    't-premium': ['salmon', 'verrine', 'antipasto', 'tartlet', 'skewer', 'eclair', 'macaron', 'cheese'],
    't-vip': ['salmon', 'verrine', 'antipasto', 'skewer', 'burger', 'macaron', 'eclair', 'cheese'],
  };
  var board = $('[data-board]'), caption = $('[data-board-caption]'), tiles = [];
  var MAX_TILES = 36;
  /* псевдослучайные, но постоянные для номера плитки сдвиг и поворот — стол выглядит разложенным руками */
  var rnd = function (i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

  function renderBoard(r) {
    var count = Math.min(MAX_TILES, r.n);
    var mix = MIX[r.mode === 'sets' ? state.occasion : 't-' + state.tariff];
    var w = board.clientWidth || 600, h = board.clientHeight || 450, aspect = w / h;
    var cols = Math.ceil(Math.sqrt(count * aspect)), rows = Math.ceil(count / cols);
    var cell = Math.min(w / cols, h / rows) * .96;
    var ox = (w - cell * cols) / 2, oy = (h - cell * rows) / 2;
    var last = count - (rows - 1) * cols;  /* неполный последний ряд — по центру */

    for (var i = 0; i < Math.max(count, tiles.length); i++) {
      var t = tiles[i];
      if (i >= count) { if (t && !t.out) { t.out = true; t.el.classList.add('is-out'); removeLater(t); } continue; }
      if (!t || t.out) {
        var el = document.createElement('div');
        el.className = 'tile';
        el.innerHTML = '<img alt="" width="400" height="400" decoding="async"><i class="tile__hit" data-i="' + i + '"></i>';
        board.append(el);
        t = tiles[i] = { el: el, img: el.firstChild };
        drop(el, i);
      }
      /* съеденные закуски возвращаются, когда стол пересобирается */
      if (t.bites) { t.bites = 0; t.el.classList.remove('is-bitten', 'is-eaten'); drop(t.el, i); }
      var name = mix[Math.floor(rnd(i, 1) * 997) % mix.length];
      if (t.name !== name) { t.name = name; t.img.src = img(name); }
      /* закуска занимает меньше половины кадра плитки, поэтому плитки крупнее клетки и заходят друг на друга краями */
      var row = Math.floor(i / cols), col = i % cols;
      var size = cell * 1.6, j = cell * .12, shift = row === rows - 1 ? (cols - last) * cell / 2 : 0;
      t.el.style.left = ((ox + shift + (col + .5) * cell - size / 2 + (rnd(i, 5) - .5) * j) / w * 100) + '%';
      t.el.style.top = ((oy + (row + .5) * cell - size / 2 + (rnd(i, 7) - .5) * j) / h * 100) + '%';
      t.el.style.width = (size / w * 100) + '%';
      t.el.style.height = (size / h * 100) + '%';
      /* поворот — отдельным свойством rotate, чтобы не спорить с transform появления и исчезновения */
      t.el.style.rotate = (rnd(i, 9) * 16 - 8) + 'deg';
    }
    eaten = 0;
    caption.textContent = (r.n > MAX_TILES ? 'Стол на ' + guestsWord(r.n) + ' — на доске показана часть' : 'Стол на ' + guestsWord(r.n)) + '. Нажмите на закуску';
  }
  /* закуска «падает» на доску: сверху, крупнее и прозрачная */
  function drop(el, i) {
    if (RM) return;
    el.classList.add('is-new');
    setTimeout(function () { el.classList.remove('is-new'); }, 30 + (i % 12) * 35);
  }

  /* прикол: гости начали раньше времени — первое нажатие откусывает, второе съедает */
  var eaten = 0;
  board.addEventListener('click', function (e) {
    var hit = e.target.closest('.tile__hit');
    if (!hit) return;
    var t = tiles[hit.dataset.i];
    if (!t || t.out || t.bites > 1) return;
    t.bites = (t.bites || 0) + 1;
    t.el.classList.add(t.bites === 1 ? 'is-bitten' : 'is-eaten');
    if (t.bites < 2) return;
    eaten++;
    var left = tiles.filter(function (x) { return !x.out && !(x.bites > 1); }).length;
    caption.textContent = left ? 'Гости начали раньше времени: съедено ' + eaten : 'Всё съели! Хорошо, что сет можно заказать ещё';
    if (!left) setTimeout(function () { renderBoard(calc()); }, 1600);
  });
  function removeLater(t) {
    setTimeout(function () {
      if (!t.out) return;
      t.el.remove();
      var i = tiles.indexOf(t);
      if (i > -1) tiles.length = i;  /* хвост за пределами нужного числа больше не нужен */
    }, RM ? 0 : 420);
  }

  /* ---------- управление ---------- */
  var inputs = $$('[data-guests]');
  function setGuests(n, from) {
    n = Math.max(MIN, Math.min(MAX, Math.round(+n) || MIN));
    state.guests = n;
    inputs.forEach(function (i) { if (i !== from) i.value = n; });
    $$('[data-quick] .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(+c.dataset.n === n)); });
    update();
  }
  inputs.forEach(function (input) {
    input.addEventListener('input', function () { if (input.value !== '' && +input.value >= MIN) setGuests(input.value, input); });
    input.addEventListener('change', function () { setGuests(input.value); });
  });
  $$('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () { setGuests(state.guests + +b.dataset.step); });
  });
  $$('[data-quick] .chip').forEach(function (c) { c.addEventListener('click', function () { setGuests(c.dataset.n); }); });

  /* тарифы обслуживания — из данных */
  $('[data-tariffs]').innerHTML = D.tariffs.map(function (t) {
    return '<label class="tariff"><input type="radio" name="tariff" value="' + t.id + '"' + (t.id === state.tariff ? ' checked' : '') + '>' +
      '<span><b>' + t.title + '</b><em>от ' + money(t.price) + '</em><small>от ' + t.grams + ' г на гостя · ' + t.includes + '</small></span></label>';
  }).join('');

  document.addEventListener('change', function (e) {
    var n = e.target.name;
    if (n === 'mode') {
      state.mode = e.target.value;
      $$('[data-for]').forEach(function (f) { f.hidden = f.dataset.for !== state.mode; });
    }
    if (n === 'occasion') state.occasion = e.target.value;
    if (n === 'tariff') state.tariff = e.target.value;
    if (n === 'mode' || n === 'occasion' || n === 'tariff') update();
  });

  function update() { var r = calc(); renderResult(r); renderBoard(r); }
  addEventListener('resize', function () { renderBoard(calc()); });

  $('[data-hero-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    setGuests($('#hero-guests').value);
    $('#table').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  });

  /* ---------- состав «Сета Премиум 21–25» ---------- */
  var S = D.premiumSet, tray = $('[data-tray]'), parts = $('[data-parts]');
  S.items.forEach(function (it, i) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.i = i;
    cell.dataset.name = it[0];
    cell.setAttribute('aria-label', it[0] + ', ' + it[1] + ' г, ' + money(it[2]));
    cell.style.gridArea = it[3];
    tray.append(cell);
    var li = document.createElement('li');
    li.innerHTML = '<button class="part" type="button" data-i="' + i + '">' + it[0] + '<span>' + it[1].toLocaleString('ru-RU') + ' г</span><span>' + money(it[2]) + '</span></button>';
    parts.append(li);
  });
  /* отсек плотно заполнен одной закуской: шаг раскладки один для всех отсеков, поэтому в большом их просто больше */
  function fillTray() {
    var step = innerWidth < 760 ? 46 : 62;
    $$('.cell', tray).forEach(function (cell) {
      var name = S.items[cell.dataset.i][3], w = cell.clientWidth, h = cell.clientHeight;
      var cols = Math.max(1, Math.round(w / step)), rows = Math.max(1, Math.round(h / step));
      var sx = w / cols, sy = h / rows, size = Math.min(sx, sy) * 1.75, html = '';
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var k = cell.dataset.i * 100 + r * cols + c;
        html += '<img class="piece" src="' + img(name) + '" alt="" decoding="async" style="left:' +
          ((c + .5) * sx - size / 2 + (rnd(k, 2) - .5) * sx * .15) / w * 100 + '%;top:' +
          ((r + .5) * sy - size / 2 + (rnd(k, 4) - .5) * sy * .15) / h * 100 + '%;width:' + size / w * 100 + '%;transform:rotate(' + (rnd(k, 6) * 20 - 10) + 'deg)">';
      }
      cell.innerHTML = html;
    });
  }
  fillTray();
  var trayW = tray.clientWidth;
  addEventListener('resize', function () { if (tray.clientWidth !== trayW) { trayW = tray.clientWidth; fillTray(); } });

  $('[data-sum]').innerHTML ='По отдельности <s>' + money(S.sum) + '</s>, в сете <b>' + money(S.price) + '</b>';

  var pinned = null;  /* закреплённая нажатием позиция; наведение и фокус только подсвечивают */
  function light(i) {
    tray.classList.toggle('is-active', i !== null);
    $$('.cell, .part').forEach(function (el) { el.classList.toggle('is-on', i !== null && el.dataset.i === String(i)); });
  }
  $$('.cell, .part').forEach(function (el) {
    el.addEventListener('mouseenter', function () { light(el.dataset.i); });
    el.addEventListener('focus', function () { light(el.dataset.i); });
    el.addEventListener('click', function () { pinned = pinned === el.dataset.i ? null : el.dataset.i; light(el.dataset.i); });
  });
  $('.inside__grid').addEventListener('mouseleave', function () { light(pinned); });
  $('.inside__grid').addEventListener('focusout', function (e) { if (!e.currentTarget.contains(e.relatedTarget)) light(pinned); });

  /* ---------- меню ---------- */
  $('[data-cats]').innerHTML = D.menu.map(function (c) {
    return '<li class="cat rv"><a href="' + SITE + c.url + '" target="_blank" rel="noopener">' +
      '<div class="cat__img"><img src="' + 'img/cat-' + c.id + '-720.webp' + '" alt="" width="720" height="900" loading="lazy"></div>' +
      '<h3>' + c.title + '</h3><p>' + c.count + ' позиций · наборы от ' + money(c.from) + '</p></a></li>';
  }).join('');

  /* фото разделов меню наклоняются за курсором — только мышь, без «уменьшить движение»; текст не наклоняем, чтобы не мылился */
  if (!RM && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.cat__img').forEach(function (el) {
      el.classList.add('tilt');
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--rx', ((.5 - y) * 9).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - .5) * 11).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- доставка: кольца — схема, точные пороги в таблице рядом ---------- */
  $('[data-zones]').innerHTML = D.zones.map(function (z) {
    return '<tr><td>' + z[0] + (z[1] ? '<small>' + z[1] + '</small>' : '') + '</td><td>' + money(z[2]) + '</td><td>' + money(z[3]) + '</td></tr>';
  }).join('');
  var rings = $('[data-rings]'), R = [56, 92, 122, 156, 190], ns = 'http://www.w3.org/2000/svg';
  R.slice().reverse().forEach(function (r, k) {
    var i = R.length - 1 - k, c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', 200); c.setAttribute('cy', 200); c.setAttribute('r', r);
    c.setAttribute('class', 'ring' + (i === 0 ? ' ring--mkad' : ''));
    rings.append(c);
  });
  /* подписи: в центре МКАД в две строки, в каждом кольце — одна строка «где · бесплатно от» */
  var label = function (text, y, cls) {
    var el = document.createElementNS(ns, 'text');
    el.setAttribute('x', 200); el.setAttribute('y', y); el.setAttribute('text-anchor', 'middle');
    if (cls) el.setAttribute('class', cls);
    el.textContent = text;
    rings.append(el);
  };
  label('МКАД', 194); label('бесплатно', 210, 'lbl'); label('от 3 500 ₽', 224, 'lbl');
  ['рядом · 7 000 ₽', 'до 15 км · 20 000 ₽', 'до 40 км · 30 000 ₽', 'до 70 км · 50 000 ₽'].forEach(function (t, i) {
    label(t, 200 - (R[i + 1] + R[i]) / 2 + 4, 'lbl');
  });

  /* ---------- 3D-кухня: Three.js грузится, только когда секция на экране; при экономии трафика — по кнопке ---------- */
  var kitchen = $('#kitchen'), startBtn = $('[data-start]');
  var loading = false;  /* запуск один, даже если кнопку и панель нажали подряд */
  var load3d = function () {
    if (loading) return;
    loading = true;
    startBtn.hidden = true;
    import('./kitchen.js').then(function (m) { m.start(kitchen); }, function () { $('[data-stage]').classList.add('is-fallback'); });
  };
  if (navigator.connection && navigator.connection.saveData) {
    startBtn.hidden = false;
    startBtn.addEventListener('click', load3d);
    $('.kitchen__panel').addEventListener('click', function once() { $('.kitchen__panel').removeEventListener('click', once); load3d(); });
  } else {
    var kio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { kio.disconnect(); load3d(); } }, { rootMargin: '0px 0px -20% 0px' });
    kio.observe($('[data-stage]'));
  }

  /* ---------- заявка: концепт ничего не отправляет ---------- */
  $('[data-callback]').addEventListener('submit', function (e) {
    e.preventDefault();
    $('[data-callback-msg]').textContent = 'Это концепт — заявка никуда не уходит. Заказать можно по телефону +7 (495) 120-21-50 или на canapeclub.ru.';
  });

  /* ---------- появление блоков и строка внизу на телефоне ---------- */
  if (!RM && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el) { io.observe(el); });
  } else $$('.rv').forEach(function (el) { el.classList.add('is-in'); });

  var dock = $('[data-dock]'), seen = { hero: true, calc: false, contact: false };
  var dockIo = new IntersectionObserver(function (es) {
    es.forEach(function (e) { seen[e.target.dataset.watch] = e.isIntersecting; });
    dock.hidden = seen.hero || seen.calc || seen.contact;
  });
  [['hero', '.hero'], ['calc', '#result'], ['contact', '#contact']].forEach(function (w) { var el = $(w[1]); el.dataset.watch = w[0]; dockIo.observe(el); });

  setGuests(25);
})();
