/* Поиск с экранной клавиатурой (RU/EN/цифры) и живой выдачей. */
Screens.search = function () {
    'use strict';
    var h = U.h;
    // Раскладки как на обычной клавиатуре: ЙЦУКЕН и QWERTY, цифры — верхним рядом
    var LAYOUTS = {
        ru: ['1234567890', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбюё'],
        en: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm-.\'']
    };
    var layout = U.store.get('kbLayout', 'ru'), query = '', reqId = 0;
    if (!LAYOUTS[layout]) layout = 'ru';
    var recent = U.store.get('recentSearch', []);

    var queryEl = h('div.search-query');
    var keysEl = h('div.kb-keys.grp');
    var resultsInner = h('div.grid-inner');
    var results = h('div.search-results.grid.sy', { 'data-align': 'auto', 'data-pad': 40 }, resultsInner);
    var hint = h('div.search-hint');
    var input = h('input.search-input', { type: 'text', autocomplete: 'off' });
    var el = h('div.screen.search-screen', [
        h('div.search-panel.glass', [
            h('div.search-box', [h('span.search-icon', UI.icon('search')), queryEl, h('span.caret')]),
            keysEl,
            input
        ]),
        h('div.search-right', [hint, results])
    ]);

    function key(label, onSelect, cls) {
        var k = h('div.kb-key.f' + (cls ? '.' + cls : ''), label);
        k._select = onSelect;
        return k;
    }

    function renderKeys() {
        var focusIdx = keysEl.contains(Nav.current()) ? Array.prototype.indexOf.call(keysEl.querySelectorAll('.f'), Nav.current()) : -1;
        U.clear(keysEl);
        LAYOUTS[layout].forEach(function (row, ri) {
            keysEl.appendChild(h('div.kb-line.kb-line-' + ri, row.split('').map(function (ch) {
                return key(ch, function () { type(ch); }, ri === 0 ? 'digit' : null);
            })));
        });
        keysEl.appendChild(h('div.kb-row', [
            key(layout === 'ru' ? 'ENG' : 'РУС', function () { switchLayout(layout === 'ru' ? 'en' : 'ru'); }, 'mid'),
            key('Пробел', function () { type(' '); }, 'wide'),
            key(UI.icon('backspace'), function () { setQuery(query.slice(0, -1)); }, 'mid'),
            key(UI.icon('close'), function () { setQuery(''); }, 'mid')
        ]));
        keysEl.appendChild(h('div.kb-row', [
            key([UI.icon('keyboard'), ' Клавиатура телевизора'], openIme, 'wide')
        ]));
        if (focusIdx >= 0) {
            var all = keysEl.querySelectorAll('.f');
            Nav.focus(all[Math.min(focusIdx, all.length - 1)]);
        }
    }

    function switchLayout(l) {
        layout = l;
        U.store.set('kbLayout', l);
        renderKeys();
        Nav.focus(keysEl.querySelector('.kb-row .kb-key')); // остаёмся на кнопке РУС/ENG
    }

    function type(ch) { setQuery(query + ch); }

    var doSearch = U.debounce(function () { search(); }, 600);

    function setQuery(q) {
        query = q;
        queryEl.textContent = q || 'Название, актёр или режиссёр';
        queryEl.classList.toggle('placeholder', !q);
        if (q.trim().length >= 2) doSearch();
        else showRecent();
    }

    function showRecent() {
        reqId++;
        U.clear(resultsInner);
        hint.textContent = recent.length ? 'Недавние запросы' : 'Введите не менее двух символов';
        recent.forEach(function (r) {
            var chip = h('div.recent-chip.f', r);
            chip._select = function () { setQuery(r); };
            resultsInner.appendChild(chip);
        });
    }

    function remember(q) {
        recent = [q].concat(recent.filter(function (r) { return r !== q; })).slice(0, 12);
        U.store.set('recentSearch', recent);
    }

    function search() {
        var q = query.trim();
        if (q.length < 2) return;
        var my = ++reqId;
        hint.textContent = 'Ищем «' + q + '»…';
        API.search(q).then(function (r) {
            var all = itemsOf(r);
            return AgeRating.filter(all).then(function (items) { return { items: items, hidden: all.length - items.length }; });
        }).then(function (res) {
            if (my !== reqId) return;
            var items = res.items;
            U.clear(resultsInner);
            Nav.resetScroll(results);
            hint.textContent = (items.length ? 'Найдено: ' + items.length : 'Ничего не найдено по запросу «' + q + '»') +
                (res.hidden ? '  ·  скрыто по возрасту: ' + res.hidden : '');
            items.forEach(function (it) {
                resultsInner.appendChild(UI.card(it, {
                    onSelect: function () { remember(q); UI.openItem(it); }
                }));
            });
        }).catch(function (e) {
            if (my === reqId) hint.textContent = 'Ошибка: ' + e.message;
        });
    }

    /* Системная клавиатура Samsung (IME) */
    var imeActive = false;
    function openIme() {
        imeActive = true;
        input.value = query;
        input.classList.add('on');
        input.focus();
    }
    function closeIme() {
        imeActive = false;
        input.classList.remove('on');
        input.blur();
        setQuery(input.value);
    }
    input.addEventListener('input', function () { setQuery(input.value); });
    input.addEventListener('blur', function () { if (imeActive) closeIme(); });

    renderKeys();
    setQuery('');

    el.addEventListener('navfocus', function (e) { UI.preloadAround(e.detail, 6); });

    return {
        el: el,
        onKey: function (code) {
            if (imeActive) {
                if (code === K.IME_DONE || code === K.IME_CANCEL || code === K.ENTER || K.isBack(code) && code !== K.BACKSPACE) {
                    closeIme();
                    return true;
                }
                return 'pass';
            }
            return false;
        },
        focusTarget: function () { return Nav.first(keysEl); }
    };
};
