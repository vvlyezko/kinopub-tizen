/* Общие утилиты. Код намеренно в стиле ES2017 без ?. и ?? —
   движок Tizen 5.5 (Chromium 69) их не поддерживает. */
var U = (function () {
    'use strict';

    function append(el, kid) {
        if (kid == null || kid === false) return;
        if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
        el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }

    // h('div.card.f', {onclick: fn, text: 'x'}, [children])
    function h(sel, attrs, kids) {
        var parts = sel.split('.');
        var el = document.createElement(parts[0] || 'div');
        if (parts.length > 1) el.className = parts.slice(1).join(' ');
        if (attrs != null && (Array.isArray(attrs) || typeof attrs !== 'object' || attrs.nodeType)) {
            kids = attrs; attrs = null;
        }
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v == null || v === false) return;
                if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
                else if (k === 'text') el.textContent = v;
                else if (k === 'html') el.innerHTML = v;
                else if (k === 'cls') el.className += ' ' + v;
                else if (k === 'select') el._select = v;
                else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
                else if (k.indexOf('data-') === 0 || k === 'src' && el.tagName !== 'IMG') el.setAttribute(k, v);
                else el[k] = v;
            });
        }
        append(el, kids);
        return el;
    }

    function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    // 3725 -> "1:02:05"
    function fmtTime(sec) {
        sec = Math.max(0, Math.floor(sec || 0));
        var hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
        return (hh ? hh + ':' + pad2(mm) : mm) + ':' + pad2(ss);
    }

    // 7260 -> "2 ч 1 мин"
    function fmtDuration(sec) {
        sec = Math.round(sec || 0);
        if (!sec) return '';
        var hh = Math.floor(sec / 3600), mm = Math.round(sec % 3600 / 60);
        if (mm === 60) { hh++; mm = 0; }
        return (hh ? hh + ' ч ' : '') + (mm ? mm + ' мин' : '');
    }

    function plural(n, one, few, many) {
        var m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
        return many;
    }

    function query(params) {
        var out = [];
        Object.keys(params || {}).forEach(function (k) {
            var v = params[k];
            if (v == null || v === '') return;
            if (Array.isArray(v)) v.forEach(function (x) { out.push(encodeURIComponent(k) + '[]=' + encodeURIComponent(x)); });
            else out.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        });
        return out.join('&');
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var args = arguments, self = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    }

    var store = {
        get: function (k, def) {
            try {
                var v = localStorage.getItem('kp.' + k);
                return v == null ? def : JSON.parse(v);
            } catch (e) { return def; }
        },
        set: function (k, v) {
            try { localStorage.setItem('kp.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
        },
        del: function (k) {
            try { localStorage.removeItem('kp.' + k); } catch (e) { /* ignore */ }
        }
    };

    // "Название / Original" -> ['Название', 'Original']
    function splitTitle(t) {
        t = t || '';
        var i = t.indexOf(' / ');
        return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 3)];
    }

    function poster(item, size) {
        var p = item && item.posters;
        if (!p) return '';
        return p[size || 'medium'] || p.medium || p.small || p.big || '';
    }

    function backdrop(item) {
        var p = item && item.posters;
        if (!p) return '';
        return p.wide || p.big || p.medium || '';
    }

    var TYPE_NAMES = {
        movie: 'Фильм', serial: 'Сериал', '3D': '3D', concert: 'Концерт',
        documovie: 'Документальный фильм', docuserial: 'Документальный сериал', tvshow: 'ТВ шоу'
    };

    function isSerialType(t) { return t === 'serial' || t === 'docuserial' || t === 'tvshow'; }

    function num(v, digits) {
        var n = parseFloat(v);
        if (!n) return '';
        return n.toFixed(digits == null ? 1 : digits);
    }

    return {
        h: h, clear: clear, append: append, fmtTime: fmtTime, fmtDuration: fmtDuration,
        plural: plural, query: query, debounce: debounce, store: store, splitTitle: splitTitle,
        poster: poster, backdrop: backdrop, TYPE_NAMES: TYPE_NAMES, isSerialType: isSerialType, num: num,
        isTizen: typeof tizen !== 'undefined',
        hasAvplay: function () { return typeof webapis !== 'undefined' && !!webapis.avplay; }
    };
})();
