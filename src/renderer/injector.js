// DOM Injection & Context Extraction Bridge for AI Webviews

function buildInjectPromptScript(provider, promptText, autoSubmit = true) {
  const payload = JSON.stringify({
    selectors: provider.selectors,
    text: promptText,
    autoSubmit: Boolean(autoSubmit)
  });

  return `(async function() {
    const cfg = ${payload};
    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 10 && rect.height > 10 && window.getComputedStyle(el).visibility !== 'hidden';
    }

    function findElement(selectorList) {
      for (const sel of selectorList) {
        const nodes = Array.from(document.querySelectorAll(sel));
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (isVisible(nodes[i])) return nodes[i];
        }
      }
      return null;
    }

    const inputEl = findElement(cfg.selectors.input);
    if (!inputEl) {
      return { ok: false, code: 'input-not-found', reason: 'Campo di input non trovato nella pagina (assicurati di aver effettuato il login).' };
    }

    inputEl.focus();

    const isTextarea = inputEl.tagName.toLowerCase() === 'textarea' || inputEl.tagName.toLowerCase() === 'input';

    if (isTextarea) {
      const proto = window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(inputEl, cfg.text);
      } else {
        inputEl.value = cfg.text;
      }
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: cfg.text }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // ContentEditable (ProseMirror on ChatGPT/Claude, Quill on Gemini, Lexical on Perplexity)
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection.removeAllRanges();
      selection.addRange(range);

      const inserted = document.execCommand('insertText', false, cfg.text);
      if (!inserted || !inputEl.innerText || inputEl.innerText.trim().length === 0) {
        inputEl.innerHTML = '';
        const lines = cfg.text.split('\\n');
        for (const line of lines) {
          const p = document.createElement('p');
          p.textContent = line || '\\u200B';
          inputEl.appendChild(p);
        }
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: cfg.text }));
      }
    }

    if (cfg.autoSubmit) {
      const deadline = Date.now() + 3000;
      let submitBtn = null;
      do {
        await new Promise(resolve => setTimeout(resolve, 160));
        submitBtn = findElement(cfg.selectors.submit);
        if (submitBtn && !submitBtn.disabled && submitBtn.getAttribute('aria-disabled') !== 'true') {
          submitBtn.click();
          return { ok: true };
        }
      } while (Date.now() < deadline);
      return { ok: false, code: 'submit-unavailable' };
    }

    return { ok: true };
  })();`;
}

function buildCaptureResponseScript(provider) {
  const payload = JSON.stringify({
    selectors: provider.selectors,
    providerId: provider.id
  });

  return `(function() {
    const cfg = ${payload};

    // 1. Priority: if the user highlighted specific text inside this AI pane, grab that selection
    const selected = window.getSelection ? window.getSelection().toString().trim() : '';
    if (selected && selected.length > 3) {
      return { ok: true, sourceType: 'selection', text: selected };
    }

    if (cfg.providerId === 'claude' && document.querySelectorAll('[data-is-streaming="true"]').length) {
      return { ok: false, reason: 'Claude sta ancora scrivendo. Attendi il completamento della risposta.' };
    }

    // 2. Otherwise grab the latest assistant message block
    const fallbackSelectors = [
      ...cfg.selectors.messages,
      '[data-message-author-role="assistant"]',
      '.font-claude-message',
      'message-content',
      '.ds-markdown',
      '.prose',
      '.markdown'
    ];

    let candidates = [];
    for (const sel of fallbackSelectors) {
      const found = Array.from(document.querySelectorAll(sel)).filter(el => {
        const txt = (el.innerText || '').trim();
        return txt.length > 5;
      });
      if (found.length > 0) {
        candidates = found;
        break;
      }
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        reason: 'Nessuna risposta trovata o testo selezionato. Seleziona del testo con il mouse oppure attendi una risposta dell\\'AI.'
      };
    }

    const lastNode = candidates[candidates.length - 1];
    const extracted = (lastNode.innerText || '').trim();
    return {
      ok: true,
      sourceType: 'last-response',
      text: extracted
    };
  })();`;
}

function buildInPageRelayHelperScript(provider) {
  const payload = JSON.stringify({
    id: provider.id,
    name: provider.name,
    color: provider.color
  });

  return `(function() {
    if (window.__IA_USE_HELPER_INSTALLED__) return;
    window.__IA_USE_HELPER_INSTALLED__ = true;
    const info = ${payload};

    const btn = document.createElement('button');
    btn.id = '__ia_use_floating_relay__';
    btn.textContent = 'Invia a un\\'altra AI →';
    Object.assign(btn.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '999px',
      background: '#121418',
      color: '#F3F4F6',
      border: '1px solid ' + info.color,
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'transform 0.12s ease, opacity 0.12s ease'
    });

    let lastSelectedText = '';

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (lastSelectedText) {
        console.log('__IA_USE_RELAY__:' + JSON.stringify({
          providerId: info.id,
          providerName: info.name,
          text: lastSelectedText
        }));
        btn.style.display = 'none';
      }
    });

    document.body.appendChild(btn);

    document.addEventListener('mouseup', (e) => {
      setTimeout(() => {
        const sel = window.getSelection ? window.getSelection().toString().trim() : '';
        if (sel && sel.length > 8) {
          lastSelectedText = sel;
          const x = Math.min(window.innerWidth - 180, Math.max(16, e.clientX - 60));
          const y = Math.max(16, e.clientY - 46);
          btn.style.left = x + 'px';
          btn.style.top = y + 'px';
          btn.style.display = 'inline-flex';
        } else {
          btn.style.display = 'none';
        }
      }, 20);
    });

    document.addEventListener('scroll', () => {
      btn.style.display = 'none';
    }, true);
  })();`;
}

window.IAUseInjector = {
  buildInjectPromptScript,
  buildCaptureResponseScript,
  buildInPageRelayHelperScript
};
