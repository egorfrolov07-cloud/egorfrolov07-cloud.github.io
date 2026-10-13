/* Данные Canape Club — снимок с canapeclub.ru на 12.10.2026: сеты, тарифы, разделы, доставка.
   Цены и веса — их, ничего не придумано. Сырые выгрузки — в data/ (на сайт не выкладываются). */
window.CC_DATA = {
  date: '12.10.2026',

  /* готовые сеты по поводам: [от, до гостей, цена ₽, вес кг, штук, адрес на их сайте] */
  sets: {
    office: { title: 'Сет для переговоров', items: [
      [5, 10, 15190, 2.79, 68, '/catering/set-dlea-peregovorov-5-10-person/'],
      [11, 15, 19190, 3.99, 85, '/catering/sjet-dlja-peregovorov-11-15-person/'],
      [16, 20, 21590, 4.58, 113, '/catering/sjet-dlja-peregovorov-16-20-person/'],
      [21, 25, 26190, 6.07, 128, '/catering/sjet-dlja-peregovorov-21-25-person/'],
      [26, 30, 29990, 7.32, 178, '/catering/sjet-dlja-peregovorov-26-30-person/'],
    ] },
    birthday: { title: 'День рождения', items: [
      [5, 10, 12490, 2.58, 97, '/buffet-sets/den-rozhdenija-na-5-10-person/'],
      [11, 15, 16490, 3.38, 138, '/buffet-sets/den-rozhdenija-na-11-15-person/'],
      [16, 20, 24990, 4.6, 194, '/catering/den-rozhdenija-na-16-20-person/'],
      [21, 25, 31890, 6.27, 231, '/catering/den-rozhdenija-na-21-25-person/'],
      [26, 30, 40590, 8.21, 329, '/catering/den-rozhdenija-na-26-30-person/'],
    ] },
    premium: { title: 'Сет Премиум', items: [
      [5, 10, 12990, 2, 65, '/buffet-sets/ready-made-kits/set-premium-5-10-person/'],
      [11, 15, 15990, 2.95, 86, '/buffet-sets/ready-made-kits/set-premium-11-15-person/'],
      [16, 20, 22090, 4.35, 166, '/buffet-sets/ready-made-kits/set-premium-16-20-person/'],
      [21, 25, 31890, 5.7, 276, '/buffet-sets/ready-made-kits/set-premium-21-25-person/'],
      [26, 30, 37390, 6.26, 316, '/buffet-sets/ready-made-kits/set-premium-26-30-person/'],
    ] },
    wedding: { title: 'Свадебный фуршет', items: [
      [5, 10, 9290, 2.31, 65, '/catering/svadebnij-5-10-person/'],
      [11, 15, 12890, 3.03, 106, '/buffet-sets/svadebnij-11-15-person/'],
      [16, 20, 19590, 4.32, 166, '/catering/svadebnij-16-20-person/'],
      [21, 25, 22990, 5.04, 206, '/catering/svadebnij-21-25-person/'],
      [26, 30, 29190, 6.83, 310, '/catering/svadebnij-26-30-person/'],
    ] },
    coffee: { title: 'Кофе-брейк', items: [
      [5, 10, 10890, 2.42, 71, '/catering/kofe-pauza-na-5-10-person/'],
      [11, 15, 13690, 2.98, 93, '/catering/kofe-pauza-na-11-15-person/'],
      [16, 20, 17590, 4.26, 108, '/catering/kofe-pauza-na-16-20-person/'],
      [21, 25, 25890, 5.63, 145, '/catering/kofe-pauza-na-21-25-person/'],
      [26, 30, 30290, 7.13, 160, '/catering/kofe-pauza-na-26-30-person/'],
    ] },
  },

  /* кейтеринг с обслуживанием: цена «от» на гостя и норма еды — со страницы «Кейтеринг» */
  tariffs: [
    { id: 'coffee', title: 'Лёгкий кофе-брейк', price: 1500, grams: 250, includes: 'закуски, выпечка, десерты, безалкогольные напитки, одноразовая посуда, официант' },
    { id: 'standard', title: 'Фуршет «Стандарт»', price: 2100, grams: 450, includes: 'холодные и горячие закуски, безалкогольные напитки, стекло и фарфор, фуршетные столы, официанты' },
    { id: 'premium', title: 'Фуршет «Премиум»', price: 3500, grams: 600, includes: 'закуски и нарезки, горячие закуски, выпечка, десерты, напитки, стекло и фарфор, сервировка, официанты, комплименты от шефа' },
    { id: 'vip', title: 'Фуршет «ВИП»', price: 6000, grams: 800, includes: 'закуски и нарезки, горячие блюда, напитки, стекло и фарфор, сервировка, официанты, комплименты от шефа, анимационные станции' },
  ],

  /* «Сет Премиум 21–25 персон»: состав со страницы товара — [название, вес г, цена ₽, кадр] */
  premiumSet: {
    price: 31890, sum: 32620, weight: 5.7, pieces: 276,
    url: '/buffet-sets/ready-made-kits/set-premium-21-25-person/',
    items: [
      ['Сет брускетт №9 Премиум', 490, 3690, 'bruschetta'],
      ['Ассорти тарталеток к вину', 545, 2990, 'tartlet'],
      ['Канапе Антипасто', 450, 2890, 'antipasto'],
      ['Рулетики Коктейль', 1000, 3190, 'roll'],
      ['Коллекция сырных канапе', 1050, 5990, 'cheese'],
      ['Канапе с венским цветком', 800, 3990, 'salmon'],
      ['Набор верринов №23 Средиземноморский', 960, 6790, 'verrine'],
      ['Коллекция макаронс «Градиент»', 400, 3090, 'macaron'],
    ],
  },

  /* восемь главных разделов: число позиций и самая низкая цена набора на всех страницах раздела */
  menu: [
    { id: 'canape', title: 'Канапе', count: 120, from: 1190, url: '/buffet-sets/canape/' },
    { id: 'tartlets', title: 'Тарталетки', count: 57, from: 490, url: '/buffet-sets/tartlets/' },
    { id: 'burgers', title: 'Мини-бургеры', count: 47, from: 1590, url: '/buffet-sets/burger/' },
    { id: 'bruschetta', title: 'Брускетты', count: 69, from: 1090, url: '/buffet-sets/brusketty/' },
    { id: 'rolls', title: 'Рулетики', count: 31, from: 1090, url: '/buffet-sets/ruletiki/' },
    { id: 'verrines', title: 'Веррины', count: 67, from: 1290, url: '/buffet-sets/verrini/' },
    { id: 'skewers', title: 'Мини-шашлычки', count: 28, from: 1390, url: '/buffet-sets/shashlik/mini-shashlychki/' },
    { id: 'desserts', title: 'Десерты', count: 157, from: 890, url: '/buffet-sets/dessert/' },
  ],

  /* зоны доставки: [название, примеры, бесплатно от ₽, иначе ₽] */
  zones: [
    ['Москва в пределах МКАД', '', 3500, 800],
    ['Ближайшее Подмосковье', 'Химки, Мытищи, Балашиха, Люберцы', 7000, 1100],
    ['До 15 км за МКАД', 'Красногорск, Видное, Коммунарка', 20000, 1500],
    ['До 40 км за МКАД', 'Зеленоград, Подольск, Домодедово', 30000, 2000],
    ['До 70 км за МКАД', 'Сергиев Посад, Чехов, Клин', 50000, 3500],
  ],
};
