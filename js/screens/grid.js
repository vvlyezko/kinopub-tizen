/* Сетка с бесконечной подгрузкой: каталоги, закладки, история, подборки. */
Screens.grid = function (cfg) {
    'use strict';
    var h = U.h;
    var hero = cfg.hero === false ? null : UI.hero();
    var titleEl = h('h1.screen-title', cfg.title);
    var filtersEl = h('div.filters');
    var inner = h('div.grid-inner');
    var scroller = h('div.grid.sy', { 'data-align': 'auto', 'data-pad': 50 }, inner);
    var el = h('div.screen.grid-screen' + (hero ? '.with-hero' : ''), [
        hero, h('div.grid-head', [titleEl, filtersEl]), scroller
    ]);
    var page = 0, pages = 1, busy = false, destroyed = false, count = 0, gen = 0, emptyRun = 0;

    // Обновить подписи кнопок и подсветку активной вкладки (filter.active)
    function updateFilters() {
        (cfg.filters || []).forEach(function (x) {
            if (!x._btn) return;
            x._btn.setLabel(x.label());
            if (x.active) x._btn.classList.toggle('active', !!x.active());
        });
    }

    function renderFilters() {
        U.clear(filtersEl);
        (cfg.filters || []).forEach(function (f) {
            var b = UI.button(f.label(), function () {
                Promise.resolve(f.select()).then(function (changed) {
                    if (changed) reset();
                    updateFilters();
                });
            }, { cls: 'small', icon: f.icon });
            f._btn = b;
            filtersEl.appendChild(b);
        });
        updateFilters();
    }

    function make(it) {
        return cfg.make ? cfg.make(it) : UI.card(it);
    }

    function loadNext() {
        if (busy || page >= pages || destroyed) return;
        busy = true;
        var my = gen;
        var p = page + 1;
        if (!count) UI.loading(true);
        cfg.load(p).then(function (r) {
            if (my !== gen || destroyed) return null;
            var pg = r.pagination;
            var raw = r.items || [];
            pages = pg && pg.total ? pg.total : (raw.length ? p + (cfg.noPaging ? 0 : 1) : p);
            if (cfg.noPaging) pages = p;
            return (cfg.ageFilter === false ? Promise.resolve(raw) : AgeRating.filter(raw)).then(function (items) {
                if (my !== gen || destroyed) return;
                page = p;
                items.forEach(function (it) { inner.appendChild(make(it)); count++; });
                // возрастной фильтр мог отсеять всю страницу — догружаем следующую
                emptyRun = items.length ? 0 : emptyRun + 1;
                if (page === 1 && count && !el.contains(Nav.current()) && !Router.depth() && !UI.hasModal()) Nav.focus(Nav.first(inner));
            });
        }).catch(function (e) {
            if (my === gen) UI.toast('⚠ ' + e.message);
        }).then(function () {
            if (my !== gen) return;
            busy = false;
            if (p === 1 || !count) UI.loading(false);
            if (!count && emptyRun && page < pages && emptyRun < 8) { UI.loading(true); loadNext(); return; }
            if (count && emptyRun && page < pages && emptyRun < 8) { loadNext(); return; }
            if (!count && !inner.querySelector('.empty')) inner.appendChild(UI.empty(cfg.emptyText || 'Ничего не найдено'));
        });
    }

    function reset() {
        gen++;
        busy = false;
        page = 0; pages = 1; count = 0; emptyRun = 0;
        U.clear(inner);
        Nav.resetScroll(scroller);
        loadNext();
    }

    el.addEventListener('navfocus', function (e) {
        var c = e.detail;
        if (hero && c._item) hero.update(c._item);
        if (c.parentElement === inner) {
            var idx = Array.prototype.indexOf.call(inner.children, c);
            if (idx >= count - 16) loadNext();
        }
    });

    renderFilters();
    loadNext();

    return {
        el: el,
        reload: reset,
        updateFilters: updateFilters,
        setEmptyText: function (t) { cfg.emptyText = t; },
        // До загрузки null: фокус останется в меню, а первая страница сама заберёт его на карточку
        focusTarget: function () { return Nav.first(inner); },
        onResume: function () { if (cfg.reloadOnResume) reset(); },
        destroy: function () { destroyed = true; }
    };
};

