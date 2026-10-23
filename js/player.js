/* Плеер: Samsung AVPlay на телевизоре, HTML5 <video> в браузере (для отладки). */

var Prefs = (function () {
    var defaults = { stream: 'hls4', quality: 'max', autoNext: true, subLang: 'off', subSize: 'm', seekStep: 10, maxAge: null, ageUnknown: 'show' };
    var data = Object.assign({}, defaults, U.store.get('prefs', {}));
    return {
        get: function (k) { return data[k]; },
        set: function (k, v) { data[k] = v; U.store.set('prefs', data); }
    };
})();

/* ---------- Адаптер AVPlay ---------- */
var AVAdapter = function () {
    var av = webapis.avplay;
    var cb = {};
    var self = this;
    var lastTime = 0;

    this.open = function (url, opts, callbacks) {
        cb = callbacks;
        try { av.stop(); } catch (e) { /* ignore */ }
        try { av.close(); } catch (e) { /* ignore */ }
        av.open(url);
        av.setDisplayRect(0, 0, 1920, 1080);
        try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e) { /* ignore */ }
        if (opts.uhd) { try { av.setStreamingProperty('SET_MODE_4K', 'TRUE'); } catch (e) { /* ignore */ } }
        av.setListener({
            onbufferingstart: function () { cb.onBuffer(true); },
            onbufferingprogress: function (p) { cb.onBuffer(true, p); },
            onbufferingcomplete: function () { cb.onBuffer(false); },
            oncurrentplaytime: function (ms) { lastTime = ms; },
            onstreamcompleted: function () { cb.onEnd(); },
            onerror: function (type) { cb.onError(String(type)); },
            onevent: function () { /* ignore */ }
        });
        var started = false;
        function start() {
            if (started) return;
            started = true;
            try { av.play(); cb.onReady(); } catch (e) { cb.onError(e.message); }
        }
        av.prepareAsync(function () {
            var ms = Math.floor((opts.start || 0) * 1000);
            if (ms > 1000) {
                setTimeout(start, 4000); // страховка, если seekTo не ответит
                try { av.seekTo(ms, start, start); } catch (e) { start(); }
            } else start();
        }, function (err) { cb.onError(err && err.name ? err.name : String(err)); });
    };
    this.play = function () { try { av.play(); } catch (e) { /* ignore */ } };
    this.pause = function () { try { av.pause(); } catch (e) { /* ignore */ } };
    this.paused = function () { try { return av.getState() === 'PAUSED'; } catch (e) { return false; } };
    this.position = function () {
        try { return av.getCurrentTime() / 1000; } catch (e) { return lastTime / 1000; }
    };
    this.duration = function () { try { return av.getDuration() / 1000; } catch (e) { return 0; } };
    this.seek = function (sec) {
        var ms = Math.max(0, Math.floor(sec * 1000));
        try { av.seekTo(ms, function () {}, function () {}); } catch (e) { /* ignore */ }
    };
    this.audioTracks = function () {
        var out = [];
        try {
            var info = av.getTotalTrackInfo();
            var current = -1;
            try {
                (av.getCurrentStreamInfo() || []).forEach(function (s) { if (s.type === 'AUDIO') current = s.index; });
            } catch (e) { /* ignore */ }
            for (var i = 0; i < info.length; i++) {
                if (info[i].type !== 'AUDIO') continue;
                var extra = {};
                try { extra = JSON.parse(info[i].extra_info); } catch (e) { /* ignore */ }
                out.push({ index: info[i].index, lang: extra.language || extra.track_lang || '', channels: extra.channels, active: info[i].index === current });
            }
        } catch (e) { /* ignore */ }
        return out;
    };
    function currentAudio() {
        var cur = -1;
        try { (av.getCurrentStreamInfo() || []).forEach(function (s) { if (s.type === 'AUDIO') cur = s.index; }); } catch (e) { /* ignore */ }
        return cur;
    }
    function audioIndexes() {
        var list = [];
        try { av.getTotalTrackInfo().forEach(function (t) { if (t.type === 'AUDIO') list.push(t.index); }); } catch (e) { /* ignore */ }
        return list;
    }
    // Одно переключение и только на существующую дорожку: setSelectTrack на HLS блокирует
    // плеер на время перебуферизации, а несуществующий номер роняет его, когда кончится буфер.
    // Проверено на Q95T (Tizen 5.5): getTotalTrackInfo/getCurrentStreamInfo нумеруют дорожки с 0,
    // а setSelectTrack ждёт номер с 1 (setSelectTrack(4) включает дорожку #3).
    U.store.del('avAudioOffset'); // поправка из прошлой версии ломала воспроизведение
    this.setAudio = function (index) {
        if (audioIndexes().indexOf(index) < 0) return;
        if (currentAudio() === index) return;
        try { av.setSelectTrack('AUDIO', index + 1); } catch (e) {
            try { av.setSelectTrack('AUDIO', index); } catch (e2) { UI.toast('Не удалось переключить дорожку'); }
        }
    };
    this.suspend = function () { try { av.suspend(); } catch (e) { /* ignore */ } };
    this.restore = function () { try { av.restore(); } catch (e) { /* ignore */ } };
    this.destroy = function () {
        try { av.stop(); } catch (e) { /* ignore */ }
        try { av.close(); } catch (e) { /* ignore */ }
    };
    return self;
};

