/* Точка входа: боковое меню, обработка пульта, запуск. */
var App = (function () {
    'use strict';
    var h = U.h;

    var MENU = [
        { id: 'search', label: 'Поиск', icon: 'search', make: function () { return Screens.search(); } },
        { id: 'home', label: 'Главная', icon: 'home', make: function () { return Screens.home(); } },
        { id: 'watching', label: 'Я смотрю', icon: 'eye', make: function () { return Screens.watching(); } },
        { id: 'bookmarks', label: 'Закладки', icon: 'bookmark', make: function () { return Screens.bookmarks(); } },
        { id: 'history', label: 'История', icon: 'history', make: function () { return Screens.history(); } },
        { sep: true },
        { id: 'movie', label: 'Фильмы', icon: 'film', make: function () { return Screens.catalog('movie', 'Фильмы'); } },
        { id: 'serial', label: 'Сериалы', icon: 'tv', make: function () { return Screens.catalog('serial', 'Сериалы'); } },
        { id: 'concert', label: 'Концерты', icon: 'music', make: function () { return Screens.catalog('concert', 'Концерты'); } },
        { id: 'documovie', label: 'Документальные фильмы', icon: 'globe', make: function () { return Screens.catalog('documovie', 'Документальные фильмы'); } },
        { id: 'docuserial', label: 'Документальные сериалы', icon: 'layers', make: function () { return Screens.catalog('docuserial', 'Документальные сериалы'); } },
        { id: 'tvshow', label: 'ТВ шоу', icon: 'mic', make: function () { return Screens.catalog('tvshow', 'ТВ шоу'); } },
        { id: '3d', label: '3D', icon: 'cube', make: function () { return Screens.catalog('3D', '3D'); } },
        { id: 'collections', label: 'Подборки', icon: 'grid', make: function () { return Screens.collections(); } },
        { sep: true },
        { id: 'settings', label: 'Настройки', icon: 'settings', make: function () { return Screens.settings(); } }
    ];

    var sidebar, menuEls = {}, activeId = null, started = false;

    function buildSidebar() {
        sidebar = document.getElementById('sidebar');
        U.clear(sidebar);
        sidebar.classList.add('grp');
        sidebar.setAttribute('data-trap', 'v');
        sidebar.appendChild(h('div.side-logo', [h('span.logo-mark', 'K'), h('span.side-label.logo-text', 'kinopub')]));
        var list = h('div.side-list');
        MENU.forEach(function (m) {
            if (m.sep) { list.appendChild(h('div.side-sep')); return; }
            var el = h('div.side-item.f', [UI.icon(m.icon), h('span.side-label', m.label)]);
            el._select = function () { open(m.id); };
            menuEls[m.id] = el;
            list.appendChild(el);
        });
        sidebar.appendChild(list);
        // Раскрываем меню, когда фокус в нём
        document.addEventListener('navfocus', function (e) {
            sidebar.classList.toggle('open', sidebar.contains(e.detail));
        });
    }

    function open(id) {
        var m = MENU.filter(function (x) { return x.id === id; })[0];
        if (!m) return;
        if (activeId) menuEls[activeId].classList.remove('active');
        activeId = id;
        menuEls[id].classList.add('active');
        sidebar._last = menuEls[id];
        Router.setRoot(m.make());
        sidebar._last = menuEls[id]; // setRoot мог сфокусировать другой пункт меню
        sidebar.classList.remove('open');
    }

    function startMain() {
        document.body.classList.remove('unauth');
        if (!started) {
            started = true;
            buildSidebar();
            notifyDevice();
            Status.init();
        }
        open('home');
    }

    function showAuth() {
        document.body.classList.add('unauth');
        Router.push(Screens.auth(function () {
            Router.pop();
            startMain();
        }));
    }

    function notifyDevice() {
        var model = 'Samsung TV', fw = 'Tizen';
        try { model = 'Samsung ' + webapis.productinfo.getRealModel(); } catch (e) { /* not TV */ }
        try { fw = 'Tizen ' + tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'); } catch (e) { /* ignore */ }
        API.deviceNotify(model, model, fw + ' / KinoPub TV 1.0.0').catch(function () {});
        if (U.hasAvplay() && !U.store.get('deviceTuned', false)) tuneDevice();
    }

    // Телевизор умеет 4K/HEVC/HDR — включаем это в серверных настройках устройства один раз,
    // иначе сервер отдаёт только AVC до 1080p. Пользователь может поменять это в Настройках.
    function tuneDevice() {
        API.deviceInfo().then(function (r) {
            var d = r.device, s = d && d.settings;
            if (!s) return;
            var body = {};
            Object.keys(s).forEach(function (k) {
                var v = s[k];
                if (v.type === 'list') {
                    var sel = (v.value || []).filter(function (o) { return +o.selected; })[0];
                    if (sel) body[k] = sel.id;
                } else body[k] = +v.value ? 1 : 0;
            });
            ['supportSsl', 'supportHevc', 'supportHdr', 'support4k'].forEach(function (k) { if (k in body) body[k] = 1; });
            return API.saveDeviceSettings(d.id, body).then(function () { U.store.set('deviceTuned', true); });
        }).catch(function () {});
    }

    function exitApp() {
        UI.confirm('Выйти из приложения?', 'Выйти', 'Остаться').then(function (ok) {
            if (!ok) return;
            try { tizen.application.getCurrentApplication().exit(); } catch (e) { window.close(); }
        });
    }

    function back() {
        if (Router.pop()) return;
        // На корневом экране: из контента — в меню, из меню — выход
        if (sidebar && !sidebar.contains(Nav.current())) {
            if (activeId !== 'home') { open('home'); return; }
            Nav.focus(sidebar._last || Nav.first(sidebar));
            return;
        }
        exitApp();
    }

    var DIRS = {};
    DIRS[K.LEFT] = 'left'; DIRS[K.RIGHT] = 'right'; DIRS[K.UP] = 'up'; DIRS[K.DOWN] = 'down';

    function onKey(e) {
        var code = e.keyCode;
        if (code === K.EXIT) return; // системная кнопка выхода

        if (UI.hasModal()) {
            var m = UI.modalKey(code, e);
            if (m === true) { e.preventDefault(); return; }
        } else {
            var top = Router.top();
            if (top && top.onKey) {
                var r = top.onKey(code, e);
                if (r === 'pass') return;
                if (r) { e.preventDefault(); return; }
            }
        }

        if (DIRS[code]) {
            e.preventDefault();
            // Из меню вправо — в контент, к последнему элементу
            if (code === K.RIGHT && sidebar && sidebar.contains(Nav.current()) && !Router.depth()) {
                var root = Router.root();
                var target = root && root.el._lastFocus && root.el.contains(root.el._lastFocus) ? root.el._lastFocus
                    : root && (root.focusTarget ? root.focusTarget() : Nav.first(root.el));
                if (target) { Nav.focus(target); return; }
            }
            Nav.move(DIRS[code]);
            return;
        }
        if (code === K.ENTER) { e.preventDefault(); Nav.select(); return; }
        if (K.isBack(code)) {
            e.preventDefault();
            if (UI.hasModal()) return;
            if (document.body.classList.contains('unauth')) { exitApp(); return; }
            back();
        }
    }

    // Запоминаем последний элемент контента корневого экрана (для возврата из меню)
    document.addEventListener('navfocus', function (e) {
        var root = Router.root();
        if (root && root.el.contains(e.detail)) root.el._lastFocus = e.detail;
    });

    // В браузере масштабируем макет 1920×1080 под размер окна
    function fit() {
        var app = document.getElementById('app');
        var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        app.style.transform = s < 0.999 || s > 1.001 ? 'scale(' + s + ')' : '';
    }

    function init() {
        K.register();
        Router.init();
        fit();
        window.addEventListener('resize', fit);
        document.addEventListener('keydown', onKey);
        API.setLogoutHandler(function () {
            Router.setRoot({ el: h('div') }, false);
            showAuth();
        });
        if (API.isAuthorized()) startMain();
        else showAuth();
    }

    return { init: init, open: open };
})();

window.addEventListener('load', App.init);
