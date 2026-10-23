/* Экран привязки устройства (OAuth Device Flow). */
Screens.auth = function (onDone) {
    'use strict';
    var h = U.h;
    var codeEl = h('div.auth-code', '·····');
    var urlEl = h('div.auth-url', 'kino.pub/device');
    var statusEl = h('div.auth-status', 'Получаем код…');
    var timer = null, expireTimer = null, destroyed = false;
    var retryBtn = UI.button('Получить новый код', function () { start(); }, { icon: 'refresh' });

    var el = h('div.auth-screen', [
        h('div.auth-card.glass.strong', [
            h('div.logo', [h('span.logo-mark', 'K'), h('span.logo-text', 'kinopub')]),
            h('div.auth-title', 'Привязка устройства'),
            h('ol.auth-steps', [
                h('li', ['Откройте на телефоне или компьютере ', urlEl]),
                h('li', 'Войдите в свой аккаунт kino.pub'),
                h('li', 'Введите код:')
            ]),
            codeEl,
            statusEl,
            h('div.auth-actions', [retryBtn])
        ])
    ]);

    function start() {
        clearTimeout(timer);
        clearTimeout(expireTimer);
        codeEl.textContent = '·····';
        statusEl.textContent = 'Получаем код…';
        API.getDeviceCode().then(function (d) {
            if (destroyed) return;
            codeEl.textContent = d.user_code;
            urlEl.textContent = (d.verification_uri || 'https://kino.pub/device').replace(/^https?:\/\//, '');
            statusEl.textContent = 'Ожидаем подтверждения…';
            poll(d.code, Math.max(3, d.interval || 5) * 1000);
            expireTimer = setTimeout(function () {
                clearTimeout(timer);
                statusEl.textContent = 'Срок действия кода истёк';
            }, (d.expires_in || 300) * 1000);
        }).catch(function (e) {
            statusEl.textContent = 'Ошибка: ' + e.message;
        });
    }

    function poll(code, interval) {
        timer = setTimeout(function () {
            API.checkDeviceCode(code).then(function (ok) {
                if (destroyed) return;
                if (ok) {
                    clearTimeout(expireTimer);
                    statusEl.textContent = 'Готово!';
                    onDone();
                } else poll(code, interval);
            }).catch(function (e) {
                if (destroyed) return;
                statusEl.textContent = 'Ошибка: ' + e.message;
            });
        }, interval);
    }

    start();

    return {
        el: el,
        destroy: function () { destroyed = true; clearTimeout(timer); clearTimeout(expireTimer); }
    };
};
