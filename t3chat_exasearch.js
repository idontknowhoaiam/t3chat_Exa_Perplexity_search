// ==UserScript==
// @name         t3.chat Exa Search (English)
// @namespace    http://tampermonkey.net/
// @version      0.3.1
// @description  Calls Exa API on t3.chat and provides configurable search parameters.
// @match        https://t3.chat/*
// @match        https://beta.t3.chat/*
// @match        https://beta.t3.chat/chat/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.exa.ai
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(async function() {
    'use strict';

    // --- Configuration and State ---
    const SCRIPT_NAME = "t3.chat Inject Search Toggle (with Exa API)";
    const SCRIPT_VERSION = "0.3.1"; // Incrementing version for English translation

    const DEFAULT_EXA_NUM_RESULTS = 5;
    const DEFAULT_EXA_SUBPAGES = 2;
    const DEFAULT_EXA_LINKS = 3;
    const DEFAULT_EXA_IMAGE_LINKS = 0;

    const GM_STORAGE_KEYS = {
        DEBUG: 'debug',
        EXA_API_KEY: 'exaApiKey',
        EXA_NUM_RESULTS: 'exaNumResults',
        EXA_SUBPAGES: 'exaSubpages',
        EXA_LINKS: 'exaLinks',
        EXA_IMAGE_LINKS: 'exaImageLinks'
    };

    const API_CONFIG = {
        exaEndpoint: 'https://api.exa.ai/search',
        conversationContextEnabled: true,
        apiRequestTimeout: 60000 // Increased timeout to 60 seconds for full-featured requests
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
        apiKeyModal: 'exa-key-modal',
        apiKeyModalContent: 'exa-key-modal-content',
        apiKeyModalHeader: 'exa-key-modal-header',
        apiKeyModalDescription: 'exa-key-modal-description',
        apiKeyInput: 'exa-key-input',
        apiKeyShowCheckbox: 'exa-key-show',
        apiKeyShowLabelContainer: 'exa-key-show-label-container',
        apiKeySaveButton: 'exa-key-save',
        searchToggle: 'search-toggle'
    };

    const CSS_CLASSES = {
        button: "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 disabled:cursor-not-allowed hover:bg-muted/40 hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-foreground/50 px-3 text-xs -mb-1.5 h-auto gap-2 rounded-full border border-solid border-secondary-foreground/10 py-1.5 pl-2 pr-2.5 text-muted-foreground",
        searchToggleLoading: 'loading',
        searchToggleOn: 'on'
    };

    // --- State Variables ---
    let debugMode = false;
    let exaApiKey = null;
    let exaNumResults = DEFAULT_EXA_NUM_RESULTS;
    let exaSubpages = DEFAULT_EXA_SUBPAGES;
    let exaLinks = DEFAULT_EXA_LINKS;
    let exaImageLinks = DEFAULT_EXA_IMAGE_LINKS;

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
  /* Spinner */
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleLoading} { opacity: 0.6; position: relative; }
  #${UI_IDS.searchToggle}.${CSS_CLASSES.searchToggleLoading}::after { content: ''; position: absolute; top:50%; left:50%; width:12px; height:12px; margin:-6px 0 0 -6px; border:2px solid currentColor; border-radius:50%; border-top-color:transparent; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  /* Button toggle animation */
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
    background: #c62a88;
  }
            `;
            document.head.appendChild(styleEl);
            Logger.log("Global styles injected.");
        }
    };

    // --- Core: API Key Modal ---
    const ApiKeyModal = {
        _isShown: false,
        show: () => {
            if (document.getElementById(UI_IDS.apiKeyModal) || ApiKeyModal._isShown) return;
            ApiKeyModal._isShown = true;
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
          <div>Enter Exa API Key</div><!-- Title -->
        </div>
        <div id="${UI_IDS.apiKeyModalDescription}">Set your API Key to enable web search functionality.</div>
        <input id="${UI_IDS.apiKeyInput}" type="password" placeholder="Enter your API Key" />
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

            showCheckbox.addEventListener('change', (e) => {
                keyInput.type = e.target.checked ? 'text' : 'password';
            });

            saveButton.addEventListener('click', async () => {
                const key = keyInput.value.trim();
                if (key) {
                    await GM_setValue(GM_STORAGE_KEYS.EXA_API_KEY, key);
                    exaApiKey = key; // Update in-memory key
                    Logger.log("API Key saved.");
                    modalElement.remove();
                    ApiKeyModal._isShown = false;
                    location.reload(); // Reload to apply changes, similar to original
                } else {
                    alert('API Key cannot be empty');
                }
            });
        }
    };

    // --- Core: Exa API Interaction ---
    const ExaAPI = {
        call: async (prompt, contextMessages = []) => {
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                Logger.error("callExa: Invalid prompt");
                return null;
            }
            if (!exaApiKey) {
                Logger.error("callExa: Exa API Key is not set.");
                ApiKeyModal.show();
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
                if (!exaApiKey) { // Re-check API key on click
                    exaApiKey = await GM_getValue(GM_STORAGE_KEYS.EXA_API_KEY); // Ensure we have the latest
                }
                if (!exaApiKey) {
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

                // contextMessages are not directly used by /search endpoint in the same way as /chat/completions
                // ExaAPI.call will receive them but won't include them in the /search request body structure.
                const contextMessagesForExa = API_CONFIG.conversationContextEnabled ? messages.slice(0, lastIdx) : [];
                const searchRes = await ExaAPI.call(originalPrompt, contextMessagesForExa);

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
            GM_registerMenuCommand('Reset Exa API Key', async () => {
                await GM_setValue(GM_STORAGE_KEYS.EXA_API_KEY, '');
                exaApiKey = null; // Clear in-memory key
                Logger.log("Exa API Key reset via menu.");
                location.reload();
            });

            GM_registerMenuCommand('Toggle debug logs', async () => {
                const newDebug = !(await GM_getValue(GM_STORAGE_KEYS.DEBUG, false));
                await GM_setValue(GM_STORAGE_KEYS.DEBUG, newDebug);
                debugMode = newDebug; // Update current session's debug mode
                Logger.log(`Debug mode toggled to: ${newDebug} via menu. Reloading...`);
                location.reload();
            });

            // Helper function for creating numeric input menu commands
            const createNumericConfigCommand = async (storageKey, name, defaultValueForPromptDisplay, liveValueForMenuText) => {
                // liveValueForMenuText is used for the menu item's initial display text.
                // defaultValueForPromptDisplay is the ultimate fallback for the prompt.
                // const currentGMValue = await GM_getValue(storageKey, defaultValueForPromptDisplay); // Get fresh value for prompt - used if liveValue wasn't passed or stale

                GM_registerMenuCommand(`Set Exa ${name} (Current: ${liveValueForMenuText}, Default: ${defaultValueForPromptDisplay})`, async () => {
                    // Fetch fresh value again right before showing prompt, in case it changed in another tab or menu wasn't re-rendered.
                    const promptCurrentValue = await GM_getValue(storageKey, defaultValueForPromptDisplay);
                    const newValueStr = prompt(`Enter new Exa ${name} (integer, default: ${defaultValueForPromptDisplay}):`, promptCurrentValue);
                    if (newValueStr !== null) {
                        const parsedValue = parseInt(newValueStr, 10);
                        if (!isNaN(parsedValue) && parsedValue >= 0) {
                            await GM_setValue(storageKey, parsedValue);
                            Logger.log(`Exa ${name} set to: ${parsedValue}. Reloading...`);
                            location.reload(); // Reload to apply changes and update menu command text
                        } else {
                            alert(`Invalid input. Please enter a non-negative integer. ${name} not changed (Current: ${promptCurrentValue}).`);
                        }
                    }
                });
            };

            // Create menu commands for each configurable Exa parameter
            // Pass the current live values (exaNumResults etc.) for the menu text
            // and the defaults for the prompt's fallback.
            await createNumericConfigCommand(GM_STORAGE_KEYS.EXA_NUM_RESULTS, "Search Results Count", DEFAULT_EXA_NUM_RESULTS, exaNumResults);
            await createNumericConfigCommand(GM_STORAGE_KEYS.EXA_SUBPAGES, "Subpages Count", DEFAULT_EXA_SUBPAGES, exaSubpages);
            await createNumericConfigCommand(GM_STORAGE_KEYS.EXA_LINKS, "Links Count", DEFAULT_EXA_LINKS, exaLinks);
            await createNumericConfigCommand(GM_STORAGE_KEYS.EXA_IMAGE_LINKS, "Image Links Count", DEFAULT_EXA_IMAGE_LINKS, exaImageLinks);

            // Placeholder for a future liveCrawl policy configuration menu item:
            /*
            // Assuming exaLiveCrawlPolicy state variable and DEFAULT_EXA_LIVE_CRAWL_POLICY constant exist
            // const currentLiveCrawlPolicy = await GM_getValue(GM_STORAGE_KEYS.EXA_LIVE_CRAWL_POLICY, DEFAULT_EXA_LIVE_CRAWL_POLICY);
            // GM_registerMenuCommand(`Set Exa Live Crawl Policy (Current: ${exaLiveCrawlPolicy}, Default: ${DEFAULT_EXA_LIVE_CRAWL_POLICY})`, async () => {
            //     const promptCurrentValue = await GM_getValue(GM_STORAGE_KEYS.EXA_LIVE_CRAWL_POLICY, DEFAULT_EXA_LIVE_CRAWL_POLICY);
            //     const newValue = prompt(`Enter Exa Live Crawl Policy (e.g., 'always', 'cached', 'if_needed'. Default: ${DEFAULT_EXA_LIVE_CRAWL_POLICY}):`, promptCurrentValue);
            //     if (newValue !== null && newValue.trim() !== "") {
            //         await GM_setValue(GM_STORAGE_KEYS.EXA_LIVE_CRAWL_POLICY, newValue.trim());
            //         Logger.log(`Exa Live Crawl Policy set to: ${newValue.trim()}. Reloading...`);
            //         location.reload();
            //     } else if (newValue !== null) {
            //         alert(`Input cannot be empty. Policy not changed (Current: ${promptCurrentValue}).`);
            //     }
            // });
            */

            Logger.log("Menu commands registered.");
        }
    };

    // --- Initialization ---
    async function main() {
        debugMode = await GM_getValue(GM_STORAGE_KEYS.DEBUG, false);
        Logger.log(`${SCRIPT_NAME} v${SCRIPT_VERSION} starting. Debug mode: ${debugMode}`);

        exaApiKey = await GM_getValue(GM_STORAGE_KEYS.EXA_API_KEY);
        if (!exaApiKey) {
            Logger.log("Exa API Key not found. It will be requested upon first search attempt.");
        } else {
            Logger.log("Exa API Key loaded.");
        }

        // Load configurable Exa parameters
        exaNumResults = await GM_getValue(GM_STORAGE_KEYS.EXA_NUM_RESULTS, DEFAULT_EXA_NUM_RESULTS);
        exaSubpages = await GM_getValue(GM_STORAGE_KEYS.EXA_SUBPAGES, DEFAULT_EXA_SUBPAGES);
        exaLinks = await GM_getValue(GM_STORAGE_KEYS.EXA_LINKS, DEFAULT_EXA_LINKS);
        exaImageLinks = await GM_getValue(GM_STORAGE_KEYS.EXA_IMAGE_LINKS, DEFAULT_EXA_IMAGE_LINKS);
        Logger.log(`Exa API params loaded: numResults=${exaNumResults}, subpages=${exaSubpages}, links=${exaLinks}, imageLinks=${exaImageLinks}`);

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