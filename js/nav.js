/* Пространственная навигация пультом.
   Фокусируемые элементы имеют класс .f, группы с памятью фокуса — .grp,
   горизонтальные скроллеры — .sx, вертикальные — .sy. */
var Nav = (function () {
    'use strict';

    var cur = null;
    var scope = null;

    function visible(el) {
        if (!el || !el.isConnected) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    // Контейнер с data-trap="v" (боковое меню) изолирован по вертикали:
    // изнутри стрелки вверх/вниз не выпускают фокус наружу, а снаружи не заводят внутрь.
    // В меню попадают только стрелкой влево.
    function trapOf(el) {
        for (var n = el; n && n !== scope; n = n.parentElement) {
            if (n.getAttribute && n.getAttribute('data-trap') === 'v') return n;
        }
        return null;
    }

    function candidates(dir) {
        if (!scope) return [];
        var vertical = dir === 'up' || dir === 'down';
        var myTrap = vertical ? trapOf(cur) : null;
        var list = (myTrap || scope).querySelectorAll('.f');
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            if (el === cur || el.classList.contains('disabled')) continue;
            if (vertical && !myTrap && trapOf(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) out.push({ el: el, r: r });
        }
        return out;
    }

    function group(el) {
        while (el && el !== scope) {
            if (el.classList && el.classList.contains('grp')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function findBest(dir) {
        if (!cur) return null;
        var a = cur.getBoundingClientRect();
        var acx = (a.left + a.right) / 2, acy = (a.top + a.bottom) / 2;
        var best = null, bestScore = Infinity;
        // По горизонтали сначала ищем в том же ряду (элементы, перекрывающиеся по высоте),
        // и только если там пусто — выше/ниже. Иначе из плеера с кнопки «+30 с» фокус уходил
        // на полосу прогресса вместо кнопок «Озвучка/Субтитры/Качество».
        var sameRow = false;
        candidates(dir).forEach(function (c) {
            var b = c.r, primary, perp, inRow = false;
            var bcx = (b.left + b.right) / 2, bcy = (b.top + b.bottom) / 2;
            if (dir === 'left' || dir === 'right') {
                primary = dir === 'right' ? b.left - a.right : a.left - b.right;
                if ((dir === 'right' ? bcx - acx : acx - bcx) <= 1) return;
                var overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                inRow = overlapY > 0;
                perp = inRow ? 0 : Math.abs(bcy - acy);
            } else {
                primary = dir === 'down' ? b.top - a.bottom : a.top - b.bottom;
                if ((dir === 'down' ? bcy - acy : acy - bcy) <= 1) return;
                var overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                perp = overlapX > 0 ? 0 : Math.abs(bcx - acx) / 2;
            }
            if (sameRow && !inRow) return;
            var score = Math.max(primary, 0) + perp * 4;
            if ((inRow && !sameRow) || score < bestScore) { bestScore = score; best = c.el; }
            if (inRow) sameRow = true;
        });
        if (!best) return null;
        // При входе в другую группу (ряд, меню) возвращаемся к последнему элементу в ней
        var g = group(best);
        if (g && g !== group(cur) && g._last && g.contains(g._last) && visible(g._last)) best = g._last;
        return best;
    }

    /* Прокрутка.
       На TV браузер рисует силами процессора, и scrollLeft/scrollTop заставляют перерисовывать
       весь ряд на каждом кадре. Поэтому контейнер .sx/.sy не прокручивается, а сдвигает
       свой единственный дочерний элемент через transform: это делает видеокарта без перерисовки. */

    // Смещение элемента относительно предка по цепочке offsetParent (не зависит от transform)
    function offsetWithin(el, ancestor) {
        var x = 0, y = 0, n = el;
        while (n && n !== ancestor) {
            x += n.offsetLeft; y += n.offsetTop;
            var op = n.offsetParent;
            if (!op || !ancestor.contains(op) && op !== ancestor) break;
            n = op;
        }
        return { x: x, y: y };
    }

    function setShift(p, x, y) {
        var inner = p.firstElementChild;
        if (!inner) return;
        p._x = x; p._y = y;
        inner.style.transform = 'translate3d(' + (-x) + 'px,' + (-y) + 'px,0)';
    }

    function resetScroll(p) {
        if (!p) return;
        var inner = p.firstElementChild;
        if (inner) {
            inner.style.transition = 'none';
            setShift(p, 0, 0);
            void inner.offsetWidth;
            inner.style.transition = '';
        }
    }

    // Сдвигаем контейнеры так, чтобы элемент оказался в зоне видимости.
    function ensureVisible(el) {
        var p = el.parentElement;
        while (p && p !== document.body) {
            var cls = p.classList;
            if (cls.contains('sx') || cls.contains('sy')) {
                var inner = p.firstElementChild;
                if (inner && inner.contains(el)) {
                    var x = p._x || 0, y = p._y || 0;
                    var pad = +(p.getAttribute('data-pad') || (cls.contains('sx') ? 80 : 40));
                    if (cls.contains('sx')) {
                        var o = offsetWithin(el, inner), w = el.offsetWidth, vw = p.clientWidth;
                        if (o.x - x < pad) x = o.x - pad;
                        else if (o.x + w - x > vw - pad) x = o.x + w - vw + pad;
                        x = Math.max(0, x);
                    }
                    if (cls.contains('sy')) {
                        // выравниваем по ближайшему ряду (.row), иначе по самому элементу
                        var row = el;
                        for (var n = el; n && n !== inner; n = n.parentElement) if (n.classList.contains('row')) { row = n; break; }
                        var top = offsetWithin(row, inner).y, rh = row.offsetHeight, vh = p.clientHeight;
                        var maxY = Math.max(0, inner.offsetHeight - vh + pad);
                        if ((p.getAttribute('data-align') || 'start') === 'start') y = top - pad;
                        else if (top - y < pad) y = top - pad;
                        else if (top + rh - y > vh - pad) y = top + rh - vh + pad;
                        y = Math.max(0, Math.min(y, maxY));
                    }
                    if (x !== (p._x || 0) || y !== (p._y || 0)) setShift(p, x, y);
                }
            }
            p = p.parentElement;
        }
    }

    function focus(el, silent) {
        if (!el) return;
        if (cur && cur !== el) cur.classList.remove('focused');
        cur = el;
        el.classList.add('focused');
        for (var g = el.parentElement; g && g !== document.body; g = g.parentElement) {
            if (g.classList.contains('grp')) g._last = el;
        }
        if (scope) scope._lastFocus = el;
        ensureVisible(el);
        if (!silent) el.dispatchEvent(new CustomEvent('navfocus', { bubbles: true, detail: el }));
    }

    function first(root) {
        var list = (root || scope).querySelectorAll('.f');
        for (var i = 0; i < list.length; i++) if (visible(list[i]) && !list[i].classList.contains('disabled')) return list[i];
        return null;
    }

    function move(dir) {
        if (!cur || !visible(cur) || (scope && !scope.contains(cur))) { focus(first()); return true; }
        var stop = cur.getAttribute('data-nav-' + dir);
        if (stop === 'none') return false;
        var next = findBest(dir);
        if (next) { focus(next); return true; }
        return false;
    }

    function select() {
        if (!cur) return false;
        if (cur._select) { cur._select(cur); return true; }
        return false;
    }

    // Мышь/тачпад (удобно при отладке в браузере и для Smart Remote с указкой)
    // Chrome шлёт синтетический mousemove при прокрутке — реагируем только на реальное движение
    var mx = -1, my = -1;
    document.addEventListener('mousemove', function (e) {
        if (Math.abs(e.screenX - mx) < 3 && Math.abs(e.screenY - my) < 3) return;
        var first = mx < 0;
        mx = e.screenX; my = e.screenY;
        if (first) return;
        var el = e.target.closest ? e.target.closest('.f') : null;
        if (el && scope && scope.contains(el) && el !== cur) focus(el);
    });
    document.addEventListener('click', function (e) {
        var el = e.target.closest ? e.target.closest('.f') : null;
        if (el && scope && scope.contains(el)) { focus(el); select(); }
    });

    return {
        focus: focus,
        move: move,
        select: select,
        first: first,
        current: function () { return cur; },
        scope: function () { return scope; },
        setScope: function (root, el) {
            scope = root;
            var target = el || (root && root._lastFocus && root.contains(root._lastFocus) ? root._lastFocus : null) || first(root);
            if (target) focus(target);
        },
        ensureVisible: ensureVisible,
        resetScroll: resetScroll,
        scrollTo: setShift
    };
})();
