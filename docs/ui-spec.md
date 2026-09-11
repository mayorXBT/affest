# Affest UI implementation spec

For the engineer who implements the audit in `docs/glider-ui-audit.md`. Do not invent live chain data. Do not touch contracts, deployment files, private keys, or backend behavior. Do not remove testnet warnings.

Identity to preserve:

- Name: Affest (title case, never `affest` as the wordmark)
- Tagline: Verified cross-chain automation for self-driving portfolios.
- Voice: operator console, not consumer investing
- Accent: Affest lime on near-black. Not Glider mint.

Source of truth for behavior: `apps/web/app.js` views.
Source of truth for tokens: `apps/web/design-tokens.json`.
Do not treat `app/page.tsx` as the live app. It is a stale mock.

---

## Outcome

One dashboard, served by Next, built with shadcn/ui on Radix, using Affest tokens. Same six destinations the static preview already has. Every visible control either works or is disabled with a reason. Disconnected and undeployed states look empty or preview-labelled, never like a funded mainnet portfolio.

The static `index.html` server stays only as a fallback until Next `dev`/`start` replaces it. Do not maintain two UIs after this work.

---

## Fonts

Keep the current pair. Do not switch to Inter, Space Grotesk, Roboto, or Glider's Selecta / Favorit / Paper Mono.

