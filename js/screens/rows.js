/* Экран с hero-блоком и горизонтальными рядами (Главная, «Я смотрю»). */
Screens.rows = function (cfg) {
    'use strict';
    var h = U.h;
    var hero = UI.hero();
    var list = h('div.rows-inner');
    var el = h('div.screen.rows-screen', [hero, h('div.rows.sy', { 'data-pad': 10 }, list)]);
    var focused = false, destroyed = false;

    el.addEventListener('navfocus', function (e) {
        var c = e.detail;
        if (c._item) hero.update(c._item);
        UI.preloadAround(c, 8);
    });

    // Фокусируем верхний ряд, но только когда все ряды выше него уже ответили
    // (ряды грузятся параллельно и приходят в произвольном порядке)
    function autoFocus(done, rowsEls) {
        if (focused || destroyed || Router.depth() || UI.hasModal()) return;
        for (var i = 0; i < done.length; i++) {
            if (!done[i]) return;
            if (rowsEls[i]) {
                focused = true;
                if (!el.contains(Nav.current())) Nav.focus(Nav.first(rowsEls[i]));
                return;
            }
        }
    }

    function load() {
        U.clear(list);
        focused = false;
        var slots = cfg.sections.map(function () { var s = h('div'); list.appendChild(s); return s; });
        var done = cfg.sections.map(function () { return false; });
        var rowsEls = [];
        var pending = cfg.sections.length, any = false;
        cfg.sections.forEach(function (sec, i) {
            sec.load().then(function (items) {
                return cfg.ageFilter === false || sec.ageFilter === false ? items : AgeRating.filter(items);
            }).then(function (items) {
                if (destroyed || !items || !items.length) return;
                any = true;
                var r = UI.row(sec.title, items, sec.opts || {});
                slots[i].replaceWith(r);
                rowsEls[i] = r;
            }).catch(function (e) {
                if (window.console) console.warn(sec.title, e);
            }).then(function () {
                done[i] = true;
                autoFocus(done, rowsEls);
                pending--;
                if (!pending && !any && !destroyed) list.appendChild(UI.empty(cfg.emptyText || 'Здесь пока пусто'));
            });
        });
    }

    load();

    return {
        el: el,
        reload: load,
        onResume: function () { if (cfg.reloadOnResume) load(); },
        focusTarget: function () { return Nav.first(list); },
        destroy: function () { destroyed = true; }
    };
};

// Вытаскиваем массив items из разных форматов ответов
function itemsOf(r) { return (r && (r.items || r.history)) || []; }

Screens.home = function () {
    function sc(kind, type, title) {
        return { title: title, load: function () { return API.shortcut(kind, type, 1, 24).then(itemsOf); } };
    }
    return Screens.rows({
        grabFocus: true,
        reloadOnResume: false,
        sections: [
            {
                title: 'Продолжить просмотр',
                ageFilter: false,
                load: function () {
                    return Promise.all([
                        API.watchingSerials(false).then(itemsOf).catch(function () { return []; }),
                        API.watchingMovies().then(itemsOf).catch(function () { return []; })
                    ]).then(function (r) {
                        var serials = r[0].filter(function (s) { return s.new > 0; });
                        return serials.concat(r[1]).slice(0, 30);
                    });
                },
                opts: {
                    make: function (it) {
                        return UI.card(it, { sub: it.new ? 'Новых серий: ' + it.new : (it.type === 'movie' ? 'Недосмотрен' : U.TYPE_NAMES[it.type]) });
                    }
                }
            },
            sc('popular', 'movie', 'Популярные фильмы'),
            sc('fresh', 'movie', 'Новые фильмы'),
            sc('hot', 'movie', 'Горячие фильмы'),
            sc('popular', 'serial', 'Популярные сериалы'),
            sc('fresh', 'serial', 'Новые сериалы'),
            sc('hot', 'serial', 'Горячие сериалы'),
            sc('fresh', 'concert', 'Новые концерты'),
            sc('fresh', '3D', 'Новое в 3D'),
            sc('fresh', 'documovie', 'Новые документальные фильмы'),
            sc('fresh', 'docuserial', 'Новые документальные сериалы'),
            sc('fresh', 'tvshow', 'Новые ТВ шоу')
        ]
    });
};

