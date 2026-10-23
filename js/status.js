/* Плашка в правом верхнем углу: подписка + состояние серверов.
   Плюс предупреждение об окончании подписки и тест скорости CDN. */
var Status = (function () {
    'use strict';
    var h = U.h;

    var el, dotEl, srvEl, subEl;
    var user = null, serverName = '', pingTimer = null, userTimer = null;
    var WARN_DAYS = 7;

    function subDays() {
        var s = user && user.subscription;
        if (!s) return null;
        if (s.active === false) return 0;
        if (s.end_time) return Math.max(0, Math.ceil((s.end_time * 1000 - Date.now()) / 86400000));
        return s.days != null ? Math.floor(s.days) : null;
    }

    function endDate() {
        var s = user && user.subscription;
        return s && s.end_time ? new Date(s.end_time * 1000).toLocaleDateString('ru-RU') : '';
    }

    function render() {
        if (!el) return;
        var d = subDays();
        subEl.textContent = d == null ? '' : d > 0 ? d + ' ' + U.plural(d, 'день', 'дня', 'дней') : 'подписка закончилась';
        el.classList.toggle('sub-warn', d != null && d > 0 && d <= WARN_DAYS);
        el.classList.toggle('sub-off', d === 0);
    }

    /* ---- Состояние серверов: пинг API ---- */

    function ping() {
        API.ping().then(function (ms) {
            dotEl.className = 'st-dot ' + (ms < 600 ? 'ok' : ms < 1500 ? 'slow' : 'bad');
            srvEl.textContent = (serverName ? serverName + ' · ' : '') + ms + ' мс';
        }, function () {
            dotEl.className = 'st-dot bad';
            srvEl.textContent = 'нет связи';
        });
    }

    function loadServerName() {
        return API.deviceInfo().then(function (r) {
            var s = r.device && r.device.settings && r.device.settings.serverLocation;
            var sel = s && s.value && s.value.filter(function (o) { return +o.selected; })[0];
            serverName = sel ? sel.label : '';
        }).catch(function () {});
    }

    function loadUser() {
        return API.user().then(function (r) {
            user = r.user || r;
            render();
            warnIfNeeded();
        }).catch(function () {});
    }

    // Раз в день напоминаем, если до конца подписки неделя или меньше
    function warnIfNeeded() {
        var d = subDays();
        if (d == null || d > WARN_DAYS) return;
        var today = new Date().toDateString();
        if (U.store.get('subWarned') === today) return;
        U.store.set('subWarned', today);
        var text = d === 0 ? 'Подписка kino.pub закончилась'
            : 'Подписка kino.pub закончится через ' + d + ' ' + U.plural(d, 'день', 'дня', 'дней') + (endDate() ? ' (' + endDate() + ')' : '');
        // ждём, пока не откроется плеер или другое окно
        (function show() {
            if (UI.hasModal() || document.body.classList.contains('playing')) { setTimeout(show, 5000); return; }
            UI.menu(text, [{ label: 'Понятно', sub: 'Продлить можно на сайте kino.watch', value: true }]);
        })();
    }

    function init() {
        el = h('div.st-bar.glass', [
            dotEl = h('span.st-dot'),
            srvEl = h('span.st-srv', 'проверка…'),
            h('span.st-sep'),
            UI.icon('star'),
            subEl = h('span.st-sub', '')
        ]);
        el.id = 'status';
        document.getElementById('shell').appendChild(el);
        loadServerName().then(ping);
        loadUser();
        clearInterval(pingTimer); clearInterval(userTimer);
        pingTimer = setInterval(ping, 60000);
        userTimer = setInterval(loadUser, 30 * 60000);
    }

    /* ---- Тест скорости ----
       Сервер теста из официального приложения (speed.*.cdntogo.net) не отвечает,
       поэтому качаем куски настоящего видеофайла с того же CDN, откуда идёт просмотр. */

    function sampleFileUrl() {
        return API.shortcut('popular', 'movie', 1, 5).then(function (r) {
            var it = (r.items || [])[0];
            if (!it) throw new Error('нет фильмов для теста');
            return API.item(it.id);
        }).then(function (r) {
            var v = (r.item.videos || [])[0] || (r.item.seasons && r.item.seasons[0].episodes[0]);
            return API.mediaLinks(v.id);
        }).then(function (m) {
            var f = (m.files || []).slice().sort(function (a, b) { return (b.h || 0) - (a.h || 0); })[0];
            var u = f && (f.url || f.urls);
            if (!u || !u.http) throw new Error('нет ссылки на файл');
            return u.http;
        });
    }

    // Несколько параллельных докачек по 8 МБ, не дольше 10 секунд → Мбит/с.
    // Берём начало файла: оно лежит в кэше CDN, а куски из середины CDN сначала
    // тянет с хранилища (ожидание до 20 с), что искажает замер канала.
    // Скорость считаем с момента первого полученного байта.
    function measure(url, onProgress) {
        var streams = 3, chunk = 8 * 1048576, deadline = 12000;
        var total = 0, start = 0, ctrls = [];
        function one(i) {
            var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            if (ctrl) ctrls.push(ctrl);
            var from = i * chunk;
            return fetch(url, { headers: { Range: 'bytes=' + from + '-' + (from + chunk - 1) }, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
                .then(function (r) {
                    if (!r.body || !r.body.getReader) { if (!start) start = Date.now(); return r.arrayBuffer().then(function (b) { total += b.byteLength; }); }
                    var reader = r.body.getReader();
                    function pump() {
                        return reader.read().then(function (res) {
                            if (res.done) return;
                            if (!start) start = Date.now();
                            total += res.value.byteLength;
                            if (onProgress) onProgress(speed());
                            return pump();
                        });
                    }
                    return pump();
                }).catch(function () {});
        }
        function speed() { return start ? total * 8 / Math.max(0.2, (Date.now() - start) / 1000) / 1e6 : 0; }
        var jobs = [];
        for (var i = 0; i < streams; i++) jobs.push(one(i));
        var timeout = new Promise(function (r) { setTimeout(r, deadline); });
        return Promise.race([Promise.all(jobs), timeout]).then(function () {
            ctrls.forEach(function (c) { try { c.abort(); } catch (e) { /* ignore */ } });
            if (!total) throw new Error('не удалось скачать данные');
            return speed();
        });
    }

    function verdict(mbit) {
        if (mbit >= 40) return 'хватит для 4K HDR';
        if (mbit >= 25) return 'хватит для 4K';
        if (mbit >= 10) return 'хватит для 1080p';
        if (mbit >= 5) return 'хватит для 720p';
        return 'медленно — возможны остановки';
    }

    function speedTest(onProgress) {
        return sampleFileUrl().then(function (url) { return measure(url, onProgress); });
    }

    return {
        init: init,
        refresh: function () { loadServerName().then(ping); loadUser(); },
        speedTest: speedTest,
        verdict: verdict,
        subDays: subDays,
        endDate: endDate
    };
})();