/* ---------- Адаптер HTML5 (браузер) ---------- */
var HTML5Adapter = function (container) {
    var v = U.h('video.html5-video', { autoplay: false, playsInline: true });
    container.appendChild(v);
    var cb = {};
    this.open = function (url, opts, callbacks) {
        cb = callbacks;
        v.onwaiting = function () { cb.onBuffer(true); };
        v.onplaying = function () { cb.onBuffer(false); };
        v.onended = function () { cb.onEnd(); };
        v.onerror = function () { cb.onError('MEDIA_ERR ' + (v.error ? v.error.code : '')); };
        v.onloadedmetadata = function () {
            if (opts.start > 1) v.currentTime = opts.start;
            v.play().catch(function () { /* autoplay policy */ });
            cb.onReady();
        };
        v.src = url;
    };
    this.play = function () { v.play().catch(function () {}); };
    this.pause = function () { v.pause(); };
    this.paused = function () { return v.paused; };
    this.position = function () { return v.currentTime || 0; };
    this.duration = function () { return isFinite(v.duration) ? v.duration : 0; };
    this.seek = function (sec) { v.currentTime = Math.max(0, sec); };
    this.audioTracks = function () {
        var out = [];
        if (v.audioTracks) for (var i = 0; i < v.audioTracks.length; i++) {
            out.push({ index: i, lang: v.audioTracks[i].language, active: v.audioTracks[i].enabled });
        }
        return out;
    };
    this.setAudio = function (index) {
        if (!v.audioTracks) return;
        for (var i = 0; i < v.audioTracks.length; i++) v.audioTracks[i].enabled = i === index;
    };
    this.suspend = function () {};
    this.restore = function () {};
    this.destroy = function () { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); };
};

/* ---------- Субтитры (SRT/VTT, рендерим сами) ---------- */
var Subs = {
    parse: function (text) {
        var cues = [];
        text = text.replace(/\r/g, '').replace(/^﻿/, '');
        var blocks = text.split(/\n\n+/);
        var re = /(\d+:)?(\d{1,2}):(\d{2})[,.](\d{3})\s*-->\s*(\d+:)?(\d{1,2}):(\d{2})[,.](\d{3})/;
        blocks.forEach(function (b) {
            var lines = b.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var m = re.exec(lines[i]);
                if (!m) continue;
                var t = function (hh, mm, ss, ms) { return (hh ? parseInt(hh, 10) : 0) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10) + parseInt(ms, 10) / 1000; };
                cues.push({
                    start: t(m[1], m[2], m[3], m[4]),
                    end: t(m[5], m[6], m[7], m[8]),
                    text: lines.slice(i + 1).join('\n').replace(/<(?!\/?(i|b|u)>)[^>]+>/g, '').replace(/\{[^}]*\}/g, '')
                });
                break;
            }
        });
        return cues;
    },
    find: function (cues, t) {
        var lo = 0, hi = cues.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (cues[mid].end < t) lo = mid + 1;
            else if (cues[mid].start > t) hi = mid - 1;
            else return cues[mid];
        }
        return null;
    }
};

var LANG_NAMES = { rus: 'Русский', eng: 'English', ukr: 'Українська', ger: 'Deutsch', deu: 'Deutsch', fre: 'Français', fra: 'Français', spa: 'Español', ita: 'Italiano', jpn: '日本語', kor: '한국어', chi: '中文', zho: '中文', pol: 'Polski', por: 'Português', tur: 'Türkçe', heb: 'עברית', ara: 'العربية' };
function langName(code) { return LANG_NAMES[(code || '').toLowerCase()] || (code ? code.toUpperCase() : 'Неизвестно'); }