/* Дата последнего обновления сериала (= когда добавили серию). В watching/serials её нет,
   поэтому ищем сериал в каталоге по названию и берём updated_at. Кэшируем на 6 часов. */
var UpdatedAt = (function () {
    var TTL = 6 * 3600 * 1000;
    var cache = U.store.get('updatedAt', {});

    function lookup(it) {
        var c = cache[it.id];
        if (c && c.u && Date.now() - c.t < TTL) return Promise.resolve(c.u);
        // знаки вроде «?» и «¿» мешают поиску по названию
        var t = U.splitTitle(it.title).map(function (s) { return s.replace(/[?!¿¡«»"]/g, '').trim(); });
        function find(r) { return (itemsOf(r)).filter(function (x) { return x.id === it.id; })[0]; }
        return API.items({ type: it.type, title: t[0], perpage: 50 }).then(function (r) {
            // запасной путь: полнотекстовый поиск (по оригинальному названию, если есть)
            return find(r) || API.search(t[1] || t[0], { type: it.type }).then(find);
        }).then(function (m) {
            var u = m ? (m.updated_at || 0) : 0;
            cache[it.id] = { u: u, t: Date.now() };
            return u;
        }).catch(function () { return 0; });
    }

    // Сортирует по убыванию даты обновления; запросы по 3 параллельно
    function sort(items) {
        var dates = {}, i = 0;
        function worker() {
            if (i >= items.length) return Promise.resolve();
            var it = items[i++];
            return lookup(it).then(function (u) { dates[it.id] = u; return worker(); });
        }
        return Promise.all([worker(), worker(), worker()]).then(function () {
            U.store.set('updatedAt', cache);
            return items.slice().sort(function (a, b) { return (dates[b.id] || 0) - (dates[a.id] || 0); });
        });
    }

    return { sort: sort };
})();

/* «Я смотрю» — как на сайте: новые эпизоды сверху, по дате добавления серии на kino.pub */
Screens.watching = function () {
    var MODES = [
        { id: 'new', label: 'Новые эпизоды', empty: 'Новых эпизодов нет. Сериалы появятся здесь, когда выйдут новые серии' },
        { id: 'all', label: 'Все мои сериалы', empty: 'Вы пока не смотрите сериалы' },
        { id: 'movies', label: 'Недосмотренные фильмы', empty: 'Недосмотренных фильмов нет' }
    ];
    var mode = U.store.get('watchingMode', 'new');
    var newTotal = null, screen;

    function serialCard(it) {
        var sub = it.new ? 'Новых серий: ' + it.new : 'Просмотрено ' + (it.watched || 0) + ' из ' + (it.total || 0);
        return UI.card(it, { sub: sub, progress: it.total ? (it.watched || 0) / it.total : null });
    }

    function load() {
        var p;
        // «Буду смотреть» (subscribed=1) API уже отдаёт по дате добавления серии — ровно как сайт
        if (mode === 'new') {
            p = API.watchingSerials(true).then(itemsOf).then(function (items) {
                items = items.filter(function (s) { return s.new > 0; });
                newTotal = items.reduce(function (a, s) { return a + (s.new || 0); }, 0);
                return items;
            });
        } else if (mode === 'all') {
            p = API.watchingSerials(false).then(itemsOf).then(UpdatedAt.sort);
        } else {
            p = API.watchingMovies().then(itemsOf);
        }
        return p.then(function (items) {
            setTimeout(function () { if (screen) screen.updateFilters(); }, 0);
            return { items: items };
        });
    }

    screen = Screens.grid({
        title: 'Я смотрю',
        ageFilter: false,
        noPaging: true,
        reloadOnResume: true,
        emptyText: 'Здесь пока пусто',
        load: load,
        make: function (it) { return mode === 'movies' ? UI.card(it) : serialCard(it); },
        filters: MODES.map(function (m) {
            return {
                label: function () { return m.id === 'new' && newTotal ? m.label + ' · ' + newTotal : m.label; },
                active: function () { return mode === m.id; },
                select: function () {
                    if (mode === m.id) return false;
                    mode = m.id;
                    U.store.set('watchingMode', mode);
                    screen.setEmptyText(m.empty);
                    return true;
                }
            };
        })
    });
    screen.setEmptyText(MODES.filter(function (m) { return m.id === mode; })[0].empty);
    return screen;
};
