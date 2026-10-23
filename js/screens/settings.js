/* Настройки: аккаунт, плеер, серверные настройки устройства, выход. */
Screens.settings = function () {
    'use strict';
    var h = U.h;
    var ageRow;
    var account = h('div.set-account');
    var local = h('div.set-group');
    var server = h('div.set-group');
    var page = h('div.settings-page.sy', { 'data-align': 'auto', 'data-pad': 80 }, h('div.settings-inner', [
        h('h1.screen-title', 'Настройки'),
        account,
        h('div.set-caption', 'Воспроизведение'), local,
        h('div.set-caption', 'Контент'),
        h('div.set-group', [
            ageRow = settingRow('Возрастное ограничение', CatalogFilters.ageLabel(), function () {
                CatalogFilters.ageMenu().then(function () {
                    ageRow.setValue(CatalogFilters.ageLabel());
                    var root = Router.root();
                    if (root && root.reload) root.reload();
                });
            })
        ]),
        h('div.set-caption', 'Устройство (хранится на сервере kino.pub)'), server,
        h('div.set-caption', 'Аккаунт'),
        h('div.set-group', [
            settingRow('Выйти из аккаунта', 'Отвязать этот телевизор', function () {
                UI.confirm('Отвязать устройство и выйти?', 'Выйти').then(function (ok) {
                    if (!ok) return;
                    API.unlink().catch(function () {}).then(function () { API.logout(); });
                });
            }),
            settingRow('О приложении', 'KinoPub для Samsung Tizen · v1.1.0', function () {})
        ])
    ]));
    var el = h('div.screen.settings-screen', page);
    var device = null;

    function settingRow(label, value, onSelect) {
        var valEl = h('div.set-value', value);
        var r = h('div.set-row.f', [h('div.set-label', label), valEl]);
        r._select = function () { onSelect(r); };
        r.setValue = function (v) { valEl.textContent = v; };
        return r;
    }

    function choice(label, key, options) {
        function cur() {
            for (var i = 0; i < options.length; i++) if (options[i].value === Prefs.get(key)) return options[i].label;
            return '';
        }
        var row = settingRow(label, cur(), function () {
            UI.menu(label, options.map(function (o) {
                return { label: o.label, sub: o.sub, value: o.value, selected: o.value === Prefs.get(key) };
            })).then(function (v) {
                if (v === undefined) return;
                Prefs.set(key, v);
                row.setValue(cur());
            });
        });
        return row;
    }

    U.append(local, [
        choice('Тип потока', 'stream', [
            { label: 'HLS4 (рекомендуется)', sub: 'Адаптивный поток, все озвучки и выбор дорожек', value: 'hls4' },
            { label: 'HLS2', sub: 'Все аудиодорожки в одном потоке', value: 'hls2' },
            { label: 'HLS', sub: 'Одна аудиодорожка', value: 'hls' },
            { label: 'HTTP (MP4)', sub: 'Прямая ссылка на файл', value: 'http' }
        ]),
        choice('Качество по умолчанию', 'quality', [
            { label: 'Максимальное', value: 'max' },
            { label: '2160p (4K)', value: '2160' },
            { label: '1080p', value: '1080' },
            { label: '720p', value: '720' },
            { label: '480p', value: '480' }
        ]),
        choice('Следующая серия автоматически', 'autoNext', [
            { label: 'Включено', value: true }, { label: 'Выключено', value: false }
        ]),
        choice('Субтитры по умолчанию', 'subLang', [
            { label: 'Выключены', value: 'off' }, { label: 'Русские', value: 'rus' }, { label: 'Английские', value: 'eng' }
        ]),
        choice('Размер субтитров', 'subSize', [
            { label: 'Маленький', value: 's' }, { label: 'Средний', value: 'm' }, { label: 'Большой', value: 'l' }
        ]),
        choice('Шаг перемотки', 'seekStep', [
            { label: '5 секунд', value: 5 }, { label: '10 секунд', value: 10 }, { label: '15 секунд', value: 15 }, { label: '30 секунд', value: 30 }
        ])
    ]);

    function loadAccount() {
        API.user().then(function (r) {
            var u = r.user || r;
            var sub = u.subscription || {};
            var days = sub.days != null ? Math.floor(sub.days) : null;
            U.clear(account);
            U.append(account, [
                h('div.set-avatar', (u.username || '?').charAt(0).toUpperCase()),
                h('div', [
                    h('div.set-user', (u.profile && u.profile.name) || u.username || ''),
                    h('div.set-sub', sub.active === false ? 'Подписка не активна' :
                        days != null ? 'Подписка: ещё ' + days + ' ' + U.plural(days, 'день', 'дня', 'дней') +
                            (sub.end_time ? ' (до ' + new Date(sub.end_time * 1000).toLocaleDateString('ru-RU') + ')' : '') : '')
                ])
            ]);
        }).catch(function () {});
    }

    function serverValue(s) {
        if (s.type === 'list') {
            var v = (s.value || []).filter(function (o) { return +o.selected; })[0];
            return v ? v.label : '—';
        }
        return +s.value ? 'Да' : 'Нет';
    }

    function payload() {
        var out = {};
        Object.keys(device.settings).forEach(function (k) {
            var s = device.settings[k];
            if (s.type === 'list') {
                var v = (s.value || []).filter(function (o) { return +o.selected; })[0];
                if (v) out[k] = v.id;
            } else out[k] = +s.value ? 1 : 0;
        });
        return out;
    }

    var SERVER_LABELS = {
        supportSsl: 'Поддержка SSL', supportHevc: 'Поддержка HEVC (H.265)', supportHdr: 'Поддержка HDR',
        support4k: 'Поддержка 4K', mixedPlaylist: 'Смешанный плейлист (AVC+HEVC)',
        streamingType: 'Тип стриминга на сервере', serverLocation: 'Сервер', useSsl: 'Использовать SSL'
    };

    function loadServer() {
        U.clear(server);
        server.appendChild(h('div.set-loading', 'Загрузка…'));
        API.deviceInfo().then(function (r) {
            device = r.device;
            if (!device || !device.settings) throw new Error('нет данных');
            U.clear(server);
            Object.keys(device.settings).forEach(function (k) {
                var s = device.settings[k];
                var label = SERVER_LABELS[k] || s.label || k;
                var row = settingRow(label, serverValue(s), function () {
                    var p;
                    if (s.type === 'list') {
                        p = UI.menu(label, s.value.map(function (o) {
                            return { label: o.label, sub: o.description, value: o, selected: !!+o.selected };
                        })).then(function (o) {
                            if (!o) return false;
                            s.value.forEach(function (x) { x.selected = x === o ? 1 : 0; });
                            return true;
                        });
                    } else {
                        s.value = +s.value ? 0 : 1;
                        p = Promise.resolve(true);
                    }
                    p.then(function (changed) {
                        if (!changed) return;
                        row.setValue(serverValue(s));
                        UI.busy(API.saveDeviceSettings(device.id, payload())).then(function () {
                            UI.toast('Сохранено');
                            Status.refresh();
                            if (k === 'serverLocation') speedRow.setValue(lastSpeed());
                        }).catch(function () { loadServer(); });
                    });
                });
                server.appendChild(row);
                if (k === 'serverLocation') {
                    server.appendChild(speedRow = settingRow('Тест скорости', lastSpeed(), runSpeedTest));
                    if (s.value && s.value.length > 1) server.appendChild(settingRow('Сравнить все серверы', 'Проверить скорость каждого и выбрать лучший', compareServers));
                }
            });
        }).catch(function (e) {
            U.clear(server);
            server.appendChild(h('div.set-loading', 'Не удалось загрузить: ' + e.message));
        });
    }

    /* ---- Тест скорости ---- */

    var speedRow = null, testing = false;

    function currentServer() {
        var s = device && device.settings && device.settings.serverLocation;
        var sel = s && s.value && s.value.filter(function (o) { return +o.selected; })[0];
        return sel || null;
    }

    function fmtSpeed(mbit) { return (mbit >= 100 ? Math.round(mbit) : mbit.toFixed(1)) + ' Мбит/с'; }

    function lastSpeed() {
        var srv = currentServer();
        var r = srv && U.store.get('speed.' + srv.id, null);
        return r ? fmtSpeed(r.mbit) + ' — ' + Status.verdict(r.mbit) + ' (' + new Date(r.t).toLocaleDateString('ru-RU') + ')' : 'Нажмите, чтобы проверить';
    }

    function runSpeedTest() {
        if (testing) return;
        testing = true;
        speedRow.setValue('Измеряем…');
        Status.speedTest(function (mbit) { speedRow.setValue('Измеряем… ' + fmtSpeed(mbit)); }).then(function (mbit) {
            var srv = currentServer();
            if (srv) U.store.set('speed.' + srv.id, { mbit: mbit, t: Date.now() });
            speedRow.setValue(fmtSpeed(mbit) + ' — ' + Status.verdict(mbit));
        }).catch(function (e) {
            speedRow.setValue('Ошибка: ' + e.message);
        }).then(function () { testing = false; });
    }

    // По очереди включаем каждый сервер, меряем и возвращаем исходный (или предлагаем лучший)
    function compareServers() {
        if (testing || !device) return;
        var s = device.settings.serverLocation;
        var original = currentServer();
        var results = [];
        testing = true;
        UI.toast('Сравниваем серверы, это займёт до минуты…', 5000);
        function select(o) {
            s.value.forEach(function (x) { x.selected = x === o ? 1 : 0; });
            return API.saveDeviceSettings(device.id, payload());
        }
        var chain = Promise.resolve();
        s.value.forEach(function (o) {
            chain = chain.then(function () {
                speedRow.setValue('Проверяем: ' + o.label + '…');
                return select(o).then(function () { return Status.speedTest(); }).then(function (mbit) {
                    results.push({ o: o, mbit: mbit });
                    U.store.set('speed.' + o.id, { mbit: mbit, t: Date.now() });
                }, function () { results.push({ o: o, mbit: 0 }); });
            });
        });
        chain.then(function () {
            return select(original);
        }).then(function () {
            testing = false;
            results.sort(function (a, b) { return b.mbit - a.mbit; });
            speedRow.setValue(lastSpeed());
            return UI.menu('Результаты', results.map(function (r) {
                return {
                    label: r.o.label + ' — ' + (r.mbit ? fmtSpeed(r.mbit) : 'нет ответа'),
                    sub: r.mbit ? Status.verdict(r.mbit) + (r.o === original ? ' · текущий' : ' · нажмите, чтобы выбрать') : '',
                    value: r.o, selected: r.o === original
                };
            }));
        }).then(function (o) {
            if (!o || o === original) return;
            return select(o).then(function () { UI.toast('Сервер: ' + o.label); loadServer(); Status.refresh(); });
        }).catch(function (e) {
            testing = false;
            UI.toast('⚠ ' + e.message);
            loadServer();
        });
    }

    loadAccount();
    loadServer();

    return { el: el, focusTarget: function () { return Nav.first(local); } };
};