/* ---------- Фильтры каталога ---------- */

var CatalogFilters = (function () {
    var POPULAR_COUNTRIES = ['США', 'Россия', 'Великобритания', 'Франция', 'Германия', 'Италия', 'Испания',
        'Канада', 'Япония', 'Южная Корея', 'Китай', 'Индия', 'Австралия', 'Украина', 'Швеция', 'Дания', 'Норвегия', 'Турция'];

    function yearPresets() {
        var y = new Date().getFullYear();
        return [
            { label: 'Любой', value: null },
            { label: String(y), value: String(y) },
            { label: (y - 1) + '–' + y, value: (y - 1) + '-' + y },
            { label: (y - 5) + '–' + y, value: (y - 5) + '-' + y },
            { label: '2010–2019', value: '2010-2019' },
            { label: '2000–2009', value: '2000-2009' },
            { label: '1990–1999', value: '1990-1999' },
            { label: '1980–1989', value: '1980-1989' },
            { label: 'До 1980', value: '1900-1979' }
        ];
    }

    var AGES = [
        { label: 'Без ограничений', value: null },
        { label: 'До 0+ — для самых маленьких', value: 0 },
        { label: 'До 6+', value: 6 },
        { label: 'До 12+', value: 12 },
        { label: 'До 16+', value: 16 },
        { label: 'До 18+ — только с известным рейтингом', value: 18 }
    ];

    function names(list) {
        if (!list || !list.length) return '';
        var t = list.map(function (x) { return x.title; });
        return t.length > 3 ? t.slice(0, 3).join(', ') + ' и ещё ' + (t.length - 3) : t.join(', ');
    }

    function ageLabel() {
        var max = Prefs.get('maxAge');
        if (max == null) return 'Без ограничений';
        return 'До ' + max + '+' + (Prefs.get('ageUnknown') === 'hide' ? ', без рейтинга скрыты' : '');
    }

    function count(s) {
        var n = 0;
        if (s.genres && s.genres.length) n++;
        if (s.countries && s.countries.length) n++;
        if (s.year) n++;
        if (s.q4k) n++;
        if (s.kp) n++;
        if (s.imdb) n++;
        if (s.finished != null) n++;
        if (Prefs.get('maxAge') != null) n++;
        return n;
    }

    // Параметры запроса /v1/items из состояния фильтров
    function params(type, s, page) {
        var p = { type: type, sort: s.sort, page: page, perpage: 42 };
        if (s.genres && s.genres.length) p.genre = s.genres.map(function (g) { return g.id; }).join(',');
        if (s.countries && s.countries.length) p.country = s.countries.map(function (c) { return c.id; }).join(',');
        if (s.year) p.year = s.year;
        if (s.q4k) p.quality = 4;
        var cond = [];
        if (s.kp) cond.push('kinopoisk_rating>=' + s.kp);
        if (s.imdb) cond.push('imdb_rating>=' + s.imdb);
        if (cond.length) p.conditions = cond;
        if (s.finished != null) p.finished = s.finished;
        return p;
    }

    function pickOne(title, options, current) {
        return UI.menu(title, options.map(function (o) {
            return { label: o.label, sub: o.sub, value: o, selected: o.value === current };
        })).then(function (o) { return o; });
    }

    function genreType(type) {
        if (type === 'concert') return 'music';
        if (type === 'documovie' || type === 'docuserial') return 'docu';
        if (type === '3D') return 'movie';
        return type;
    }

    // Панель фильтров: список параметров, каждый открывает своё меню. Promise<true, если что-то изменилось>
    function panel(type, s, save) {
        var changed = false, focusIdx = 0;
        var serial = U.isSerialType(type);

        function rows() {
            var r = [
                { key: 'done', label: 'Показать результаты', sub: count(s) ? 'Активных фильтров: ' + count(s) : 'Фильтры не заданы' },
                { key: 'genres', label: 'Жанры', sub: names(s.genres) || 'Любые' },
                { key: 'countries', label: 'Страны', sub: names(s.countries) || 'Любые' },
                { key: 'year', label: 'Год выпуска', sub: s.year ? s.year.replace('-', '–').replace('1900–1979', 'до 1980') : 'Любой' },
                { key: 'q4k', label: 'Качество', sub: s.q4k ? 'Только 4K' : 'Любое' },
                { key: 'kp', label: 'Рейтинг КиноПоиска', sub: s.kp ? 'от ' + s.kp : 'Любой' },
                { key: 'imdb', label: 'Рейтинг IMDb', sub: s.imdb ? 'от ' + s.imdb : 'Любой' }
            ];
            if (serial) r.push({ key: 'finished', label: 'Статус сериала', sub: s.finished === 1 ? 'Завершён' : s.finished === 0 ? 'Выходит' : 'Любой' });
            r.push({ key: 'age', label: 'Возрастное ограничение', sub: ageLabel() + ' · действует во всех разделах' });
            if (count(s)) r.push({ key: 'reset', label: 'Сбросить все фильтры' });
            return r;
        }

        function step() {
            var list = rows();
            return UI.menu('Фильтры', list.map(function (r) {
                return { label: r.label, sub: r.sub, value: r.key };
            }), { focus: focusIdx, wide: true }).then(function (key) {
                if (!key || key === 'done') return changed;
                focusIdx = list.map(function (r) { return r.key; }).indexOf(key);
                return edit(key).then(function (did) {
                    if (did) { changed = true; save(); }
                    return step();
                });
            });
        }

        function edit(key) {
            if (key === 'genres') {
                return UI.busy(API.genres(genreType(type))).then(function (r) {
                    var list = (r.items || r || []).slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
                    return multi('Жанры', list, s.genres);
                }).then(function (sel) { if (!sel) return false; s.genres = sel; return true; });
            }
            if (key === 'countries') {
                return UI.busy(API.countries()).then(function (r) {
                    var list = (r.items || r || []).slice().sort(function (a, b) {
                        var ia = POPULAR_COUNTRIES.indexOf(a.title), ib = POPULAR_COUNTRIES.indexOf(b.title);
                        if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
                        return a.title.localeCompare(b.title);
                    });
                    return multi('Страны', list, s.countries);
                }).then(function (sel) { if (!sel) return false; s.countries = sel; return true; });
            }
            if (key === 'year') {
                return pickOne('Год выпуска', yearPresets(), s.year || null).then(function (o) {
                    if (!o) return false; s.year = o.value; return true;
                });
            }
            if (key === 'q4k') {
                return pickOne('Качество', [{ label: 'Любое', value: false }, { label: 'Только 4K', value: true }], !!s.q4k).then(function (o) {
                    if (!o) return false; s.q4k = o.value; return true;
                });
            }
            if (key === 'kp' || key === 'imdb') {
                var opts = [{ label: 'Любой', value: null }, { label: 'от 6', value: 6 }, { label: 'от 7', value: 7 }, { label: 'от 7.5', value: 7.5 }, { label: 'от 8', value: 8 }];
                return pickOne(key === 'kp' ? 'Рейтинг КиноПоиска' : 'Рейтинг IMDb', opts, s[key] || null).then(function (o) {
                    if (!o) return false; s[key] = o.value; return true;
                });
            }
            if (key === 'finished') {
                return pickOne('Статус сериала', [{ label: 'Любой', value: null }, { label: 'Завершён', value: 1 }, { label: 'Выходит', value: 0 }], s.finished == null ? null : s.finished).then(function (o) {
                    if (!o) return false; s.finished = o.value; return true;
                });
            }
            if (key === 'age') return ageMenu();
            if (key === 'reset') {
                s.genres = []; s.countries = []; s.year = null; s.q4k = false; s.kp = null; s.imdb = null; s.finished = null;
                Prefs.set('maxAge', null);
                focusIdx = 0;
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        }

        return step();
    }

    // Глобальная настройка возраста (используется и в Настройках)
    function ageMenu() {
        return pickOne('Возрастное ограничение', AGES, Prefs.get('maxAge')).then(function (o) {
            if (!o) return false;
            Prefs.set('maxAge', o.value);
            if (o.value == null) return true;
            return pickOne('Фильмы без возрастного рейтинга', [
                { label: 'Показывать', sub: 'Рейтинг известен не для всех фильмов, особенно сериалов', value: 'show' },
                { label: 'Скрывать', sub: 'Строже: остаются только фильмы с подходящим рейтингом', value: 'hide' }
            ], Prefs.get('ageUnknown')).then(function (u) {
                if (u) Prefs.set('ageUnknown', u.value);
                return true;
            });
        });
    }

    // Множественный выбор: OK отмечает пункт, «Готово» сверху применяет
    function multi(title, list, selected) {
        var picked = {};
        (selected || []).forEach(function (x) { picked[x.id] = true; });
        return UI.multiMenu(title, list.map(function (x) {
            return { label: x.title, value: x, selected: !!picked[x.id] };
        })).then(function (vals) {
            if (!vals) return null;
            return vals.map(function (x) { return { id: x.id, title: x.title }; });
        });
    }

    return { params: params, panel: panel, count: count, ageMenu: ageMenu, ageLabel: ageLabel };
})();

/* Каталог по типу контента с сортировкой и фильтрами */
Screens.catalog = function (type, title) {
    var SORTS = [
        { id: 'updated-', label: 'Обновлённые' },
        { id: 'created-', label: 'Новые на сайте' },
        { id: 'views-', label: 'Популярные' },
        { id: 'watchers-', label: 'Смотрят сейчас' },
        { id: 'rating-', label: 'По рейтингу kinopub' },
        { id: 'kinopoisk_rating-', label: 'По рейтингу КП' },
        { id: 'imdb_rating-', label: 'По рейтингу IMDb' },
        { id: 'year-', label: 'По году (новые)' },
        { id: 'title', label: 'По названию' }
    ];
    var state = U.store.get('catalog.' + type, {});
    // миграция со старого формата (один жанр)
    if (state.genre && !state.genres) state.genres = [{ id: state.genre, title: state.genreTitle }];
    delete state.genre; delete state.genreTitle;
    state.sort = state.sort || 'updated-';
    state.genres = state.genres || [];
    state.countries = state.countries || [];

    function save() { U.store.set('catalog.' + type, state); }
    function sortLabel() {
        for (var i = 0; i < SORTS.length; i++) if (SORTS[i].id === state.sort) return SORTS[i].label;
        return 'Сортировка';
    }

    return Screens.grid({
        title: title,
        load: function (page) { return API.items(CatalogFilters.params(type, state, page)); },
        filters: [
            {
                icon: 'sort',
                label: sortLabel,
                select: function () {
                    return UI.menu('Сортировка', SORTS.map(function (s) {
                        return { label: s.label, value: s.id, selected: s.id === state.sort };
                    })).then(function (v) {
                        if (!v || v === state.sort) return false;
                        state.sort = v; save(); return true;
                    });
                }
            },
            {
                icon: 'tag',
                label: function () {
                    var n = CatalogFilters.count(state);
                    return n ? 'Фильтры · ' + n : 'Фильтры';
                },
                select: function () { return CatalogFilters.panel(type, state, save); }
            }
        ]
    });
};
