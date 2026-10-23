/* Закладки, история, подборки. */

function tile(title, sub, img, onSelect) {
    var h = U.h;
    var el = h('div.tile.f', [
        h('div.tile-bg', img ? UI.lazyImg(img, 'tile-img') : null),
        h('div.tile-text', [h('div.tile-title', title), sub ? h('div.tile-sub', sub) : null])
    ]);
    el._select = onSelect;
    return el;
}

Screens.bookmarks = function () {
    return Screens.grid({
        title: 'Закладки',
        hero: false,
        noPaging: true,
        reloadOnResume: true,
        emptyText: 'Папок с закладками пока нет. Создайте их на сайте kino.pub',
        load: function () { return API.bookmarks(); },
        make: function (f) {
            return tile(f.title, (f.count || 0) + ' ' + U.plural(f.count || 0, 'элемент', 'элемента', 'элементов'), null, function () {
                Router.push(Screens.grid({
                    title: f.title,
                    ageFilter: false,
                    reloadOnResume: false,
                    load: function (page) { return API.bookmarkFolder(f.id, page); }
                }));
            });
        }
    });
};

Screens.history = function () {
    var seen = {};
    return Screens.grid({
        title: 'История просмотров',
        ageFilter: false,
        reloadOnResume: false,
        emptyText: 'История пуста',
        load: function (page) {
            if (page === 1) seen = {};
            return API.history(page).then(function (r) {
                var items = [];
                (r.history || []).forEach(function (h) {
                    if (!h.item || seen[h.item.id]) return;
                    seen[h.item.id] = true;
                    var it = Object.assign({}, h.item);
                    var m = h.media || {};
                    var sub = '';
                    if (m.snumber) sub = 'S' + m.snumber + 'E' + m.number;
                    else if (m.number && U.isSerialType(it.type)) sub = 'Серия ' + m.number;
                    if (h.time) sub += (sub ? ' · ' : '') + U.fmtTime(h.time);
                    it._sub = sub;
                    it._progress = m.duration && h.time ? Math.min(1, h.time / m.duration) : null;
                    items.push(it);
                });
                return { items: items, pagination: r.pagination };
            });
        },
        make: function (it) { return UI.card(it, { sub: it._sub || String(it.year || ''), progress: it._progress }); }
    });
};

Screens.collections = function () {
    return Screens.grid({
        title: 'Подборки',
        hero: false,
        load: function (page) { return API.collections(page, 'watchers-'); },
        make: function (c) {
            return tile(c.title, c.views ? c.views + ' просмотров' : '', U.poster(c, 'medium'), function () {
                Router.push(Screens.grid({
                    title: c.title,
                    noPaging: true,
                    load: function () { return API.collection(c.id); }
                }));
            });
        }
    });
};
