# DESIGN.md — IA-Use Design System & Architecture Contract

## 1. Product Philosophy & Aesthetic Direction
**IA-Use** is a desktop command center for power users who pay for multiple top-tier AI subscriptions (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok) and need to orchestrate them side-by-side or in sequence without tab chaos or copy-paste fatigue.

- **Benchmark References**: Linear (desktop shell precision, hairline borders, keyboard-first UX), Raycast (command bar & quick relay actions), Arc Browser (split-view management & session isolation).
- **Zero Chrome Bloat**: Because the core content is the embedded AI Web UIs, the host shell must be ultra-compact, dark-native, high-contrast, and visually recessive so the AI panes get 92%+ of the viewport area.

---

## 2. Color System (Dark-Native Studio Palette)
Designed to harmonize with the dark modes of ChatGPT (`#212121`), Claude (`#191919`), Gemini (`#131314`), and Perplexity (`#191A1A`).

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--bg-app` | `#0B0C0E` | Deepest window background & split-pane gutter |
| `--bg-surface` | `#121418` | Sidebar, top bar, and omnibar container |
| `--bg-elevated` | `#1A1D24` | Cards, dropdowns, active pills, modal surfaces |
| `--bg-hover` | `#232730` | Interactive hover states |
| `--border-subtle` | `rgba(255, 255, 255, 0.07)` | 1px structural hairline dividers |
| `--border-focus` | `rgba(255, 255, 255, 0.22)` | Active pane or input ring |
| `--text-primary` | `#F3F4F6` | Primary UI labels and omnibar input |
| `--text-secondary` | `#9CA3AF` | Secondary metadata, shortcuts, inactive tabs |
| `--text-muted` | `#6B7280` | Disabled states, subtle hints |
| `--accent-primary` | `#6366F1` | Primary action (Multi-Prompt Send, Relay CTA) |
| `--accent-glow` | `rgba(99, 102, 241, 0.20)` | Subtle focus glow on Omnibar |

### Provider Semantic Accents
Each AI provider has an authentic signature indicator color used strictly on its status badge, active pane top-border (2px), and target pills:
- **ChatGPT**: `#10A37F` (OpenAI Emerald)
- **Claude**: `#D97757` (Anthropic Terracotta)
- **Gemini**: `#4E82EE` (Google Cobalt Blue)
- **Perplexity**: `#22B8CF` (Perplexity Cyan)
- **DeepSeek**: `#4D6BFE` (DeepSeek Indigo)
- **Grok**: `#E5E7EB` (xAI Monochrome Silver)

---

## 3. Typography & Hierarchy
- **UI Sans**: `-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", sans-serif`
  - App Controls & Tabs: `12.5px`, `font-weight: 500`, `letter-spacing: -0.01em`
  - Pane Headers: `12px`, `font-weight: 600`
  - Omnibar Input: `14px`, `line-height: 1.45`
- **Monospace (Shortcuts & Badges)**: `"SF Mono", "JetBrains Mono", monospace`
  - Keyboard shortcuts (`⌘1`, `⌘K`, `⌘↵`): `11px`, `font-weight: 500`

---

## 4. Layout & Spatial Architecture
1. **Left Rail (56px collapsed / 210px expanded)**:
   - macOS Traffic Lights safe area (`padding-top: 38px`).
   - Provider Switcher list with live status indicators (Loaded / Active in Split) and `⌘1`–`⌘6` badges.
   - Layout Mode Switcher (`1x Focus`, `2x Split`, `3x Triple`, `2x2 Grid`).
   - Workspace Presets (*Coding*, *Research*, *Triade*).
2. **Main Stage (Split-Pane Webview Grid)**:
   - CSS Grid with `6px` gutter (`--bg-app`), `10px` border-radius per pane, `1px solid var(--border-subtle)`.
   - **Persistent Webviews**: All enabled AI `<webview>` instances remain mounted in the DOM at all times; inactive ones are hidden via CSS class so streaming responses never abort when switching views.
   - **Compact Pane Header (32px height)**:
     - Provider dot + Name + URL/Model indicator
     - Quick Actions: `📥 Cattura risposta` (1-click extract last answer), `⚡ Invia a...` (Relay menu), `↻ Ricarica`, `🔗 Apri esterno`
3. **Bottom Multi-Prompt Omnibar & Context Relay Dock**:
   - Floating/docked command bar at the bottom of the workspace.
   - **Context Attachment Pill**: When a response or text snippet is captured from an AI (e.g. from Claude), it appears above the input with a preview, source badge (`Da: Claude`), and 1-click template chips (*Verifica errori*, *Migliora codice*, *Sintetizza*, *Confronta*).
   - **Target Selector Chips**: Toggle which AI panes receive the prompt (defaults to all currently visible panes in split-screen, or customizable).
   - **Prompt Textarea**: Auto-expanding input (`↵` or `⌘↵` to dispatch simultaneously to all selected AIs).
