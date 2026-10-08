/* CHINGATE — страница товара: галерея, панель покупки, описание, нижняя кнопка на телефоне */
(function () {
  'use strict';
  var CG = window.CG, $ = CG.$;

  CG.ready.then(function () {
    var q = new URLSearchParams(location.search);
    var model = CG.model(q.get('m')) || CG.model('x-ray-puffer-jacket');
    var color = model.colors[+q.get('c')] || model.colors.filter(CG.hasStock)[0] || model.colors[0];
    document.title = model.name + ' — ' + CG.rub(CG.price(color)) + ' | CHINGATE';
    $('[data-name]').textContent = model.name;
    $('[data-bar-name]').textContent = model.name;

    /* факты из описания на их сайте; строки о сроках — уже в панели покупки */
    var facts = $('[data-facts]');
    model.facts.filter(function (f) { return !/отправк|отсч[её]т|срок|рост модели|предзаказ/i.test(f); }).forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f;
      facts.append(li);
    });
    if (!facts.children.length) $('.pdp__sub').hidden = true;

    var gallery = $('[data-gallery]');
    var panel = CG.buy($('[data-buy]'), model, color, function (c) {
      gallery.innerHTML = '';
      c.images.map(CG.img).filter(Boolean).forEach(function (src, i) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = i ? '' : model.name + ', цвет ' + c.name;
        img.width = 1100;
        img.height = 1100;
        if (i) { img.loading = 'lazy'; img.decoding = 'async'; }
        gallery.append(img);
      });
      gallery.scrollLeft = 0;
      $('[data-bar-price]').textContent = CG.rub(CG.price(c));
      history.replaceState(null, '', '?m=' + model.key + '&c=' + model.colors.indexOf(c));
    });
    $('[data-buy]').addEventListener('size', function (e) {
      $('[data-bar-price]').textContent = CG.rub(e.detail.priceRub);
      $('[data-bar-add]').textContent = 'Добавить в корзину';
    });

    /* нижняя кнопка: только на телефоне и только когда выбор размера и основная кнопка ушли из вида */
    var bar = $('[data-bar]'), group = $('[data-size-group]'), mainAdd = $('[data-add]'), seen = new Set();
    var phone = matchMedia('(max-width: 899px)');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      bar.hidden = !phone.matches || seen.size > 0;
    });
    io.observe(group);
    io.observe(mainAdd);
    $('[data-bar-add]').addEventListener('click', function () {
      if (!panel.size) { CG.scrollTo(group); return; }
      panel.add();
    });
  });
})();
