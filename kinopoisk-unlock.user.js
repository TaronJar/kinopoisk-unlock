// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    kinopoisk-unlock
// @version      2.3
// @description  Смотрите фильмы бесплатно.
// @author       TaronJar
// @match        https://www.kinopoisk.ru/*
// @match        https://hd.kinopoisk.ru/*
// @icon         https://www.kinopoisk.ru/favicon.ico
// @homepageURL  https://github.com/TaronJar/kinopoisk-unlock
// @updateURL    https://github.com/TaronJar/kinopoisk-unlock/raw/main/kinopoisk-unlock.user.js
// @downloadURL  https://github.com/TaronJar/kinopoisk-unlock/raw/main/kinopoisk-unlock.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const PIRATE_DOMAIN = "kinopoisk.cam";
    const BUTTON_ID = "pirate-watch-btn";

    // Матчер — ловит film, series, anime и другие страницы с ID
    const KINOPOISK_MATCHER = /kinopoisk\.ru\/(film|series|anime|media|person)\/.*/;

    let previousUrl = '';

    const logger = {
        info: (...args) => console.info('[Kinopoisk Unlock]', ...args),
        warn: (...args) => console.warn('[Kinopoisk Unlock]', ...args),
    };

    /**
     * Получает текущий URL без параметров и хеша
     */
    function getCurrentURL() {
        return location.origin + location.pathname;
    }

    /**
     * Извлекает ID фильма из URL или __NEXT_DATA__ (для HD-версии)
     */
    function extractKinopoiskId() {
        const url = getCurrentURL();

        if (!url.match(KINOPOISK_MATCHER)) return null;

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
            // Фоллбэк — ID из URL (hex, 24 или 32 символа)
            const hexMatch = url.match(/\/([a-f0-9]{20,32})/);
            if (hexMatch) return hexMatch[1];
        }

        // Обычный Кинопоиск — ID в URL: /film/12345/
        const classicMatch = url.match(/\/(\d+)\//);
        if (classicMatch) return classicMatch[1];

        return null;
    }

    /**
     * Удаляет кнопку
     */
    function removeButton() {
        document.getElementById(BUTTON_ID)?.remove();
    }

    /**
     * Вставляет кнопку рядом с "Буду смотреть"
     */
    function injectButton() {
        const url = getCurrentURL();
        const urlMatches = url.match(KINOPOISK_MATCHER);

        // Убираем кнопку если не на странице фильма
        if (!urlMatches) {
            removeButton();
            return;
        }

        // Если кнопка уже есть и URL не менялся — пропускаем
        if (url === previousUrl && document.getElementById(BUTTON_ID)) return;

        previousUrl = url;

        const id = extractKinopoiskId();
        if (!id) {
            removeButton();
            return;
        }
        if (document.getElementById(BUTTON_ID)) return;

        // Ищем кнопку "Буду смотреть" по title, aria-label или тексту
        const allButtons = document.querySelectorAll('button');
        let target = null;
        for (const b of allButtons) {
            const btnTitle = b.getAttribute('title');
            const ariaLabel = b.getAttribute('aria-label');
            const text = b.textContent.replace(/\s+/g, ' ').trim();
            if (btnTitle === 'Буду смотреть' || ariaLabel === 'Буду смотреть' || text === 'Буду смотреть') {
                target = b;
                break;
            }
        }
        if (!target) return;

        // Создаём кнопку в стиле Кинопоиска
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.textContent = 'Смотреть бесплатно';

        Object.assign(btn.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '0 22px',
            height: '52px',
            marginLeft: '12px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            color: '#000',
            border: 'none',
            borderRadius: '52px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'background 0.2s ease, transform 0.2s ease',
            lineHeight: '1',
            whiteSpace: 'nowrap',
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            boxSizing: 'border-box',
            outline: 'none',
        });

        btn.onmouseover = () => {
            btn.style.backgroundColor = 'rgba(0,0,0,0.1)';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = 'rgba(0,0,0,0.05)';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            const url = new URL(location.href);
            url.hostname = PIRATE_DOMAIN;
            window.open(url, '_blank');
        };

        // Вставляем рядом с найденной кнопкой
        const wrapper = document.createElement('div');
        wrapper.style.display = 'contents';
        wrapper.appendChild(btn);

        const btnContainer = target.closest('[class*="button"]') || target.parentElement;
        if (btnContainer) {
            btnContainer.appendChild(wrapper);
        } else {
            target.after(wrapper);
        }

        logger.info('Кнопка вставлена, ID:', id);
    }

    // MutationObserver — следим за изменениями DOM
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document, { subtree: true, childList: true });

    // Первый запуск
    injectButton();
})();
