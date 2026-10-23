/* Сезоны и серии. Слева список сезонов, справа серии выбранного сезона. */
Screens.episodes = function (item, list, onChanged) {
    'use strict';
    var h = U.h;
    var seasons = [];
    list.forEach(function (e, i) {
        var key = e.season || 0;
        var s = seasons[seasons.length - 1];
        if (!s || s.key !== key) { s = { key: key, eps: [] }; seasons.push(s); }
        s.eps.push(i);
    });
    var hasSeasons = seasons.length > 1 || seasons[0].key;

    var seasonsEl = h('div');
    var epsEl = h('div');
    var seasonsBox = h('div.ep-seasons.grp.sy', { 'data-align': 'auto', 'data-pad': 20 }, seasonsEl);
    var epsBox = h('div.ep-list.sy', { 'data-align': 'auto', 'data-pad': 30 }, epsEl);
    var headSub = h('div.ep-head-sub');
    var el = h('div.screen.episodes-screen', [
        h('div.ep-head', [h('div.ep-head-title', U.splitTitle(item.title)[0]), headSub]),
        h('div.ep-body', [hasSeasons ? seasonsBox : null, epsBox])
    ]);
    var current = -1, seasonBtns = [];

    function seasonStats(s) {
        var watched = 0;
        s.eps.forEach(function (i) { if (list[i].status === 1) watched++; });
        return watched;
    }

    seasons.forEach(function (s, si) {
        var w = seasonStats(s);
        var b = h('div.season-btn.f', [
            h('div.season-name', s.key ? 'Сезон ' + s.key : 'Видео'),
            h('div.season-sub', w + ' из ' + s.eps.length)
        ]);
        b._select = function () { showSeason(si, true); };
        seasonBtns.push(b);
        seasonsEl.appendChild(b);
    });

    function epRow(i) {
        var e = list[i];
        var progress = e.status === 1 ? 1 : (e.duration && e.time ? Math.min(1, e.time / e.duration) : 0);
        var main = h('div.ep.f', [
            h('div.ep-thumb', [
                UI.lazyImg(e.thumbnail, 'thumb'),
                h('div.ep-num', String(e.video)),
                progress ? h('div.card-progress', h('i', { style: { width: Math.round(progress * 100) + '%' } })) : null
            ]),
            h('div.ep-info', [
                h('div.ep-title', (e.season ? 'Серия ' + e.video : 'Часть ' + e.video) + (e.epTitle ? ' · ' + U.splitTitle(e.epTitle)[0] : '')),
                h('div.ep-meta', [
                    e.duration ? U.fmtDuration(e.duration) : '',
                    e.status === 0 && e.time ? '  ·  остановились на ' + U.fmtTime(e.time) : ''
                ].join(''))
            ]),
            h('div.ep-state' + (e.status === 1 ? '.done' : ''), e.status === 1 ? UI.icon('check') : null)
        ]);
        main._select = function () { ItemUtil.play(item, list, i, function () { if (onChanged) onChanged(); rerender(); }); };
        var mark = h('div.ep-mark.f', e.status === 1 ? 'Не смотрел' : 'Просмотрено');
        mark._select = function () {
            UI.busy(API.toggleWatched(item.id, e.video, e.season)).then(function (r) {
                e.status = r.watched ? 1 : -1;
                e.time = 0;
                rerender(true);
                if (onChanged) onChanged();
            });
        };
        var rowEl = h('div.ep-row', [main, mark]);
        rowEl._main = main;
        return rowEl;
    }

    function showSeason(si, focusFirst, keepScroll) {
        current = si;
        seasonBtns.forEach(function (b, j) { b.classList.toggle('active', j === si); });
        U.clear(epsEl);
        if (!keepScroll) Nav.resetScroll(epsBox);
        var rows = seasons[si].eps.map(epRow);
        rows.forEach(function (r) { epsEl.appendChild(r); });
        var s = seasons[si];
        headSub.textContent = (s.key ? 'Сезон ' + s.key + '  ·  ' : '') + s.eps.length + ' ' + U.plural(s.eps.length, 'серия', 'серии', 'серий');
        if (focusFirst) {
            var target = rows[0];
            for (var k = 0; k < s.eps.length; k++) if (list[s.eps[k]].status !== 1) { target = rows[k]; break; }
            if (target) Nav.focus(target._main);
        }
    }

    function rerender(keepFocus) {
        var cur = Nav.current();
        var idx = keepFocus && cur ? Array.prototype.indexOf.call(epsEl.querySelectorAll('.f'), cur) : -1;
        seasons.forEach(function (s, si) {
            var sub = seasonBtns[si].querySelector('.season-sub');
            sub.textContent = seasonStats(s) + ' из ' + s.eps.length;
        });
        showSeason(current, false, true);
        var all = epsEl.querySelectorAll('.f');
        if (idx >= 0 && all[idx]) Nav.focus(all[idx]);
    }

    // Открываем сезон с серией для продолжения
    var resume = ItemUtil.resumeIndex(list);
    var startSeason = 0;
    seasons.forEach(function (s, si) { if (s.eps.indexOf(resume) >= 0) startSeason = si; });
    showSeason(startSeason, false);

    // Фокус на сезоне сразу переключает список серий
    seasonsEl.addEventListener('navfocus', function (e) {
        var si = seasonBtns.indexOf(e.detail);
        if (si >= 0 && si !== current) showSeason(si, false);
    });

    return {
        el: el,
        focusTarget: function () {
            var rows = epsEl.children;
            var s = seasons[current].eps;
            var k = s.indexOf(resume);
            return rows[k >= 0 ? k : 0] ? rows[k >= 0 ? k : 0]._main : Nav.first(el);
        }
    };
};
