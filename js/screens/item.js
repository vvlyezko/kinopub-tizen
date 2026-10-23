/* Карточка фильма/сериала. */

var ItemUtil = {
    // Плоский плейлист из всех видео/серий
    playlist: function (item) {
        var out = [];
        var title = U.splitTitle(item.title)[0];
        if (item.seasons && item.seasons.length) {
            item.seasons.forEach(function (s) {
                (s.episodes || []).forEach(function (e) {
                    var w = e.watching || {};
                    out.push({
                        title: title,
                        subtitle: 'Сезон ' + s.number + ', серия ' + e.number + (e.title ? ' · ' + U.splitTitle(e.title)[0] : ''),
                        short: 'S' + s.number + 'E' + e.number,
                        season: s.number, video: e.number, mid: e.id,
                        files: e.files, subtitles: e.subtitles, audios: e.audios,
                        duration: e.duration, time: w.time || 0,
                        status: w.status != null ? w.status : (e.watched != null ? e.watched : -1),
                        thumbnail: e.thumbnail, epTitle: e.title
                    });
                });
            });
        } else {
            (item.videos || []).forEach(function (v, i) {
                var w = v.watching || {};
                var multi = item.videos.length > 1;
                out.push({
                    title: title,
                    subtitle: multi ? (v.title ? U.splitTitle(v.title)[0] : 'Часть ' + (v.number || i + 1)) : '',
                    short: multi ? 'Часть ' + (v.number || i + 1) : '',
                    video: v.number || i + 1, mid: v.id,
                    files: v.files, subtitles: v.subtitles, audios: v.audios,
                    duration: v.duration, time: w.time || 0,
                    status: w.status != null ? w.status : (v.watched != null ? v.watched : -1),
                    thumbnail: v.thumbnail, epTitle: v.title
                });
            });
        }
        return out;
    },

    // Индекс серии, с которой продолжить просмотр
    resumeIndex: function (list) {
        var last = -1;
        for (var i = 0; i < list.length; i++) if (list[i].status >= 0) last = i;
        if (last < 0) return 0;
        if (list[last].status === 0) return last;
        return Math.min(last + 1, list.length - 1);
    },

    play: function (item, list, index, onClose) {
        if (!list.length) { UI.toast('Видео пока недоступно'); return; }
        Player.open({ item: item, playlist: list, index: index, onClose: onClose });
    }
};

