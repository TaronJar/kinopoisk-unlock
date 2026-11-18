// ==UserScript==
// @name         Kinopoisk Unlock
// @namespace    https://github.com/TaronJar/kinopoisk-unlock
// @version      3.3.1
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

    function getButtonText(button) {
        return (button.getAttribute('aria-label') ||
            button.getAttribute('title') ||
            button.textContent ||
            '').replace(/\\s+/g, ' ').trim().toLocaleLowerCase('ru');
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
                return { anchor: button, template: button };
            }
        }

        const fallback = buttons.find(button => getButtonText(button) === 'буду смотреть');
        return fallback ? { anchor: fallback, template: fallback } : null;
    }

    function injectStyles() {
        if (document.getElementById(CONFIG.styleId)) return;

        // Визуальный стиль самой кнопки остаётся полностью штатным.
        const style = document.createElement('style');
        style.id = CONFIG.styleId;
        style.textContent = [
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

    function applyContextSpacing(button, target) {
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
        // Клонируем настоящую кнопку Кинопоиска: так сохраняются её CSS-классы,
        // вложенная разметка, иконка, размеры, скругления и штатные анимации.
        // cloneNode не переносит обработчики событий исходной кнопки.
        const button = template.cloneNode(true);

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
                textNode.nodeValue = textNode.nodeValue.replace(/Буду смотреть|Смотреть сериал|Смотреть фильм|Трейлер/gi, CONFIG.buttonLabel);
                replaced = true;
            }
        }

        if (!replaced) {
            const label = document.createElement('span');
            label.textContent = CONFIG.buttonLabel;
            button.appendChild(label);
        }

        const freeBadge = document.createElement('span');
        freeBadge.className = 'kp-unlock-free-badge';
        freeBadge.textContent = 'БЕСПЛАТНО';
        freeBadge.setAttribute('aria-hidden', 'true');
        // Inline styles keep the badge readable even if the site's CSS
        // overrides injected stylesheet rules.
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

        const { anchor, template } = actions;
        const currentButton = document.getElementById(CONFIG.buttonId);

        if (currentButton && currentButton.isConnected &&
            currentButton.dataset.pageKey === page.pageKey &&
            currentButton.previousElementSibling === anchor) {
            applyContextSpacing(currentButton, anchor);
            return;
        }

        // Если Kinopoisk переставил или перерисовал блок действий,
        // переносим нашу кнопку к новой группе. Шаблон и место вставки
        // выбираются отдельно: внешний вид берём у CTA, позицию — после трейлера.
        currentButton?.remove();

        injectStyles();
        const button = createButton(template, page, id);
        applyContextSpacing(button, anchor);
        anchor.insertAdjacentElement('afterend', button);

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