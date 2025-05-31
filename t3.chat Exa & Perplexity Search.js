// ==UserScript==
// @name         T3 chat Exa & Perplexity Search
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Call Exa or Perplexity API on t3.chat
// @match        https://t3.chat/*
// @match        https://t3.chat/chat/*
// @match        https://beta.t3.chat/*
// @match        https://beta.t3.chat/chat/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.exa.ai
// @connect      api.perplexity.ai
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // ==================== React-like Framework ====================

    class ReactLikeComponent {
        constructor(props = {}) {
            this.props = props;
            this.state = {};
            this.element = null;
            this.children = [];
            this.events = {};
            this.isMounted = false;
        }

        setState(newState, callback) {
            const prevState = { ...this.state };
            this.state = { ...this.state, ...newState };

            if (this.isMounted) {
                this.componentDidUpdate(this.props, prevState);
                this.render();
            }

            if (callback && typeof callback === 'function') {
                callback();
            }
        }

        mount(parentElement) {
            if (!this.isMounted) {
                this.componentWillMount();
                this.isMounted = true;
                this.render();
                if (parentElement && this.element) {
                    parentElement.appendChild(this.element);
                }
                this.componentDidMount();
            }
        }

        unmount() {
            if (this.isMounted) {
                this.componentWillUnmount();
                if (this.element && this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
                this.isMounted = false;
            }
        }

        // Lifecycle methods (to be overridden)
        componentWillMount() {}
        componentDidMount() {}
        componentWillUnmount() {}
        componentDidUpdate(prevProps, prevState) {}

        // Event handling
        addEventListener(element, event, handler) {
            if (element && handler) {
                element.addEventListener(event, handler);
                if (!this.events[event]) this.events[event] = [];
                this.events[event].push({ element, handler });
            }
        }

        removeAllEventListeners() {
            Object.keys(this.events).forEach(event => {
                this.events[event].forEach(({ element, handler }) => {
                    element.removeEventListener(event, handler);
                });
            });
            this.events = {};
        }

        // DOM creation helper
        createElement(tag, attributes = {}, innerHTML = '') {
            const element = document.createElement(tag);

            Object.keys(attributes).forEach(key => {
                if (key === 'className') {
                    element.className = attributes[key];
                } else if (key === 'style' && typeof attributes[key] === 'object') {
                    Object.assign(element.style, attributes[key]);
                } else {
                    element.setAttribute(key, attributes[key]);
                }
            });

            if (innerHTML) {
                element.innerHTML = innerHTML;
            }

            return element;
        }

        // Abstract render method
        render() {
            throw new Error('render() method must be implemented');
        }
    }

    // ==================== State Management ====================

    class StateManager {
        constructor() {
            this.state = {};
            this.subscribers = [];
        }

        getState() {
            return { ...this.state };
        }

        setState(newState) {
            this.state = { ...this.state, ...newState };
            this.notifySubscribers();
        }

        subscribe(callback) {
            this.subscribers.push(callback);
            return () => {
                this.subscribers = this.subscribers.filter(sub => sub !== callback);
            };
        }

        notifySubscribers() {
            this.subscribers.forEach(callback => callback(this.state));
        }
    }

    // ==================== Constants and Configuration ====================

    const CONFIG = {
        SCRIPT_NAME: "t3.chat Inject Search Toggle (with Exa & Perplexity API)",
        SCRIPT_VERSION: "0.5",

        API_PROVIDERS: {
            EXA: 'exa',
            PERPLEXITY: 'perplexity'
        },

        DEFAULTS: {
            EXA_NUM_RESULTS: 5,
            EXA_SUBPAGES: 2,
            EXA_LINKS: 3,
            EXA_IMAGE_LINKS: 0,
            PERPLEXITY_MODEL: 'sonar',
            PERPLEXITY_TEMPERATURE: 0.7,
            PERPLEXITY_MAX_TOKENS: 512,
            PERPLEXITY_TOP_P: 1,
            PERPLEXITY_TOP_K: 0,
            PERPLEXITY_PRESENCE_PENALTY: 0,
            PERPLEXITY_FREQUENCY_PENALTY: 0
        },

        STORAGE_KEYS: {
            SELECTED_API_PROVIDER: 'selectedApiProvider',
            API_KEY_EXA: 'exaApiKey',
            EXA_NUM_RESULTS: 'exaNumResults',
            EXA_SUBPAGES: 'exaSubpages',
            EXA_LINKS: 'exaLinks',
            EXA_IMAGE_LINKS: 'exaImageLinks',
            API_KEY_PERPLEXITY: 'perplexityApiKey',
            PERPLEXITY_MODEL: 'perplexityModel',
            PERPLEXITY_TEMPERATURE: 'perplexityTemperature',
            PERPLEXITY_MAX_TOKENS: 'perplexityMaxTokens',
            PERPLEXITY_TOP_P: 'perplexityTopP',
            PERPLEXITY_TOP_K: 'perplexityTopK',
            PERPLEXITY_PRESENCE_PENALTY: 'perplexityPresencePenalty',
            PERPLEXITY_FREQUENCY_PENALTY: 'perplexityFrequencyPenalty'
        },

        API: {
            exaEndpoint: 'https://api.exa.ai/search',
            perplexityEndpoint: 'https://api.perplexity.ai/chat/completions',
            conversationContextEnabled: true,
            apiRequestTimeout: 300000
        },

        SELECTORS: {
            justifyDiv: 'div.mt-2.flex-row-reverse.justify-between',
            modelTempSection: 'div.flex.flex-col',
            mlGroup: 'div.ml-\\[-7px\\]',
            chatLogContainer: 'div[role="log"][aria-label="Chat messages"]',
            mainContentArea: 'main',
            chatArea: '.chat'
        },

        CSS_CLASSES: {
            button: "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 disabled:cursor-not-allowed hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-foreground/50 px-3 text-xs -mb-1.5 h-auto gap-2 rounded-full border border-solid border-secondary-foreground/10 py-1.5 pl-2 pr-2.5 text-muted-foreground max-sm:p-2",
            searchToggleLoading: 'loading',
            searchToggleOn: 'on'
        }
    };

    // ==================== Global State ====================

    const globalState = new StateManager();

    // Initialize global state
    globalState.setState({
        selectedApiProvider: CONFIG.API_PROVIDERS.EXA,
        exaApiKey: null,
        perplexityApiKey: null,
        exaNumResults: CONFIG.DEFAULTS.EXA_NUM_RESULTS,
        exaSubpages: CONFIG.DEFAULTS.EXA_SUBPAGES,
        exaLinks: CONFIG.DEFAULTS.EXA_LINKS,
        exaImageLinks: CONFIG.DEFAULTS.EXA_IMAGE_LINKS,
        perplexityModel: CONFIG.DEFAULTS.PERPLEXITY_MODEL,
        perplexityTemperature: CONFIG.DEFAULTS.PERPLEXITY_TEMPERATURE,
        perplexityMaxTokens: CONFIG.DEFAULTS.PERPLEXITY_MAX_TOKENS,
        perplexityTopP: CONFIG.DEFAULTS.PERPLEXITY_TOP_P,
        perplexityTopK: CONFIG.DEFAULTS.PERPLEXITY_TOP_K,
        perplexityPresencePenalty: CONFIG.DEFAULTS.PERPLEXITY_PRESENCE_PENALTY,
        perplexityFrequencyPenalty: CONFIG.DEFAULTS.PERPLEXITY_FREQUENCY_PENALTY,
        searchToggleState: false,
        isLoading: false
    });

    // ==================== Utility Components ====================

    class StyleManager extends ReactLikeComponent {
        render() {
            if (document.getElementById('t3chat-search-style')) return;

            const styleEl = this.createElement('style', { id: 't3chat-search-style' });
            styleEl.textContent = `
                /* Button toggle animation */
                #search-toggle {
                    position: relative !important;
                    overflow: visible !important;
                }
                button#search-toggle.on,
                #search-toggle[data-state="open"] {
                    background-color: rgba(219,39,119,0.15) !important;
                }
                button#search-toggle.on:hover,
                #search-toggle[data-state="open"]:hover {
                    background-color: rgba(219,39,119,0.25) !important;
                }
                button#search-toggle:not(.on):hover {
                    background-color: rgba(0,0,0,0.04) !important;
                }

                /* Modal Styles */
                .api-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .api-modal-content {
                    background: #1c1c1e;
                    padding: 24px;
                    border-radius: 12px;
                    width: 360px;
                    box-sizing: border-box;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                    color: #fff;
                }
                .api-modal-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 20px;
                    font-size: 22px;
                    font-weight: 600;
                }
                .api-modal-description {
                    color: #999;
                    font-size: 14px;
                    margin-bottom: 16px;
                }
                .api-input {
                    width: 100%;
                    padding: 12px;
                    margin-bottom: 16px;
                    box-sizing: border-box;
                    background: #2a2a2c;
                    color: #fff;
                    border: 1px solid #333;
                    border-radius: 6px;
                    outline: none;
                    font-size: 14px;
                }
                .api-button {
                    width: 100%;
                    padding: 12px;
                    background: #a02553;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .api-button:hover {
                    background-color: #c62a88;
                }

                /* Tooltip styles */
                .search-tooltip {
                    position: absolute !important;
                    bottom: 100% !important;
                    left: 50% !important;
                    transform: translateX(-50%) translateY(-8px) !important;
                    background: #000 !important;
                    color: #fff !important;
                    padding: 6px 10px !important;
                    border-radius: 4px !important;
                    font-size: 12px !important;
                    white-space: nowrap !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    transition: all 0.2s ease !important;
                    z-index: 99999 !important;
                    pointer-events: none !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
                }
                #search-toggle:hover .search-tooltip {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transform: translateX(-50%) translateY(-8px) !important;
                }

                /* Config Modal Styles */
                .config-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .config-modal-content {
                    background: #1c1c1e;
                    padding: 24px;
                    border-radius: 12px;
                    width: 400px;
                    box-sizing: border-box;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                    color: #fff;
                }
                .config-modal-header {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .config-modal-description {
                    color: #aaa;
                    font-size: 14px;
                    margin-bottom: 24px;
                }
                .config-slider-container {
                    margin-bottom: 20px;
                }
                .config-slider-container label {
                    display: block;
                    font-size: 14px;
                    color: #ccc;
                    margin-bottom: 10px;
                }
                .config-slider-container .slider-wrapper {
                    display: flex;
                    align-items: center;
                }
                .config-slider-container input[type="range"] {
                    flex-grow: 1;
                    margin-right: 15px;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 8px;
                    background: #444;
                    border-radius: 4px;
                    outline: none;
                }
                .config-slider-container input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    background: #c62a88;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid #1c1c1e;
                }
                .config-slider-container input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    background: #c62a88;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid #1c1c1e;
                }
                .config-slider-container .value-display {
                    display: inline-block;
                    width: 30px;
                    text-align: right;
                    font-size: 14px;
                    color: #fff;
                }
                .config-buttons {
                    margin-top: 30px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .config-button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                }
                .config-close-button {
                    background-color: #4a4a4f;
                    color: #ddd;
                }
                .config-close-button:hover {
                    background-color: #5a5a5f;
                }
                .config-save-button {
                    background-color: #a02553;
                    color: white;
                }
                .config-save-button:hover {
                    background-color: #c62a88;
                }

                /* Searching Indicator */
                .searching-indicator {
                    position: fixed !important;
                    z-index: 10000 !important;
                    justify-content: center !important;
                    whitespace-nowrap: true !important;
                    font-weight: 500 !important;
                    transition: all 0.2s ease !important;
                    focus-visible:outline: none !important;
                    focus-visible:ring: 1px solid transparent !important;
                    disabled:opacity: 0.5 !important;
                    disabled:cursor: not-allowed !important;
                    disabled:hover:background: rgba(0,0,0,0.05) !important;
                    height: 32px !important;
                    padding: 0 12px !important;
                    font-size: 12px !important;
                    pointer-events: auto !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    border-radius: 9999px !important;
                    border: 1px solid !important;
                    border-color: rgba(0,0,0,0.1) !important;
                    background: var(--chat-overlay, rgba(255,255,255,0.8)) !important;
                    color: white !important;
                    backdrop-filter: blur(24px) !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    transform: translateX(-50%) translateY(-10px) !important;
                    transition: all 0.2s ease !important;
                }
                .searching-indicator.show {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transform: translateX(-50%) translateY(0px) !important;
                }
                .searching-indicator:hover {
                    background: rgba(0,0,0,0.05) !important;
                }
                .searching-indicator .dots {
                    font-weight: bold !important;
                    min-width: 24px !important;
                    text-align: left !important;
                }
            `;

            document.head.appendChild(styleEl);
            this.element = styleEl;
        }
    }

    // ==================== API Service Components ====================

    class APIService extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();

            // Subscribe to global state changes
            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }

        async callExaAPI(prompt, contextMessages = []) {
            const { exaApiKey, exaNumResults, exaSubpages, exaLinks, exaImageLinks } = this.state;

            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                return null;
            }
            if (!exaApiKey) {
                return null;
            }

            const requestBody = {
                query: prompt,
                type: "auto",
                numResults: exaNumResults,
                contents: {
                    text: { includeHtmlTags: false },
                    livecrawl: "always",
                    summary: {},
                    subpages: exaSubpages,
                    extras: {
                        links: exaLinks,
                        imageLinks: exaImageLinks
                    }
                }
            };

            return new Promise((resolve) => {
                let isResolved = false;
                const req = GM_xmlhttpRequest({
                    method: "POST",
                    url: CONFIG.API.exaEndpoint,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${exaApiKey}`
                    },
                    data: JSON.stringify(requestBody),
                    onload(res) {
                        if (isResolved) return;
                        clearTimeout(timeoutId);
                        isResolved = true;

                        try {
                            let data = JSON.parse(res.responseText);
                            if (res.status >= 200 && res.status < 300 && data && Array.isArray(data.results)) {
                                if (data.results.length === 0) {
                                    resolve(null);
                                } else {
                                    let combinedText = "";
                                    let urlList = [];

                                    for (const result of data.results) {
                                        if (result.title && result.url) {
                                            combinedText += `Title: [${result.title}](${result.url})\n`;
                                            urlList.push(`- [${result.title}](${result.url})`);
                                        } else if (result.title) {
                                            combinedText += `Title: ${result.title}\n`;
                                        }
                                        if (result.url && !result.title) {
                                            combinedText += `URL: [${result.url}](${result.url})\n`;
                                            urlList.push(`- [${result.url}](${result.url})`);
                                        }
                                        if (result.text) combinedText += `Text: ${result.text}\n`;
                                        if (result.summary) combinedText += `Summary: ${result.summary}\n`;
                                        combinedText += '---\n';
                                    }

                                    if (urlList.length > 0) {
                                        combinedText += '\n**Related Links:**\n';
                                        combinedText += urlList.join('\n') + '\n';
                                    }

                                    resolve(combinedText.trim());
                                }
                            } else {
                                resolve(null);
                            }
                        } catch (error) {
                            resolve(null);
                        }
                    },
                    onerror() {
                        if (isResolved) return;
                        clearTimeout(timeoutId);
                        isResolved = true;
                        resolve(null);
                    },
                    ontimeout() {
                        if (isResolved) return;
                        isResolved = true;
                        resolve(null);
                    }
                });

                const timeoutId = setTimeout(() => {
                    if (isResolved) return;
                    isResolved = true;
                    if (req && typeof req.abort === 'function') req.abort();
                    resolve(null);
                }, CONFIG.API.apiRequestTimeout);
            });
        }

        async callPerplexityAPI(prompt, contextMessages = []) {
            const {
                perplexityApiKey, perplexityModel, perplexityTemperature,
                perplexityMaxTokens, perplexityTopP, perplexityTopK,
                perplexityPresencePenalty, perplexityFrequencyPenalty
            } = this.state;

            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                return null;
            }
            if (!perplexityApiKey) {
                return null;
            }

            const messages = [{ role: "system", content: "Be precise and concise." }];
            if (CONFIG.API.conversationContextEnabled && contextMessages && contextMessages.length > 0) {
                messages.push(...contextMessages.map(m => ({ role: m.role, content: m.content })).filter(m => m.content));
            }
            messages.push({ role: "user", content: prompt });

            const requestBody = {
                model: perplexityModel,
                messages: messages,
                temperature: perplexityTemperature,
                max_tokens: perplexityMaxTokens,
                top_p: perplexityTopP,
                presence_penalty: perplexityPresencePenalty,
                frequency_penalty: perplexityFrequencyPenalty
            };

            if (perplexityTopK > 0) {
                requestBody.top_k = perplexityTopK;
            }

            return new Promise((resolve) => {
                let isResolved = false;
                GM_xmlhttpRequest({
                    method: "POST",
                    url: CONFIG.API.perplexityEndpoint,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${perplexityApiKey}`
                    },
                    data: JSON.stringify(requestBody),
                    timeout: CONFIG.API.apiRequestTimeout,
                    onload(res) {
                        if (isResolved) return;
                        isResolved = true;

                        if (res.status < 200 || res.status >= 300) {
                            return resolve(null);
                        }

                        try {
                            let data = JSON.parse(res.responseText);
                            if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                                let content = data.choices[0].message.content;
                                const citations = data.citations || [];
                                let linksSection = '';

                                if (Array.isArray(citations) && citations.length > 0) {
                                    const uniqueUrls = [...new Set(citations.filter(url => typeof url === 'string' && url))];
                                    linksSection = '\n\n**Citations:**\n' + uniqueUrls.map(url => `- [${url}](${url})`).join('\n');
                                }

                                const combinedText = `Source: Perplexity AI (${perplexityModel})\nContent: ${content}${linksSection}`;
                                resolve(combinedText.trim());
                            } else {
                                resolve(null);
                            }
                        } catch (error) {
                            resolve(null);
                        }
                    },
                    onerror() {
                        if (isResolved) return;
                        isResolved = true;
                        resolve(null);
                    },
                    ontimeout() {
                        if (isResolved) return;
                        isResolved = true;
                        resolve(null);
                    }
                });
            });
        }

        render() {
            // This is a service component, no rendering needed
        }
    }

    // ==================== UI Components ====================

    class SearchToggle extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            this.removeAllEventListeners();
        }

        componentDidMount() {
            // Restore toggle state from unsafeWindow if it exists
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.t3ChatSearch && unsafeWindow.t3ChatSearch.needSearch) {
                globalState.setState({ searchToggleState: true });
            }
            this.updateButtonState();
        }

        async handleToggleClick() {
            const { selectedApiProvider, exaApiKey, perplexityApiKey } = this.state;

            let apiKeyMissing = false;
            if (selectedApiProvider === CONFIG.API_PROVIDERS.EXA && !exaApiKey) {
                apiKeyMissing = true;
            } else if (selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY && !perplexityApiKey) {
                apiKeyMissing = true;
            }

            if (apiKeyMissing) {
                const modal = new APIKeyModal();
                modal.mount(document.body);
                return;
            }

            const newToggleState = !this.state.searchToggleState;

            // Update global state
            globalState.setState({ searchToggleState: newToggleState });

            // Update local state immediately for instant visual feedback
            this.setState({ searchToggleState: newToggleState }, () => {
                // Force update the button state after local state change
                this.updateButtonState();
            });

            if (typeof unsafeWindow !== 'undefined') {
                if (!unsafeWindow.t3ChatSearch) {
                    unsafeWindow.t3ChatSearch = {};
                }
                unsafeWindow.t3ChatSearch.needSearch = newToggleState;
            }
        }

        componentDidUpdate(prevProps, prevState) {
            // Update button classes when state changes
            if (this.element && (
                prevState.searchToggleState !== this.state.searchToggleState ||
                prevState.selectedApiProvider !== this.state.selectedApiProvider ||
                prevState.perplexityModel !== this.state.perplexityModel
            )) {
                this.updateButtonState();
            }
        }

        updateButtonState() {
            if (!this.element) return;

            const { searchToggleState, selectedApiProvider, perplexityModel } = this.state;

            // Clear only state-specific classes, preserve base classes
            this.element.classList.remove('on');

            // Add state classes and apply styles
            if (searchToggleState) {
                this.element.classList.add('on');
                // Remove inline styles and rely on CSS for 'on' state
                this.element.style.backgroundColor = '';
                this.element.style.borderColor = '';
                this.element.style.color = '';
            } else {
                // Reset to default styles when not 'on'
                this.element.style.backgroundColor = '';
                this.element.style.borderColor = '';
                this.element.style.color = '';
            }

            // Set data-mode attribute as shown in the example
            this.element.setAttribute('data-mode', searchToggleState ? 'on' : 'off');

            // Ensure button has relative positioning for tooltip
            this.element.style.position = 'relative';
            this.element.style.overflow = 'visible';

            // Update aria attributes
            this.element.setAttribute('aria-label', searchToggleState ? 'Disable search' : 'Enable search');
            this.element.setAttribute('data-state', searchToggleState ? 'open' : 'closed');

            // Update tooltip content
            const tooltip = this.element.querySelector('.search-tooltip');
            if (tooltip) {
                let modelName = 'Exa API';
                if (selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                    modelName = perplexityModel;
                }
                tooltip.textContent = modelName;
            }
        }

        render() {
            const { selectedApiProvider, perplexityModel, searchToggleState } = this.state;

            // Remove existing element if it exists
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }

            const btn = this.createElement('button', {
                id: 'search-toggle',
                type: 'button',
                'aria-label': searchToggleState ? 'Disable search' : 'Enable search',
                'data-state': searchToggleState ? 'open' : 'closed',
                'data-mode': searchToggleState ? 'on' : 'off',
                className: CONFIG.CSS_CLASSES.button,
                style: {
                    position: 'relative',
                    overflow: 'visible'
                }
            });

            let modelName = 'Exa API';
            if (selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                modelName = perplexityModel;
            }

            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe h-4 w-4 scale-x-[-1]">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                    <path d="M2 12h20"></path>
                </svg>
                <span class="max-sm:hidden">Search</span>
            `;

            const tooltip = this.createElement('div', {
                className: 'search-tooltip'
            });
            tooltip.textContent = modelName;
            btn.appendChild(tooltip);

            this.addEventListener(btn, 'click', () => this.handleToggleClick());

            this.element = btn;

            // Apply initial state immediately
            this.updateButtonState();
        }
    }

    class SearchingIndicator extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();
            this.targetElement = null;
            this.dotsInterval = null;

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            if (this.dotsInterval) {
                clearInterval(this.dotsInterval);
            }
            this.removeAllEventListeners();
        }

        componentDidUpdate(prevProps, prevState) {
            if (prevState.isLoading !== this.state.isLoading) {
                this.updateDisplay();
            }
        }

        componentDidMount() {
            // 添加滾動和窗口大小變化監聽器
            this.addEventListener(window, 'scroll', () => {
                if (this.state.isLoading) {
                    this.positionIndicator();
                }
            });

            this.addEventListener(window, 'resize', () => {
                if (this.state.isLoading) {
                    this.positionIndicator();
                }
            });
        }

        mount(parentElement) {
            // Override mount to not require parentElement since we append to body
            if (!this.isMounted) {
                this.componentWillMount();
                this.isMounted = true;
                this.render();
                this.componentDidMount();
            }
        }

        findTargetElement() {
            // 查找指定的容器元素 - 使用更簡單的選擇器
            let chatInputContainer = document.querySelector('div.border-reflect');
            if (!chatInputContainer) {
                // 備用選擇器 - 查找包含聊天輸入框的form
                chatInputContainer = document.querySelector('form textarea[name="input"]')?.closest('div');
            }
            if (!chatInputContainer) {
                // 最後的備用選擇器
                chatInputContainer = document.querySelector('textarea[id*="chat-input"]')?.closest('div.bg-\\[--chat-input-background\\]');
            }
            return chatInputContainer;
        }

        startDotsAnimation() {
            // 清理現有的interval
            if (this.dotsInterval) {
                clearInterval(this.dotsInterval);
                this.dotsInterval = null;
            }

            const dotsElement = this.element?.querySelector('.dots');
            if (!dotsElement) {
                console.log('Dots element not found');
                return;
            }

            let dotsCount = 0;
            // 立即設置初始狀態
            dotsElement.textContent = '';

            this.dotsInterval = setInterval(() => {
                dotsCount = (dotsCount + 1) % 4; // 1, 2, 3, 0
                const dots = '.'.repeat(dotsCount);
                dotsElement.textContent = dots;
            }, 500);
        }

        stopDotsAnimation() {
            if (this.dotsInterval) {
                clearInterval(this.dotsInterval);
                this.dotsInterval = null;
            }
        }

        updateDisplay() {
            if (!this.element) return;

            this.targetElement = this.findTargetElement();
            if (!this.targetElement) return;

            if (this.state.isLoading) {
                this.positionIndicator();
                this.element.classList.add('show');
                this.startDotsAnimation();
            } else {
                this.element.classList.remove('show');
                this.stopDotsAnimation();
            }
        }

        positionIndicator() {
            if (!this.targetElement || !this.element) return;

            const rect = this.targetElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const topY = rect.top - 40; // 40px above the target element

            this.element.style.left = centerX + 'px';
            this.element.style.top = topY + 'px';
        }

        render() {
            // 清理現有的元素
            const existingIndicator = document.getElementById('searching-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            const indicator = this.createElement('div', {
                className: 'searching-indicator',
                id: 'searching-indicator'
            });

            indicator.innerHTML = `
                <span class="pb-0.5">Searching<span class="dots"></span></span>
            `;

            this.element = indicator;

            // 添加到document.body以便使用fixed定位
            document.body.appendChild(indicator);

            this.updateDisplay();
        }
    }

    class APIKeyModal extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            this.removeAllEventListeners();
        }

        async handleSave() {
            const keyInput = this.element.querySelector('#api-key-input');
            const providerSelect = this.element.querySelector('#api-provider-select');

            const key = keyInput.value.trim();
            const currentProvider = providerSelect.value;

            if (key) {
                if (currentProvider === CONFIG.API_PROVIDERS.EXA) {
                    await GM_setValue(CONFIG.STORAGE_KEYS.API_KEY_EXA, key);
                    globalState.setState({ exaApiKey: key });
                } else if (currentProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                    await GM_setValue(CONFIG.STORAGE_KEYS.API_KEY_PERPLEXITY, key);
                    globalState.setState({ perplexityApiKey: key });
                }

                await GM_setValue(CONFIG.STORAGE_KEYS.SELECTED_API_PROVIDER, currentProvider);
                globalState.setState({ selectedApiProvider: currentProvider });

                this.unmount();
                location.reload();
            } else {
                alert('API Key cannot be empty for the selected provider.');
            }
        }

        handleProviderChange(e) {
            const newProvider = e.target.value;
            const keyInput = this.element.querySelector('#api-key-input');

            if (newProvider === CONFIG.API_PROVIDERS.EXA) {
                keyInput.value = this.state.exaApiKey || '';
            } else {
                keyInput.value = this.state.perplexityApiKey || '';
            }
            keyInput.placeholder = `Enter your ${newProvider === CONFIG.API_PROVIDERS.EXA ? 'Exa' : 'Perplexity'} API Key`;
        }

        handleShowCheckbox(e) {
            const keyInput = this.element.querySelector('#api-key-input');
            keyInput.type = e.target.checked ? 'text' : 'password';
        }

        render() {
            const { selectedApiProvider, exaApiKey, perplexityApiKey } = this.state;

            const wrapper = this.createElement('div', {
                className: 'api-modal'
            });

            const currentKey = selectedApiProvider === CONFIG.API_PROVIDERS.EXA ? (exaApiKey || '') : (perplexityApiKey || '');

            wrapper.innerHTML = `
                <div class="api-modal-content">
                    <div class="api-modal-header">
                        <div style="color: #c62a88; margin-right: 12px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </div>
                        <div>Enter API Key</div>
                    </div>
                    <div class="api-modal-description">Select your API provider and set the API Key to enable web search functionality.</div>
                    <div style="margin-bottom: 16px;">
                        <label for="api-provider-select" style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">API Provider:</label>
                        <select id="api-provider-select" class="api-input">
                            <option value="${CONFIG.API_PROVIDERS.EXA}" ${selectedApiProvider === CONFIG.API_PROVIDERS.EXA ? 'selected' : ''}>Exa API</option>
                            <option value="${CONFIG.API_PROVIDERS.PERPLEXITY}" ${selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY ? 'selected' : ''}>Perplexity API</option>
                        </select>
                    </div>
                    <input id="api-key-input" type="password" class="api-input" placeholder="Enter your API Key" value="${currentKey}" />
                    <div style="display: flex; align-items: center; margin-bottom: 20px; color: #ccc;">
                        <input id="api-key-show" type="checkbox" style="margin-right: 8px; accent-color: #c62a88;" />
                        <label for="api-key-show" style="font-size: 14px;">Show API Key</label>
                    </div>
                    <button id="api-key-save" class="api-button">Save Settings</button>
                </div>
            `;

            // Attach event listeners
            const providerSelect = wrapper.querySelector('#api-provider-select');
            const showCheckbox = wrapper.querySelector('#api-key-show');
            const saveButton = wrapper.querySelector('#api-key-save');

            this.addEventListener(providerSelect, 'change', (e) => this.handleProviderChange(e));
            this.addEventListener(showCheckbox, 'change', (e) => this.handleShowCheckbox(e));
            this.addEventListener(saveButton, 'click', () => this.handleSave());

            this.element = wrapper;
        }
    }

    class ExaConfigModal extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });

            this.SLIDER_CONFIG = [
                { storageKey: CONFIG.STORAGE_KEYS.EXA_NUM_RESULTS, label: 'Search Results Count (0-99):', min: 0, max: 99, defaultValue: CONFIG.DEFAULTS.EXA_NUM_RESULTS, sliderId: 'exa-num-results-slider', valueId: 'exa-num-results-value' },
                { storageKey: CONFIG.STORAGE_KEYS.EXA_SUBPAGES, label: 'Subpages Count (0-10):', min: 0, max: 10, defaultValue: CONFIG.DEFAULTS.EXA_SUBPAGES, sliderId: 'exa-subpages-slider', valueId: 'exa-subpages-value' },
                { storageKey: CONFIG.STORAGE_KEYS.EXA_LINKS, label: 'Links Count (0-10):', min: 0, max: 10, defaultValue: CONFIG.DEFAULTS.EXA_LINKS, sliderId: 'exa-links-slider', valueId: 'exa-links-value' },
                { storageKey: CONFIG.STORAGE_KEYS.EXA_IMAGE_LINKS, label: 'Image Links Count (0-10):', min: 0, max: 10, defaultValue: CONFIG.DEFAULTS.EXA_IMAGE_LINKS, sliderId: 'exa-image-links-slider', valueId: 'exa-image-links-value' }
            ];
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            this.removeAllEventListeners();
        }

        async handleSave() {
            for (const config of this.SLIDER_CONFIG) {
                const slider = this.element.querySelector(`#${config.sliderId}`);
                if (slider) {
                    const value = parseInt(slider.value, 10);
                    await GM_setValue(config.storageKey, value);

                    // Update global state
                    if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_NUM_RESULTS) globalState.setState({ exaNumResults: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_SUBPAGES) globalState.setState({ exaSubpages: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_LINKS) globalState.setState({ exaLinks: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_IMAGE_LINKS) globalState.setState({ exaImageLinks: value });
                }
            }
            this.unmount();
            location.reload();
        }

        handleSliderInput(sliderId, valueId) {
            const slider = this.element.querySelector(`#${sliderId}`);
            const valueDisplay = this.element.querySelector(`#${valueId}`);
            if (slider && valueDisplay) {
                valueDisplay.textContent = slider.value;
            }
        }

        render() {
            const wrapper = this.createElement('div', {
                className: 'config-modal'
            });

            let slidersHtml = '';
            for (const config of this.SLIDER_CONFIG) {
                let currentValue = config.defaultValue;

                // Get current value from state based on storage key
                if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_NUM_RESULTS) currentValue = this.state.exaNumResults;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_SUBPAGES) currentValue = this.state.exaSubpages;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_LINKS) currentValue = this.state.exaLinks;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.EXA_IMAGE_LINKS) currentValue = this.state.exaImageLinks;

                slidersHtml += `
                    <div class="config-slider-container">
                        <label for="${config.sliderId}">${config.label}</label>
                        <div class="slider-wrapper">
                            <input type="range" id="${config.sliderId}" name="${config.storageKey}" min="${config.min}" max="${config.max}" value="${currentValue}">
                            <span id="${config.valueId}" class="value-display">${currentValue}</span>
                        </div>
                    </div>
                `;
            }

            wrapper.innerHTML = `
                <div class="config-modal-content">
                    <div class="config-modal-header">Configure Exa Search</div>
                    <div class="config-modal-description">Adjust the parameters for Exa search requests.</div>
                    ${slidersHtml}
                    <div class="config-buttons">
                        <button id="exa-config-close" class="config-button config-close-button">Close</button>
                        <button id="exa-config-save" class="config-button config-save-button">Save & Reload</button>
                    </div>
                </div>
            `;

            // Attach event listeners
            this.SLIDER_CONFIG.forEach(config => {
                const slider = wrapper.querySelector(`#${config.sliderId}`);
                if (slider) {
                    this.addEventListener(slider, 'input', () => this.handleSliderInput(config.sliderId, config.valueId));
                }
            });

            const closeButton = wrapper.querySelector('#exa-config-close');
            const saveButton = wrapper.querySelector('#exa-config-save');

            this.addEventListener(closeButton, 'click', () => this.unmount());
            this.addEventListener(saveButton, 'click', () => this.handleSave());

            this.element = wrapper;
        }
    }

    class PerplexityConfigModal extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.state = globalState.getState();

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });

            this.CONFIG_ITEMS = [
                {
                    type: 'select',
                    storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_MODEL,
                    label: 'Model:',
                    defaultValue: CONFIG.DEFAULTS.PERPLEXITY_MODEL,
                    selectId: 'perplexity-model-select',
                    options: [
                        { value: 'sonar', text: 'sonar'},
                        { value: 'sonar-pro', text: 'sonar-pro'},
                        { value: 'sonar-deep-research', text: 'sonar-deep-research'},
                        { value: 'sonar-reasoning', text: 'sonar-reasoning'},
                        { value: 'sonar-reasoning-pro', text: 'sonar-reasoning-pro'},
                    ]
                },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_TEMPERATURE, label: 'Temperature (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_TEMPERATURE, sliderId: 'perplexity-temperature-slider', valueId: 'perplexity-temperature-value' },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_MAX_TOKENS, label: 'Max Tokens (1-4096):', min: 1, max: 4096, step: 1, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_MAX_TOKENS, sliderId: 'perplexity-max-tokens-slider', valueId: 'perplexity-max-tokens-value' },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_P, label: 'Top P (0.0-1.0):', min: 0, max: 1, step: 0.01, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_TOP_P, sliderId: 'perplexity-top-p-slider', valueId: 'perplexity-top-p-value' },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_K, label: 'Top K (0-200, 0 to disable):', min: 0, max: 200, step: 1, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_TOP_K, sliderId: 'perplexity-top-k-slider', valueId: 'perplexity-top-k-value' },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY, label: 'Presence Penalty (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_PRESENCE_PENALTY, sliderId: 'perplexity-presence-penalty-slider', valueId: 'perplexity-presence-penalty-value' },
                { type: 'slider', storageKey: CONFIG.STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY, label: 'Frequency Penalty (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: CONFIG.DEFAULTS.PERPLEXITY_FREQUENCY_PENALTY, sliderId: 'perplexity-frequency-penalty-slider', valueId: 'perplexity-frequency-penalty-value' }
            ];
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            this.removeAllEventListeners();
        }

        async handleSave() {
            for (const config of this.CONFIG_ITEMS) {
                let value;
                if (config.type === 'slider') {
                    const slider = this.element.querySelector(`#${config.sliderId}`);
                    if (slider) {
                        value = config.step && config.step < 1 ? parseFloat(slider.value) : parseInt(slider.value, 10);
                    }
                } else if (config.type === 'select') {
                    const select = this.element.querySelector(`#${config.selectId}`);
                    if (select) {
                        value = select.value;
                    }
                }

                if (value !== undefined) {
                    await GM_setValue(config.storageKey, value);

                    // Update global state
                    if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_MODEL) globalState.setState({ perplexityModel: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TEMPERATURE) globalState.setState({ perplexityTemperature: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_MAX_TOKENS) globalState.setState({ perplexityMaxTokens: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_P) globalState.setState({ perplexityTopP: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_K) globalState.setState({ perplexityTopK: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY) globalState.setState({ perplexityPresencePenalty: value });
                    else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY) globalState.setState({ perplexityFrequencyPenalty: value });
                }
            }
            this.unmount();
            location.reload();
        }

        handleSliderInput(sliderId, valueId) {
            const slider = this.element.querySelector(`#${sliderId}`);
            const valueDisplay = this.element.querySelector(`#${valueId}`);
            if (slider && valueDisplay) {
                valueDisplay.textContent = slider.value;
            }
        }

        render() {
            const wrapper = this.createElement('div', {
                className: 'config-modal'
            });

            let controlsHtml = '';
            for (const config of this.CONFIG_ITEMS) {
                let currentValue = config.defaultValue;

                // Get current value from state based on storage key
                if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_MODEL) currentValue = this.state.perplexityModel;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TEMPERATURE) currentValue = this.state.perplexityTemperature;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_MAX_TOKENS) currentValue = this.state.perplexityMaxTokens;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_P) currentValue = this.state.perplexityTopP;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_K) currentValue = this.state.perplexityTopK;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY) currentValue = this.state.perplexityPresencePenalty;
                else if (config.storageKey === CONFIG.STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY) currentValue = this.state.perplexityFrequencyPenalty;

                if (config.type === 'slider') {
                    controlsHtml += `
                        <div class="config-slider-container">
                            <label for="${config.sliderId}">${config.label}</label>
                            <div class="slider-wrapper">
                                <input type="range" id="${config.sliderId}" name="${config.storageKey}" min="${config.min}" max="${config.max}" step="${config.step || 1}" value="${currentValue}">
                                <span id="${config.valueId}" class="value-display">${currentValue}</span>
                            </div>
                        </div>
                    `;
                } else if (config.type === 'select') {
                    controlsHtml += `
                        <div class="config-slider-container">
                            <label for="${config.selectId}">${config.label}</label>
                            <select id="${config.selectId}" name="${config.storageKey}" class="api-input">
                                ${config.options.map(opt => `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }
            }

            wrapper.innerHTML = `
                <div class="config-modal-content">
                    <div class="config-modal-header">Configure Perplexity AI</div>
                    <div class="config-modal-description">Adjust parameters for Perplexity AI requests.</div>
                    ${controlsHtml}
                    <div class="config-buttons">
                        <button id="perplexity-config-close" class="config-button config-close-button">Close</button>
                        <button id="perplexity-config-save" class="config-button config-save-button">Save & Reload</button>
                    </div>
                </div>
            `;

            // Attach event listeners
            this.CONFIG_ITEMS.forEach(config => {
                if (config.type === 'slider') {
                    const slider = wrapper.querySelector(`#${config.sliderId}`);
                    if (slider) {
                        this.addEventListener(slider, 'input', () => this.handleSliderInput(config.sliderId, config.valueId));
                    }
                }
            });

            const closeButton = wrapper.querySelector('#perplexity-config-close');
            const saveButton = wrapper.querySelector('#perplexity-config-save');

            this.addEventListener(closeButton, 'click', () => this.unmount());
            this.addEventListener(saveButton, 'click', () => this.handleSave());

            this.element = wrapper;
        }
    }

    // ==================== Fetch Interceptor Component ====================

    class FetchInterceptor extends ReactLikeComponent {
        constructor(props) {
            super(props);
            this.originalFetch = null;
            this.apiService = new APIService();
            this.state = globalState.getState();

            this.unsubscribe = globalState.subscribe((newState) => {
                this.setState(newState);
            });
        }

        componentDidMount() {
            this.initInterceptor();
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }

        initInterceptor() {
            if (typeof unsafeWindow === 'undefined') {
                return;
            }

            const w = unsafeWindow;
            w.t3ChatSearch = w.t3ChatSearch || { needSearch: false };
            this.originalFetch = w.fetch.bind(w);

            w.fetch = async (input, initOptions) => {
                if (!unsafeWindow.t3ChatSearch.needSearch || !initOptions?.body) {
                    return this.originalFetch.call(w, input, initOptions);
                }

                let data;
                try {
                    data = JSON.parse(initOptions.body);
                } catch {
                    return this.originalFetch.call(w, input, initOptions);
                }

                if (!Array.isArray(data.messages)) {
                    return this.originalFetch.call(w, input, initOptions);
                }

                const messages = data.messages;
                const lastIdx = messages.length - 1;
                if (lastIdx < 0 || messages[lastIdx]?.role !== 'user') {
                    return this.originalFetch.call(w, input, initOptions);
                }

                const originalPrompt = messages[lastIdx]?.content;
                if (typeof originalPrompt !== 'string') {
                    return this.originalFetch.call(w, input, initOptions);
                }

                globalState.setState({ isLoading: true });

                const contextMessagesForApi = CONFIG.API.conversationContextEnabled ? messages.slice(0, lastIdx) : [];
                let searchRes = null;

                const currentState = globalState.getState();

                if (currentState.selectedApiProvider === CONFIG.API_PROVIDERS.EXA) {
                    let exaQuery = originalPrompt;
                    if (CONFIG.API.conversationContextEnabled && contextMessagesForApi.length > 0) {
                        const formattedHistory = contextMessagesForApi.map(msg => {
                            let roleDisplay = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : (msg.role || 'System'));
                            const content = String(msg.content || '').replace(/\n/g, ' ');
                            return `${roleDisplay}: ${content}`;
                        }).join('\n');
                        exaQuery = `Conversation History:\n${formattedHistory}\n\nLatest User Query: ${originalPrompt}`;
                    }
                    searchRes = await this.apiService.callExaAPI(exaQuery, contextMessagesForApi);
                } else if (currentState.selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                    searchRes = await this.apiService.callPerplexityAPI(originalPrompt, contextMessagesForApi);
                }

                globalState.setState({ isLoading: false });

                if (searchRes) {
                    const englishInstruction = "The following information was retrieved from a real-time web search using an external tool. Please use these results to inform your response:\n";
                    messages[lastIdx].content = `${englishInstruction}\n[Web Search Results]\n${searchRes}\n\n[Original Message]\n${originalPrompt}`;
                    initOptions.body = JSON.stringify(data);
                }

                return this.originalFetch.call(w, input, initOptions);
            };
        }

        render() {
            // This is a service component, no rendering needed
        }
    }

    // ==================== Main Application Component ====================

    class T3ChatSearchApp extends ReactLikeComponent {
        constructor() {
            super();
            this.components = {
                styleManager: new StyleManager(),
                fetchInterceptor: new FetchInterceptor(),
                searchToggle: null,
                searchingIndicator: new SearchingIndicator()
            };
            this.injectionObserver = null;
            this.injectionInterval = null;
        }

        async componentDidMount() {
            await this.loadStoredSettings();
            await this.initMenuCommands();

            this.components.styleManager.mount();
            this.components.fetchInterceptor.mount();
            this.components.searchingIndicator.mount();

            this.setupUIInjection();
        }

        componentWillUnmount() {
            if (this.injectionObserver) {
                this.injectionObserver.disconnect();
            }
            if (this.injectionInterval) {
                clearInterval(this.injectionInterval);
            }

            Object.values(this.components).forEach(component => {
                if (component && component.unmount) {
                    component.unmount();
                }
            });
        }

        async loadStoredSettings() {
            const selectedApiProvider = await GM_getValue(CONFIG.STORAGE_KEYS.SELECTED_API_PROVIDER, CONFIG.API_PROVIDERS.EXA);
            const exaApiKey = await GM_getValue(CONFIG.STORAGE_KEYS.API_KEY_EXA);
            const perplexityApiKey = await GM_getValue(CONFIG.STORAGE_KEYS.API_KEY_PERPLEXITY);

            const exaNumResults = await GM_getValue(CONFIG.STORAGE_KEYS.EXA_NUM_RESULTS, CONFIG.DEFAULTS.EXA_NUM_RESULTS);
            const exaSubpages = await GM_getValue(CONFIG.STORAGE_KEYS.EXA_SUBPAGES, CONFIG.DEFAULTS.EXA_SUBPAGES);
            const exaLinks = await GM_getValue(CONFIG.STORAGE_KEYS.EXA_LINKS, CONFIG.DEFAULTS.EXA_LINKS);
            const exaImageLinks = await GM_getValue(CONFIG.STORAGE_KEYS.EXA_IMAGE_LINKS, CONFIG.DEFAULTS.EXA_IMAGE_LINKS);

            const perplexityModel = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_MODEL, CONFIG.DEFAULTS.PERPLEXITY_MODEL);
            const perplexityTemperature = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_TEMPERATURE, CONFIG.DEFAULTS.PERPLEXITY_TEMPERATURE);
            const perplexityMaxTokens = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_MAX_TOKENS, CONFIG.DEFAULTS.PERPLEXITY_MAX_TOKENS);
            const perplexityTopP = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_P, CONFIG.DEFAULTS.PERPLEXITY_TOP_P);
            const perplexityTopK = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_TOP_K, CONFIG.DEFAULTS.PERPLEXITY_TOP_K);
            const perplexityPresencePenalty = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY, CONFIG.DEFAULTS.PERPLEXITY_PRESENCE_PENALTY);
            const perplexityFrequencyPenalty = await GM_getValue(CONFIG.STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY, CONFIG.DEFAULTS.PERPLEXITY_FREQUENCY_PENALTY);

            globalState.setState({
                selectedApiProvider,
                exaApiKey,
                perplexityApiKey,
                exaNumResults,
                exaSubpages,
                exaLinks,
                exaImageLinks,
                perplexityModel,
                perplexityTemperature,
                perplexityMaxTokens,
                perplexityTopP,
                perplexityTopK,
                perplexityPresencePenalty,
                perplexityFrequencyPenalty
            });
        }

        async initMenuCommands() {
            GM_registerMenuCommand('Set API Provider & Key', () => {
                const modal = new APIKeyModal();
                modal.mount(document.body);
            });

            GM_registerMenuCommand('Reset Current API Key', async () => {
                const state = globalState.getState();
                if (state.selectedApiProvider === CONFIG.API_PROVIDERS.EXA) {
                    await GM_setValue(CONFIG.STORAGE_KEYS.API_KEY_EXA, '');
                    globalState.setState({ exaApiKey: null });
                } else if (state.selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                    await GM_setValue(CONFIG.STORAGE_KEYS.API_KEY_PERPLEXITY, '');
                    globalState.setState({ perplexityApiKey: null });
                }
                location.reload();
            });

            GM_registerMenuCommand('Configure API Parameters', async () => {
                const state = globalState.getState();
                if (state.selectedApiProvider === CONFIG.API_PROVIDERS.EXA) {
                    const modal = new ExaConfigModal();
                    modal.mount(document.body);
                } else if (state.selectedApiProvider === CONFIG.API_PROVIDERS.PERPLEXITY) {
                    const modal = new PerplexityConfigModal();
                    modal.mount(document.body);
                }
            });
        }

        setupUIInjection() {
            // Mutation observer for dynamic injection
            const injectionObserverTargetParent = document.querySelector(CONFIG.SELECTORS.justifyDiv)?.parentElement || document.body;
            this.injectionObserver = new MutationObserver(() => {
                this.injectSearchToggle();
            });
            this.injectionObserver.observe(injectionObserverTargetParent, { childList: true, subtree: true });

            // Interval backup for injection
            this.injectionInterval = setInterval(() => {
                this.injectSearchToggle();
            }, 10);

            // Initial injection attempt
            this.injectSearchToggle();
        }

        injectSearchToggle() {
            const justifyDiv = document.querySelector(CONFIG.SELECTORS.justifyDiv);
            if (!justifyDiv) return false;

            const modelTempSection = justifyDiv.querySelector(CONFIG.SELECTORS.modelTempSection);
            if (!modelTempSection) return false;

            const mlGroup = modelTempSection.querySelector(CONFIG.SELECTORS.mlGroup);
            if (!mlGroup) return false;

            const existingBtn = mlGroup.querySelector('#search-toggle');
            if (existingBtn) {
                if (mlGroup.lastElementChild !== existingBtn) {
                    mlGroup.appendChild(existingBtn);
                }
                return true;
            }

            if (!this.components.searchToggle) {
                this.components.searchToggle = new SearchToggle();
            }

            this.components.searchToggle.render();
            if (this.components.searchToggle.element) {
                mlGroup.appendChild(this.components.searchToggle.element);
                // Trigger componentDidMount manually since we're not using mount()
                this.components.searchToggle.componentDidMount();
            }

            return true;
        }

        render() {
            // Main app component, rendering is handled by sub-components
        }
    }

    // ==================== Application Initialization ====================

    async function initializeApp() {
        const app = new T3ChatSearchApp();
        app.mount();
    }

    // Start the application
    initializeApp();

})();
