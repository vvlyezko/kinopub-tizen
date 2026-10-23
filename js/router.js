/* Стек экранов. Корневые разделы живут внутри оболочки с боковым меню,
   вложенные экраны (карточка фильма, серии, плеер) открываются поверх. */
var Router = (function () {
    'use strict';

    var root = null;
    var stack = [];
    var shell, content, layers;

    function init() {
        shell = document.getElementById('shell');
        content = document.getElementById('content');
        layers = document.getElementById('layers');
    }

    function top() { return stack.length ? stack[stack.length - 1] : root; }

    function setRoot(screen, focusContent) {
        while (stack.length) popSilently();
        if (root) {
            if (root.destroy) root.destroy();
            root.el.remove();
        }
        root = screen;
        content.appendChild(screen.el);
        shell.classList.remove('covered');
        if (screen.onShow) screen.onShow();
        if (focusContent === false) return;
        Nav.setScope(shell, screen.focusTarget ? screen.focusTarget() : Nav.first(screen.el));
    }

    function push(screen) {
        var prev = top();
        if (prev && prev.onHide) prev.onHide();
        if (prev && prev !== root) prev.el.classList.add('covered');
        shell.classList.add('covered');
        screen.el.classList.add('layer');
        (screen.container || layers).appendChild(screen.el);
        stack.push(screen);
        if (screen.onShow) screen.onShow();
        Nav.setScope(screen.el, screen.focusTarget ? screen.focusTarget() : null);
    }

    function popSilently() {
        var s = stack.pop();
        if (s.destroy) s.destroy();
        s.el.remove();
    }

    function pop() {
        if (!stack.length) return false;
        popSilently();
        var t = top();
        if (t === root) {
            shell.classList.remove('covered');
            Nav.setScope(shell);
        } else {
            t.el.classList.remove('covered');
            Nav.setScope(t.el);
        }
        if (t && t.onResume) t.onResume();
        return true;
    }

    // Заменить верхний экран (например, следующая серия в плеере)
    function replace(screen) {
        if (stack.length) popSilently();
        push(screen);
    }

    return {
        init: init, setRoot: setRoot, push: push, pop: pop, replace: replace, top: top,
        root: function () { return root; },
        depth: function () { return stack.length; },
        // Найти экран определённого вида в стеке (для обновления после просмотра)
        each: function (fn) { if (root) fn(root); stack.forEach(fn); }
    };
})();
