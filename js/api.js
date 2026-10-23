/* Клиент API kino.pub (https://kinoapi.com). Авторизация — OAuth Device Flow. */
var API = (function () {
    'use strict';

    // Данные OAuth-клиента — в js/config.js (не публикуется; шаблон — js/config.example.js)
    var CFG = window.KP_CONFIG || {};
    var CLIENT_ID = CFG.clientId || '';
    var CLIENT_SECRET = CFG.clientSecret || '';
    // Зеркала API: если основной домен недоступен, пробуем следующий.
    var HOSTS = ['https://api.service-kp.com', 'https://api.srvkp.com', 'https://kino.watch/api'];
    var TIMEOUT = 20000;

    var hostIdx = U.store.get('hostIdx', 0) || 0;
    var auth = U.store.get('auth', null);
    var refreshing = null;
    var onLogout = function () {};

    function host() { return HOSTS[hostIdx % HOSTS.length]; }

    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
            promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
        });
    }

    // Низкоуровневый запрос с перебором зеркал при сетевой ошибке.
    function raw(method, path, params, body, attempt) {
        attempt = attempt || 0;
        var qs = U.query(params);
        var url = host() + path + (qs ? (path.indexOf('?') < 0 ? '?' : '&') + qs : '');
        var opts = { method: method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            opts.body = U.query(body);
        }
        return withTimeout(fetch(url, opts), TIMEOUT).then(function (res) {
            return res.text().then(function (text) {
                var data = null;
                try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
                return { status: res.status, data: data };
            });
        }, function (err) {
            if (attempt < HOSTS.length - 1) {
                hostIdx = (hostIdx + 1) % HOSTS.length;
                U.store.set('hostIdx', hostIdx);
                return raw(method, path, params, body, attempt + 1);
            }
            throw err;
        });
    }

    function saveAuth(data) {
        auth = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000
        };
        U.store.set('auth', auth);
    }

    function clientParams(extra) {
        return Object.assign({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }, extra);
    }

    /* ---------- Device Flow ---------- */

    function getDeviceCode() {
        if (!CLIENT_ID || !CLIENT_SECRET) {
            return Promise.reject(new Error('не задан ключ API. Скопируйте js/config.example.js в js/config.js и впишите данные клиента (см. README).'));
        }
        return raw('POST', '/oauth2/device', clientParams({ grant_type: 'device_code' })).then(function (r) {
            if (r.status !== 200 || !r.data || !r.data.code) throw new Error((r.data && r.data.error_description) || 'Не удалось получить код');
            return r.data;
        });
    }

    // resolve(true) — авторизовано, resolve(false) — ещё ждём
    function checkDeviceCode(code) {
        return raw('POST', '/oauth2/device', clientParams({ grant_type: 'device_token', code: code })).then(function (r) {
            if (r.status === 200 && r.data && r.data.access_token) { saveAuth(r.data); return true; }
            if (r.data && (r.data.error === 'authorization_pending' || r.data.error === 'slow_down')) return false;
            throw new Error((r.data && (r.data.error_description || r.data.error)) || 'Ошибка авторизации');
        });
    }

    function refresh() {
        if (refreshing) return refreshing;
        if (!auth || !auth.refresh_token) return Promise.reject(new Error('no refresh token'));
        var params = clientParams({ grant_type: 'refresh_token', refresh_token: auth.refresh_token });
        refreshing = raw('POST', '/oauth2/token', params).then(function (r) {
            if (r.status === 200 && r.data && r.data.access_token) return r;
            return raw('POST', '/oauth2/device', params);
        }).then(function (r) {
            refreshing = null;
            if (r.status === 200 && r.data && r.data.access_token) { saveAuth(r.data); return true; }
            var err = new Error('refresh failed');
            err.fatal = r.status >= 400 && r.status < 500;
            throw err;
        }, function (e) { refreshing = null; throw e; });
        return refreshing;
    }

    function logout() {
        auth = null;
        U.store.del('auth');
        onLogout();
    }

    /* ---------- Авторизованные запросы ---------- */

    function request(method, path, params, body, retried) {
        if (!auth) return Promise.reject(new Error('not authorized'));
        var pre = auth.expires_at - Date.now() < 60000 ? refresh().catch(function () {}) : Promise.resolve();
        return pre.then(function () {
            var p = Object.assign({}, params, { access_token: auth.access_token });
            return raw(method, path, p, body);
        }).then(function (r) {
            if (r.status === 401 && !retried) {
                return refresh().then(function () {
                    return request(method, path, params, body, true);
                }, function (e) {
                    if (e.fatal) logout();
                    throw new Error('Требуется повторная авторизация');
                });
            }
            if (r.status >= 400) {
                var msg = (r.data && (r.data.message || r.data.error_description || r.data.error)) || ('Ошибка сервера ' + r.status);
                var err = new Error(msg);
                err.status = r.status;
                throw err;
            }
            return r.data;
        });
    }

    function get(path, params) { return request('GET', path, params); }
    function post(path, body, params) { return request('POST', path, params, body || {}); }

    // Простой кэш для редко меняющихся справочников
    var cache = {};
    function cached(key, fn) {
        if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; });
        return cache[key];
    }

    return {
        setLogoutHandler: function (fn) { onLogout = fn; },
        isAuthorized: function () { return !!auth; },
        getDeviceCode: getDeviceCode,
        checkDeviceCode: checkDeviceCode,
        refresh: refresh,
        logout: logout,
        get: get,
        post: post,

        user: function () { return get('/v1/user'); },
        // Время ответа API в мс (лёгкий запрос, без кэша)
        ping: function () {
            var t0 = Date.now();
            return get('/v1/types').then(function () { return Date.now() - t0; });
        },
        types: function () { return cached('types', function () { return get('/v1/types'); }); },
        genres: function (type) { return cached('genres' + type, function () { return get('/v1/genres', { type: type }); }); },
        countries: function () { return cached('countries', function () { return get('/v1/countries'); }); },

        items: function (params) { return get('/v1/items', params); },
        shortcut: function (kind, type, page, perpage) {
            return get('/v1/items/' + kind, { type: type, page: page || 1, perpage: perpage || 20 });
        },
        search: function (q, params) { return get('/v1/items/search', Object.assign({ q: q, perpage: 50 }, params)); },
        item: function (id) { return get('/v1/items/' + id); },
        similar: function (id) { return get('/v1/items/similar', { id: id }); },
        mediaLinks: function (mid) { return get('/v1/items/media-links', { mid: mid }); },
        trailer: function (id) { return get('/v1/items/trailer', { id: id }); },

        watchingSerials: function (subscribed) { return get('/v1/watching/serials', { subscribed: subscribed ? 1 : 0 }); },
        watchingMovies: function () { return get('/v1/watching/movies'); },
        watchingInfo: function (id) { return get('/v1/watching', { id: id }); },
        markTime: function (id, video, time, season) {
            return get('/v1/watching/marktime', { id: id, video: video, time: Math.floor(time), season: season });
        },
        toggleWatched: function (id, video, season) { return get('/v1/watching/toggle', { id: id, video: video, season: season }); },
        toggleWatchlist: function (id) { return get('/v1/watching/togglewatchlist', { id: id }); },

        history: function (page) { return get('/v1/history', { page: page || 1, perpage: 50 }); },

        bookmarks: function () { return get('/v1/bookmarks'); },
        bookmarkFolder: function (id, page) { return get('/v1/bookmarks/' + id, { page: page || 1 }); },
        itemFolders: function (item) { return get('/v1/bookmarks/get-item-folders', { item: item }); },
        toggleBookmark: function (item, folder) { return post('/v1/bookmarks/toggle-item', { item: item, folder: folder }); },
        createFolder: function (title) { return post('/v1/bookmarks/create', { title: title }); },

        collections: function (page, sort) { return get('/v1/collections', { page: page || 1, perpage: 30, sort: sort || 'watchers-' }); },
        collection: function (id) { return get('/v1/collections/view', { id: id }); },

        deviceInfo: function () { return get('/v1/device/info'); },
        deviceSettings: function (id) { return get('/v1/device/' + id + '/settings'); },
        saveDeviceSettings: function (id, values) { return post('/v1/device/' + id + '/settings', values); },
        deviceNotify: function (title, hardware, software) {
            return post('/v1/device/notify', { title: title, hardware: hardware, software: software });
        },
        unlink: function () { return post('/v1/device/unlink'); }
    };
})();
