// ==UserScript==
// @name         t3.chat Exa & Perplexity Search
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Call Exa or Perplexity API on t3.chat
// @match        https://t3.chat/*
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

(async function() {
    'use strict';

    // --- Configuration and State ---
    const SCRIPT_NAME = "t3.chat Inject Search Toggle (with Exa & Perplexity API)";
    const SCRIPT_VERSION = "0.4";

    const API_PROVIDERS = {
        EXA: 'exa',
        PERPLEXITY: 'perplexity'
    };

    const DEFAULT_EXA_NUM_RESULTS = 5;
    const DEFAULT_EXA_SUBPAGES = 2;
    const DEFAULT_EXA_LINKS = 3;
    const DEFAULT_EXA_IMAGE_LINKS = 0;

    const DEFAULT_PERPLEXITY_MODEL = 'sonar';
    const DEFAULT_PERPLEXITY_TEMPERATURE = 0.7;
    const DEFAULT_PERPLEXITY_MAX_TOKENS = 512;
    const DEFAULT_PERPLEXITY_TOP_P = 1;
    const DEFAULT_PERPLEXITY_TOP_K = 0; // 0 means not used by Perplexity
    const DEFAULT_PERPLEXITY_PRESENCE_PENALTY = 0;
    const DEFAULT_PERPLEXITY_FREQUENCY_PENALTY = 0;

    const GM_STORAGE_KEYS = {
        DEBUG: 'debug',
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
    };

    const API_CONFIG = {
        exaEndpoint: 'https://api.exa.ai/search',
        perplexityEndpoint: 'https://api.perplexity.ai/chat/completions',
        conversationContextEnabled: true,
        apiRequestTimeout: 300000 // Increased timeout to 300 seconds (5 minutes)
    };

    const SELECTORS = {
        justifyDiv: 'div.mt-2.flex-row-reverse.justify-between',
        modelTempSection: 'div.flex.flex-col',
        mlGroup: 'div.ml-\\[-7px\\]', // Escaped for querySelector
        chatLogContainer: 'div[role="log"][aria-label="Chat messages"]',
        mainContentArea: 'main',
        chatArea: '.chat'
    };

    const UI_IDS = {
        styleElement: 't3chat-search-style',
        apiKeyModal: 'api-key-modal',
        apiKeyModalContent: 'api-key-modal-content',
        apiKeyModalHeader: 'api-key-modal-header',
        apiKeyModalDescription: 'api-key-modal-description',
        apiProviderSelect: 'api-provider-select',
        apiKeyInput: 'api-key-input',
        apiKeyShowCheckbox: 'api-key-show',
        apiKeyShowLabelContainer: 'api-key-show-label-container',
        apiKeySaveButton: 'api-key-save',
        searchToggle: 'search-toggle',
        exaConfigModal: 'exa-config-modal',
        exaConfigModalContent: 'exa-config-modal-content',
        exaConfigModalHeader: 'exa-config-modal-header-id',
        exaConfigModalDescription: 'exa-config-modal-description-id',
        exaConfigCloseButton: 'exa-config-close-button',
        exaConfigSaveButton: 'exa-config-save-button',
        numResultsSlider: 'exa-num-results-slider',
        numResultsValue: 'exa-num-results-value',
        subpagesSlider: 'exa-subpages-slider',
        subpagesValue: 'exa-subpages-value',
        linksSlider: 'exa-links-slider',
        linksValue: 'exa-links-value',
        imageLinksSlider: 'exa-image-links-slider',
        imageLinksValue: 'exa-image-links-value',
        perplexityConfigModal: 'perplexity-config-modal',
        perplexityConfigModalContent: 'perplexity-config-modal-content',
        perplexityConfigModalHeader: 'perplexity-config-modal-header',
        perplexityConfigModalDescription: 'perplexity-config-modal-description',
        perplexityConfigCloseButton: 'perplexity-config-close-button',
        perplexityConfigSaveButton: 'perplexity-config-save-button',
        perplexityModelSelect: 'perplexity-model-select',
        perplexityTemperatureSlider: 'perplexity-temperature-slider',
        perplexityTemperatureValue: 'perplexity-temperature-value',
        perplexityMaxTokensSlider: 'perplexity-max-tokens-slider',
        perplexityMaxTokensValue: 'perplexity-max-tokens-value',
        perplexityTopPSlider: 'perplexity-top-p-slider',
        perplexityTopPValue: 'perplexity-top-p-value',
        perplexityTopKSlider: 'perplexity-top-k-slider',
        perplexityTopKValue: 'perplexity-top-k-value',
        perplexityPresencePenaltySlider: 'perplexity-presence-penalty-slider',
        perplexityPresencePenaltyValue: 'perplexity-presence-penalty-value',
        perplexityFrequencyPenaltySlider: 'perplexity-frequency-penalty-slider',
        perplexityFrequencyPenaltyValue: 'perplexity-frequency-penalty-value'
    };

    const CSS_CLASSES = {
        button: "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 disabled:cursor-not-allowed hover:bg-muted/40 hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-foreground/50 px-3 text-xs -mb-1.5 h-auto gap-2 rounded-full border border-solid border-secondary-foreground/10 py-1.5 pl-2 pr-2.5 text-muted-foreground",
        searchToggleLoading: 'loading',
        searchToggleOn: 'on'
    };

    // --- State Variables ---
    let debugMode = false;
    let selectedApiProvider = API_PROVIDERS.EXA;
    let exaApiKey = null;
    let perplexityApiKey = null;

    let exaNumResults = DEFAULT_EXA_NUM_RESULTS;
    let exaSubpages = DEFAULT_EXA_SUBPAGES;
    let exaLinks = DEFAULT_EXA_LINKS;
    let exaImageLinks = DEFAULT_EXA_IMAGE_LINKS;

    let perplexityModel = DEFAULT_PERPLEXITY_MODEL;
    let perplexityTemperature = DEFAULT_PERPLEXITY_TEMPERATURE;
    let perplexityMaxTokens = DEFAULT_PERPLEXITY_MAX_TOKENS;
    let perplexityTopP = DEFAULT_PERPLEXITY_TOP_P;
    let perplexityTopK = DEFAULT_PERPLEXITY_TOP_K;
    let perplexityPresencePenalty = DEFAULT_PERPLEXITY_PRESENCE_PENALTY;
    let perplexityFrequencyPenalty = DEFAULT_PERPLEXITY_FREQUENCY_PENALTY;

    // --- Utility: Debounce ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // --- Utility: Logger ---
    const Logger = {
        log: (...args) => {
            if (debugMode) console.log(`[${SCRIPT_NAME}]`, ...args);
        },
        error: (...args) => console.error(`[${SCRIPT_NAME}]`, ...args)
    };

    // --- Utility: LaTeX Processor ---
    const LaTeXProcessor = {
        map: [
            { pattern: /(\d+)(?:\\,)?(?:\^)?\circ\mathrm{C}/g, replacement: '$1°C' },
            { pattern: /(\d+)(?:\\,)?(?:\^)?\circ\mathrm{F}/g, replacement: '$1°F' },
            { pattern: /(\d+)(?:\\,)?(?:\^)?\circ/g, replacement: '$1°' },
            { pattern: /\times/g, replacement: '×' },
            { pattern: /\div/g, replacement: '÷' },
            { pattern: /\pm/g, replacement: '±' },
            { pattern: /\sqrt{([^}]+)}/g, replacement: '√($1)' },
            { pattern: /\frac{([^}]+)}{([^}]+)}/g, replacement: '$1/$2' },
            { pattern: /\mathrm{([^}]+)}/g, replacement: '$1' },
            { pattern: /\text(?:bf)?{([^}]+)}/g, replacement: '$1' },
            { pattern: /\left\(/g, replacement: '(' },
            { pattern: /\right\)/g, replacement: ')' },
            { pattern: /\,/g, replacement: ' ' },
            { pattern: /\%/g, replacement: '%' },
        ],
        process: function(text) {
            return text
                ? this.map.reduce((t, { pattern, replacement }) => t.replace(pattern, replacement), text)
                : text;
        }
    };

    // --- Core: Style Management ---
    const StyleManager = {
        injectGlobalStyles: () => {
            if (document.getElementById(UI_IDS.styleElement)) return;
            const styleEl = document.createElement('style');
            styleEl.id = UI_IDS.styleElement;
            // Using template literals for multiline strings requires backticks `
            styleEl.textContent = `
  /* Spinner - New globe flip animation */
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleLoading} {
    opacity: 0.8; /* Keep it slightly dimmed */
  }
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleLoading} svg.lucide-globe { /* Target the globe icon specifically */
    animation: globe-flip 1.2s linear infinite;
  }
  @keyframes globe-flip {
    0% {
      transform: scaleX(-1) rotateY(0deg); /* Maintain existing horizontal flip, start normal */
    }
    50% {
      transform: scaleX(-1) rotateY(180deg);
    }
    100% {
      transform: scaleX(-1) rotateY(360deg);
    }
  }

  /* 按鈕切換動畫 */
  #${UI_IDS.searchToggle} { position: relative; overflow: hidden; transition: color 0.3s ease; }
  #${UI_IDS.searchToggle}::before { content: ''; position: absolute; inset: 0; background-color: rgba(219,39,119,0.15); transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; z-index:-1; }
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleOn}::before { transform: scaleX(1); }
  #${UI_IDS.searchToggle} svg { transition: transform 0.3s ease; }
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleOn} svg { transform: rotate(360deg); }

  /* API Key Modal Styles */
  #${UI_IDS.apiKeyModal} {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  #${UI_IDS.apiKeyModalContent} {
    background: #1c1c1e;
    padding: 24px;
    border-radius: 12px;
    width: 360px;
    box-sizing: border-box;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  #${UI_IDS.apiKeyModalHeader} {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  #${UI_IDS.apiKeyModalHeader} > div:first-child { /* Icon container */
    color: #c62a88;
    margin-right: 12px;
  }
  #${UI_IDS.apiKeyModalHeader} > div:last-child { /* Title container */
    font-size: 22px;
    font-weight: 600;
    color: #fff;
  }
  #${UI_IDS.apiKeyModalDescription} {
    color: #999;
    font-size: 14px;
    margin-bottom: 16px;
  }
  #${UI_IDS.apiKeyInput} {
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
  #${UI_IDS.apiKeyShowLabelContainer} {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    color: #ccc;
  }
  #${UI_IDS.apiKeyShowCheckbox} {
    margin-right: 8px;
    accent-color: #c62a88;
  }
  #${UI_IDS.apiKeyShowLabelContainer} label {
    font-size: 14px;
  }
  #${UI_IDS.apiKeySaveButton} {
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
  #${UI_IDS.apiKeySaveButton}:hover {
    background-color: #c62a88;
  }
  /* Exa Config Modal Styles */
  #${UI_IDS.exaConfigModal} {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000; /* Ensure it's above other modals */
  }
  #${UI_IDS.exaConfigModalContent} {
    background: #1c1c1e; /* Dark background from image */
    padding: 24px;
    border-radius: 12px;
    width: 400px;
    box-sizing: border-box;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    color: #fff;
  }
  #${UI_IDS.exaConfigModalHeader} { /* Using the specific ID */
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  #${UI_IDS.exaConfigModalDescription} { /* Using the specific ID */
    color: #aaa;
    font-size: 14px;
    margin-bottom: 24px;
  }
  .exa-config-slider-container {
    margin-bottom: 20px;
  }
  .exa-config-slider-container label {
    display: block;
    font-size: 14px;
    color: #ccc;
    margin-bottom: 10px;
  }
  .exa-config-slider-container .slider-wrapper {
    display: flex;
    align-items: center;
  }
  .exa-config-slider-container input[type="range"] {
    flex-grow: 1;
    margin-right: 15px;
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    background: #444; /* Slider track color */
    border-radius: 4px;
    outline: none;
  }
  .exa-config-slider-container input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: #c62a88; /* Slider thumb color (magenta) */
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #1c1c1e; /* Thumb border to match modal bg */
  }
  .exa-config-slider-container input[type="range"]::-moz-range-thumb {
    width: 18px; /* For Firefox */
    height: 18px;
    background: #c62a88;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #1c1c1e;
  }
  .exa-config-slider-container .value-display {
    display: inline-block;
    width: 30px; /* Increased width for two digits */
    text-align: right;
    font-size: 14px;
    color: #fff;
  }
  .exa-config-buttons {
    margin-top: 30px;
    display: flex;
    justify-content: flex-end; /* Align buttons to the right */
    gap: 12px; /* Space between buttons */
  }
  .exa-config-button { /* General button style */
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  #${UI_IDS.exaConfigCloseButton} {
    background-color: #4a4a4f; /* Darker grey for Close */
    color: #ddd;
  }
  #${UI_IDS.exaConfigCloseButton}:hover {
    background-color: #5a5a5f;
  }
  #${UI_IDS.exaConfigSaveButton} {
    background-color: #a02553; /* Original save button color */
    color: white;
  }
  #${UI_IDS.exaConfigSaveButton}:hover {
    background-color: #c62a88; /* Original save button hover */
  }

  /* Perplexity Config Modal Styles (Mirroring Exa's for base visibility) */
  #${UI_IDS.perplexityConfigModal} {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000; /* Ensure it's above other modals */
  }
  #${UI_IDS.perplexityConfigModalContent} {
    background: #1c1c1e; /* Dark background */
    padding: 24px;
    border-radius: 12px;
    width: 400px; /* Same width as Exa's */
    box-sizing: border-box;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    color: #fff;
  }
  #${UI_IDS.perplexityConfigModalHeader} { /* Unique ID for Perplexity header */
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  #${UI_IDS.perplexityConfigModalDescription} { /* Unique ID for Perplexity description */
    color: #aaa;
    font-size: 14px;
    margin-bottom: 24px;
  }
  /* Note: Slider and button styles within Perplexity modal re-use existing .exa-config- classes */
            `;
            document.head.appendChild(styleEl);
            Logger.log("Global styles injected.");
        }
    };

    // --- Core: API Key Modal ---
    const ApiKeyModal = {
        _isShown: false,
        show: async () => {
            if (document.getElementById(UI_IDS.apiKeyModal) || ApiKeyModal._isShown) return;
            ApiKeyModal._isShown = true;

            // Ensure current provider is loaded before showing
            selectedApiProvider = await GM_getValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, API_PROVIDERS.EXA);
            const currentExaKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_EXA, '');
            const currentPerplexityKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY, '');

            const wrapper = document.createElement('div');
            wrapper.id = UI_IDS.apiKeyModal;
            wrapper.innerHTML = `
      <div id="${UI_IDS.apiKeyModalContent}">
        <div id="${UI_IDS.apiKeyModalHeader}">
          <div><!-- Icon container -->
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </div>
          <div>Enter API Key</div><!-- Title -->
        </div>
        <div id="${UI_IDS.apiKeyModalDescription}">Select your API provider and set the API Key to enable web search functionality.</div>
        <div style="margin-bottom: 16px;">
            <label for="${UI_IDS.apiProviderSelect}" style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">API Provider:</label>
            <select id="${UI_IDS.apiProviderSelect}" style="width: 100%; padding: 12px; background: #2a2a2c; color: #fff; border: 1px solid #333; border-radius: 6px; font-size: 14px;">
                <option value="${API_PROVIDERS.EXA}" ${selectedApiProvider === API_PROVIDERS.EXA ? 'selected' : ''}>Exa API</option>
                <option value="${API_PROVIDERS.PERPLEXITY}" ${selectedApiProvider === API_PROVIDERS.PERPLEXITY ? 'selected' : ''}>Perplexity API</option>
            </select>
        </div>
        <input id="${UI_IDS.apiKeyInput}" type="password" placeholder="Enter your API Key" value="${selectedApiProvider === API_PROVIDERS.EXA ? currentExaKey : currentPerplexityKey}" />
        <div id="${UI_IDS.apiKeyShowLabelContainer}">
          <input id="${UI_IDS.apiKeyShowCheckbox}" type="checkbox" />
          <label for="${UI_IDS.apiKeyShowCheckbox}">Show API Key</label>
        </div>
        <button id="${UI_IDS.apiKeySaveButton}">Save Settings</button>
      </div>`;
            document.body.appendChild(wrapper);
            ApiKeyModal._attachEventListeners(wrapper);
            Logger.log("API Key modal shown.");
        },
        _attachEventListeners: (modalElement) => {
            const keyInput = modalElement.querySelector(`#${UI_IDS.apiKeyInput}`);
            const showCheckbox = modalElement.querySelector(`#${UI_IDS.apiKeyShowCheckbox}`);
            const saveButton = modalElement.querySelector(`#${UI_IDS.apiKeySaveButton}`);
            const providerSelect = modalElement.querySelector(`#${UI_IDS.apiProviderSelect}`);

            providerSelect.addEventListener('change', async (e) => {
                const newProvider = e.target.value;
                keyInput.value = newProvider === API_PROVIDERS.EXA
                    ? await GM_getValue(GM_STORAGE_KEYS.API_KEY_EXA, '')
                    : await GM_getValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY, '');
                keyInput.placeholder = `Enter your ${newProvider === API_PROVIDERS.EXA ? 'Exa' : 'Perplexity'} API Key`;
            });

            showCheckbox.addEventListener('change', (e) => {
                keyInput.type = e.target.checked ? 'text' : 'password';
            });

            saveButton.addEventListener('click', async () => {
                const key = keyInput.value.trim();
                const currentProvider = providerSelect.value;

                if (key) {
                    if (currentProvider === API_PROVIDERS.EXA) {
                        await GM_setValue(GM_STORAGE_KEYS.API_KEY_EXA, key);
                        exaApiKey = key;
                    } else if (currentProvider === API_PROVIDERS.PERPLEXITY) {
                        await GM_setValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY, key);
                        perplexityApiKey = key;
                    }
                    await GM_setValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, currentProvider);
                    selectedApiProvider = currentProvider;

                    Logger.log(`${currentProvider} API Key saved. Selected provider: ${currentProvider}`);
                    modalElement.remove();
                    ApiKeyModal._isShown = false;
                    location.reload();
                } else {
                    alert('API Key cannot be empty for the selected provider.');
                }
            });
        }
    };

    // --- Core: Exa Configuration Modal ---
    const ExaConfigModal = {
        _isShown: false,
        _modalElement: null,

        SLIDER_CONFIG: [
            { storageKey: GM_STORAGE_KEYS.EXA_NUM_RESULTS, label: 'Search Results Count (0-99):', min: 0, max: 99, defaultValue: DEFAULT_EXA_NUM_RESULTS, sliderId: UI_IDS.numResultsSlider, valueId: UI_IDS.numResultsValue },
            { storageKey: GM_STORAGE_KEYS.EXA_SUBPAGES, label: 'Subpages Count (0-10):', min: 0, max: 10, defaultValue: DEFAULT_EXA_SUBPAGES, sliderId: UI_IDS.subpagesSlider, valueId: UI_IDS.subpagesValue },
            { storageKey: GM_STORAGE_KEYS.EXA_LINKS, label: 'Links Count (0-10):', min: 0, max: 10, defaultValue: DEFAULT_EXA_LINKS, sliderId: UI_IDS.linksSlider, valueId: UI_IDS.linksValue },
            { storageKey: GM_STORAGE_KEYS.EXA_IMAGE_LINKS, label: 'Image Links Count (0-10):', min: 0, max: 10, defaultValue: DEFAULT_EXA_IMAGE_LINKS, sliderId: UI_IDS.imageLinksSlider, valueId: UI_IDS.imageLinksValue }
        ],

        show: async function() {
            if (this._isShown || document.getElementById(UI_IDS.exaConfigModal)) return;
            this._isShown = true;

            const wrapper = document.createElement('div');
            wrapper.id = UI_IDS.exaConfigModal;

            let slidersHtml = '';
            for (const config of this.SLIDER_CONFIG) {
                const currentValue = await GM_getValue(config.storageKey, config.defaultValue);
                slidersHtml += `
                    <div class="exa-config-slider-container">
                        <label for="${config.sliderId}">${config.label}</label>
                        <div class="slider-wrapper">
                            <input type="range" id="${config.sliderId}" name="${config.storageKey}" min="${config.min}" max="${config.max}" value="${currentValue}">
                            <span id="${config.valueId}" class="value-display">${currentValue}</span>
                        </div>
                    </div>
                `;
            }

            wrapper.innerHTML = `
                <div id="${UI_IDS.exaConfigModalContent}">
                    <div id="${UI_IDS.exaConfigModalHeader}">Configure Exa Search</div>
                    <div id="${UI_IDS.exaConfigModalDescription}">Adjust the parameters for Exa search requests.</div>
                    ${slidersHtml}
                    <div class="exa-config-buttons">
                        <button id="${UI_IDS.exaConfigCloseButton}" class="exa-config-button">Close</button>
                        <button id="${UI_IDS.exaConfigSaveButton}" class="exa-config-button">Save & Reload</button>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper);
            this._modalElement = wrapper;
            this._attachEventListeners();
            Logger.log("Exa Config modal shown.");
        },

        hide: function() {
            if (this._modalElement) {
                this._modalElement.remove();
                this._modalElement = null;
            }
            this._isShown = false;
            Logger.log("Exa Config modal hidden.");
        },

        _attachEventListeners: function() {
            if (!this._modalElement) return;

            this.SLIDER_CONFIG.forEach(config => {
                const slider = this._modalElement.querySelector(`#${config.sliderId}`);
                const valueDisplay = this._modalElement.querySelector(`#${config.valueId}`);
                if (slider && valueDisplay) {
                    slider.addEventListener('input', (e) => {
                        valueDisplay.textContent = e.target.value;
                    });
                }
            });

            const closeButton = this._modalElement.querySelector(`#${UI_IDS.exaConfigCloseButton}`);
            if (closeButton) {
                closeButton.addEventListener('click', () => this.hide());
            }

            const saveButton = this._modalElement.querySelector(`#${UI_IDS.exaConfigSaveButton}`);
            if (saveButton) {
                saveButton.addEventListener('click', async () => {
                    Logger.log("Saving Exa configuration...");
                    for (const config of this.SLIDER_CONFIG) {
                        const slider = this._modalElement.querySelector(`#${config.sliderId}`);
                        if (slider) {
                            const value = parseInt(slider.value, 10);
                            await GM_setValue(config.storageKey, value);
                            // Update live global variables immediately
                            if (config.storageKey === GM_STORAGE_KEYS.EXA_NUM_RESULTS) exaNumResults = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.EXA_SUBPAGES) exaSubpages = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.EXA_LINKS) exaLinks = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.EXA_IMAGE_LINKS) exaImageLinks = value;
                            Logger.log(`Set ${config.storageKey} to ${value}`);
                        }
                    }
                    this.hide();
                    Logger.log("Exa configuration saved. Reloading page.");
                    location.reload();
                });
            }
        }
    };

    // --- Core: Perplexity Configuration Modal ---
    const PerplexityConfigModal = {
        _isShown: false,
        _modalElement: null,

        CONFIG_ITEMS: [
            {
                type: 'select', storageKey: GM_STORAGE_KEYS.PERPLEXITY_MODEL, label: 'Model:', defaultValue: DEFAULT_PERPLEXITY_MODEL, selectId: UI_IDS.perplexityModelSelect,
                options: [
                    { value: 'sonar', text: 'sonar'},
                    { value: 'sonar-pro', text: 'sonar-pro'},
                    { value: 'sonar-deep-research', text: 'sonar-deep-research'},
                    { value: 'sonar-reasoning', text: 'sonar-reasoning'},
                    { value: 'sonar-reasoning-pro', text: 'sonar-reasoning-pro'},
                    { value: 'r1-1776', text: 'r1-1776'}
                ]
            },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_TEMPERATURE, label: 'Temperature (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: DEFAULT_PERPLEXITY_TEMPERATURE, sliderId: UI_IDS.perplexityTemperatureSlider, valueId: UI_IDS.perplexityTemperatureValue },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_MAX_TOKENS, label: 'Max Tokens (1-4096):', min: 1, max: 4096, step: 1, defaultValue: DEFAULT_PERPLEXITY_MAX_TOKENS, sliderId: UI_IDS.perplexityMaxTokensSlider, valueId: UI_IDS.perplexityMaxTokensValue },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_TOP_P, label: 'Top P (0.0-1.0):', min: 0, max: 1, step: 0.01, defaultValue: DEFAULT_PERPLEXITY_TOP_P, sliderId: UI_IDS.perplexityTopPSlider, valueId: UI_IDS.perplexityTopPValue },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_TOP_K, label: 'Top K (0-200, 0 to disable):', min: 0, max: 200, step: 1, defaultValue: DEFAULT_PERPLEXITY_TOP_K, sliderId: UI_IDS.perplexityTopKSlider, valueId: UI_IDS.perplexityTopKValue },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY, label: 'Presence Penalty (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: DEFAULT_PERPLEXITY_PRESENCE_PENALTY, sliderId: UI_IDS.perplexityPresencePenaltySlider, valueId: UI_IDS.perplexityPresencePenaltyValue },
            { type: 'slider', storageKey: GM_STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY, label: 'Frequency Penalty (0.0-2.0):', min: 0, max: 2, step: 0.1, defaultValue: DEFAULT_PERPLEXITY_FREQUENCY_PENALTY, sliderId: UI_IDS.perplexityFrequencyPenaltySlider, valueId: UI_IDS.perplexityFrequencyPenaltyValue }
        ],

        show: async function() {
            if (this._isShown || document.getElementById(UI_IDS.perplexityConfigModal)) return;
            this._isShown = true;

            const wrapper = document.createElement('div');
            wrapper.id = UI_IDS.perplexityConfigModal; // Use the correct ID for Perplexity modal

            let controlsHtml = '';
            for (const config of this.CONFIG_ITEMS) {
                const currentValue = await GM_getValue(config.storageKey, config.defaultValue);
                if (config.type === 'slider') {
                    controlsHtml += `
                        <div class="exa-config-slider-container"> <!-- Re-use exa styling for sliders -->
                            <label for="${config.sliderId}">${config.label}</label>
                            <div class="slider-wrapper">
                                <input type="range" id="${config.sliderId}" name="${config.storageKey}" min="${config.min}" max="${config.max}" step="${config.step || 1}" value="${currentValue}">
                                <span id="${config.valueId}" class="value-display">${currentValue}</span>
                            </div>
                        </div>
                    `;
                } else if (config.type === 'select') {
                    controlsHtml += `
                        <div class="exa-config-slider-container"> <!-- Re-use exa styling -->
                            <label for="${config.selectId}">${config.label}</label>
                            <select id="${config.selectId}" name="${config.storageKey}" style="width: 100%; padding: 10px; background: #2a2a2c; color: #fff; border: 1px solid #333; border-radius: 6px; font-size: 14px;">
                                ${config.options.map(opt => `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }
            }

            wrapper.innerHTML = `
                <div id="${UI_IDS.perplexityConfigModalContent}"> <!-- Use perplexity specific ID -->
                    <div id="${UI_IDS.perplexityConfigModalHeader}">Configure Perplexity AI</div>
                    <div id="${UI_IDS.perplexityConfigModalDescription}">Adjust parameters for Perplexity AI requests.</div>
                    ${controlsHtml}
                    <div class="exa-config-buttons">
                        <button id="${UI_IDS.perplexityConfigCloseButton}" class="exa-config-button">Close</button>
                        <button id="${UI_IDS.perplexityConfigSaveButton}" class="exa-config-button">Save & Reload</button>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper);
            this._modalElement = wrapper;
            this._attachEventListeners();
            Logger.log("Perplexity Config modal shown.");
        },

        hide: function() {
            if (this._modalElement) {
                this._modalElement.remove();
                this._modalElement = null;
            }
            this._isShown = false;
            Logger.log("Perplexity Config modal hidden.");
        },

        _attachEventListeners: function() {
            if (!this._modalElement) return;

            this.CONFIG_ITEMS.forEach(config => {
                if (config.type === 'slider') {
                    const slider = this._modalElement.querySelector(`#${config.sliderId}`);
                    const valueDisplay = this._modalElement.querySelector(`#${config.valueId}`);
                    if (slider && valueDisplay) {
                        slider.addEventListener('input', (e) => {
                            valueDisplay.textContent = e.target.value;
                        });
                    }
                }
                // No event listener needed for select on input, value is read on save.
            });

            const closeButton = this._modalElement.querySelector(`#${UI_IDS.perplexityConfigCloseButton}`);
            if (closeButton) {
                closeButton.addEventListener('click', () => this.hide());
            }

            const saveButton = this._modalElement.querySelector(`#${UI_IDS.perplexityConfigSaveButton}`);
            if (saveButton) {
                saveButton.addEventListener('click', async () => {
                    Logger.log("Saving Perplexity configuration...");
                    for (const config of this.CONFIG_ITEMS) {
                        let value;
                        if (config.type === 'slider') {
                            const slider = this._modalElement.querySelector(`#${config.sliderId}`);
                            if (slider) {
                                value = config.step && config.step < 1 ? parseFloat(slider.value) : parseInt(slider.value, 10);
                            }
                        } else if (config.type === 'select') {
                            const select = this._modalElement.querySelector(`#${config.selectId}`);
                            if (select) {
                                value = select.value;
                            }
                        }

                        if (value !== undefined) {
                            await GM_setValue(config.storageKey, value);
                            // Update live global variables immediately
                            if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_MODEL) perplexityModel = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_TEMPERATURE) perplexityTemperature = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_MAX_TOKENS) perplexityMaxTokens = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_TOP_P) perplexityTopP = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_TOP_K) perplexityTopK = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY) perplexityPresencePenalty = value;
                            else if (config.storageKey === GM_STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY) perplexityFrequencyPenalty = value;
                            Logger.log(`Set ${config.storageKey} to ${value}`);
                        }
                    }
                    this.hide();
                    Logger.log("Perplexity configuration saved. Reloading page.");
                    location.reload();
                });
            }
        }
    };

    // --- Core: Exa API Interaction ---
    const ExaAPI = {
        call: async (prompt, contextMessages = []) => {
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                Logger.error("ExaAPI.call: Invalid prompt");
                return null;
            }
            if (!exaApiKey) {
                Logger.error("ExaAPI.call: Exa API Key is not set.");
                ApiKeyModal.show(); // Show the generic API key modal
                return null;
            }

            // Full-featured request body with configurable counts
            const requestBody = {
                query: prompt,
                type: "auto",
                numResults: exaNumResults,
                contents: {
                    text: { includeHtmlTags: false },
                    livecrawl: "always", // WARNING: "always" can be expensive. Check Exa API docs for alternatives like "cached" or if it can be omitted/made conditional.
                    summary: {},
                    subpages: exaSubpages,
                    extras: {
                        links: exaLinks,
                        imageLinks: exaImageLinks
                    }
                }
            };

            Logger.log("Calling Exa API (/search) with prompt:", prompt, "Request body:", requestBody);

            return new Promise((resolve) => {
                let isResolved = false;
                const req = GM_xmlhttpRequest({
                    method: "POST",
                    url: API_CONFIG.exaEndpoint, // Using the updated /search endpoint
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${exaApiKey}` },
                    data: JSON.stringify(requestBody), // Using the new comprehensive request body
                    onload(res) {
                        if (isResolved) return;
                        clearTimeout(timeoutId);
                        isResolved = true;
                        let data;
                        try {
                            data = JSON.parse(res.responseText);
                        } catch (e) {
                            Logger.error("Failed to parse Exa response JSON:", e, "\nOriginal response:", res.responseText?.substring(0, 500) + "...");
                            return resolve(null);
                        }

                        // Handle response from /search endpoint
                        // It returns an object with a "results" array.
                        if (res.status >= 200 && res.status < 300 && data && Array.isArray(data.results)) {
                            console.log(`[${SCRIPT_NAME}] Exa API raw response (object, click to expand 'results' array):`, data); // Log raw Exa API response
                            console.log(`[${SCRIPT_NAME}] Exa API raw response (JSON string):`, JSON.stringify(data, null, 2)); // Log as pretty-printed JSON string
                            if (data.results.length === 0) {
                                Logger.log("Exa API returned 0 results.");
                                resolve(null); // Or a message indicating no results
                            } else {
                                let combinedText = "";
                                for (const result of data.results) {
                                    if (result.title) combinedText += `Title: ${result.title}\n`;
                                    if (result.url) combinedText += `URL: ${result.url}\n`;
                                    // Text content is directly in result.text if requested via contents.text
                                    if (result.text) combinedText += `Text: ${result.text}\n`;
                                    // Summary is directly in result.summary if requested via contents.summary
                                    if (result.summary) combinedText += `Summary: ${result.summary}\n`;
                                    combinedText += '---\n';
                                }
                                resolve(LaTeXProcessor.process(combinedText.trim()));
                            }
                        } else {
                            Logger.error("Exa API error or unexpected structure for /search:", res.status, data);
                            resolve(null);
                        }
                    },
                    onerror(err) {
                        if (isResolved) return;
                        clearTimeout(timeoutId);
                        Logger.error("Exa API request failed:", err);
                        isResolved = true;
                        resolve(null);
                    },
                    ontimeout() {
                        if (isResolved) return;
                        isResolved = true;
                        Logger.error("Exa API request timed out (native timeout).");
                        resolve(null);
                    }
                });
                const timeoutId = setTimeout(() => {
                    if (isResolved) return;
                    isResolved = true;
                    if (req && typeof req.abort === 'function') req.abort();
                    Logger.error("Exa API request timed out (custom timeout).");
                    resolve(null);
                }, API_CONFIG.apiRequestTimeout);
            });
        }
    };

    // --- Core: Perplexity API Interaction ---
    const PerplexityAPI = {
        call: async (prompt, contextMessages = []) => {
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                Logger.error("PerplexityAPI.call: Invalid prompt");
                return null;
            }
            if (!perplexityApiKey) {
                Logger.error("PerplexityAPI.call: Perplexity API Key is not set.");
                ApiKeyModal.show();
                return null;
            }

            const messages = [{ role: "system", content: "Be precise and concise." }];
            if (API_CONFIG.conversationContextEnabled && contextMessages && contextMessages.length > 0) {
                messages.push(...contextMessages.map(m => ({ role: m.role, content: m.content })).filter(m => m.content));
            }
            messages.push({ role: "user", content: prompt });

            const requestBody = {
                model: perplexityModel,
                messages: messages,
                temperature: perplexityTemperature,
                max_tokens: perplexityMaxTokens,
                top_p: perplexityTopP,
            };
            if (perplexityTopK > 0) {
                requestBody.top_k = perplexityTopK;
            }

            Logger.log("Calling Perplexity API (/chat/completions) via GM_xmlhttpRequest. Endpoint:", API_CONFIG.perplexityEndpoint, "Request body:", JSON.stringify(requestBody), "Headers (subset for logging):", {"Content-Type": "application/json", "Authorization": `Bearer ${perplexityApiKey.substring(0, 8)}...`});

            return new Promise((resolve) => {
                let isResolved = false;
                const req = GM_xmlhttpRequest({
                    method: "POST",
                    url: API_CONFIG.perplexityEndpoint,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${perplexityApiKey}`
                    },
                    data: JSON.stringify(requestBody),
                    timeout: API_CONFIG.apiRequestTimeout, // GM_xmlhttpRequest uses timeout directly
                    onload(res) {
                        if (isResolved) return;
                        isResolved = true;
                        let data;
                        try {
                            data = JSON.parse(res.responseText);
                        } catch (e) {
                            Logger.error("Failed to parse Perplexity response JSON:", e, "\nOriginal response status:", res.status, "\nResponse text substring:", res.responseText?.substring(0, 500) + "...");
                            return resolve(null);
                        }

                        Logger.log(`[${SCRIPT_NAME}] Perplexity API raw full response data (from GM_xmlhttpRequest):`, JSON.stringify(data));

                        if (res.status >= 200 && res.status < 300 && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                            const combinedText = `Source: Perplexity AI (${perplexityModel})\nContent: ${data.choices[0].message.content}`;
                            resolve(LaTeXProcessor.process(combinedText.trim()));
                        } else {
                            Logger.error("Perplexity API error or unexpected structure (from GM_xmlhttpRequest):", res.status, data);
                            resolve(null);
                        }
                    },
                    onerror(err) {
                        if (isResolved) return;
                        isResolved = true;
                        Logger.error("Perplexity API request failed (GM_xmlhttpRequest onerror):", err);
                        resolve(null);
                    },
                    ontimeout() {
                        if (isResolved) return;
                        isResolved = true;
                        Logger.error("Perplexity API request timed out (GM_xmlhttpRequest ontimeout).");
                        resolve(null);
                    }
                });
                // GM_xmlhttpRequest has its own timeout handling, so the manual setTimeout for abort is not strictly needed in the same way as fetch.
                // However, it's good practice to ensure the promise resolves if something unexpected happens with GM_xmlhttpRequest not calling callbacks.
                // For simplicity, we rely on GM_xmlhttpRequest's own timeout for now.
            });
        }
    };

    // --- Core: UI Manager (Search Toggle Button) ---
    const UIManager = {
        searchToggleButton: null,
        _createSearchToggleButton: async () => {
            const btn = document.createElement("button");
            btn.id = UI_IDS.searchToggle;
            btn.type = "button";
            btn.setAttribute("aria-label", "Enable search");
            btn.setAttribute("data-state", "closed");
            btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe h-4 w-4 scale-x-[-1]">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
        <path d="M2 12h20"></path>
      </svg>
      Search
            `;
            btn.className = CSS_CLASSES.button;
            btn.dataset.mode = "off"; // Original attribute, kept for compatibility if anything relied on it

            btn.addEventListener("click", async () => {
                // Ensure API keys and provider are loaded/refreshed before toggle logic
                selectedApiProvider = await GM_getValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, API_PROVIDERS.EXA);
                exaApiKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_EXA);
                perplexityApiKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY);

                let apiKeyMissing = false;
                if (selectedApiProvider === API_PROVIDERS.EXA && !exaApiKey) {
                    apiKeyMissing = true;
                } else if (selectedApiProvider === API_PROVIDERS.PERPLEXITY && !perplexityApiKey) {
                    apiKeyMissing = true;
                }

                if (apiKeyMissing) {
                    ApiKeyModal.show();
                    return;
                }

                const isOn = btn.classList.toggle(CSS_CLASSES.searchToggleOn);
                btn.setAttribute("aria-label", isOn ? "Disable search" : "Enable search");
                btn.setAttribute("data-state", isOn ? "open" : "closed");
                if (typeof unsafeWindow !== 'undefined' && unsafeWindow.t3ChatSearch) {
                    unsafeWindow.t3ChatSearch.needSearch = isOn;
                }
                Logger.log(`Search toggle set to: ${isOn}`);
            });
            return btn;
        },
        injectSearchToggle: async () => {
            const justifyDiv = document.querySelector(SELECTORS.justifyDiv);
            if (!justifyDiv) {
                Logger.log("❌ justifyDiv not found for search toggle injection.");
                return false;
            }
            const modelTempSection = justifyDiv.querySelector(SELECTORS.modelTempSection);
            if (!modelTempSection) {
                Logger.log("❌ modelTempSection not found.");
                return false;
            }
            const mlGroup = modelTempSection.querySelector(SELECTORS.mlGroup);
            if (!mlGroup) {
                Logger.log("❌ mlGroup not found.");
                return false;
            }

            const existingBtn = mlGroup.querySelector(`#${UI_IDS.searchToggle}`);
            if (existingBtn) {
                if (mlGroup.lastElementChild !== existingBtn) {
                    mlGroup.appendChild(existingBtn); // Ensure it's the last child
                }
                UIManager.searchToggleButton = existingBtn; // Store reference
                return true;
            }

            UIManager.searchToggleButton = await UIManager._createSearchToggleButton();
            mlGroup.appendChild(UIManager.searchToggleButton);
            Logger.log("✅ SearchToggle injected.");
            return true;
        },
        updateSearchToggleLoadingState: (isLoading) => {
            if (UIManager.searchToggleButton) {
                if (isLoading) {
                    UIManager.searchToggleButton.classList.add(CSS_CLASSES.searchToggleLoading);
                } else {
                    UIManager.searchToggleButton.classList.remove(CSS_CLASSES.searchToggleLoading);
                }
            }
        }
    };

    // --- Core: Fetch Interception ---
    const FetchInterceptor = {
        originalFetch: null,
        init: () => {
            if (typeof unsafeWindow === 'undefined') {
                Logger.error("unsafeWindow is not available. Fetch interception disabled.");
                return;
            }
            const w = unsafeWindow;
            w.t3ChatSearch = w.t3ChatSearch || { needSearch: false }; // Ensure namespace exists
            FetchInterceptor.originalFetch = w.fetch.bind(w); // Bind to w (unsafeWindow)
            w.fetch = async function(input, initOptions) { // Use standard function to ensure 'this' is unsafeWindow
                // Use FetchInterceptor.originalFetch to call original
                // Access unsafeWindow.t3ChatSearch directly

                if (!unsafeWindow.t3ChatSearch.needSearch || !initOptions?.body) {
                    return FetchInterceptor.originalFetch.call(this, input, initOptions);
                }

                let data;
                try {
                    data = JSON.parse(initOptions.body);
                } catch {
                    return FetchInterceptor.originalFetch.call(this, input, initOptions);
                }

                if (!Array.isArray(data.messages)) {
                    return FetchInterceptor.originalFetch.call(this, input, initOptions);
                }

                const messages = data.messages;
                const lastIdx = messages.length - 1;
                if (lastIdx < 0 || messages[lastIdx]?.role !== 'user') { // Ensure there's a last user message
                    return FetchInterceptor.originalFetch.call(this, input, initOptions);
                }
                const originalPrompt = messages[lastIdx]?.content;

                if (typeof originalPrompt !== 'string') {
                    return FetchInterceptor.originalFetch.call(this, input, initOptions);
                }

                Logger.log("Fetch intercepted for potential search enhancement.");
                UIManager.updateSearchToggleLoadingState(true);

                const contextMessagesForApi = API_CONFIG.conversationContextEnabled ? messages.slice(0, lastIdx) : [];
                let searchRes = null;

                if (selectedApiProvider === API_PROVIDERS.EXA) {
                    let exaQuery = originalPrompt;
                    if (API_CONFIG.conversationContextEnabled && contextMessagesForApi.length > 0) {
                        const formattedHistory = contextMessagesForApi.map(msg => {
                            let roleDisplay = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : (msg.role || 'System'));
                            // Replace newlines within a single message's content with spaces to keep each history item on one logical line in the combined string.
                            const content = String(msg.content || '').replace(/\n/g, ' ');
                            return `${roleDisplay}: ${content}`;
                        }).join('\n'); // Join distinct messages with newlines.
                        exaQuery = `Conversation History:\n${formattedHistory}\n\nLatest User Query: ${originalPrompt}`;
                        Logger.log("Exa query enhanced with formatted history. New query length:", exaQuery.length);
                    }
                    searchRes = await ExaAPI.call(exaQuery, contextMessagesForApi); // contextMessagesForApi is still passed for potential future direct use by ExaAPI
                } else if (selectedApiProvider === API_PROVIDERS.PERPLEXITY) {
                    searchRes = await PerplexityAPI.call(originalPrompt, contextMessagesForApi); // Perplexity handles the array of messages directly
                }

                UIManager.updateSearchToggleLoadingState(false);

                if (searchRes) {
                    // Ensure originalPrompt is always present, even if searchRes is extensive.
                    const englishInstruction = "The following information was retrieved from a real-time web search using an external tool. Please use these results to inform your response:\n";
                    messages[lastIdx].content = `${englishInstruction}\n[Web Search Results]\n${searchRes}\n\n[Original Message]\n${originalPrompt}`;
                    initOptions.body = JSON.stringify(data);
                    Logger.log("Search results prepended to prompt with English instruction.");
                } else {
                    Logger.log("No search results to prepend, or search failed.");
                    // Do not modify the prompt if searchRes is null or empty
                }
                return FetchInterceptor.originalFetch.call(this, input, initOptions);
            };
            Logger.log("Fetch interceptor initialized.");
        }
    };

    // --- Core: DOM Content Correction (Math Expressions) ---
    const DOMCorrector = {
        _processNodeAndItsTextDescendants: function(node) {
            if (!node) return false;
            let processed = false;
            if (node.nodeType === Node.TEXT_NODE) {
                const orig = node.textContent;
                const proc = LaTeXProcessor.process(orig);
                if (proc !== orig) {
                    node.textContent = proc;
                    processed = true;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Only create a TreeWalker if the node is an element and might contain text nodes
                if (node.hasChildNodes()) { // Small optimization: only walk if there are children
                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                    let textNode;
                    while (textNode = walker.nextNode()) {
                        const origContent = textNode.textContent;
                        const procContent = LaTeXProcessor.process(origContent);
                        if (procContent !== origContent) {
                            textNode.textContent = procContent;
                            processed = true;
                        }
                    }
                }
            }
            return processed;
        },

        _fixMathInChatInternal: (mutations) => { // Renamed internal function
            let changesMadeOverall = false;
            if (!mutations || mutations.length === 0) { // Full scan for initial run or manual call without mutations
                const logContainer = document.querySelector(SELECTORS.chatLogContainer);
                const container = logContainer || document.querySelector(SELECTORS.mainContentArea) || document.querySelector(SELECTORS.chatArea);
                if (!container) {
                    // Logger.log("Chat container not found for full math fixing scan.");
                    return;
                }
                if (DOMCorrector._processNodeAndItsTextDescendants(container)) {
                    changesMadeOverall = true;
                }
            } else { // Selective update based on mutations
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const addedNode of mutation.addedNodes) {
                            if (DOMCorrector._processNodeAndItsTextDescendants(addedNode)) {
                                changesMadeOverall = true;
                            }
                        }
                        // For removedNodes, no action is needed for this feature.
                    } else if (mutation.type === 'characterData') {
                        // mutation.target is the text node that changed.
                        if (DOMCorrector._processNodeAndItsTextDescendants(mutation.target)) {
                            changesMadeOverall = true;
                        }
                    }
                }
            }

            // if (changesMadeOverall) Logger.log("Math expressions fixed in DOM (selectively or full scan).");
        },

        // Debounced version will be assigned after the object is defined
        fixMathInChat: null,

        observeChatChanges: () => {
            // Assign the debounced function here, ensuring 'this' context is correct if methods rely on it
            // However, _fixMathInChatInternal is static-like, so direct debouncing is fine.
            DOMCorrector.fixMathInChat = debounce(DOMCorrector._fixMathInChatInternal, 250);

            const logContainer = document.querySelector(SELECTORS.chatLogContainer);
            const chatContainer = logContainer || document.querySelector(SELECTORS.mainContentArea) || document.querySelector(SELECTORS.chatArea) || document.body;

            if (!chatContainer) {
                Logger.error("Failed to find a suitable chat container for DOM observation.");
                return;
            }

            const observer = new MutationObserver((mutationsList) => {
                // Call the debounced function
                DOMCorrector.fixMathInChat(mutationsList);
            });
            observer.observe(chatContainer, { subtree: true, childList: true, characterData: true });

            // Initial full run - call the internal function directly or the debounced one.
            // Calling the internal one for immediate first pass might be preferred.
            DOMCorrector._fixMathInChatInternal(null);
            Logger.log("Chat observer for math corrections initialized (selective updates with debounce).");
        }
    };

    // --- Core: Tampermonkey Menu Commands ---
    const MenuCommands = {
        init: async () => {
            GM_registerMenuCommand('Set API Provider & Key', async () => {
                ApiKeyModal.show();
            });

            GM_registerMenuCommand('Reset Current API Key', async () => {
                selectedApiProvider = await GM_getValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, API_PROVIDERS.EXA);
                if (selectedApiProvider === API_PROVIDERS.EXA) {
                    await GM_setValue(GM_STORAGE_KEYS.API_KEY_EXA, '');
                    exaApiKey = null;
                    Logger.log("Exa API Key reset via menu.");
                } else if (selectedApiProvider === API_PROVIDERS.PERPLEXITY) {
                    await GM_setValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY, '');
                    perplexityApiKey = null;
                    Logger.log("Perplexity API Key reset via menu.");
                }
                location.reload();
            });

            GM_registerMenuCommand('Toggle debug logs', async () => {
                const newDebug = !(await GM_getValue(GM_STORAGE_KEYS.DEBUG, false));
                await GM_setValue(GM_STORAGE_KEYS.DEBUG, newDebug);
                debugMode = newDebug; // Update current session's debug mode
                Logger.log(`Debug mode toggled to: ${newDebug} via menu. Reloading...`);
                location.reload();
            });

            GM_registerMenuCommand('Configure API Parameters', async () => {
                selectedApiProvider = await GM_getValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, API_PROVIDERS.EXA);
                if (selectedApiProvider === API_PROVIDERS.EXA) {
                    ExaConfigModal.show();
                } else if (selectedApiProvider === API_PROVIDERS.PERPLEXITY) {
                    PerplexityConfigModal.show();
                }
            });

            Logger.log("Menu commands registered.");
        }
    };

    // --- Initialization ---
    async function main() {
        debugMode = await GM_getValue(GM_STORAGE_KEYS.DEBUG, false);
        Logger.log(`${SCRIPT_NAME} v${SCRIPT_VERSION} starting. Debug mode: ${debugMode}`);

        selectedApiProvider = await GM_getValue(GM_STORAGE_KEYS.SELECTED_API_PROVIDER, API_PROVIDERS.EXA);
        Logger.log(`Selected API Provider: ${selectedApiProvider}`);

        exaApiKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_EXA);
        if (!exaApiKey) {
            Logger.log("Exa API Key not found. It will be requested upon first search attempt if Exa is selected.");
        } else {
            Logger.log("Exa API Key loaded.");
        }

        perplexityApiKey = await GM_getValue(GM_STORAGE_KEYS.API_KEY_PERPLEXITY);
        if (!perplexityApiKey) {
            Logger.log("Perplexity API Key not found. It will be requested upon first search attempt if Perplexity is selected.");
        } else {
            Logger.log("Perplexity API Key loaded.");
        }

        // Load configurable Exa parameters
        exaNumResults = await GM_getValue(GM_STORAGE_KEYS.EXA_NUM_RESULTS, DEFAULT_EXA_NUM_RESULTS);
        exaSubpages = await GM_getValue(GM_STORAGE_KEYS.EXA_SUBPAGES, DEFAULT_EXA_SUBPAGES);
        exaLinks = await GM_getValue(GM_STORAGE_KEYS.EXA_LINKS, DEFAULT_EXA_LINKS);
        exaImageLinks = await GM_getValue(GM_STORAGE_KEYS.EXA_IMAGE_LINKS, DEFAULT_EXA_IMAGE_LINKS);
        Logger.log(`Exa API params loaded: numResults=${exaNumResults}, subpages=${exaSubpages}, links=${exaLinks}, imageLinks=${exaImageLinks}`);

        // Load configurable Perplexity parameters
        perplexityModel = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_MODEL, DEFAULT_PERPLEXITY_MODEL);
        perplexityTemperature = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_TEMPERATURE, DEFAULT_PERPLEXITY_TEMPERATURE);
        perplexityMaxTokens = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_MAX_TOKENS, DEFAULT_PERPLEXITY_MAX_TOKENS);
        perplexityTopP = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_TOP_P, DEFAULT_PERPLEXITY_TOP_P);
        perplexityTopK = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_TOP_K, DEFAULT_PERPLEXITY_TOP_K);
        perplexityPresencePenalty = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_PRESENCE_PENALTY, DEFAULT_PERPLEXITY_PRESENCE_PENALTY);
        perplexityFrequencyPenalty = await GM_getValue(GM_STORAGE_KEYS.PERPLEXITY_FREQUENCY_PENALTY, DEFAULT_PERPLEXITY_FREQUENCY_PENALTY);
        Logger.log(`Perplexity API params loaded: model=${perplexityModel}, temperature=${perplexityTemperature}, maxTokens=${perplexityMaxTokens}, topP=${perplexityTopP}, topK=${perplexityTopK}, presencePenalty=${perplexityPresencePenalty}, frequencyPenalty=${perplexityFrequencyPenalty}`);

        await MenuCommands.init();
        StyleManager.injectGlobalStyles();
        FetchInterceptor.init(); // Init fetch interceptor early

        // Observer for search toggle button injection
        // Try to find a more stable parent if justifyDiv itself is dynamic
        const injectionObserverTargetParent = document.querySelector(SELECTORS.justifyDiv)?.parentElement || document.body;
        const injectionObserver = new MutationObserver(async (mutations, obs) => {
            // Check if the specific target for injection is now available
            const targetContainer = document.querySelector(SELECTORS.mlGroup);
            if (targetContainer) {
                 if(await UIManager.injectSearchToggle()) {
                    // If successfully injected into the specific target,
                    // we might not need to observe anymore, or observe less broadly.
                    // For now, let it run to handle dynamic re-rendering of this part of UI.
                 }
            } else {
                // If even the broader justifyDiv is gone, try to re-inject if it reappears.
                const justifyDiv = document.querySelector(SELECTORS.justifyDiv);
                if (justifyDiv) await UIManager.injectSearchToggle();
            }
        });
        injectionObserver.observe(injectionObserverTargetParent, { childList: true, subtree: true });
        await UIManager.injectSearchToggle(); // Initial attempt

        DOMCorrector.observeChatChanges();

        Logger.log("Initialization complete.");
    }

    // --- Start the script ---
    main().catch(err => {
        console.error(`[${SCRIPT_NAME}] Unhandled error in main function:`, err);
        // Use Logger.error if debugMode is already set, but console.error ensures it's always visible for critical startup failures.
    });

  })(); 
