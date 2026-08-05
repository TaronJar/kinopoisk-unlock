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

        // Ищем кнопку "Буду смотреть" по title или тексту
        const allButtons = document.querySelectorAll('button');
        let target = null;
        for (const b of allButtons) {
            const title = b.getAttribute('title');
            const text = b.textContent.replace(/\s+/g, ' ').trim();
            if (title === 'Буду смотреть' || text === 'Буду смотреть') {
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
            padding: '0 20px',
            height: '52px',
            backgroundColor: '#f5f5f5',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '26px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'transform 0.2s ease, background-color 0.2s ease',
            lineHeight: '1',
            whiteSpace: 'nowrap',
            opacity: '0',
            transform: 'translateY(4px) scale(1)',
            boxSizing: 'border-box',
        });

        // Плавное появление
        requestAnimationFrame(() => {
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0) scale(1)';
        });

        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.03)';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            const url = new URL(location.href);
            url.hostname = PIRATE_DOMAIN;
            window.open(url, '_blank');
        };

        // Оборачиваем как оригинальные кнопки и вставляем в тот же контейнер
        const wrapper = document.createElement('div');
        wrapper.style.display = 'contents';
        wrapper.appendChild(btn);

        const container = target.closest('.styles_button__bW_ew')?.parentElement;
        if (container) {
            const newBtnWrap = document.createElement('div');
            newBtnWrap.className = 'styles_button__bW_ew';
            newBtnWrap.appendChild(btn);
            container.appendChild(newBtnWrap);
        } else {
            target.parentElement?.appendChild(wrapper);
        }

        logger.info('Кнопка вставлена, ID:', id);
    }

    // MutationObserver — следим за изменениями DOM (как Tape Operator)
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document, { subtree: true, childList: true });

    // Первый запуск
    injectButton();
})();
