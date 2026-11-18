// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    https://github.com/TaronJar/kinopoisk-unlock
// @version      3.0.0
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
        buttonTitle: 'Открыть на Kino.vin'
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

        const style = document.createElement('style');
        style.id = CONFIG.styleId;
        style.textContent = [
            '#' + CONFIG.buttonId + ' {',
            '  --kp-unlock-bg: #ff6a2b;',
            '  --kp-unlock-bg-hover: #ff7d43;',
            '  --kp-unlock-bg-active: #ed5520;',
            '  appearance: none !important;',
            '  position: relative !important;',
            '  display: inline-flex !important;',
            '  align-items: center !important;',
            '  justify-content: center !important;',
            '  gap: 9px !important;',
            '  min-height: 44px !important;',
            '  min-width: 142px !important;',
            '  margin: 0 0 0 10px !important;',
            '  padding: 0 18px !important;',
            '  border: 1px solid rgba(255,255,255,.13) !important;',
            '  border-radius: 999px !important;',
            '  background: linear-gradient(135deg, var(--kp-unlock-bg), #f04b24) !important;',
            '  box-shadow: 0 3px 10px rgba(240, 75, 36, .22), inset 0 1px 0 rgba(255,255,255,.18) !important;',
            '  color: #fff !important;',
            '  cursor: pointer !important;',
            '  font: 650 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;',
            '  letter-spacing: .01em !important;',
            '  white-space: nowrap !important;',
            '  text-decoration: none !important;',
            '  user-select: none !important;',
            '  -webkit-tap-highlight-color: transparent !important;',
            '  transition: background .18s ease, box-shadow .18s ease, transform .18s ease, filter .18s ease !important;',
            '}',
            '#' + CONFIG.buttonId + ':hover {',
            '  background: linear-gradient(135deg, var(--kp-unlock-bg-hover), #ff6335) !important;',
            '  box-shadow: 0 6px 18px rgba(240, 75, 36, .3), inset 0 1px 0 rgba(255,255,255,.2) !important;',
            '  filter: saturate(1.08) !important;',
            '  transform: translateY(-1px) !important;',
            '}',
            '#' + CONFIG.buttonId + ':active {',
            '  background: var(--kp-unlock-bg-active) !important;',
            '  box-shadow: 0 2px 6px rgba(240, 75, 36, .22) !important;',
            '  transform: translateY(0) scale(.985) !important;',
            '}',
            '#' + CONFIG.buttonId + ':focus-visible {',
            '  outline: 3px solid rgba(255, 145, 90, .55) !important;',
            '  outline-offset: 3px !important;',
            '}',
            '#' + CONFIG.buttonId + ' .kp-unlock-icon {',
            '  display: block !important;',
            '  width: 16px !important;',
            '  height: 16px !important;',
            '  flex: 0 0 16px !important;',
            '  fill: currentColor !important;',
            '}',
            '@media (max-width: 640px) {',
            '  #' + CONFIG.buttonId + ' { min-width: 44px !important; width: 44px !important; padding: 0 !important; gap: 0 !important; }',
            '  #' + CONFIG.buttonId + ' .kp-unlock-label {',
            '    position: absolute !important; width: 1px !important; height: 1px !important;',
            '    padding: 0 !important; margin: -1px !important; overflow: hidden !important;',
            '    clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important;',
            '  }',
            '}',
            '@media (prefers-reduced-motion: reduce) {',
            '  #' + CONFIG.buttonId + ' { transition: none !important; }',
            '}'
        ].join('\n');

        (document.head || document.documentElement).appendChild(style);
    }

    function createButton(page, id) {
        const button = document.createElement('button');
        button.id = CONFIG.buttonId;
        button.type = 'button';
        button.className = 'kp-unlock-button';
        button.dataset.pageKey = page.pageKey;
        button.dataset.kinopoiskId = id;
        button.title = CONFIG.buttonTitle;
        button.setAttribute('aria-label', CONFIG.buttonTitle);

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.classList.add('kp-unlock-icon');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M8 5.8c0-.8.9-1.3 1.6-.9l9.1 5.2a1 1 0 0 1 0 1.8l-9.1 5.2c-.7.4-1.6-.1-1.6-.9V5.8Z');
        icon.appendChild(path);

        const label = document.createElement('span');
        label.className = 'kp-unlock-label';
        label.textContent = CONFIG.buttonLabel;

        button.append(icon, label);

        button.addEventListener('click', () => {
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
        const button = createButton(page, id);
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