/* Возрастной рейтинг.
   В API kino.pub поле age_rating есть, но не заполнено (-1), поэтому берём рейтинг
   из Wikidata по IMDb-номеру: российский (P2637), иначе максимум из FSK (P1981),
   MPAA (P1657) и австралийского (P3156), приведённых к шкале 0+/6+/12+/16+/18+. */
var AgeRating = (function () {
    'use strict';

    var ENDPOINT = 'https://query.wikidata.org/sparql?format=json&query=';
    var TTL = 7 * 24 * 3600 * 1000;   // повторно спрашиваем неизвестные раз в неделю
    var cache = U.store.get('ageCache', {});
    var queue = {}, waiters = {}, timer = null, saveTimer = null;

    function tt(item) {
        return item && item.imdb ? 'tt' + ('0000000' + item.imdb).slice(-Math.max(7, String(item.imdb).length)) : null;
    }

    function mpaa(v) {
        return { 'G': 0, 'PG': 6, 'PG-13': 12, 'R': 18, 'NC-17': 18 }[v];
    }

    function aus(v) {
        if (/^G\b|General/i.test(v)) return 0;
        if (/^PG|Parental/i.test(v)) return 6;
        if (/^M\b|Mature/i.test(v)) return 12;
        if (/MA ?15/i.test(v)) return 16;
        if (/R ?18|X ?18/i.test(v)) return 18;
        return undefined;
    }

    function normalize(d) {
        var ru = d.ru ? parseInt(d.ru, 10) : NaN;
        if (!isNaN(ru)) return ru;
        var vals = [];
        if (d.fsk) { var f = parseInt(String(d.fsk).replace(/\D+/g, ''), 10); if (!isNaN(f)) vals.push(f); }
        if (d.mpaa && mpaa(d.mpaa) != null) vals.push(mpaa(d.mpaa));
        if (vals.length) return Math.max.apply(null, vals);
        if (d.au && aus(d.au) != null) return aus(d.au);
        return null;
    }

    function saveSoon() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            var keys = Object.keys(cache);
            if (keys.length > 4000) {
                keys.sort(function (a, b) { return cache[a].t - cache[b].t; });
                keys.slice(0, keys.length - 3000).forEach(function (k) { delete cache[k]; });
            }
            U.store.set('ageCache', cache);
        }, 1000);
    }

    function resolveKey(k, age) {
        cache[k] = { a: age, t: Date.now() };
        (waiters[k] || []).forEach(function (fn) { fn(age); });
        delete waiters[k];
    }

    function flush() {
        timer = null;
        var keys = Object.keys(queue).slice(0, 120);
        keys.forEach(function (k) { delete queue[k]; });
        if (Object.keys(queue).length) timer = setTimeout(flush, 50);
        if (!keys.length) return;
        var q = 'SELECT ?imdb ?ru ?mpaa ?fsk ?au WHERE { VALUES ?imdb { ' +
            keys.map(function (k) { return '"' + k + '"'; }).join(' ') + ' } ?f wdt:P345 ?imdb . ' +
            'OPTIONAL { ?f wdt:P2637 ?r . ?r rdfs:label ?ru . FILTER(LANG(?ru)="ru") } ' +
            'OPTIONAL { ?f wdt:P1657 ?m . ?m rdfs:label ?mpaa . FILTER(LANG(?mpaa)="en") } ' +
            'OPTIONAL { ?f wdt:P1981 ?g . ?g rdfs:label ?fsk . FILTER(LANG(?fsk)="en") } ' +
            'OPTIONAL { ?f wdt:P3156 ?a . ?a rdfs:label ?au . FILTER(LANG(?au)="en") } }';
        fetch(ENDPOINT + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
            var by = {};
            j.results.bindings.forEach(function (b) {
                var k = b.imdb.value, d = by[k] = by[k] || {};
                ['ru', 'mpaa', 'fsk', 'au'].forEach(function (f) { if (b[f] && !d[f]) d[f] = b[f].value; });
            });
            keys.forEach(function (k) { resolveKey(k, by[k] ? normalize(by[k]) : null); });
            saveSoon();
        }).catch(function () {
            // сеть недоступна — не кэшируем, просто отвечаем «неизвестно»
            keys.forEach(function (k) {
                (waiters[k] || []).forEach(function (fn) { fn(null); });
                delete waiters[k];
            });
        });
    }

    // Promise<число|null>
    function get(item) {
        var k = tt(item);
        if (!k) return Promise.resolve(null);
        var c = cache[k];
        if (c && (c.a != null || Date.now() - c.t < TTL)) return Promise.resolve(c.a);
        return new Promise(function (resolve) {
            (waiters[k] = waiters[k] || []).push(resolve);
            queue[k] = true;
            if (!timer) timer = setTimeout(flush, 80);
        });
    }

    function cached(item) {
        var k = tt(item), c = k && cache[k];
        return c ? c.a : undefined;
    }

    function label(age) { return age == null ? '' : age + '+'; }

    /* ---- Фильтр по возрасту (глобальная настройка) ---- */

    function limit() { return Prefs.get('maxAge'); }

    function allowed(age) {
        var max = limit();
        if (max == null) return true;
        if (age == null) return Prefs.get('ageUnknown') !== 'hide';
        return age <= max;
    }

    // Отбрасывает элементы выше лимита. Без лимита возвращает список как есть.
    function filter(items) {
        if (limit() == null || !items || !items.length) return Promise.resolve(items || []);
        return Promise.all(items.map(get)).then(function (ages) {
            // элементы без type (папки, подборки) не фильтруем
            return items.filter(function (it, i) { return !it.type || allowed(ages[i]); });
        });
    }

    return { get: get, cached: cached, label: label, filter: filter, allowed: allowed, limit: limit };
})();
