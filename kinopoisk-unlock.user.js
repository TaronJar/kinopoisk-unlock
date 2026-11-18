// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    https://github.com/TaronJar/kinopoisk-unlock
// @version      3.4.1
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
        const redirectId = location.hostname === 'hd.kinopoisk.ru'
            ? new URLSearchParams(location.search).get('rt')
            : null;

        // HD-Кинопоиск иногда открывает карточку фильма/сериала через
        // корневой URL с параметром rt вместо /film/<id>.
        const routeId = match?.[1] || redirectId;
        if (!routeId) return null;

        return {
            host: location.hostname,
            pathname: location.pathname,
            pageKey: location.origin + location.pathname + location.search,
            routeId
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
            if (CONFIG.hdId.test(page.routeId)) return page.routeId;
            return extractHdId();
        }

        return CONFIG.classicId.test(page.routeId) ? page.routeId : null;
    }

    function removeButton() {
        document.getElementById(CONFIG.buttonId)?.remove();
    }

    function getButtonText(button) {
        return (button.getAttribute('aria-label') ||
            button.getAttribute('title') ||
            button.textContent ||
            '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru');
    }

    function findActionButtons() {
        const buttons = Array.from(document.querySelectorAll('button'))
            .filter(button => button.id !== CONFIG.buttonId && button.isConnected && button.getClientRects().length);

        const primary = buttons.find(button => {
            const text = getButtonText(button);
            return /^(смотреть (?:сериал|фильм)|смотреть)$/.test(text);
        });

        const trailer = buttons.find(button => getButtonText(button) === 'трейлер');

        // На HD-страницах сначала располагаются основные действия:
        // большая кнопка просмотра и «Трейлер». Вставляемся после трейлера,
        // но копируем оформление большой кнопки просмотра.
        if (primary) {
            const anchor = trailer && trailer.parentElement === primary.parentElement
                ? trailer
                : primary;
            return { anchor, template: primary };
        }

        // Резерв для старого интерфейса, где основным действием является
        // «Буду смотреть». Не используем закладку как основной шаблон,
        // если на странице уже найдена CTA-кнопка просмотра.
        for (const selector of SELECTORS) {
            const button = document.querySelector(selector);
            if (button && button.getClientRects().length) {
                return { anchor: button, template: null, placement: 'below' };
            }
        }

        const fallback = buttons.find(button => getButtonText(button) === 'буду смотреть');
        return fallback ? { anchor: fallback, template: null, placement: 'below' } : null;
    }

    function injectStyles() {
        if (document.getElementById(CONFIG.styleId)) return;

        // Визуальный стиль самой кнопки остаётся полностью штатным.
        const style = document.createElement('style');
        style.id = CONFIG.styleId;
        style.textContent = [
            '#' + CONFIG.buttonId + '::before,',
            '#' + CONFIG.buttonId + '::after {',
            '  content: none !important;',
            '  display: none !important;',
            '}',
            '#' + CONFIG.buttonId + ' .kp-unlock-free-badge {',
            '  display: inline-flex !important;',
            '  align-items: center !important;',
            '  margin-inline-start: 2px !important;',
            '  padding: 3px 5px !important;',
            '  border-radius: 5px !important;',
            '  background: rgba(0, 0, 0, .18) !important;',
            '  color: #fff !important;',
            '  font: 750 9px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;',
            '  letter-spacing: .035em !important;',
            '  white-space: nowrap !important;',
            '}',
            '#' + CONFIG.buttonId + ':focus-visible {',
            '  outline: 2px solid currentColor !important;',
            '  outline-offset: 3px !important;',
            '}'
        ].join('\\n');

        (document.head || document.documentElement).appendChild(style);
    }

    function applyContextSpacing(button, target, placement) {
        if (placement === 'below') {
            button.style.display = 'inline-flex';
            button.style.margin = '16px 0 0 0';
            button.style.position = 'relative';
            button.style.inset = 'auto';
            return;
        }
        const parent = target.parentElement;
        if (!parent) return;

        const layout = getComputedStyle(parent);
        const display = layout.display;
        const isFlex = display === 'flex' || display === 'inline-flex';
        const isGrid = display === 'grid' || display === 'inline-grid';

        // Если контейнер уже задаёт gap, не добавляем второй отступ.
        const columnGap = Number.parseFloat(layout.columnGap) || 0;
        const rowGap = Number.parseFloat(layout.rowGap) || 0;
        if ((isFlex && layout.flexDirection.startsWith('column') && rowGap > 0) ||
            ((isFlex && !layout.flexDirection.startsWith('column')) && columnGap > 0) ||
            (isGrid && (columnGap > 0 || rowGap > 0))) {
            button.style.margin = '0';
            return;
        }

        // Для вертикального списка используем вертикальный отступ,
        // для горизонтального ряда или обычного потока — горизонтальный.
        if (isFlex && layout.flexDirection.startsWith('column')) {
            button.style.marginBlockStart = '8px';
            button.style.marginInlineStart = '0';
        } else {
            button.style.marginInlineStart = '8px';
            button.style.marginBlockStart = '0';
        }
    }

    function createButton(template, page, id) {
        const button = template ? template.cloneNode(true) : document.createElement('button');

        button.id = CONFIG.buttonId;
        button.type = 'button';
        button.disabled = false;
        button.removeAttribute('aria-pressed');
        button.removeAttribute('aria-checked');
        button.setAttribute('aria-label', 'Смотреть бесплатно');
        button.removeAttribute('title');
        button.dataset.pageKey = page.pageKey;
        button.dataset.kinopoiskId = id;

        // Keep the site's outer button classes, but discard all copied inner
        // content. The source on classic pages is a bookmark button, so
        // retaining any of its children can leak the bookmark icon.
        button.replaceChildren();

        // No play icon: keep the shortcut compact so its width aligns
        // more closely with the neighboring native action button.

        const label = document.createElement('span');
        label.textContent = 'Смотреть';
        label.style.whiteSpace = 'nowrap';
        button.appendChild(label);

        const freeBadge = document.createElement('span');
        freeBadge.className = 'kp-unlock-free-badge';
        freeBadge.textContent = 'БЕСПЛАТНО';
        freeBadge.setAttribute('aria-hidden', 'true');
        Object.assign(freeBadge.style, {
            display: 'inline-flex',
            alignItems: 'center',
            marginInlineStart: '7px',
            padding: '3px 5px',
            borderRadius: '5px',
            background: 'rgba(0, 0, 0, .2)',
            color: '#fff',
            font: '750 9px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '.035em',
            whiteSpace: 'nowrap',
            verticalAlign: 'middle'
        });
        button.appendChild(freeBadge);

        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.flexWrap = 'nowrap';
        button.style.whiteSpace = 'nowrap';
        button.style.maxWidth = '100%';
        button.style.justifyContent = 'center';
        button.style.boxSizing = 'border-box';

        if (!template) {
            // Ticket-only film pages have no native watch CTA. Build a pill
            // instead of cloning the circular bookmark control.
            Object.assign(button.style, {
                appearance: 'none',
                width: 'max-content',
                minWidth: '0',
                minHeight: '48px',
                padding: '0 20px',
                border: '0',
                borderRadius: '999px',
                background: '#292929',
                color: '#fff',
                font: '600 16px/1.2 Arial, sans-serif',
                cursor: 'pointer'
            });
        }

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const destination = new URL(location.href);
            destination.hostname = CONFIG.externalDomain;
            window.open(destination.href, '_blank', 'noopener,noreferrer');
        });

        return button;
    }

    function syncButton() {
        frameRequested = false;

        const page = getPage();
        if (!page) {
            removeButton();
            return;
        }

        const existingButton = document.getElementById(CONFIG.buttonId);
        if (existingButton && existingButton.dataset.pageKey !== page.pageKey) {
            existingButton.remove();
        }

        const id = extractKinopoiskId(page);
        if (!id) {
            removeButton();
            return;
        }

        const actions = findActionButtons();
        if (!actions) return;

        const { anchor, template, placement } = actions;
        const insertionTarget = placement === 'below' ? anchor.parentElement : anchor;
        if (!insertionTarget) return;
        const currentButton = document.getElementById(CONFIG.buttonId);

        if (currentButton && currentButton.isConnected &&
            currentButton.dataset.pageKey === page.pageKey &&
            currentButton.previousElementSibling === insertionTarget) {
            applyContextSpacing(currentButton, anchor, placement);
            return;
        }

        // Если Kinopoisk переставил или перерисовал блок действий,
        // переносим нашу кнопку к новой группе. Шаблон и место вставки
        // выбираются отдельно: внешний вид берём у CTA, позицию — после трейлера.
        currentButton?.remove();

        injectStyles();
        const button = createButton(template, page, id);
        applyContextSpacing(button, anchor, placement);
        insertionTarget.insertAdjacentElement('afterend', button);

        if (placement === 'below' && template) {
            // Match the native "Буду смотреть" control's outer width.
            const anchorWidth = Math.round(anchor.getBoundingClientRect().width);
            if (anchorWidth > 0) button.style.width = anchorWidth + 'px';
        }

        logger.info('Кнопка добавлена в основную группу действий:', page.pageKey);
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