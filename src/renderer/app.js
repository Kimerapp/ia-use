(() => {
  const { AI_PROVIDERS, WORKSPACE_PRESETS, RELAY_TEMPLATES } = window.IAUseConfig;
  const { buildInjectPromptScript, buildCaptureResponseScript, buildInPageRelayHelperScript } = window.IAUseInjector;

  const CAPACITY_BY_LAYOUT = {
    '1x': 1,
    '2x': 2,
    '3x': 3,
    '2x2': 4
  };

  // Application State
  const state = {
    layoutMode: localStorage.getItem('ia_use_layout') || '2x',
    visibleProviders: JSON.parse(localStorage.getItem('ia_use_visible') || '["claude", "chatgpt"]'),
    focusedProvider: localStorage.getItem('ia_use_focused') || 'claude',
    syncTargetsWithVisible: true,
    selectedTargets: new Set(['claude', 'chatgpt']),
    capturedContext: null, // { sourceId, sourceName, text, templateId }
    capturedHistory: JSON.parse(localStorage.getItem('ia_use_clips') || '[]'),
    quickRelayState: {
      sourceId: null,
      sourceName: null,
      text: '',
      targetId: null
    }
  };

  // Registry of mounted <webview> DOM elements by providerId
  const mountedPanes = new Map();

  // DOM References
  const stageGrid = document.getElementById('stage-grid');
  const providerListEl = document.getElementById('provider-list');
  const presetBarEl = document.getElementById('preset-bar');
  const layoutSwitcherEl = document.getElementById('layout-switcher');
  const targetChipsEl = document.getElementById('target-chips');
  const btnSelectVisibleTargets = document.getElementById('btn-select-visible-targets');
  const omnibarInput = document.getElementById('omnibar-input');
  const btnSendMulti = document.getElementById('btn-send-multi');
  const chkAutoSubmit = document.getElementById('chk-auto-submit');
  const sidebarEl = document.getElementById('sidebar');
  const omnibarDockEl = document.getElementById('omnibar-dock');

  // Relay Drawer DOM
  const relayDrawerEl = document.getElementById('relay-drawer');
  const relaySourceBadgeEl = document.getElementById('relay-source-badge');
  const relayCharCountEl = document.getElementById('relay-char-count');
  const relayTemplatesEl = document.getElementById('relay-templates');
  const relayContentEditor = document.getElementById('relay-content-editor');
  const capturedHistoryListEl = document.getElementById('captured-history-list');

  // Quick Relay Modal DOM
  const quickRelayModal = document.getElementById('quick-relay-modal');
  const quickRelayTitle = document.getElementById('quick-relay-title');
  const quickRelayTargets = document.getElementById('quick-relay-targets');
  const quickRelayActions = document.getElementById('quick-relay-actions');
  const quickRelaySnippet = document.getElementById('quick-relay-snippet');

  function getProvider(id) {
    return AI_PROVIDERS.find((p) => p.id === id);
  }

  function saveState() {
    localStorage.setItem('ia_use_layout', state.layoutMode);
    localStorage.setItem('ia_use_visible', JSON.stringify(state.visibleProviders));
    localStorage.setItem('ia_use_focused', state.focusedProvider);
    localStorage.setItem('ia_use_clips', JSON.stringify(state.capturedHistory.slice(0, 12)));
  }

  function showToast(message, accentColor = '#6366F1') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeft = `3px solid ${accentColor}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s ease';
      setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  // Ensure a provider's <webview> pane is created and mounted once
  function ensurePaneMounted(providerId) {
    if (mountedPanes.has(providerId)) {
      return mountedPanes.get(providerId);
    }

    const provider = getProvider(providerId);
    if (!provider) return null;

    const pane = document.createElement('div');
    pane.className = 'ai-pane';
    pane.dataset.providerId = provider.id;

    pane.innerHTML = `
      <div class="pane-accent-bar" style="background: ${provider.color}"></div>
      <div class="pane-header">
        <div class="pane-header-left">
          <span class="pane-status-dot" style="background: ${provider.color}"></span>
          <span class="pane-title">${provider.name}</span>
          <span class="pane-loading-indicator">Caricamento…</span>
          <div class="pane-nav-btns">
            <button class="pane-icon-btn" data-action="back" title="Indietro">←</button>
            <button class="pane-icon-btn" data-action="forward" title="Avanti">→</button>
            <button class="pane-icon-btn" data-action="reload" title="Ricarica (${provider.name})">↻</button>
            <button class="pane-icon-btn" data-action="home" title="Nuova Chat / Home">🏠</button>
          </div>
        </div>
        <div class="pane-header-right">
          <button class="pane-relay-btn" data-action="append-doc" title="Aggiungi la risposta (o selezione) di ${provider.name} in coda al Documento Staffetta">
            ➕ Al Doc
          </button>
          <button class="pane-relay-btn" data-action="capture" title="Cattura l'ultima risposta o il testo selezionato da ${provider.name}">
            📥 Cattura
          </button>
          <button class="pane-relay-btn accent" data-action="quick-relay" title="Invia la risposta di ${provider.name} a un'altra AI in 1 click">
            ⚡ Passa a…
          </button>
          <button class="pane-icon-btn" data-action="external" title="Apri nel browser di sistema">↗</button>
        </div>
      </div>
      <div class="webview-container">
        <webview
          src="${provider.url}"
          partition="persist:ia-use"
          allowpopups
        ></webview>
      </div>
    `;

    const webview = pane.querySelector('webview');

    // Focus tracking
    pane.addEventListener('mousedown', () => {
      setFocusedProvider(provider.id);
    });

    webview.addEventListener('focus', () => {
      setFocusedProvider(provider.id);
    });

    webview.addEventListener('did-start-loading', () => {
      pane.classList.add('loading');
    });

    webview.addEventListener('did-stop-loading', () => {
      pane.classList.remove('loading');
    });

    webview.addEventListener('dom-ready', () => {
      // Inject in-page floating relay button when selecting text
      const helperScript = buildInPageRelayHelperScript(provider);
      webview.executeJavaScript(helperScript).catch(() => {});
    });

    // Listen for in-page floating pill clicks (__IA_USE_RELAY__:)
    webview.addEventListener('console-message', (event) => {
      if (event.message && event.message.startsWith('__IA_USE_RELAY__:')) {
        try {
          const payload = JSON.parse(event.message.replace('__IA_USE_RELAY__:', ''));
          if (payload && payload.text) {
            setCapturedContext(provider.id, payload.text, 'selection');
            openQuickRelayModal(provider.id, payload.text);
          }
        } catch (_err) {}
      }
    });

    // Header actions
    pane.querySelector('.pane-header').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'back' && webview.canGoBack()) webview.goBack();
      if (action === 'forward' && webview.canGoForward()) webview.goForward();
      if (action === 'reload') webview.reload();
      if (action === 'home') webview.loadURL(provider.url);
      if (action === 'external') {
        const currentUrl = webview.getURL() || provider.url;
        window.electronAPI?.openExternal(currentUrl);
      }
      if (action === 'capture') {
        await captureFromProvider(provider.id, false);
      }
      if (action === 'quick-relay') {
        await captureFromProvider(provider.id, true);
      }
      if (action === 'append-doc') {
        await appendProviderOutputToDoc(provider.id, false);
      }
    });

    stageGrid.appendChild(pane);
    const entry = { pane, webview, provider };
    mountedPanes.set(providerId, entry);
    return entry;
  }

  function setFocusedProvider(providerId) {
    if (!getProvider(providerId)) return;
    state.focusedProvider = providerId;
    saveState();
    updateUI();
  }

  // Enforce layout capacity on visibleProviders
  function normalizeVisibleProviders() {
    const cap = CAPACITY_BY_LAYOUT[state.layoutMode] || 2;

    // Remove duplicates & invalid IDs
    state.visibleProviders = state.visibleProviders.filter(
      (id, idx, arr) => getProvider(id) && arr.indexOf(id) === idx
    );

    if (state.visibleProviders.length === 0) {
      state.visibleProviders = ['claude'];
    }

    if (state.visibleProviders.length > cap) {
      // Keep focusedProvider if present
      if (state.visibleProviders.includes(state.focusedProvider)) {
        const others = state.visibleProviders.filter((id) => id !== state.focusedProvider);
        state.visibleProviders = [state.focusedProvider, ...others].slice(0, cap);
      } else {
        state.visibleProviders = state.visibleProviders.slice(0, cap);
      }
    } else if (state.visibleProviders.length < cap) {
      for (const p of AI_PROVIDERS) {
        if (state.visibleProviders.length >= cap) break;
        if (!state.visibleProviders.includes(p.id)) {
          state.visibleProviders.push(p.id);
        }
      }
    }

    if (!state.visibleProviders.includes(state.focusedProvider)) {
      state.focusedProvider = state.visibleProviders[0];
    }

    if (state.syncTargetsWithVisible) {
      state.selectedTargets = new Set(state.visibleProviders);
    }
  }

  function setLayoutMode(mode) {
    if (!CAPACITY_BY_LAYOUT[mode]) return;
    state.layoutMode = mode;
    normalizeVisibleProviders();
    saveState();
    updateUI();
  }

  // Click on provider in sidebar or Cmd+1..7
  function activateOrFocusProvider(providerId) {
    if (!getProvider(providerId)) return;

    if (state.layoutMode === '1x') {
      state.visibleProviders = [providerId];
      state.focusedProvider = providerId;
    } else {
      if (state.visibleProviders.includes(providerId)) {
        state.focusedProvider = providerId;
      } else {
        // Replace the currently focused pane (or last pane) with the chosen provider
        const replaceIdx = state.visibleProviders.indexOf(state.focusedProvider);
        if (replaceIdx !== -1) {
          state.visibleProviders[replaceIdx] = providerId;
        } else {
          state.visibleProviders[state.visibleProviders.length - 1] = providerId;
        }
        state.focusedProvider = providerId;
      }
    }

    if (state.syncTargetsWithVisible) {
      state.selectedTargets = new Set(state.visibleProviders);
    }

    saveState();
    updateUI();
  }

  // Toggle a provider in/out of the Split View ("Pin" button)
  function toggleProviderInSplit(providerId) {
    if (state.visibleProviders.includes(providerId)) {
      if (state.visibleProviders.length <= 1) {
        showToast('Almeno un ambiente AI deve restare visibile.');
        return;
      }
      state.visibleProviders = state.visibleProviders.filter((id) => id !== providerId);
      const count = state.visibleProviders.length;
      state.layoutMode = count === 1 ? '1x' : count === 2 ? '2x' : count === 3 ? '3x' : '2x2';
    } else {
      if (state.visibleProviders.length >= 4) {
        state.visibleProviders[state.visibleProviders.length - 1] = providerId;
      } else {
        state.visibleProviders.push(providerId);
      }
      const count = state.visibleProviders.length;
      state.layoutMode = count === 1 ? '1x' : count === 2 ? '2x' : count === 3 ? '3x' : '2x2';
      state.focusedProvider = providerId;
    }

    if (state.syncTargetsWithVisible) {
      state.selectedTargets = new Set(state.visibleProviders);
    }

    saveState();
    updateUI();
  }

  function applyPreset(preset) {
    state.layoutMode = preset.layout;
    state.visibleProviders = [...preset.providers];
    state.focusedProvider = preset.providers[0];
    if (state.syncTargetsWithVisible) {
      state.selectedTargets = new Set(state.visibleProviders);
    }
    saveState();
    updateUI();
    showToast(`Preset "${preset.name}" attivato`);
  }

  // ==========================================
  // CAPTURE & RELAY SYSTEM
  // ==========================================
  async function captureFromProvider(providerId, openQuickModal = false) {
    const entry = ensurePaneMounted(providerId);
    if (!entry) return;

    try {
      const script = buildCaptureResponseScript(entry.provider);
      const result = await entry.webview.executeJavaScript(script);

      if (!result || !result.ok || !result.text) {
        showToast(result?.reason || ` Impossibile estrarre la risposta da ${entry.provider.name}.`, '#EF4444');
        return;
      }

      setCapturedContext(providerId, result.text, result.sourceType);

      if (openQuickModal) {
        openQuickRelayModal(providerId, result.text);
      } else {
        omnibarDockEl.classList.remove('collapsed');
        omnibarInput.focus();
        showToast(
          `📥 Risposta catturata da ${entry.provider.name} (${result.text.length} caratteri)`,
          entry.provider.color
        );
      }
    } catch (err) {
      showToast(`Errore durante la cattura da ${entry.provider.name}. Assicurati che la pagina sia carica.`, '#EF4444');
    }
  }

  function setCapturedContext(sourceId, text, sourceType = 'last-response') {
    const provider = getProvider(sourceId);
    if (!provider) return;

    state.capturedContext = {
      sourceId,
      sourceName: provider.name,
      sourceColor: provider.color,
      sourceType,
      text,
      templateId: state.capturedContext?.templateId || 'verify'
    };

    // Add to sidebar history if not duplicate of top item
    if (!state.capturedHistory.length || state.capturedHistory[0].text !== text) {
      state.capturedHistory.unshift({
        id: Date.now(),
        sourceId,
        sourceName: provider.name,
        sourceColor: provider.color,
        text,
        timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      });
      state.capturedHistory = state.capturedHistory.slice(0, 12);
      saveState();
    }

    renderRelayDrawer();
    renderCapturedHistory();
  }

  function clearCapturedContext() {
    state.capturedContext = null;
    renderRelayDrawer();
  }

  function renderRelayDrawer() {
    if (!state.capturedContext) {
      relayDrawerEl.classList.add('hidden');
      return;
    }

    relayDrawerEl.classList.remove('hidden');
    const ctx = state.capturedContext;
    relaySourceBadgeEl.textContent = `📎 Da ${ctx.sourceName}`;
    relaySourceBadgeEl.style.borderColor = ctx.sourceColor;
    relayCharCountEl.textContent = `${ctx.text.length} caratteri`;
    relayContentEditor.value = ctx.text;

    relayTemplatesEl.innerHTML = '';
    for (const tpl of RELAY_TEMPLATES) {
      const btn = document.createElement('button');
      btn.className = `template-chip ${ctx.templateId === tpl.id ? 'active' : ''}`;
      btn.textContent = tpl.label;
      btn.addEventListener('click', () => {
        state.capturedContext.templateId = tpl.id;
        renderRelayDrawer();
        omnibarInput.focus();
      });
      relayTemplatesEl.appendChild(btn);
    }
  }

  function renderCapturedHistory() {
    capturedHistoryListEl.innerHTML = '';
    if (state.capturedHistory.length === 0) {
      capturedHistoryListEl.innerHTML = `
        <div class="empty-clips-hint">
          Clicca <strong>"📥 Cattura risposta"</strong> su qualsiasi pannello (o seleziona del testo) per passare l'output da un'AI all'altra.
        </div>
      `;
      return;
    }

    for (const item of state.capturedHistory) {
      const card = document.createElement('div');
      card.className = 'clip-card';
      card.innerHTML = `
        <div class="clip-card-top">
          <span style="color: ${item.sourceColor}">● ${item.sourceName}</span>
          <span style="color: var(--text-muted)">${item.timestamp}</span>
        </div>
        <div class="clip-card-preview"></div>
      `;
      card.querySelector('.clip-card-preview').textContent = item.text;
      card.addEventListener('click', () => {
        setCapturedContext(item.sourceId, item.text, 'history');
        omnibarDockEl.classList.remove('collapsed');
        omnibarInput.focus();
      });
      capturedHistoryListEl.appendChild(card);
    }
  }

  // ==========================================
  // QUICK 1-CLICK RELAY MODAL
  // ==========================================
  function openQuickRelayModal(sourceId, text) {
    const sourceProvider = getProvider(sourceId);
    if (!sourceProvider) return;

    // Default target: another visible provider, or chatgpt/claude
    const defaultTarget =
      state.visibleProviders.find((id) => id !== sourceId) ||
      (sourceId === 'claude' ? 'chatgpt' : 'claude');

    state.quickRelayState = {
      sourceId,
      sourceName: sourceProvider.name,
      text,
      targetId: defaultTarget
    };

    quickRelayTitle.textContent = `⚡ Passa risposta di ${sourceProvider.name} a un'altra AI`;
    quickRelaySnippet.textContent = text;
    renderQuickRelayModalControls();
    quickRelayModal.classList.remove('hidden');
  }

  function renderQuickRelayModalControls() {
    const qr = state.quickRelayState;
    quickRelayTargets.innerHTML = '';

    for (const p of AI_PROVIDERS) {
      if (p.id === qr.sourceId) continue;
      const btn = document.createElement('button');
      btn.className = `qr-target-btn ${qr.targetId === p.id ? 'active' : ''}`;
      btn.innerHTML = `<span class="provider-color-dot" style="background:${p.color}"></span> ${p.name}`;
      btn.addEventListener('click', () => {
        state.quickRelayState.targetId = p.id;
        renderQuickRelayModalControls();
      });
      quickRelayTargets.appendChild(btn);
    }

    // Also add "Tutte le altre visibili" option
    const otherVisible = state.visibleProviders.filter((id) => id !== qr.sourceId);
    if (otherVisible.length > 1) {
      const allBtn = document.createElement('button');
      allBtn.className = `qr-target-btn ${qr.targetId === '__ALL_OTHERS__' ? 'active' : ''}`;
      allBtn.textContent = `🎯 Tutte le altre visibili (${otherVisible.length})`;
      allBtn.addEventListener('click', () => {
        state.quickRelayState.targetId = '__ALL_OTHERS__';
        renderQuickRelayModalControls();
      });
      quickRelayTargets.appendChild(allBtn);
    }

    quickRelayActions.innerHTML = '';
    for (const tpl of RELAY_TEMPLATES) {
      const actBtn = document.createElement('button');
      actBtn.className = 'qr-action-btn';
      actBtn.textContent = tpl.label;
      actBtn.addEventListener('click', async () => {
        const finalPrompt = tpl.buildPrompt(qr.sourceName, qr.text, '');
        quickRelayModal.classList.add('hidden');

        const targetIds =
          qr.targetId === '__ALL_OTHERS__'
            ? state.visibleProviders.filter((id) => id !== qr.sourceId)
            : [qr.targetId];

        // Ensure target is visible on screen so user sees the result immediately
        for (const tId of targetIds) {
          if (!state.visibleProviders.includes(tId)) {
            if (state.layoutMode === '1x') {
              state.layoutMode = '2x';
              state.visibleProviders = [qr.sourceId, tId];
            } else {
              state.visibleProviders[state.visibleProviders.length - 1] = tId;
            }
          }
        }
        state.focusedProvider = targetIds[0];
        saveState();
        updateUI();

        await dispatchPromptToProviders(targetIds, finalPrompt, true);
      });
      quickRelayActions.appendChild(actBtn);
    }
  }

  // ==========================================
  // MULTI-PROMPT DISPATCH ENGINE
  // ==========================================
  async function dispatchPromptToProviders(targetIds, promptText, autoSubmit) {
    if (!promptText || !promptText.trim()) return;

    // Always copy to clipboard as an instant fallback
    window.electronAPI?.copyText(promptText);

    const succeeded = [];
    const failed = [];

    await Promise.all(
      targetIds.map(async (providerId) => {
        const entry = ensurePaneMounted(providerId);
        if (!entry) return;

        try {
          const script = buildInjectPromptScript(entry.provider, promptText, autoSubmit);
          const res = await entry.webview.executeJavaScript(script);
          if (res && res.ok) {
            succeeded.push(entry.provider.name);
          } else {
            failed.push(entry.provider.name);
          }
        } catch (_err) {
          failed.push(entry.provider.name);
        }
      })
    );

    if (succeeded.length > 0) {
      showToast(`⚡ Inviato a: ${succeeded.join(', ')}`, '#10B981');
    }
    if (failed.length > 0) {
      showToast(
        `⚠️ Input non trovato su ${failed.join(', ')} (verifica il login; prompt copiato negli appunti).`,
        '#F59E0B'
      );
    }
  }

  async function handleOmnibarSend() {
    const customNote = omnibarInput.value.trim();
    const hasRelay = Boolean(state.capturedContext);

    if (!customNote && !hasRelay) {
      showToast('Scrivi un prompt o cattura prima una risposta da un pannello AI.');
      return;
    }

    let finalPrompt = customNote;
    if (hasRelay) {
      const editedContext = relayContentEditor.value.trim() || state.capturedContext.text;
      const tpl =
        RELAY_TEMPLATES.find((t) => t.id === state.capturedContext.templateId) || RELAY_TEMPLATES[0];
      finalPrompt = tpl.buildPrompt(state.capturedContext.sourceName, editedContext, customNote);
    }

    const targets = Array.from(state.selectedTargets);
    if (targets.length === 0) {
      showToast('Seleziona almeno un ambiente AI di destinazione.');
      return;
    }

    omnibarInput.value = '';
    omnibarInput.style.height = 'auto';
    if (hasRelay) {
      clearCapturedContext();
    }

    await dispatchPromptToProviders(targets, finalPrompt, chkAutoSubmit.checked);
  }

  // ==========================================
  // RENDER & UPDATE UI
  // ==========================================
  function renderPresets() {
    presetBarEl.innerHTML = '';
    for (const preset of WORKSPACE_PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'preset-chip';
      btn.title = preset.description;
      btn.textContent = preset.name;
      btn.addEventListener('click', () => applyPreset(preset));
      presetBarEl.appendChild(btn);
    }
  }

  function updateUI() {
    // 1. Update Layout Switcher buttons & Stage Grid class
    stageGrid.className = `stage-grid layout-${state.layoutMode}`;
    layoutSwitcherEl.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.layout === state.layoutMode);
    });

    // 2. Ensure visible webview panes are mounted and toggle visibility
    for (const vid of state.visibleProviders) {
      ensurePaneMounted(vid);
    }

    for (const [id, entry] of mountedPanes.entries()) {
      const isVisible = state.visibleProviders.includes(id);
      entry.pane.classList.toggle('visible', isVisible);
      entry.pane.classList.toggle('focused', id === state.focusedProvider);
      if (isVisible) {
        entry.pane.style.order = String(state.visibleProviders.indexOf(id));
      }
    }

    // 3. Render Left Sidebar Provider List
    providerListEl.innerHTML = '';
    for (const p of AI_PROVIDERS) {
      const inView = state.visibleProviders.includes(p.id);
      const isFocused = state.focusedProvider === p.id;

      const item = document.createElement('div');
      item.className = `provider-item ${inView ? 'in-view' : ''} ${isFocused ? 'focused-pane' : ''}`;
      item.innerHTML = `
        <div class="provider-item-left">
          <span class="provider-color-dot" style="background: ${p.color}"></span>
          <div class="provider-names">
            <div class="provider-name-row">
              <span class="provider-name">${p.name}</span>
            </div>
            <span class="provider-sub">${p.subtitle}</span>
          </div>
        </div>
        <div class="provider-item-right">
          <button class="split-pin-btn ${inView ? 'pinned' : ''}" data-pin="${p.id}" title="${
        inView ? 'Rimuovi dallo Split-Screen' : 'Aggiungi in Split-Screen affiancato'
      }">
            ${inView ? '✓ Split' : '+ Split'}
          </button>
          <kbd>${p.shortcut}</kbd>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('button[data-pin]')) {
          e.stopPropagation();
          toggleProviderInSplit(p.id);
          return;
        }
        activateOrFocusProvider(p.id);
      });

      providerListEl.appendChild(item);
    }

    // 4. Render Target Chips in Bottom Omnibar
    btnSelectVisibleTargets.classList.toggle('active', state.syncTargetsWithVisible);
    targetChipsEl.innerHTML = '';
    for (const p of AI_PROVIDERS) {
      const isSelected = state.selectedTargets.has(p.id);
      const chip = document.createElement('button');
      chip.className = `target-chip ${isSelected ? 'selected' : ''}`;
      chip.innerHTML = `
        <span class="target-chip-dot" style="background: ${p.color}"></span>
        <span>${p.name}</span>
      `;
      chip.addEventListener('click', () => {
        state.syncTargetsWithVisible = false;
        if (state.selectedTargets.has(p.id)) {
          if (state.selectedTargets.size > 1) state.selectedTargets.delete(p.id);
        } else {
          state.selectedTargets.add(p.id);
        }
        updateUI();
      });
      targetChipsEl.appendChild(chip);
    }
  }

  // ==========================================
  // EVENT LISTENERS & SHORTCUTS
  // ==========================================
  layoutSwitcherEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (btn && btn.dataset.layout) {
      setLayoutMode(btn.dataset.layout);
    }
  });

  btnSelectVisibleTargets.addEventListener('click', () => {
    state.syncTargetsWithVisible = true;
    state.selectedTargets = new Set(state.visibleProviders);
    updateUI();
  });

  btnSendMulti.addEventListener('click', handleOmnibarSend);

  omnibarInput.addEventListener('input', () => {
    omnibarInput.style.height = 'auto';
    omnibarInput.style.height = Math.min(omnibarInput.scrollHeight, 130) + 'px';
  });

  omnibarInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleOmnibarSend();
    }
  });

  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    sidebarEl.classList.toggle('collapsed');
  });

  document.getElementById('btn-toggle-omnibar').addEventListener('click', () => {
    omnibarDockEl.classList.toggle('collapsed');
    if (!omnibarDockEl.classList.contains('collapsed')) {
      omnibarInput.focus();
    }
  });

  document.getElementById('btn-capture-focused').addEventListener('click', () => {
    captureFromProvider(state.focusedProvider, true);
  });

  document.getElementById('btn-close-relay').addEventListener('click', clearCapturedContext);

  document.getElementById('btn-copy-captured').addEventListener('click', () => {
    const txt = relayContentEditor.value || state.capturedContext?.text || '';
    if (txt) {
      window.electronAPI?.copyText(txt);
      showToast('📋 Testo copiato negli appunti');
    }
  });

  document.getElementById('btn-clear-clips').addEventListener('click', () => {
    state.capturedHistory = [];
    saveState();
    renderCapturedHistory();
  });

  document.getElementById('btn-close-quick-relay').addEventListener('click', () => {
    quickRelayModal.classList.add('hidden');
  });

  quickRelayModal.addEventListener('click', (e) => {
    if (e.target === quickRelayModal) {
      quickRelayModal.classList.add('hidden');
    }
  });

  // Listen for native menu shortcuts from Electron main process
  window.electronAPI?.onShortcut((payload) => {
    if (!payload) return;
    if (payload.type === 'provider') {
      activateOrFocusProvider(payload.id);
    } else if (payload.type === 'layout') {
      setLayoutMode(payload.mode);
    } else if (payload.type === 'focus-omnibar') {
      omnibarDockEl.classList.remove('collapsed');
      omnibarInput.focus();
    } else if (payload.type === 'capture-active') {
      captureFromProvider(state.focusedProvider, true);
    } else if (payload.type === 'reload-active') {
      const entry = mountedPanes.get(state.focusedProvider);
      if (entry) entry.webview.reload();
    } else if (payload.type === 'toggle-sidebar') {
      sidebarEl.classList.toggle('collapsed');
    }
  });

  // ==========================================
  // DOCUMENTO A STAFFETTA (60% AI #1 -> 40% AI #2)
  // ==========================================
  const docStudioEl = document.getElementById('doc-studio');
  const docTopicInput = document.getElementById('doc-topic-input');
  const selRelayAi1 = document.getElementById('sel-relay-ai-1');
  const selRelayAi2 = document.getElementById('sel-relay-ai-2');
  const rngSplitPct = document.getElementById('rng-split-pct');
  const unifiedDocTextarea = document.getElementById('unified-doc-textarea');
  const docStatsEl = document.getElementById('doc-stats');

  function initDocStudio() {
    if (!selRelayAi1 || !selRelayAi2) return;

    selRelayAi1.innerHTML = '';
    selRelayAi2.innerHTML = '';
    for (const p of AI_PROVIDERS) {
      const opt1 = document.createElement('option');
      opt1.value = p.id;
      opt1.textContent = p.name;
      selRelayAi1.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = p.id;
      opt2.textContent = p.name;
      selRelayAi2.appendChild(opt2);
    }

    selRelayAi1.value = 'chatgpt';
    selRelayAi2.value = AI_PROVIDERS.some((p) => p.id === 'venice') ? 'venice' : 'claude';

    unifiedDocTextarea.value = localStorage.getItem('ia_use_unified_doc') || '';
    updateDocStudioLabels();
    updateDocStats();
  }

  function updateDocStudioLabels() {
    const pct1 = Number(rngSplitPct.value) || 60;
    const pct2 = 100 - pct1;
    const p1 = getProvider(selRelayAi1.value) || AI_PROVIDERS[0];
    const p2 = getProvider(selRelayAi2.value) || AI_PROVIDERS[1];

    document.getElementById('lbl-pct-1').textContent = `${pct1}%`;
    document.getElementById('lbl-pct-2').textContent = `${pct2}%`;
    document.getElementById('slider-caption-left').textContent = `${pct1}% su ${p1.name}`;
    document.getElementById('slider-caption-right').textContent = `${pct2}% su ${p2.name}`;

    document.getElementById('btn-pct-1').textContent = `${pct1}%`;
    document.getElementById('btn-ai-1').textContent = p1.name;
    document.getElementById('btn-pct-2').textContent = `${pct2}%`;
    document.getElementById('btn-ai-2').textContent = p2.name;
    document.getElementById('btn-ai-2-end').textContent = p2.name;
  }

  function updateDocStats() {
    const text = unifiedDocTextarea.value || '';
    localStorage.setItem('ia_use_unified_doc', text);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    docStatsEl.textContent = `${words} parole · ${text.length} caratteri`;
  }

  async function appendProviderOutputToDoc(providerId, replaceAll = false) {
    const entry = ensurePaneMounted(providerId);
    if (!entry) return null;

    try {
      const script = buildCaptureResponseScript(entry.provider);
      const res = await entry.webview.executeJavaScript(script);
      if (!res || !res.ok || !res.text) {
        showToast(res?.reason || `Nessuna risposta trovata su ${entry.provider.name}.`, '#EF4444');
        return null;
      }

      docStudioEl.classList.remove('collapsed');
      if (replaceAll || !unifiedDocTextarea.value.trim()) {
        unifiedDocTextarea.value = res.text.trim();
      } else {
        unifiedDocTextarea.value = `${unifiedDocTextarea.value.trim()}\n\n${res.text.trim()}`;
      }
      updateDocStats();
      showToast(`📄 Aggiunto al Documento da ${entry.provider.name}`, entry.provider.color);
      return res.text.trim();
    } catch (_err) {
      showToast(`Errore durante la lettura da ${entry.provider.name}.`, '#EF4444');
      return null;
    }
  }

  document.getElementById('btn-toggle-doc-studio')?.addEventListener('click', () => {
    docStudioEl.classList.toggle('collapsed');
  });

  document.getElementById('btn-close-doc-studio')?.addEventListener('click', () => {
    docStudioEl.classList.add('collapsed');
  });

  rngSplitPct?.addEventListener('input', updateDocStudioLabels);
  selRelayAi1?.addEventListener('change', updateDocStudioLabels);
  selRelayAi2?.addEventListener('change', updateDocStudioLabels);
  unifiedDocTextarea?.addEventListener('input', updateDocStats);

  // Step 1: Generate first X% (e.g. 60%) on AI #1
  document.getElementById('btn-step1-generate')?.addEventListener('click', async () => {
    const topic = docTopicInput.value.trim();
    if (!topic) {
      docTopicInput.focus();
      showToast('Inserisci prima l\'argomento della ricerca/documento nel campo in alto!', '#F59E0B');
      return;
    }

    const pct1 = Number(rngSplitPct.value) || 60;
    const pct2 = 100 - pct1;
    const ai1Id = selRelayAi1.value;
    const ai2Id = selRelayAi2.value;

    // Put AI #1 and AI #2 side-by-side in 2x Split so user sees both
    if (ai1Id !== ai2Id) {
      state.layoutMode = '2x';
      state.visibleProviders = [ai1Id, ai2Id];
    } else {
      state.layoutMode = '1x';
      state.visibleProviders = [ai1Id];
    }
    state.focusedProvider = ai1Id;
    saveState();
    updateUI();

    const promptStep1 = `Devo realizzare una ricerca/documento completo su: "${topic}".\n\nLavoriamo a staffetta tra due intelligenze artificiali:\n1. All'inizio proponi un Indice strutturato di tutto il documento (100%).\n2. Subito dopo, sviluppa e scrivi per intero, in modo approfondito e ben formattato, SOLO il primo ${pct1}% dei capitoli previsti dall'indice.\n3. Fermati esattamente al ${pct1}% senza scrivere i capitoli finali né la conclusione (che verranno completati per il restante ${pct2}% dalla seconda AI).`;

    await dispatchPromptToProviders([ai1Id], promptStep1, true);
  });

  // Step 2: Capture first X% from AI #1, save in Unified Doc, and send to AI #2 to complete remaining Y%
  document.getElementById('btn-step2-handover')?.addEventListener('click', async () => {
    const pct1 = Number(rngSplitPct.value) || 60;
    const pct2 = 100 - pct1;
    const ai1Id = selRelayAi1.value;
    const ai2Id = selRelayAi2.value;
    const p1 = getProvider(ai1Id);
    const topic = docTopicInput.value.trim();

    const capturedPart1 = await appendProviderOutputToDoc(ai1Id, true);
    if (!capturedPart1) return;

    state.focusedProvider = ai2Id;
    if (!state.visibleProviders.includes(ai2Id)) {
      state.layoutMode = '2x';
      state.visibleProviders = [ai1Id, ai2Id];
    }
    saveState();
    updateUI();

    const promptStep2 = `Sto realizzando una ricerca/documento${topic ? ` su "${topic}"` : ''}. Qui sotto trovi il primo ${pct1}% già scritto da ${p1.name}.\n\nIl tuo compito è scrivere il restante ${pct2}% del documento:\n- Riprendi ESATTAMENTE dal punto o capitolo in cui si è interrotto ${p1.name}.\n- NON ripetere l'introduzione o i capitoli già svolti e NON aggiungere preamboli conversazionali ("Certamente, ecco il seguito...").\n- Mantieni lo stesso stile e porta a termine i capitoli rimanenti fino alla conclusione completa.\n\n---\n${capturedPart1}\n---`;

    await dispatchPromptToProviders([ai2Id], promptStep2, true);
  });

  // Step 3: Capture remaining Y% from AI #2 and append seamlessly to Unified Document
  document.getElementById('btn-step3-append')?.addEventListener('click', async () => {
    const ai2Id = selRelayAi2.value;
    await appendProviderOutputToDoc(ai2Id, false);
  });

  // Export & Copy Unified Document
  document.getElementById('btn-doc-copy')?.addEventListener('click', () => {
    const text = unifiedDocTextarea.value.trim();
    if (!text) {
      showToast('Il documento è vuoto.');
      return;
    }
    window.electronAPI?.copyText(text);
    showToast('📋 Documento completo copiato negli appunti!', '#10B981');
  });

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById('btn-doc-export-md')?.addEventListener('click', () => {
    const text = unifiedDocTextarea.value.trim();
    if (!text) {
      showToast('Il documento è vuoto.');
      return;
    }
    const slug = (docTopicInput.value.trim() || 'ricerca-staffetta-ai')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    downloadFile(`${slug || 'documento'}.md`, text, 'text/markdown;charset=utf-8');
    showToast('💾 Scaricato file Markdown (.md)');
  });

  document.getElementById('btn-doc-export-doc')?.addEventListener('click', () => {
    const text = unifiedDocTextarea.value.trim();
    if (!text) {
      showToast('Il documento è vuoto.');
      return;
    }
    const title = docTopicInput.value.trim() || 'Documento Ricerca';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const paragraphsHtml = text
      .split(/\n\n+/)
      .map((para) => {
        const clean = para.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (clean.startsWith('# ')) return `<h1>${clean.slice(2)}</h1>`;
        if (clean.startsWith('## ')) return `<h2>${clean.slice(3)}</h2>`;
        if (clean.startsWith('### ')) return `<h3>${clean.slice(4)}</h3>`;
        return `<p>${clean.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('\n');

    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title}</title>
<style>body { font-family: Calibri, Arial, sans-serif; font-size: 11.5pt; line-height: 1.5; }</style>
</head><body>${paragraphsHtml}</body></html>`;

    downloadFile(`${slug || 'ricerca'}.doc`, wordHtml, 'application/msword;charset=utf-8');
    showToast('💾 Scaricato documento Word (.doc)');
  });

  document.getElementById('btn-doc-clear')?.addEventListener('click', () => {
    unifiedDocTextarea.value = '';
    updateDocStats();
    showToast('🗑️ Foglio unificato svuotato');
  });

  // Boot
  normalizeVisibleProviders();
  renderPresets();
  renderCapturedHistory();
  initDocStudio();
  updateUI();
})();
