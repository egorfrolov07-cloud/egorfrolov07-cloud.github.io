/* CHINGATE — общее для всех страниц: данные каталога, корзина, шапка, плавная прокрутка.
   Каталог — снимок публичных данных chingate.store (собран tools/chingate-catalog.mjs, Codex). */
(function () {
  'use strict';
  var CG = window.CG = {};
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  CG.RM = RM;
  CG.$ = function (s, c) { return (c || document).querySelector(s); };
  CG.$$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ---------- данные ---------- */
  CG.ready = Promise.all([
    fetch('data/catalog.json').then(function (r) { return r.json(); }),
    fetch('data/images.json').then(function (r) { return r.json(); }),
  ]).then(function (res) {
    CG.models = res[0].models;
    CG.images = res[1];
    return CG;
  });
  /* путь фото на их сайте → сжатая локальная копия */
  CG.img = function (path) { var m = CG.images.map[path]; return m ? m.src : ''; };
  CG.model = function (key) { return CG.models.filter(function (m) { return m.key === key; })[0]; };
  CG.rub = function (n) { return n.toLocaleString('ru-RU') + ' ₽'; };
  CG.price = function (color) {
    var p = color.sizes.map(function (s) { return s.priceRub; }).filter(Boolean);
    return p.length ? Math.min.apply(null, p) : 0;
  };
  CG.hasStock = function (color) { return color.preorder.enabled || color.sizes.some(function (s) { return s.available > 0; }); };

  /* цвет кружка по названию цвета из каталога */
  var SWATCH = {
    'черный': '#111', 'белый': '#F4F4F1', 'бежевый': '#D9CBB2', 'зеленый': '#5C6440', 'серый': '#A3A6A1',
    'синий': '#1F2F6B', 'бордовый': '#5E1B26', 'скай блу': '#AFC8E6', 'серо-зеленый': '#7C8471',
    'голубой': '#9DB7D6', 'темно-серый': '#4A4D4A', 'светло-серый': '#C9CBC7', 'коричневый': '#5A3E2B',
    'черно-бежевый': 'linear-gradient(135deg, #111 50%, #D9CBB2 50%)',
  };
  CG.swatch = function (name) { return SWATCH[name] || '#bbb'; };

  /* строка о сроке отправки для цвета: только то, что написано в карточке на их сайте */
  CG.shipping = function (model, color) {
    var t = shippingRaw(model, color);
    /* «ОТПРАВКА ЧЕРЕЗ 1-5 ДНЕЙ» → «Отправка через 1–5 дней» */
    if (t === t.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
    t = t.replace(/(\d)-(\d)/g, '$1–$2');
    return t && !/[.!]$/.test(t) ? t + '.' : t;
  };
  function shippingRaw(model, color) {
    if (color.preorder.enabled) return 'Предзаказ. ' + color.preorder.shippingText.replace(/\.?;\s*/g, '. ').replace(/\.$/, '') + '.';
    var own = model.facts.filter(function (f) { return f.indexOf(color.name + ':') === 0 && /отправк/i.test(f); });
    if (own.length) return own.map(function (f) { return f.slice(color.name.length + 1).trim(); }).join('. ').replace(/\.\./g, '.');
    var common = model.facts.filter(function (f) { return /^отправк/i.test(f); });
    return common.length ? common[0] : '';
  }
  /* «Рост модели М - 186 L» → «модель 186 см носит L» */
  CG.fit = function (model) {
    return model.facts.filter(function (f) { return /рост модели/i.test(f); }).map(function (f) {
      var m = f.match(/рост модели\s*[МЖ]\s*-\s*(\d+)\s*([A-Z]+)/i);
      return m ? 'модель ' + m[1] + ' см носит ' + m[2] : f;
    }).join(', ');
  };

  /* ---------- панель покупки: цвет, размер, цена, срок, кнопка. Общая для главной и страницы товара ----------
     onColor(color) — что поменять на странице при смене цвета (фото, ссылки) */
  CG.buy = function (root, model, color, onColor) {
    var colorsBox = $1('[data-colors]'), sizesBox = $1('[data-sizes]'), add = $1('[data-add]'), size = null;
    function $1(s) { return root.querySelector(s); }
    var fit = CG.fit(model);
    $1('[data-fit]').textContent = fit ? 'На фото ' + fit + '.' : '';
    model.colors.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--c', CG.swatch(c.name));
      b.setAttribute('aria-label', c.name);
      b.addEventListener('click', function () { pick(c); });
      colorsBox.append(b);
    });
    function pick(c) {
      color = c;
      size = null;
      CG.$$('.swatch', colorsBox).forEach(function (b, i) { b.setAttribute('aria-pressed', model.colors[i] === c); });
      $1('[data-color-name]').textContent = c.name;
      $1('[data-ship]').textContent = CG.shipping(model, c);
      $1('[data-price]').textContent = CG.rub(CG.price(c));
      add.textContent = 'Выберите размер';
      sizesBox.innerHTML = '';
      c.sizes.forEach(function (s) {
        var b = document.createElement('button');
        var label = s.size ? s.size.replace(/-предзаказ/i, '') : 'Один размер';
        var pre = /предзаказ/i.test(s.size || '') || (c.preorder.enabled && !s.available);
        b.type = 'button';
        b.className = 'size';
        b.innerHTML = label + (pre ? '<small>предзаказ</small>' : '');
        b.disabled = !s.available && !pre;
        b.setAttribute('aria-pressed', 'false');
        if (b.disabled) b.setAttribute('aria-label', label + ', нет в наличии');
        b.addEventListener('click', function () {
          size = s;
          CG.$$('.size', sizesBox).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
          $1('[data-price]').textContent = CG.rub(s.priceRub);
          /* у чёрного X-RAY XL — предзаказ со своим сроком: показываем срок именно этого размера */
          var weeks = (CG.shipping(model, c).match(/[^.]*предзаказ[^.]*недел[^.]*/i) || [])[0];
          var inStock = CG.shipping(model, c).split(/\.\s*/).filter(function (x) { return x && !/предзаказ/i.test(x); }).join('. ');
          $1('[data-ship]').textContent = c.preorder.enabled || !weeks ? CG.shipping(model, c)
            : pre ? 'Размер ' + label + ' — по предзаказу. ' + weeks.trim() + '.' : inStock + '.';
          add.textContent = 'Добавить в корзину';
          root.dispatchEvent(new CustomEvent('size', { detail: s }));
        });
        sizesBox.append(b);
      });
      if (c.sizes.length === 1 && !sizesBox.firstChild.disabled) sizesBox.firstChild.click();
      if (onColor) onColor(c);
    }
    add.addEventListener('click', function () { panel.add(); });
    var panel = {
      get size() { return size; },
      get color() { return color; },
      add: function () {
        if (!size) {
          var first = sizesBox.querySelector('.size:not(:disabled)');
          if (first) first.focus();
          CG.toast('Сначала выберите размер');
          return false;
        }
        CG.add({ variantId: size.variantId, name: model.name, color: color.name, size: size.size ? size.size.replace(/-предзаказ/i, '') : 'один размер', price: size.priceRub, img: CG.img(color.images[0]) });
        return true;
      },
    };
    pick(color);
    return panel;
  };

  /* ---------- корзина: показывает, как это работает; хранится только в этом браузере ---------- */
  var KEY = 'cg-concept-cart';
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* приватный режим — корзина живёт до перезагрузки */ } }

  var drawer = CG.$('[data-drawer]'), list = CG.$('[data-cart-list]'), lastFocus = null;
  function render() {
    var n = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    CG.$$('[data-cart-count]').forEach(function (el) { el.textContent = n; });
    CG.$('[data-cart-total]').textContent = CG.rub(cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
    list.innerHTML = cart.length ? '' : '<li class="drawer__empty">Здесь пока пусто. Выберите размер и добавьте вещь.</li>';
    cart.forEach(function (i, k) {
      var li = document.createElement('li');
      li.className = 'line';
      li.innerHTML = '<img src="' + i.img + '" alt="" width="72" height="90"><div><p class="line__name"></p><p class="line__meta"></p></div><button class="line__remove" type="button">Убрать</button>';
      li.querySelector('.line__name').textContent = i.name;
      li.querySelector('.line__meta').textContent = i.color + ', ' + i.size + (i.qty > 1 ? ', ' + i.qty + ' шт.' : '') + ' · ' + CG.rub(i.price * i.qty);
      li.querySelector('button').addEventListener('click', function () { cart.splice(k, 1); save(); render(); });
      list.append(li);
    });
  }
  CG.add = function (item) {
    var same = cart.filter(function (i) { return i.variantId === item.variantId; })[0];
    if (same) same.qty++; else cart.push(Object.assign({ qty: 1 }, item));
    save(); render();
    CG.toast('Добавили в корзину: ' + item.name + ', ' + item.size);
  };
  /* пока открыт диалог (корзина или выбор размера), страница под ним недоступна с клавиатуры и для экранного диктора */
  function behind(on, keep) { keep = keep || drawer; CG.$$('body > *').forEach(function (el) { if (el !== keep && el.tagName !== 'SCRIPT') el.inert = on; }); }
  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    behind(true);
    requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    if (CG.lenis) CG.lenis.stop();
    CG.$('.drawer__close', drawer).focus();
  }
  function close() {
    behind(false);
    drawer.classList.remove('is-open');
    drawer.classList.add('is-closing');
    setTimeout(function () { drawer.hidden = true; drawer.classList.remove('is-closing'); }, RM ? 0 : 260);
    if (CG.lenis) CG.lenis.start();
    if (lastFocus) lastFocus.focus();
  }
  CG.$$('[data-cart-open]').forEach(function (b) { b.addEventListener('click', open); });
  CG.$$('[data-cart-close]').forEach(function (b) { b.addEventListener('click', close); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
  render();

  /* ---------- быстрый выбор размера из каталога: снизу на телефоне, по центру на компьютере ---------- */
  var sheet = CG.$('[data-sheet]'), sheetFrom = null;
  CG.quick = function (model, color, opener) {
    sheetFrom = opener;
    CG.$('[data-sheet-title]').textContent = model.name;
    CG.$('[data-sheet-meta]').textContent = color.name + ' · ' + CG.rub(CG.price(color)) + (CG.shipping(model, color) ? '. ' + CG.shipping(model, color) : '');
    var box = CG.$('[data-sheet-sizes]');
    box.innerHTML = '';
    color.sizes.forEach(function (s) {
      var label = s.size ? s.size.replace(/-предзаказ/i, '') : 'Один размер';
      var pre = /предзаказ/i.test(s.size || '') || (color.preorder.enabled && !s.available);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'size';
      b.innerHTML = label + (pre ? '<small>предзаказ</small>' : '');
      b.disabled = !s.available && !pre;
      b.addEventListener('click', function () {
        CG.add({ variantId: s.variantId, name: model.name, color: color.name, size: s.size ? label : 'один размер', price: s.priceRub, img: CG.img(color.images[0]) });
        closeSheet();
      });
      box.append(b);
    });
    sheet.hidden = false;
    behind(true, sheet);
    if (CG.lenis) CG.lenis.stop();
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
    (box.querySelector('.size:not(:disabled)') || CG.$('[data-sheet-close]')).focus();
  };
  function closeSheet() {
    sheet.classList.remove('is-open');
    behind(false, sheet);
    if (CG.lenis) CG.lenis.start();
    setTimeout(function () { sheet.hidden = true; }, RM ? 0 : 220);
    if (sheetFrom) sheetFrom.focus();
  }
  if (sheet) {
    CG.$$('[data-sheet-close]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  }

  var toast = CG.$('[data-toast]'), toastTimer;
  CG.toast = function (text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2400);
  };

  /* ---------- плавная прокрутка и якоря ---------- */
  if (window.Lenis && !RM) {
    CG.lenis = new Lenis({ lerp: 0.1 });
    (function raf(t) { CG.lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  CG.scrollTo = function (target) {
    /* отступ на высоту закреплённой шапки, чтобы она не закрывала начало раздела */
    if (CG.lenis) CG.lenis.scrollTo(target, { offset: -64, duration: 1.1 });
    else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  };
  CG.$$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = CG.$(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      CG.scrollTo(t);
    });
  });
})();
