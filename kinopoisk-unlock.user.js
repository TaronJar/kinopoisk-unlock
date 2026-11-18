// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    https://github.com/TaronJar/kinopoisk-unlock
// @version      3.1.0
// @description  Удобная кнопка перехода со страниц Кинопоиска.
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

    const CONFIG = Object.freeze({
        buttonId: 'kp-unlock-watch-button',
        styleId: 'kp-unlock-styles',
        externalDomain: 'kino.vin',
        supportedHosts: new Set(['www.kinopoisk.ru', 'hd.kinopoisk.ru']),
        supportedPath: /^\/(?:film|series|anime|media)\/([^/?#]+)\/?/i,
        classicId: /^\d+$/,
        hdId: /^[a-f0-9]{20,32}$/i,
        buttonLabel: 'Смотреть',
        buttonTitle: 'Смотреть'
    });

    const SELECTORS = [
        '[data-tid="ContentActions"] button[title="Буду смотреть"]',
        '[data-tid="ContentActions"] button[aria-label="Буду смотреть"]',
        '.styles_buttons__IoJ0k button[title="Буду смотреть"]',
        '.styles_buttons__IoJ0k button[aria-label="Буду смотреть"]'
    ];

    let frameRequested = false;

    const logger = {
        info: (...args) => console.info('[Kinopoisk Unlock]', ...args),
        warn: (...args) => console.warn('[Kinopoisk Unlock]', ...args)
    };

    function getPage() {
        if (!CONFIG.supportedHosts.has(location.hostname)) return null;

        const match = location.pathname.match(CONFIG.supportedPath);
        if (!match) return null;

        return {
            host: location.hostname,
            pathname: location.pathname,
            pageKey: location.origin + location.pathname,
            routeId: match[1]
        };
    }

    function extractHdId() {
        const dataElement = document.getElementById('__NEXT_DATA__');

        if (dataElement) {
            try {
                const data = JSON.parse(dataElement.textContent || '{}');
                const apolloData = data?.props?.pageProps?.apolloState?.data;
                const entities = apolloData && typeof apolloData === 'object'
                    ? Object.values(apolloData)
                    : [];

                const entity = entities.find(item =>
                    item &&
                    (item.__typename === 'TvSeries' || item.__typename === 'Film') &&
                    item.id !== undefined &&
                    item.id !== null
                );

                if (entity && (typeof entity.id === 'string' || typeof entity.id === 'number')) {
                    const id = String(entity.id).trim();
                    if (id && id.length <= 128) return id;
                }
            } catch (error) {
                logger.warn('Не удалось прочитать ID из __NEXT_DATA__:', error);
            }
        }

        // Резервный вариант работает и тогда, когда __NEXT_DATA__ отсутствует.
        const pathMatch = location.pathname.match(/\/([a-f0-9]{20,32})(?:\/|$)/i);
        return pathMatch ? pathMatch[1] : null;
    }

    function extractKinopoiskId(page) {
        if (!page) return null;

        if (page.host === 'hd.kinopoisk.ru') {
            return extractHdId();
        }

        return CONFIG.classicId.test(page.routeId) ? page.routeId : null;
    }

    function removeButton() {
        document.getElementById(CONFIG.buttonId)?.remove();
    }

    function findWatchButton() {
        for (const selector of SELECTORS) {
            const button = document.querySelector(selector);
            if (button) return button;
        }

        // Текстовый fallback оставлен на случай изменения атрибутов кнопки.
        return Array.from(document.querySelectorAll('button')).find(button => {
            const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
            return text === 'Буду смотреть';
        }) || null;
    }

    function injectStyles() {
        if (document.getElementById(CONFIG.styleId)) return;

        // Оставляем оригинальные стили Кинопоиска. Добавляем только отступ
        // и доступное состояние фокуса, не переопределяя форму, цвет и анимации.
        const style = document.createElement('style');
        style.id = CONFIG.styleId;
        style.textContent = [
            '#' + CONFIG.buttonId + ' {',
            '  margin-inline-start: 10px !important;',
            '}',
            '#' + CONFIG.buttonId + ':focus-visible {',
            '  outline: 2px solid currentColor !important;',
            '  outline-offset: 3px !important;',
            '}'
        ].join('\n');

        (document.head || document.documentElement).appendChild(style);
    }

    function createButton(target, page, id) {
        // Клонируем настоящую кнопку Кинопоиска: так сохраняются её CSS-классы,
        // вложенная разметка, иконка, размеры, скругления и штатные анимации.
        // cloneNode не переносит обработчики событий исходной кнопки.
        const button = target.cloneNode(true);

        button.id = CONFIG.buttonId;
        button.type = 'button';
        button.disabled = false;
        button.removeAttribute('aria-pressed');
        button.removeAttribute('aria-checked');
        button.setAttribute('aria-label', CONFIG.buttonLabel);
        button.title = CONFIG.buttonLabel;
        button.dataset.pageKey = page.pageKey;
        button.dataset.kinopoiskId = id;

        // Удаляем возможные дублирующиеся ID из скопированной внутренней разметки.
        button.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));

        // Меняем только подпись, не трогая SVG и другие декоративные элементы.
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        let textNode;
        let replaced = false;
        while ((textNode = walker.nextNode())) {
            if (textNode.nodeValue.trim()) {
                textNode.nodeValue = textNode.nodeValue.replace('Буду смотреть', CONFIG.buttonLabel);
                replaced = true;
            }
        }

        if (!replaced) {
            const label = document.createElement('span');
            label.textContent = CONFIG.buttonLabel;
            button.appendChild(label);
        }

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();

            const destination = new URL(location.href);
            destination.hostname = CONFIG.externalDomain;

            // Открываем только заранее заданный домен назначения.
            window.open(destination.href, '_blank', 'noopener,noreferrer');
        });

        return button;
    }

    function syncButton() {
        frameRequested = false;

        const page = getPage();
        const existingButton = document.getElementById(CONFIG.buttonId);

        if (!page) {
            removeButton();
                return;
        }

        if (existingButton && existingButton.dataset.pageKey !== page.pageKey) {
            existingButton.remove();
        }

        const id = extractKinopoiskId(page);
        if (!id) {
            removeButton();
            return;
        }

        const currentButton = document.getElementById(CONFIG.buttonId);
        if (currentButton && currentButton.isConnected && currentButton.dataset.pageKey === page.pageKey) {
            return;
        }

        const target = findWatchButton();
        if (!target) {
            return;
        }

        injectStyles();
        const button = createButton(target, page, id);
        target.insertAdjacentElement('afterend', button);

        logger.info('Кнопка добавлена для страницы:', page.pageKey);
    }

    function scheduleSync() {
        if (frameRequested) return;
        frameRequested = true;
        requestAnimationFrame(syncButton);
    }

    function hookHistoryNavigation() {
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            if (typeof original !== 'function' || original.__kpUnlockWrapped) continue;

            const wrapped = function (...args) {
                const result = original.apply(this, args);
                window.dispatchEvent(new Event('kp-unlock:navigate'));
                return result;
            };

            wrapped.__kpUnlockWrapped = true;
            try {
                history[method] = wrapped;
            } catch (error) {
                logger.warn('Не удалось подключить отслеживание ' + method + ':', error);
            }
        }

        window.addEventListener('popstate', scheduleSync);
        window.addEventListener('kp-unlock:navigate', scheduleSync);
    }

    function observePage() {
        const observer = new MutationObserver(scheduleSync);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        hookHistoryNavigation();
        observePage();
        scheduleSync();
    }

    init();
})();