| Role | Face | Weights | License | Source |
| --- | --- | --- | --- | --- |
| Brand, headings, body | Manrope | 400, 500, 600, 700, 800 | SIL OFL 1.1 | [fontsource/manrope](https://fontsource.org/fonts/manrope) or Google Fonts. Prefer self-hosted woff2 via Fontsource so the dashboard works offline. |
| Labels, chips, IDs, amounts | DM Mono | 400, 500 | SIL OFL 1.1 | [fontsource/dm-mono](https://fontsource.org/fonts/dm-mono). Enable `font-variant-numeric: tabular-nums` on amounts. |

Manrope is already the Affest face. It is geometric, a little wide, and not the default AI stack. DM Mono is the instrument panel. Together they are distinct from Glider's proprietary Selecta.

Load with `next/font` or Fontsource imports in `app/layout.tsx`. Drop the Google Fonts `@import` in `globals.css` once self-hosted.

---

## Stack change

`apps/web/package.json` currently has no Next, React, Tailwind, or shadcn. The Next files are dead weight. The implementer should:

1. Add Next 15, React 19, TypeScript, Tailwind 4 or 3.4, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
2. Init shadcn against `apps/web`. Base color: custom CSS variables from `design-tokens.json`, not zinc/neutral defaults. Radius from tokens. Dark only for v1.
3. Point `pnpm --filter @affest/web dev` at `next dev -p 3000`.
4. Keep `server.mjs` until Next is the default, then delete it in the same PR if nothing else calls it.

Do not add a wallet SDK in this pass unless the owner asks. Preview wallet stays a clearly labelled local toggle.

---

## File-level plan

Work in this order. One vertical slice at a time. Do not refactor contracts or MCP.

### 1. Tokens and chrome

| File | Change |
| --- | --- |
| `apps/web/design-tokens.json` | Already written. Do not restyle from memory. |
| `apps/web/app/globals.css` | Replace the flattened one-file CSS with Tailwind + CSS variables mapped 1:1 from the token file. Keep the lime/ink/paper values. No extra gradients. |
| `apps/web/app/layout.tsx` | `lang="en"`, Manrope + DM Mono, metadata title `Affest - verified cross-chain automation`, description = the tagline. |
| `apps/web/lib/utils.ts` | shadcn `cn()` helper. |
| `apps/web/components/ui/*` | Generate only the primitives listed below. |

### 2. App shell

| File | Change |
| --- | --- |
| `apps/web/components/app-shell.tsx` | Sidebar + topbar + footer. Nav is real `<Link>`s. Active state is a filled rounded rect, no dent, no left notch, no lime pill rail. |
| `apps/web/components/network-chip.tsx` | Creditcoin CC3 / Testnet. Not a fake connected-chain menu until a wallet exists. |
| `apps/web/components/wallet-button.tsx` | Disconnected: `Connect wallet`. Preview: `Preview wallet connected`. Never a bare `0x71…b3a8`. |
| `apps/web/components/mobile-nav.tsx` | shadcn `Sheet`. Hamburger in the topbar below 768px. Lists the same six routes. |

### 3. Routes (port `app.js`, do not invent pages)

| File | Port from |
| --- | --- |
| `apps/web/app/page.tsx` | `views.overview` in `app.js`. Delete the greeting, date, and `$12,480.00`. |
| `apps/web/app/portfolio/page.tsx` | `views.portfolio` |
| `apps/web/app/strategies/page.tsx` | `views.strategies` |
| `apps/web/app/activity/page.tsx` | `views.activity` |
| `apps/web/app/agents/page.tsx` | `views.agents` |
| `apps/web/app/settings/page.tsx` | `views.settings` |

Client state that is allowed in this pass: `previewConnected`, `paused`, `draftSaved`, `previewAgent`. All four must be named preview in the UI.

### 4. Domain components

| File | Job |
| --- | --- |
| `components/preview-banner.tsx` | Replaces the connect banner. Copy from live `app.js`, not from `page.tsx`. |
| `components/status-row.tsx` | Testnet + proof-gated + permissions pending. Never `Contracts deployed` unless a real address is configured. |
| `components/value-card.tsx` | Empty state when not previewing. Preview state shows `test units` + `PREVIEW DATA`. No `$`. No sparkline until a real series exists. |
| `components/allocation-card.tsx` | Donut + legend + target. Hide or zero-out when not previewing. |
| `components/strategy-card.tsx` | Signal Balanced + pause. Pause is preview-only until chain pause exists. |
| `components/proof-rail.tsx` | Four steps. Default all `next` except when real worker data says otherwise. Do not hard-code `Receipt confirmed`. |
| `components/activity-list.tsx` | Tabs that actually filter. Empty state when the filter has no rows. |
| `components/agent-panel.tsx` | Preview credential generate/revoke with `AlertDialog` on revoke. |
| `components/holdings-table.tsx` | ASTB / ARSK rows, labelled demo tokens. |
| `components/strategy-builder.tsx` | Textarea + generated rules + security review. Save is local. Activate opens a review `Dialog`, does not silently route home. |

### 5. Remove or freeze

| File | Change |
| --- | --- |
| `apps/web/index.html` | Keep until Next is default, then delete. |
| `apps/web/app.js` | Port, then delete. Do not leave a third implementation. |
| `apps/web/server.mjs` | Delete once `next start` is the documented command. |
| `apps/web/README.md` | Document Next, preview-only wallet, no private keys. |

Do not edit `packages/contracts/**`, `apps/worker/**`, `apps/mcp/**`, `.env`, or deployment docs as part of this UI pass.

---

## shadcn / Radix mapping

Install these and no others in the first pass:

| shadcn component | Radix primitive | Affest use |
| --- | --- | --- |
| `button` | `@radix-ui/react-slot` | Primary lime (`Connect`, `Save`, `Generate`). Outline (`Pause`, `View details`). Ghost (`Edit strategy`). Destructive (`Revoke`, `Emergency pause`). |
| `card` | none | Every panel. Token radius `lg`, border `--line`, bg `--ink-2`. |
| `badge` | none | `PREVIEW DATA`, `Testnet`, `Waiting`, `Draft`, `Active`. |
| `tabs` | `@radix-ui/react-tabs` | Activity filters. Must change the list. |
| `dialog` | `@radix-ui/react-dialog` | Strategy review, safety guide. |
| `alert-dialog` | `@radix-ui/react-alert-dialog` | Revoke credential, emergency pause. |
| `sheet` | `@radix-ui/react-dialog` | Mobile nav. |
| `tooltip` | `@radix-ui/react-tooltip` | Truncated address, proof step detail. |
| `dropdown-menu` | `@radix-ui/react-dropdown-menu` | Future network menu. Not required until a real wallet exists. |
| `alert` | none | Connect/preview banner, Settings testnet note. |
| `progress` | `@radix-ui/react-progress` | Target allocation bar. |
| `table` | none | Holdings, activity, settings rows. |
| `textarea` | none | Strategy instruction. |
| `input` + `label` | none | Future forms. |
| `select` | `@radix-ui/react-select` | Future execution mode. |
| `switch` | `@radix-ui/react-switch` | Future notification flags. Not needed for P0. |
| `sonner` | none | `Draft saved locally`, `Preview paused`, `Preview credential revoked`. |
| `skeleton` | none | Optional. Prefer empty states over fake numbers. |
| `separator` | `@radix-ui/react-separator` | Sidebar footer rule. |
| `avatar` | `@radix-ui/react-avatar` | Sidebar `A` mark. |

Theme the components with CSS variables. Do not leave shadcn's default `--primary: 240 5.9% 10%`. Primary is lime `#d6f26a` on ink `#101410`.

Lucide icons only. Suggested: `Wallet`, `Pause`, `Play`, `ShieldCheck`, `Bot`, `Lock`, `CircleHelp`, `ChevronRight`, `Menu`, `X`.

---

## Layout rules

- Sidebar 240px, hidden below 768px, replaced by `Sheet`.
- Content max width 1240px, padding 48px desktop, 24px tablet, 16px mobile.
- Overview grid: two columns from 1024px up. One column below.
- Do not use a left notch, cutout, or lime bar on the selected nav item. Selected = `--ink-3` fill, `--paper` text, radius `md`.
- Header is title + subtitle + wallet button. No date, no greeting.
- Footer keeps the tagline and three links. Docs / Security / Testnet notes can stay as Settings anchors until real docs routes exist.

### Breakpoints

| Name | Width | Behavior |
| --- | --- | --- |
| `xs` | 0 | Single column. Sheet nav. Wallet button compact. |
| `sm` | 640px | Still single column. |
| `md` | 768px | Sidebar may appear as icon rail or stay in the sheet. Prefer sheet until 1024 if the 190px rail feels cramped. |
| `lg` | 1024px | Full sidebar + two-column overview. |
| `xl` | 1280px | Current 1440 composition. |

Replace today's 900 / 640 pair with this scale so Tailwind and the CSS agree.

---

## Trust rules (non-negotiable)

1. No `$` and no implied USD oracle.
2. No sparkline without a real series.
3. No `Receipt confirmed` / `done` proof step unless the worker actually reported it.
4. No `Contracts deployed` unless `docs/deployments.md` (or the runtime config) has an address. Copy should say `Contracts not deployed` or `Permissions pending`.
5. Preview wallet must say `Preview`. A truncated hex alone is a lie.
6. Pause, save, and credential actions in this pass are local. Toasts and buttons must say so.
7. Keep the Settings testnet paragraph.
8. Disconnected default: empty value card (`No portfolio loaded`), empty allocation, proof rail idle, activity empty. The sample vault is opt-in via `Use preview wallet`.
9. Do not add fake connect-to-MetaMask behavior.

---

## Copy

Sentence case for buttons and titles. Uppercase mono only for eyebrows.

| Current | Replace with |
| --- | --- |
| `Good morning, operator.` | Remove. Title is the route name. |
| `Tuesday, 08 September 2026 · testnet` | Remove. Testnet lives in the chip and status row. |
| `$12,480.00` | `12,480 test units` in preview, or empty. |
| `DEMO BALANCE` | `PREVIEW DATA` |
| `Contracts deployed · permissions pending` | `Contracts not deployed` until they are. |
| `Proof-gated automation is on` | `Proof-gated automation ready` (live copy) or `Waiting for a verified proof` |
| `Use preview wallet` | Keep. |
| `Preview wallet connected` | Keep. |
| `Connect an agent` | `Generate local preview credential` on the Agents page. Overview teaser can stay `Connect an agent` if it routes there. |
| `Activate after review ↗` | `Review and activate` and open a dialog. |
| `Ⅱ Pause` | `Pause` with a Lucide icon. |
| `Guardrails are enforced on-chain` | `Guardrails will be enforced on-chain after deploy` while undeployed. |

Keep the proof note:

> Nothing executes from a database claim. The Creditcoin contract must verify the Attestcoin proof first.

Keep:

> Non-custodial by design

---

## Accessibility

- All nav items are links or buttons with visible text. Do not icon-only the desktop rail.
- `:focus-visible` ring 2px lime at 40% opacity. Do not `outline: none` without a replacement.
- Contrast: `--paper` on `--ink` passes. 9px `#8f9a9b` on `#151a1d` does not for body text. Minimum 12px for readable copy, 11px for mono labels.
- `prefers-reduced-motion`: no pulse on Waiting, no transition over 120ms. Already stubbed in CSS. Keep it.
- Pause / Resume name the next action, not the state only.
- Revoke and emergency pause require `AlertDialog`. Enter submits nothing by accident.
- Donut and future charts need a text summary (`62% stable, 38% risk, target 70 / 30`).
- `aria-current="page"` on the active route.
- Do not rely on color alone for proof state. Keep the check / number / label.

---

## Motion

Minimal-functional. 120 to 180ms ease-out on hover and sheet open. No page-load choreography. No gradient buttons. No glow on lime.

---

## Screen-by-screen acceptance

A screen passes only if a human can do the path in the running app. Screenshots of the first paint are not enough.

### Overview

- [ ] Wordmark reads `Affest`, not `affest`.
- [ ] No date chip, no greeting.
- [ ] No sidebar dent.
- [ ] Disconnected: no dollar amount, no rising sparkline, no `Receipt confirmed`.
- [ ] `Use preview wallet` labels the session as preview.
- [ ] `Pause` flips to `Resume` and the pill copy follows.
- [ ] `Edit strategy` opens Strategies.
- [ ] `See all` opens Activity.
- [ ] `Connect an agent` opens Agents.
- [ ] Status row still says testnet.
- [ ] Desktop two-column, mobile one-column.
- [ ] Mobile hamburger opens all six routes.

### Portfolio

- [ ] Holdings list is reachable from nav and from `View details`.
- [ ] Amounts are units, not `$`.
- [ ] Demo tokens stay labelled demo / allowlisted.
- [ ] Guardrail copy does not claim on-chain enforcement while undeployed.
- [ ] `Edit strategy` opens Strategies.

### Strategies

- [ ] Textarea is editable.
- [ ] `Save deterministic draft` toasts `Saved locally` and does not hit a chain.
- [ ] `Review and activate` opens a dialog that restates trigger, allocation, caps, and proof gate.
- [ ] Dialog cancel leaves the draft. Confirm in this pass only returns to Overview with a preview toast. No unsigned tx.
- [ ] Draft badge does not stretch to the full card height.

### Activity

- [ ] All / Proofs / Actions change the visible rows.
- [ ] Empty filter shows `No proofs yet` (or Actions) plus a sentence, not a blank table.
- [ ] Rows that have no destination are not clickable, or they open a detail `Dialog`.

### Agents

- [ ] Empty state explains preview vs production.
- [ ] Generate shows a masked secret and scopes.
- [ ] Revoke asks for confirmation, then returns to empty.
- [ ] Endpoint stays `localhost:8787/mcp` for local preview.
- [ ] No copy that the agent can withdraw.

### Settings

- [ ] Chain ID 102031, Sepolia, Testnet only.
- [ ] Testnet workspace warning still present.
- [ ] Emergency pause uses `AlertDialog` and the same preview pause flag.
- [ ] Docs / Security / Testnet notes land here until real docs exist.

### Cross-cutting

- [ ] Keyboard only: tab through nav, open sheet, pause, save, revoke.
- [ ] 375, 768, 1440 viewports, no overlapping cards, no hidden nav without a replacement.
- [ ] Console has no 404 for favicon.
- [ ] No Glider assets, Selecta files, or mint marketing chrome.
- [ ] `page.tsx` no longer contains `$12,480` or the date eyebrow.
- [ ] `index.html` / `app.js` are gone, or the README states a single remaining fallback and a delete date.

---

## Out of scope

- Smart contracts, Foundry, worker, MCP server internals
- Real wallet signatures
- Live DEX quotes
- Inventing Attestcoin success
- Visual clones of Glider marketing or the unseen Glider app
- Light theme
- New destinations beyond the six nav items

When a later pass adds a real wallet or a real proof feed, replace preview state. Do not layer fake data on top of real data.
