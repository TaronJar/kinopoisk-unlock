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
            padding: '1.7rem 2.6rem',
            height: '5.2rem',
            marginLeft: '0.8rem',
            backgroundColor: '#ff5c00',
            color: '#fff',
            border: 'none',
            borderRadius: '5.2rem',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1.6rem',
            lineHeight: '1.8rem',
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
            btn.style.backgroundColor = '#e05200';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = '#ff5c00';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            const url = new URL(location.href);
            // Для HD версии используем hd.kinopoisk.cam
            if (location.hostname === 'hd.kinopoisk.ru') {
                url.hostname = 'hd.' + PIRATE_DOMAIN;
            } else {
                url.hostname = PIRATE_DOMAIN;
            }
            window.open(url, '_blank');
        };

        // Вставляем внутрь контейнера кнопок
        const buttonsContainer = document.querySelector('[data-tid="ContentActions"] .styles_buttons__IoJ0k') ||
                                  target.closest('.styles_buttons__IoJ0k') ||
                                  target.closest('[class*="buttons"]');
        if (buttonsContainer) {
            buttonsContainer.appendChild(btn);
        } else {
            target.after(btn);
        }

        logger.info('Кнопка вставлена, ID:', id);
    }

    // MutationObserver — следим за изменениями DOM
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document, { subtree: true, childList: true });

    // Первый запуск
    injectButton();
})();