Screens.item = function (id, preview) {
    'use strict';
    var h = U.h;
    var item = preview || null, list = [], destroyed = false;

    var titleEl = h('div.item-title'), origEl = h('div.item-orig'), metaEl = h('div.item-meta');
    var chipsEl = h('div.item-chips'), plotEl = h('div.item-plot'), peopleEl = h('div.item-people');
    // «Смотреть» — отдельным рядом, остальные кнопки — рядом ниже
    var actionsMain = h('div.item-actions.item-actions-main.grp');
    var actions = h('div.item-actions.item-actions-more.grp');
    var posterBox = h('div.item-poster');   // постер колонкой на всю высоту экрана
    var castEl = h('div.item-cast');
    var extra = h('div.item-extra');
    var top = h('section.item-top.row', [
        h('div.item-info', [titleEl, origEl, metaEl, chipsEl, plotEl, peopleEl, actionsMain, actions])
    ]);
    var page = h('div.item-page.sy', { 'data-align': 'auto', 'data-pad': 60 }, h('div', [top, castEl, extra]));
    var el = h('div.screen.item-screen', [h('div.item-gradient'), posterBox, page]);

    // Состав: режиссёры и актёры; по OK — все фильмы с этим человеком
    function renderCast() {
        U.clear(castEl);
        function names(s) {
            return (s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        }
        var people = names(item.director).map(function (n) { return { name: n, role: 'Режиссёр', param: 'director' }; })
            .concat(names(item.cast).slice(0, 24).map(function (n) { return { name: n, role: 'Актёр', param: 'actor' }; }));
        if (!people.length) return;
        castEl.appendChild(UI.row('Состав', people, { make: personTile }));
    }

    function personTile(p) {
        var initials = p.name.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
        var tile = h('div.person.f', [
            h('div.person-avatar' + (p.param === 'director' ? '.director' : ''), initials),
            h('div.person-name', p.name),
            h('div.person-role', p.role)
        ]);
        tile._select = function () {
            Router.push(Screens.grid({
                title: p.role + ': ' + p.name,
                load: function (pg) {
                    var q = { page: pg, perpage: 42, sort: 'year-' };
                    q[p.param] = p.name;
                    return API.items(q);
                },
                emptyText: 'Фильмов с этим человеком не найдено'
            }));
        };
        return tile;
    }

    function renderInfo() {
        var t = U.splitTitle(item.title);
        titleEl.textContent = t[0];
        origEl.textContent = t[1] || '';
        var meta = [];
        if (item.year) meta.push(item.year);
        if (U.TYPE_NAMES[item.type]) meta.push(U.TYPE_NAMES[item.type]);
        if (item.countries && item.countries.length) meta.push(item.countries.map(function (c) { return c.title; }).join(', '));
        if (item.duration) {
            if (U.isSerialType(item.type) && item.duration.average) meta.push('~' + U.fmtDuration(item.duration.average) + ' серия');
            else if (item.duration.average) meta.push(U.fmtDuration(item.duration.average));
        }
        if (U.isSerialType(item.type) && item.finished != null) meta.push(item.finished ? 'Завершён' : 'Выходит');
        metaEl.textContent = meta.join('  ·  ');
        U.clear(chipsEl);
        UI.ratingChips(item).forEach(function (c) { chipsEl.appendChild(c); });
        (item.genres || []).forEach(function (g) { chipsEl.appendChild(h('span.chip.genre', g.title)); });
        plotEl.textContent = item.plot || '';
        U.clear(peopleEl);
        if (item.voice) peopleEl.appendChild(h('div', [h('b', 'Озвучка: '), item.voice]));
        U.clear(posterBox);
        posterBox.appendChild(UI.lazyImg(U.poster(item, 'big'), 'poster'));
        UI.Ambient.set(U.backdrop(item) || U.poster(item, 'big'), true);
        renderCast();
    }

    function renderActions() {
        // запоминаем, какая кнопка была в фокусе, чтобы вернуть его после перерисовки
        var all = [].slice.call(actionsMain.children).concat([].slice.call(actions.children));
        var keep = all.indexOf(Nav.current());
        U.clear(actionsMain);
        U.clear(actions);
        if (!list.length && !item.seasons && !item.videos) {
            actionsMain.appendChild(h('div.btn.ghost', 'Загрузка…'));
            return;
        }
        var idx = ItemUtil.resumeIndex(list);
        var ep = list[idx];
        var serial = list.length > 1;
        var label;
        if (!ep) label = 'Недоступно';
        else if (ep.status === 0 && ep.time > 30) label = 'Продолжить' + (serial ? ' ' + ep.short : '') + ' с ' + U.fmtTime(ep.time);
        else if (serial && idx > 0) label = 'Смотреть ' + ep.short;
        else label = 'Смотреть';
        actionsMain.appendChild(UI.button(label, function () { ItemUtil.play(item, list, idx, refresh); }, { icon: 'play', cls: 'primary' }));

        if (ep && ep.status === 0 && ep.time > 30) {
            actions.appendChild(UI.button('С начала', function () {
                var copy = list.slice();
                copy[idx] = Object.assign({}, ep, { time: 0 });
                ItemUtil.play(item, copy, idx, refresh);
            }, { icon: 'restart' }));
        }
        if (serial) {
            actions.appendChild(UI.button(item.seasons ? 'Сезоны и серии' : 'Все части', function () {
                Router.push(Screens.episodes(item, list, refresh));
            }, { icon: 'list' }));
        }
        if (item.trailer) {
            actions.appendChild(UI.button('Трейлер', playTrailer, { icon: 'trailer' }));
        }
        if (U.isSerialType(item.type)) {
            var inList = item.in_watchlist || item.subscribed;
            actions.appendChild(UI.button(inList ? 'Не буду смотреть' : 'Буду смотреть', function () {
                UI.busy(API.toggleWatchlist(item.id)).then(function (r) {
                    item.in_watchlist = item.subscribed = r.watching != null ? !!r.watching : !inList;
                    UI.toast(item.in_watchlist ? 'Добавлено в «Буду смотреть»' : 'Удалено из «Буду смотреть»');
                    renderActions();
                });
            }, { icon: inList ? 'starFill' : 'star' }));
        } else if (list.length === 1) {
            var watched = list[0].status === 1;
            actions.appendChild(UI.button(watched ? 'Просмотрено' : 'Не просмотрено', function () {
                UI.busy(API.toggleWatched(item.id, list[0].video)).then(function (r) {
                    list[0].status = r.watched ? 1 : -1;
                    list[0].time = 0;
                    renderActions();
                });
            }, { icon: watched ? 'check' : 'circle' }));
        }
        actions.appendChild(UI.button('Закладки', bookmarkMenu, { icon: 'bookmark' }));
        var now = [].slice.call(actionsMain.children).concat([].slice.call(actions.children));
        if (keep >= 0 && now[keep]) Nav.focus(now[keep]);
    }

    function playTrailer() {
        UI.busy(API.trailer(item.id)).then(function (r) {
            // Ответ: {trailer: [{id, url}]} (url — HLS) или старый формат с files[]
            var t = Array.isArray(r) ? r[0] : r;
            t = t && t.trailer ? t.trailer : t;
            if (Array.isArray(t)) t = t[0];
            var norm = [];
            if (t && t.files && t.files.length) {
                norm = t.files.map(function (f) { return { quality: (f.quality || f.height || '') + 'p', h: f.height, url: { http: f.url } }; });
            } else if (t && t.url && !/youtube\.com|youtu\.be/.test(t.url)) {
                var isHls = /\.m3u8/.test(t.url);
                norm = [{ quality: 'Авто', url: isHls ? { hls: t.url } : { http: t.url } }];
            }
            if (!norm.length) { UI.toast('Трейлер недоступен'); return; }
            Player.open({ item: item, playlist: [{ title: U.splitTitle(item.title)[0], subtitle: 'Трейлер', files: norm }], index: 0 });
        });
    }

    function bookmarkMenu() {
        UI.busy(Promise.all([API.bookmarks(), API.itemFolders(item.id)])).then(function (r) {
            var folders = r[0].items || [];
            var inFolders = (r[1].folders || []).map(function (f) { return f.id; });
            if (!folders.length) { UI.toast('Создайте папку закладок на сайте kino.pub'); return null; }
            return UI.menu('Добавить в закладки', folders.map(function (f) {
                var has = inFolders.indexOf(f.id) >= 0;
                return { label: f.title, sub: has ? 'Уже в этой папке — нажмите, чтобы убрать' : (f.count || 0) + ' шт.', value: f, selected: has };
            })).then(function (f) {
                if (!f) return;
                var had = inFolders.indexOf(f.id) >= 0;
                return UI.busy(API.toggleBookmark(item.id, f.id)).then(function () {
                    UI.toast(had ? 'Удалено из «' + f.title + '»' : 'Добавлено в «' + f.title + '»');
                });
            });
        }).catch(function () {});
    }

    function loadSimilar() {
        API.similar(id).then(function (r) {
            return AgeRating.filter(itemsOf(r));
        }).then(function (items) {
            if (destroyed || !items.length) return;
            extra.appendChild(UI.row('Похожие', items));
        }).catch(function () {});
    }

    function load(quiet) {
        var p = API.item(id).then(function (r) {
            if (destroyed) return;
            item = r.item || r;
            list = ItemUtil.playlist(item);
            renderInfo();
            renderActions();
            if (!quiet && !el.contains(Nav.current())) Nav.focus(Nav.first(actionsMain));
        });
        return quiet ? p.catch(function () {}) : UI.busy(p).catch(function () {});
    }

    // Вызывается после закрытия плеера: обновляем прогресс
    function refresh() { load(true); }

    if (item) { renderInfo(); renderActions(); }
    load(false).then(loadSimilar);

    el.addEventListener('navfocus', function (e) {
        if (e.detail._item) UI.preloadAround(e.detail, 8);
        if (top.contains(e.detail) && page._y) Nav.scrollTo(page, 0, 0);
    });

    return {
        el: el,
        focusTarget: function () { return Nav.first(actionsMain); },
        onResume: function () { if (item) UI.Ambient.set(U.backdrop(item) || U.poster(item, 'big'), true); },
        destroy: function () { destroyed = true; }
    };
};
