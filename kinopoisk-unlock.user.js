// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    kinopoisk-unlock
// @version      2.2
// @description  Смотрите фильмы бесплатно. Стриминг: habster.sbs | Telegram: t.me/+mOb82x-ajswzYmZi
// @author       TaronJar
// @match        https://www.kinopoisk.ru/*
// @match        https://hd.kinopoisk.ru/*
// @icon         https://www.kinopoisk.ru/favicon.ico
// @updateURL    https://github.com/TaronJar/kinopoisk-unlock/raw/main/kinopoisk-unlock.user.js
// @downloadURL  https://github.com/TaronJar/kinopoisk-unlock/raw/main/kinopoisk-unlock.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const PIRATE_DOMAIN = "kinopoisk.cam";
    const BUTTON_ID = "pirate-watch-btn";

    const logger = {
        info: (...args) => console.info('[Kinopoisk Unlock]', ...args),
        warn: (...args) => console.warn('[Kinopoisk Unlock]', ...args),
    };

    /**
     * Извлекает ID фильма из URL или __NEXT_DATA__ (для HD-версии)
     */
    function extractKinopoiskId() {
        const url = location.origin + location.pathname;

        // Обычный Кинопоиск — ID в URL: /film/12345/
        const classicMatch = url.match(/\/(\d+)\//);
        if (classicMatch) return classicMatch[1];

        // Kinopoisk HD — ID в JSON-данных страницы
        if (location.hostname === 'hd.kinopoisk.ru') {
            try {
                const el = document.getElementById('__NEXT_DATA__');
                if (!el) return null;
                const data = JSON.parse(el.innerText);
                const apollo = Object.values(data?.props?.pageProps?.apolloState?.data || {});
                const found = apollo.find(item =>
                    item?.__typename === 'TvSeries' || item?.__typename === 'Film'
                );
                if (found?.id) return String(found.id);
            } catch (e) {
                logger.warn('Не удалось извлечь ID из __NEXT_DATA__:', e);
            }
        }

        return null;
    }

    /**
     * Вставляет кнопку рядом с "Буду смотреть"
     */
    function injectButton() {
        const id = extractKinopoiskId();
        if (!id) {
            document.getElementById(BUTTON_ID)?.remove();
            return;
        }
        if (document.getElementById(BUTTON_ID)) return;

        // Ищем кнопку "Буду смотреть"
        const allButtons = document.querySelectorAll('button');
        let target = null;
        for (const b of allButtons) {
            if (b.textContent.trim() === 'Буду смотреть') {
                target = b;
                break;
            }
        }
        if (!target) return;

        // Создаём кнопку
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.textContent = 'Смотреть бесплатно';

        Object.assign(btn.style, {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            marginLeft: '8px',
            backgroundColor: '#ff5c00',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            fontFamily: 'YS Text, sans-serif',
            transition: 'background-color 0.2s, transform 0.15s',
            lineHeight: '1',
            whiteSpace: 'nowrap',
            opacity: '0',
            transform: 'translateY(4px)',
        });

        // Плавное появление
        requestAnimationFrame(() => {
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
        });

        btn.onmouseover = () => {
            btn.style.backgroundColor = '#e05200';
            btn.style.transform = 'scale(1.03)';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = '#ff5c00';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            const url = new URL(location.href);
            url.hostname = PIRATE_DOMAIN;
            window.open(url, '_blank');
        };

        // Вставляем рядом с "Буду смотреть"
        if (target.parentElement) {
            target.parentElement.insertBefore(btn, target.nextSibling);
        } else {
            target.after(btn);
        }

        logger.info('Кнопка вставлена, ID:', id);
    }

    // MutationObserver — следим за изменениями DOM (как Tape Operator)
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document, { subtree: true, childList: true });

    // Первый запуск
    injectButton();
})();
