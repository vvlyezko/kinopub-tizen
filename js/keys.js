/* Коды клавиш пульта Samsung и регистрация медиа-кнопок. */
var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 10009, ESC: 27, BACKSPACE: 8, EXIT: 10182,
    PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413,
    FF: 417, RW: 412, NEXT: 10233, PREV: 10232,
    CH_UP: 427, CH_DOWN: 428,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, INFO: 457,
    IME_DONE: 65376, IME_CANCEL: 65385,

    isBack: function (c) { return c === K.BACK || c === K.ESC || c === K.BACKSPACE; },

    register: function () {
        if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;
        ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
            'MediaTrackPrevious', 'MediaTrackNext', 'ChannelUp', 'ChannelDown', 'Info',
            'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'
        ].forEach(function (name) {
            try { tizen.tvinputdevice.registerKey(name); } catch (e) { /* клавиши может не быть */ }
        });
    }
};