function audioLabel(a) {
    if (!a) return '';
    var parts = [];
    var type = a.type && (a.type.title || a.type.short_title);
    var author = a.author && a.author.title;
    if (type) parts.push(type);
    if (author) parts.push(author);
    var tech = [langName(a.lang)];
    if (a.codec) tech.push(a.codec.toUpperCase() + (a.channels ? ' ' + (a.channels > 2 ? (a.channels - 1) + '.1' : '2.0') : ''));
    return (parts.length ? parts.join(' · ') + '  —  ' : '') + tech.join(', ');
}

/* ---------- Экран плеера ---------- */
// ctx: { item, playlist: [{title, subtitle, season, video, mid, files, subtitles, audios, time, duration}], index }
Screens.player = function (ctx) {
    'use strict';
    var h = U.h;
    var item = ctx.item;
    var entry = ctx.playlist[ctx.index];
    var adapter = null;
    var media = null;      // {files, subtitles}
    var currentFile = null;
    var cues = null, subLang = Prefs.get('subLang'), lastCue = null;
    var ticker, hideTimer, markTimer, seekTimer, nextTimer;
    var seekTarget = null, seekCount = 0, lastSeekKey = 0;
    var overlayVisible = true, ended = false, closed = false, ready = false, replacing = false, lastMarkPos = -1;
    var audioPrefKey = 'aud.' + item.id;

    var titleEl = h('div.pl-title', U.splitTitle(item.title)[0]);
    var subEl = h('div.pl-sub', entry.subtitle || '');
    var clockEl = h('div.pl-clock');
    var curEl = h('span.pl-cur', '0:00'), durEl = h('span.pl-dur', '0:00');
    var fill = h('div.pl-fill'), knob = h('div.pl-knob'), seekPreview = h('div.pl-seekprev');
    var bar = h('div.pl-bar.f', { 'data-nav-up': 'none' }, [h('div.pl-track', [fill, knob]), seekPreview]);
    var playBtn = h('div.pl-btn.f.big', [UI.icon('play'), UI.icon('pause')]);
    var prevBtn = h('div.pl-btn.f', UI.icon('prev')), nextBtn = h('div.pl-btn.f', UI.icon('next'));
    var rwBtn = h('div.pl-btn.f', UI.icon('rw')), ffBtn = h('div.pl-btn.f', UI.icon('ff'));
    var audioBtn = UI.button('Озвучка', function () { audioMenu(); }, { icon: 'audio', cls: 'pl-tbtn' });
    var subsBtn = UI.button('Субтитры', function () { subsMenu(); }, { icon: 'subs', cls: 'pl-tbtn' });
    var qualBtn = UI.button('Качество', function () { qualityMenu(); }, { icon: 'quality', cls: 'pl-tbtn' });
    var subtitleBox = h('div.pl-subtitle.size-' + Prefs.get('subSize'));
    var spinner = h('div.pl-spinner', h('div.spinner'));
    var center = h('div.pl-center');
    var nextPanel = h('div.pl-next.glass.strong');

    var bottom = h('div.pl-bottom', [
        h('div.pl-times', [curEl, durEl]),
        bar,
        h('div.pl-controls', [
            h('div.pl-left', [prevBtn, rwBtn, playBtn, ffBtn, nextBtn]),
            h('div.pl-right', [audioBtn, subsBtn, qualBtn])
        ])
    ]);
    var el = h('div.player-screen', [
        h('div.pl-video'),
        subtitleBox,
        h('div.pl-overlay', [
            h('div.pl-top', [h('div', [titleEl, subEl]), clockEl]),
            center,
            bottom
        ]),
        spinner,
        nextPanel
    ]);
    el.classList.add('show-ui');

    playBtn._select = function () { togglePause(); };
    rwBtn._select = function () { seekBy(-30, true); };
    ffBtn._select = function () { seekBy(30, true); };
    prevBtn._select = function () { go(-1); };
    nextBtn._select = function () { go(1); };
    bar._select = function () { if (seekTarget != null) commitSeek(); else togglePause(); };
    if (ctx.index <= 0) prevBtn.classList.add('disabled');
    if (ctx.index >= ctx.playlist.length - 1) nextBtn.classList.add('disabled');

    /* ---- Загрузка и запуск ---- */

    function fileUrl(f, type) {
        var urls = f.urls || f.url || {};
        if (typeof urls === 'string') return urls;
        var order = [type, 'hls4', 'hls2', 'hls', 'http'];
        if (!U.hasAvplay() && !document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) order = ['http', type, 'hls4', 'hls'];
        for (var i = 0; i < order.length; i++) if (urls[order[i]]) return urls[order[i]];
        return null;
    }

    function qualityNum(f) { return parseInt(f.quality, 10) || f.h || 0; }

    function pickFile(files) {
        var sorted = files.slice().sort(function (a, b) { return qualityNum(b) - qualityNum(a); });
        var pref = Prefs.get('quality');
        if (pref === 'max') return sorted[0];
        var lim = parseInt(pref, 10);
        for (var i = 0; i < sorted.length; i++) if (qualityNum(sorted[i]) <= lim) return sorted[i];
        return sorted[sorted.length - 1];
    }

    function loadMedia() {
        if (entry.mid) {
            return API.mediaLinks(entry.mid).then(function (r) {
                if (r && r.files && r.files.length) return { files: r.files, subtitles: r.subtitles || entry.subtitles || [] };
                throw new Error('empty');
            }).catch(function () {
                return { files: entry.files || [], subtitles: entry.subtitles || [] };
            });
        }
        return Promise.resolve({ files: entry.files || [], subtitles: entry.subtitles || [] });
    }

    function start(file, startAt) {
        currentFile = file;
        var url = fileUrl(file, Prefs.get('stream'));
        if (!url) { UI.toast('Нет ссылки на видео'); return; }
        ready = false;
        spinner.classList.add('on');
        adapter.open(url, { start: startAt, uhd: qualityNum(file) >= 2160 }, {
            onReady: function () {
                ready = true;
                spinner.classList.remove('on');
                applySavedAudio();
                scheduleHide();
            },
            onBuffer: function (on) { spinner.classList.toggle('on', !!on); },
            onEnd: onEnded,
            onError: function (msg) {
                spinner.classList.remove('on');
                UI.toast('Ошибка воспроизведения: ' + msg, 6000);
            }
        });
    }

    function init() {
        adapter = U.hasAvplay() ? new AVAdapter() : new HTML5Adapter(el.querySelector('.pl-video'));
        setScreenSaver(false);
        loadMedia().then(function (m) {
            if (closed) return;
            media = m;
            if (!media.files.length) { UI.toast('Видео недоступно'); return; }
            var resume = entry.time && entry.duration && entry.time < entry.duration * 0.95 ? entry.time : 0;
            start(pickFile(media.files), resume);
            if (subLang && subLang !== 'off') {
                // сперва узнаём, какие дорожки форсированные, затем выбираем нужную
                probeSubs().then(function () {
                    if (closed || currentSub) return;
                    var s = findSub(subLang, Prefs.get('subForced'));
                    if (s) loadSubs(s);
                });
            } else probeSubs();
        });
        ticker = setInterval(tick, 250);
        markTimer = setInterval(function () { mark(false); }, 30000);
    }

    /* ---- Отображение ---- */

    function tick() {
        if (!adapter) return;
        var pos = adapter.position(), dur = adapter.duration() || entry.duration || 0;
        var shown = seekTarget != null ? seekTarget : pos;
        var pct = dur ? Math.min(1, shown / dur) : 0;
        fill.style.width = (pct * 100) + '%';
        knob.style.left = (pct * 100) + '%';
        curEl.textContent = U.fmtTime(shown);
        durEl.textContent = '−' + U.fmtTime(Math.max(0, dur - shown));
        var paused = adapter.paused();
        el.classList.toggle('paused', paused);
        var d = new Date();
        clockEl.textContent = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
        if (cues) {
            var c = Subs.find(cues, pos - (cues.shift || 0));
            if (c !== lastCue) {
                lastCue = c;
                subtitleBox.innerHTML = c ? c.text.replace(/&(?!amp;)/g, '&amp;').replace(/\n/g, '<br>') : '';
            }
        }
    }

    function showUI(focusEl) {
        overlayVisible = true;
        el.classList.add('show-ui');
        if (focusEl) Nav.focus(focusEl);
        else if (!Nav.current() || !el.contains(Nav.current())) Nav.focus(playBtn);
        scheduleHide();
    }

    function hideUI() {
        overlayVisible = false;
        el.classList.remove('show-ui');
        clearTimeout(hideTimer);
    }

    function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
            if (adapter && !adapter.paused() && !UI.hasModal() && seekTarget == null) hideUI();
        }, 5000);
    }

    /* ---- Управление ---- */

    function togglePause() {
        if (!adapter) return;
        if (adapter.paused()) { adapter.play(); scheduleHide(); }
        else { adapter.pause(); mark(false); showUI(); clearTimeout(hideTimer); }
    }

    function seekBy(delta, immediate) {
        if (!adapter || !ready) return;
        var now = Date.now();
        seekCount = now - lastSeekKey < 700 ? seekCount + 1 : 0;
        lastSeekKey = now;
        // Ускорение при удержании: 10с → 30с → 60с
        var step = Math.abs(delta);
        if (!immediate) step = seekCount > 12 ? 60 : seekCount > 4 ? 30 : Prefs.get('seekStep');
        var dur = adapter.duration() || entry.duration || 0;
        var base = seekTarget != null ? seekTarget : adapter.position();
        seekTarget = Math.max(0, Math.min(dur ? dur - 3 : Infinity, base + (delta < 0 ? -step : step)));
        el.classList.add('seeking');
        seekPreview.textContent = U.fmtTime(seekTarget);
        seekPreview.style.left = (dur ? seekTarget / dur * 100 : 0) + '%';
        tick();
        if (!overlayVisible) showUI(bar);
        clearTimeout(seekTimer);
        seekTimer = setTimeout(commitSeek, immediate ? 300 : 900);
    }

    function commitSeek() {
        clearTimeout(seekTimer);
        if (seekTarget == null) return;
        adapter.seek(seekTarget);
        seekTarget = null;
        el.classList.remove('seeking');
        lastCue = null;
        scheduleHide();
    }

    function mark(final) {
        if (!adapter || !ready) return;
        var pos = adapter.position();
        if (pos < 5 && !final) return;
        if (!final && adapter.paused() && lastMarkPos === pos) return;
        lastMarkPos = pos;
        API.markTime(item.id, entry.video, pos, entry.season).catch(function () {});
        entry.time = pos;
        if (entry.status !== 1) entry.status = 0;
    }

    function onEnded() {
        if (ended) return;
        ended = true;
        var dur = adapter.duration() || entry.duration;
        if (dur) API.markTime(item.id, entry.video, dur, entry.season).catch(function () {});
        entry.time = 0;
        entry.status = 1;
        if (ctx.index < ctx.playlist.length - 1 && Prefs.get('autoNext')) {
            var left = 10;
            var next = ctx.playlist[ctx.index + 1];
            var render = function () {
                nextPanel.innerHTML = '';
                U.append(nextPanel, [h('div.pl-next-label', 'Следующая серия через ' + left + ' с'), h('div.pl-next-title', next.subtitle || next.title), h('div.pl-next-hint', 'OK — сейчас, Назад — выйти')]);
            };
            render();
            nextPanel.classList.add('on');
            nextTimer = setInterval(function () {
                left--;
                if (left <= 0) { clearInterval(nextTimer); go(1); } else render();
            }, 1000);
        } else {
            close();
        }
    }

    function go(delta) {
        var idx = ctx.index + delta;
        if (idx < 0 || idx >= ctx.playlist.length) return;
        if (!ended) mark(true);
        clearInterval(nextTimer);
        replacing = true;
        Router.replace(Screens.player(Object.assign({}, ctx, { index: idx })));
    }

    function close() {
        if (closed) return;
        if (!ended) mark(true);
        Router.pop();
    }

    /* ---- Озвучка, субтитры, качество ---- */

    function audioOptions() {
        var tracks = adapter.audioTracks();
        var api = (media && media.audios) || entry.audios || [];
        return tracks.map(function (t, i) {
            var label = tracks.length === api.length ? audioLabel(api[i]) : langName(t.lang) + (t.channels ? ' (' + t.channels + ' кан.)' : '');
            return { label: (i + 1) + '. ' + label, value: { index: t.index, pos: i }, selected: t.active };
        });
    }

    function audioMenu() {
        var opts = audioOptions();
        if (!opts.length) {
            var api = entry.audios || [];
            if (api.length) UI.toast('Дорожки: ' + api.map(audioLabel).join('; '), 5000);
            else UI.toast('Нет доступных аудиодорожек');
            return;
        }
        UI.menu('Озвучка', opts, { wide: true }).then(function (v) {
            if (!v) return;
            adapter.setAudio(v.index);
            U.store.set(audioPrefKey, v.pos);
        });
    }

    function applySavedAudio() {
        var pos = U.store.get(audioPrefKey, null);
        if (pos == null) return;
        setTimeout(function () {
            var tracks = adapter.audioTracks();
            if (tracks[pos] && !tracks[pos].active) adapter.setAudio(tracks[pos].index);
        }, 800);
    }

    function subsList() { return (media && media.subtitles) || entry.subtitles || []; }

    /* Форсированные субтитры: API КиноПаба почти никогда их не помечает. Если у языка несколько
       дорожек, заранее скачиваем их (это небольшие тексты) и считаем реплики: в форсированных
       переведены только надписи и иностранная речь — реплик в разы меньше, чем в полных. */
    var subInfo = {};   // url -> { cues: число реплик, text }
    var subsProbe = null;

    function probeSubs() {
        if (subsProbe) return subsProbe;
        var list = subsList(), count = {}, jobs = [];
        list.forEach(function (s) { count[s.lang] = (count[s.lang] || 0) + 1; });
        list.forEach(function (s) {
            if (!s.url || count[s.lang] < 2 || subInfo[s.url]) return;
            jobs.push(fetch(s.url).then(function (r) { return r.text(); }).then(function (text) {
                subInfo[s.url] = { cues: Subs.parse(text).length, text: text };
            }).catch(function () { subInfo[s.url] = { cues: -1 }; }));
        });
        subsProbe = Promise.all(jobs);
        return subsProbe;
    }

    function isForced(s) {
        if (s.forced) return true;
        if (/forced|форс/i.test((s.url || '') + ' ' + (s.file || '') + ' ' + (s.title || ''))) return true;
        var info = subInfo[s.url], max = 0;
        if (!info || !(info.cues > 0)) return false;
        subsList().forEach(function (o) {
            var i = o.lang === s.lang && subInfo[o.url];
            if (i && i.cues > max) max = i.cues;
        });
        return info.cues < max * 0.4;
    }

    function subLabel(s) {
        var info = subInfo[s.url];
        return langName(s.lang) + (isForced(s) ? ' · форсированные' : '') +
            (info && info.cues > 0 ? '  —  ' + info.cues + ' ' + U.plural(info.cues, 'реплика', 'реплики', 'реплик') : '');
    }

    // Сохранённый выбор: язык + форсированные или нет (номер дорожки у разных серий свой)
    function findSub(lang, forced) {
        var list = subsList(), first = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].lang !== lang) continue;
            if (!first) first = list[i];
            if (forced == null || isForced(list[i]) === !!forced) return list[i];
        }
        return first;
    }

    var currentSub = null;

    function loadSubs(s) {
        cues = null;
        lastCue = null;
        currentSub = s || null;
        subtitleBox.innerHTML = '';
        if (!s || !s.url) return;
        var cached = subInfo[s.url] && subInfo[s.url].text;
        (cached ? Promise.resolve(cached) : fetch(s.url).then(function (r) { return r.text(); })).then(function (text) {
            if (currentSub !== s) return;
            cues = Subs.parse(text);
            cues.shift = s.shift || 0;
        }).catch(function () { UI.toast('Не удалось загрузить субтитры'); });
    }

    function subsMenu() {
        probeSubs().then(showSubsMenu);
    }

    function showSubsMenu() {
        var list = subsList();
        var items = [{ label: 'Выключены', value: 'off', selected: !currentSub }];
        list.forEach(function (s, i) {
            items.push({ label: subLabel(s), value: i, selected: currentSub === s });
        });
        items.push({ label: 'Размер: ' + ({ s: 'маленький', m: 'средний', l: 'большой' })[Prefs.get('subSize')], value: 'size' });
        UI.menu('Субтитры', items).then(function (v) {
            if (v === undefined) return;
            if (v === 'off') { subLang = 'off'; Prefs.set('subLang', 'off'); loadSubs(null); return; }
            if (v === 'size') {
                var next = { s: 'm', m: 'l', l: 's' }[Prefs.get('subSize')];
                Prefs.set('subSize', next);
                subtitleBox.className = 'pl-subtitle size-' + next;
                return;
            }
            subLang = list[v].lang;
            Prefs.set('subLang', subLang);
            Prefs.set('subForced', isForced(list[v]));
            loadSubs(list[v]);
        });
    }

    function qualityMenu() {
        if (!media) return;
        var type = Prefs.get('stream');
        var same = media.files.every(function (f) { return fileUrl(f, type) === fileUrl(media.files[0], type); });
        if (same && media.files.length > 1) {
            UI.toast('В режиме ' + type.toUpperCase() + ' качество подбирается автоматически. Фиксированное качество — тип потока HLS2/HLS/HTTP в настройках.', 6000);
            return;
        }
        var files = media.files.slice().sort(function (a, b) { return qualityNum(b) - qualityNum(a); });
        UI.menu('Качество', files.map(function (f) {
            return {
                label: f.quality + (f.codec ? ' · ' + f.codec.toUpperCase() : ''),
                sub: f.w && f.h ? f.w + '×' + f.h : '',
                value: f, selected: f === currentFile
            };
        })).then(function (f) {
            if (!f || f === currentFile) return;
            var pos = adapter.position();
            start(f, pos);
        });
    }

    function setScreenSaver(on) {
        try {
            webapis.appcommon.setScreenSaver(on ? webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON
                : webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
        } catch (e) { /* не на TV */ }
    }

    function onVisibility() {
        if (!adapter) return;
        if (document.hidden) { mark(true); adapter.pause(); adapter.suspend(); }
        else { adapter.restore(); showUI(); }
    }

    /* ---- Клавиши ---- */

    function onKey(code) {
        if (nextPanel.classList.contains('on')) {
            if (code === K.ENTER) { clearInterval(nextTimer); go(1); return true; }
            if (K.isBack(code)) { clearInterval(nextTimer); Router.pop(); return true; }
            return true;
        }
        switch (code) {
            case K.PLAY: if (adapter.paused()) togglePause(); return true;
            case K.PAUSE: if (!adapter.paused()) togglePause(); return true;
            case K.PLAYPAUSE: togglePause(); return true;
            case K.STOP: close(); return true;
            case K.FF: seekBy(30, true); return true;
            case K.RW: seekBy(-30, true); return true;
            case K.NEXT: case K.CH_UP: go(1); return true;
            case K.PREV: case K.CH_DOWN: go(-1); return true;
        }
        if (K.isBack(code)) {
            if (seekTarget != null) { seekTarget = null; el.classList.remove('seeking'); clearTimeout(seekTimer); return true; }
            if (overlayVisible && !adapter.paused()) { hideUI(); return true; }
            close();
            return true;
        }
        if (!overlayVisible) {
            if (code === K.LEFT) { seekBy(-1); return true; }
            if (code === K.RIGHT) { seekBy(1); return true; }
            if (code === K.ENTER) { togglePause(); showUI(playBtn); return true; }
            if (code === K.UP || code === K.DOWN || code === K.INFO) { showUI(); return true; }
            return true;
        }
        scheduleHide();
        if (Nav.current() === bar) {
            if (code === K.LEFT) { seekBy(-1); return true; }
            if (code === K.RIGHT) { seekBy(1); return true; }
            if (code === K.ENTER) { if (seekTarget != null) commitSeek(); else togglePause(); return true; }
        }
        return false;
    }

    document.addEventListener('visibilitychange', onVisibility);
    setTimeout(init, 0);

    return {
        el: el,
        container: document.getElementById('player-root'),
        onKey: onKey,
        focusTarget: function () { return playBtn; },
        onShow: function () { document.body.classList.add('playing'); },
        destroy: function () {
            closed = true;
            clearInterval(ticker); clearInterval(markTimer); clearInterval(nextTimer);
            clearTimeout(hideTimer); clearTimeout(seekTimer);
            document.removeEventListener('visibilitychange', onVisibility);
            if (adapter) adapter.destroy();
            setScreenSaver(true);
            // Если плеер заменяется следующей серией, класс сразу вернётся в onShow
            document.body.classList.remove('playing');
            if (ctx.onClose && !replacing) ctx.onClose(ctx.playlist);
        }
    };
};

// Запуск плеера из любой точки приложения
var Player = {
    open: function (ctx) { Router.push(Screens.player(ctx)); }
};
