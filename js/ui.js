/* Компоненты интерфейса: карточки, ряды, hero-блок, фон, модальные меню, тосты. */
var UI = (function () {
    'use strict';
    var h = U.h;


    /* ---------- SVG-иконки (шрифты TV могут не содержать юникод-символов) ---------- */
    var ICONS = {
        search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
        home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
        eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
        history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
        tv: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/>',
        music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
        globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
        layers: '<path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
        mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
        cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
        play: '<path d="M7 4l13 8-13 8z" class="fill"/>',
        pause: '<rect x="6" y="4" width="4" height="16" rx="1" class="fill"/><rect x="14" y="4" width="4" height="16" rx="1" class="fill"/>',
        prev: '<path d="M19 5L9 12l10 7z" class="fill"/><rect x="5" y="5" width="2.5" height="14" rx="1" class="fill"/>',
        next: '<path d="M5 5l10 7-10 7z" class="fill"/><rect x="16.5" y="5" width="2.5" height="14" rx="1" class="fill"/>',
        rw: '<path d="M11 5L3 12l8 7zM21 5l-8 7 8 7z" class="fill"/>',
        ff: '<path d="M13 5l8 7-8 7zM3 5l8 7-8 7z" class="fill"/>',
        audio: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
        subs: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11h3M13 11h4M7 15h7M17 15h0"/>',
        quality: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9v6M7 12h4M11 9v6M14 9v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z"/>',
        star: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z"/>',
        starFill: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z" class="fill"/>',
        check: '<path d="M5 12l5 5 9-10"/>',
        circle: '<circle cx="12" cy="12" r="8"/>',
        list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.2" class="fill"/><circle cx="4" cy="12" r="1.2" class="fill"/><circle cx="4" cy="18" r="1.2" class="fill"/>',
        restart: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>',
        sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
        tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
        keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
        backspace: '<path d="M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-6 6M11 9l6 6"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        trailer: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" class="fill"/>'
    };

    function icon(name) {
        var span = h('span.ico');
        span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
        return span;
    }

    /* ---------- Ленивая загрузка картинок ---------- */
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) loadImg(e.target); });
    }, { rootMargin: '400px 800px' }) : null;

    function loadImg(img) {
        if (!img || img._loaded || !img._src) return;
        img._loaded = true;
        if (io) io.unobserve(img);
        img.onload = function () { img.classList.add('ok'); };
        img.onerror = function () { img.classList.add('err'); };
        img.src = img._src;
    }

    function lazyImg(src, cls) {
        var img = h('img' + (cls ? '.' + cls : ''), { alt: '' });
        img._src = src;
        if (!src) img.classList.add('err');
        else if (io) io.observe(img); else loadImg(img);
        return img;
    }

    // Подгружаем постеры у соседей сфокусированной карточки (внутри overflow:hidden IO их не видит)
    function preloadAround(el, count) {
        var n = el;
        for (var i = 0; i < (count || 8) && n; i++) {
            var img = n.querySelector && n.querySelector('img');
            if (img) loadImg(img);
            n = n.nextElementSibling;
        }
    }

    /* ---------- Фон (размытый постер в фокусе) ----------
       CSS filter: blur на весь экран слишком тяжёл для TV (браузер рисует процессором).
       Вместо этого уменьшаем постер на canvas до 16×9 и растягиваем: билинейное
       масштабирование видеокартой даёт то же мягкое размытие почти бесплатно. */
    var Ambient = (function () {
        var layers, idx = 0, curUrl = '', timer;
        var steps = [[160, 90], [48, 27], [16, 9]];
        var tmp = steps.map(function (s) {
            var c = document.createElement('canvas');
            c.width = s[0]; c.height = s[1];
            return c;
        });

        function draw(img, target) {
            // кадрируем как background-size: cover, немного сверху (лица обычно там)
            var iw = img.naturalWidth, ih = img.naturalHeight, ratio = 16 / 9;
            var sw = iw, sh = iw / ratio;
            if (sh > ih) { sh = ih; sw = ih * ratio; }
            var sx = (iw - sw) / 2, sy = (ih - sh) * 0.25;
            var prev = null;
            tmp.forEach(function (c, i) {
                var ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
                if (i === 0) ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
                else ctx.drawImage(prev, 0, 0, c.width, c.height);
                prev = c;
            });
            var tctx = target.getContext('2d');
            tctx.clearRect(0, 0, target.width, target.height);
            tctx.drawImage(prev, 0, 0, target.width, target.height);
        }

        function apply(url) {
            if (!layers) layers = document.querySelectorAll('#ambient .amb-layer');
            if (url === curUrl) return;
            curUrl = url;
            var img = new Image();
            img.onload = function () {
                if (curUrl !== url) return;
                var next = layers[idx ^ 1], prev = layers[idx];
                try { draw(img, next); } catch (e) { return; }
                next.classList.add('on');
                prev.classList.remove('on');
                idx ^= 1;
            };
            img.src = url;
        }
        return {
            set: function (url, immediate) {
                if (!url) return;
                clearTimeout(timer);
                if (immediate) apply(url);
                else timer = setTimeout(function () { apply(url); }, 350);
            }
        };
    })();

    /* ---------- Карточки ---------- */

    // Значок «16+» дорисовывается, когда придёт ответ Wikidata
    // Ступень шкалы для цвета: 0, 6, 12, 16, 18
    function ageStep(a) { return a >= 18 ? 18 : a >= 16 ? 16 : a >= 12 ? 12 : a >= 6 ? 6 : 0; }

    // Вызывает fn(возраст), как только рейтинг известен (сразу из кэша или после ответа Wikidata)
    function withAge(item, fn) {
        if (!item || !item.imdb) return;
        var c = AgeRating.cached(item);
        if (c !== undefined) { if (c != null) fn(c); }
        else AgeRating.get(item).then(function (a) { if (a != null) fn(a); });
    }

    function ageBadge(item, cls) {
        var el = h('span.' + cls + '.age-hidden');
        withAge(item, function (a) {
            el.textContent = AgeRating.label(a);
            el.classList.remove('age-hidden');
            el.classList.add('age-' + ageStep(a));
        });
        return el;
    }

    function badges(item) {
        var out = [];
        if (item.quality >= 2160 || item.quality === '4K') out.push(h('span.badge.b4k', '4K'));
        if (item.new) out.push(h('span.badge.bnew', '+' + item.new));
        if (item.imdb) out.push(ageBadge(item, 'badge.bage'));
        return out.length ? h('div.badges', out) : null;
    }

    function rating(item) {
        var r = U.num(item.kinopoisk_rating) || U.num(item.imdb_rating);
        return r ? h('div.card-rating', r) : null;
    }

    // Карточка постера. opts.onSelect, opts.progress (0..1), opts.sub — подпись
    function card(item, opts) {
        opts = opts || {};
        var t = U.splitTitle(item.title);
        var progress = opts.progress != null ? opts.progress : null;
        var el = h('div.card.f', [
            h('div.card-poster', [
                lazyImg(U.poster(item), 'poster'),
                h('div.card-ph', t[0]),
                badges(item),
                rating(item),
                progress != null ? h('div.card-progress', h('i', { style: { width: Math.round(progress * 100) + '%' } })) : null,
                item.watched && item.total && item.watched >= item.total ? h('div.card-check', icon('check')) : null
            ]),
            h('div.card-title', t[0]),
            h('div.card-sub', opts.sub || [item.year, U.TYPE_NAMES[item.type] && item.type !== 'movie' ? U.TYPE_NAMES[item.type] : ''].filter(Boolean).join(' · '))
        ]);
        el._item = item;
        // цветная рамка постера по возрастному рейтингу
        withAge(item, function (a) { el.classList.add('rated', 'rated-' + ageStep(a)); });
        el._select = function () { (opts.onSelect || openItem)(item, el); };
        return el;
    }

    function openItem(item) {
        Router.push(Screens.item(item.id, item));
    }

    // Горизонтальный ряд карточек с заголовком
    function row(title, items, opts) {
        opts = opts || {};
        var track = h('div.row-track');
        items.forEach(function (it) { track.appendChild((opts.make || card)(it, opts)); });
        var el = h('section.row.grp', [
            h('h2.row-title', [title, opts.count ? h('span.row-count', String(opts.count)) : null]),
            h('div.row-scroll.sx', { 'data-pad': 60 }, track)
        ]);
        el._track = track;
        return el;
    }

    /* ---------- Hero: подробности о карточке в фокусе ---------- */

    function hero() {
        var title = h('div.hero-title'), orig = h('div.hero-orig'), meta = h('div.hero-meta'),
            plot = h('div.hero-plot'), chips = h('div.hero-chips');
        var el = h('div.hero', [h('div.hero-inner', [title, orig, meta, chips, plot])]);
        var timer;
        el.update = function (item) {
            clearTimeout(timer);
            timer = setTimeout(function () { render(item); }, 120);
        };
        function render(item) {
            if (!item) return;
            var t = U.splitTitle(item.title);
            title.textContent = t[0];
            orig.textContent = t[1] || '';
            U.clear(meta);
            U.clear(chips);
            var parts = [];
            if (item.year) parts.push(item.year);
            if (U.TYPE_NAMES[item.type]) parts.push(U.TYPE_NAMES[item.type]);
            if (item.countries && item.countries.length) parts.push(item.countries.slice(0, 2).map(function (c) { return c.title; }).join(', '));
            if (item.genres && item.genres.length) parts.push(item.genres.slice(0, 3).map(function (g) { return g.title; }).join(', '));
            if (item.duration && item.duration.average && !U.isSerialType(item.type)) parts.push(U.fmtDuration(item.duration.average));
            if (item.new) parts.push('Новых серий: ' + item.new);
            meta.textContent = parts.join('  ·  ');
            ratingChips(item).forEach(function (c) { chips.appendChild(c); });
            plot.textContent = item.plot || '';
            Ambient.set(U.backdrop(item) || U.poster(item, 'big'));
        }
        return el;
    }

    function ratingChips(item) {
        var out = [];
        if (item.imdb) out.push(ageBadge(item, 'chip.age'));
        if (U.num(item.kinopoisk_rating)) out.push(h('span.chip.kp', [h('b', 'КП'), ' ' + U.num(item.kinopoisk_rating)]));
        if (U.num(item.imdb_rating)) out.push(h('span.chip.imdb', [h('b', 'IMDb'), ' ' + U.num(item.imdb_rating)]));
        if (item.quality) out.push(h('span.chip', item.quality >= 2160 ? '4K UHD' : item.quality + 'p'));
        if (item.ac3) out.push(h('span.chip', 'Dolby 5.1'));
        if (item.subtitles) out.push(h('span.chip', 'Субтитры'));
        return out;
    }

    /* ---------- Кнопки ---------- */

    function button(label, onSelect, opts) {
        opts = opts || {};
        var el = h('div.btn.f' + (opts.cls ? '.' + opts.cls : ''), [
            opts.icon ? (ICONS[opts.icon] ? icon(opts.icon) : h('span.btn-icon', opts.icon)) : null,
            h('span.btn-label', label)
        ]);
        el._select = onSelect;
        el.setLabel = function (l) { el.querySelector('.btn-label').textContent = l; };
        return el;
    }

    /* ---------- Модальные окна ---------- */

    var modalStack = [];

    function openModal(el, onKey, initialFocus) {
        var root = document.getElementById('modal-root');
        var entry = { el: el, prevScope: Nav.scope(), prevFocus: Nav.current(), onKey: onKey };
        modalStack.push(entry);
        root.appendChild(el);
        Nav.setScope(el, initialFocus);
        return entry;
    }

    function closeModal(entry) {
        var i = modalStack.indexOf(entry);
        if (i < 0) return;
        modalStack.splice(i, 1);
        entry.el.remove();
        Nav.setScope(entry.prevScope, entry.prevFocus);
    }

    function menuItem(it, plain) {
        return h('div.menu-item.f' + (it.selected ? '.selected' : '') + (plain ? '.plain' : ''), [
            plain ? null : h('span.menu-check'),
            h('div.menu-text', [h('div.menu-label', it.label), it.sub ? h('div.menu-sub', it.sub) : null])
        ]);
    }

    // Меню выбора. items: [{label, sub, value, selected}] -> Promise(value | undefined)
    // opts.focus — индекс пункта, на котором открыть; opts.plain — без кружков выбора
    function menu(title, items, opts) {
        opts = opts || {};
        var plain = opts.plain || opts.focus != null;
        return new Promise(function (resolve) {
            var entry, selectedEl = null;
            var list = h('div.menu-list');
            items.forEach(function (it, i) {
                var el = menuItem(it, plain);
                el._select = function () { closeModal(entry); resolve(it.value); };
                if (it.selected && !selectedEl) selectedEl = el;
                if (opts.focus === i) selectedEl = el;
                list.appendChild(el);
            });
            var box = h('div.modal' + (opts.wide ? '.wide' : ''), [
                h('div.modal-box.glass.strong', [title ? h('div.modal-title', title) : null,
                    h('div.menu-scroll.sy', { 'data-align': 'auto', 'data-pad': 20 }, list)])
            ]);
            entry = openModal(box, function (code) {
                if (K.isBack(code)) { closeModal(entry); resolve(undefined); return true; }
                return false;
            }, selectedEl);
        });
    }

    // Множественный выбор: OK отмечает/снимает пункт, «Готово» (первый пункт) или «Назад» применяют.
    // Promise(массив выбранных value)
    function multiMenu(title, items) {
        return new Promise(function (resolve) {
            var entry, done;
            var picked = items.map(function (it) { return !!it.selected; });
            var list = h('div.menu-list');
            function doneLabel() {
                var n = picked.filter(Boolean).length;
                return n ? 'Готово · выбрано ' + n : 'Готово · любые';
            }
            function finish() {
                closeModal(entry);
                resolve(items.filter(function (it, i) { return picked[i]; }).map(function (it) { return it.value; }));
            }
            done = h('div.menu-item.f.plain.menu-done', h('div.menu-text', h('div.menu-label', doneLabel())));
            done._select = finish;
            list.appendChild(done);
            var clear = h('div.menu-item.f.plain', h('div.menu-text', h('div.menu-label', 'Снять все отметки')));
            list.appendChild(clear);
            var els = items.map(function (it, i) {
                var el = menuItem(it, false);
                el._select = function () {
                    picked[i] = !picked[i];
                    el.classList.toggle('selected', picked[i]);
                    done.querySelector('.menu-label').textContent = doneLabel();
                };
                list.appendChild(el);
                return el;
            });
            clear._select = function () {
                picked = picked.map(function () { return false; });
                els.forEach(function (el) { el.classList.remove('selected'); });
                done.querySelector('.menu-label').textContent = doneLabel();
            };
            var box = h('div.modal', [
                h('div.modal-box.glass.strong', [h('div.modal-title', title),
                    h('div.menu-scroll.sy', { 'data-align': 'auto', 'data-pad': 20 }, list)])
            ]);
            entry = openModal(box, function (code) {
                if (K.isBack(code)) { finish(); return true; }
                return false;
            }, done);
        });
    }

    function confirm(text, okLabel, cancelLabel) {
        return menu(text, [
            { label: okLabel || 'Да', value: true },
            { label: cancelLabel || 'Отмена', value: false }
        ]).then(function (v) { return v === true; });
    }

    function modalKey(code, e) {
        var top = modalStack[modalStack.length - 1];
        if (!top) return false;
        if (top.onKey && top.onKey(code, e)) return true;
        return 'block'; // остальные клавиши обрабатываются навигацией внутри модалки
    }

    /* ---------- Тосты и загрузка ---------- */

    function toast(text, ms) {
        var root = document.getElementById('toast-root');
        var el = h('div.toast.glass.strong', text);
        root.appendChild(el);
        setTimeout(function () { el.classList.add('show'); }, 20);
        setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { el.remove(); }, 400);
        }, ms || 3000);
    }

    var loadingCount = 0;
    function loading(on) {
        loadingCount = Math.max(0, loadingCount + (on ? 1 : -1));
        document.getElementById('loader').classList.toggle('on', loadingCount > 0);
    }

    // Обёртка промиса со спиннером и тостом об ошибке
    function busy(promise) {
        loading(true);
        return promise.then(function (v) { loading(false); return v; }, function (e) {
            loading(false);
            toast('⚠ ' + (e && e.message ? e.message : 'Ошибка'));
            throw e;
        });
    }

    function empty(text) {
        return h('div.empty', text);
    }

    return {
        icon: icon, lazyImg: lazyImg, loadImg: loadImg, preloadAround: preloadAround, Ambient: Ambient,
        card: card, row: row, hero: hero, ratingChips: ratingChips, button: button, openItem: openItem,
        menu: menu, multiMenu: multiMenu, confirm: confirm, openModal: openModal, closeModal: closeModal, modalKey: modalKey,
        hasModal: function () { return modalStack.length > 0; },
        toast: toast, loading: loading, busy: busy, empty: empty
    };
})();

var Screens = {};
