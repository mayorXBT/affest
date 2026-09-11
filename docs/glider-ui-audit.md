# Affest UI audit vs Glider public product

Date: 2026-09-08
Scope: read-only. No redesign was implemented.
Local app: http://localhost:3000 (static `index.html` + `app.js` + `app/globals.css`)
Public Glider: https://glider.fi/ and https://docs.glider.fi/
Annotated review image: the supplied screenshot marked "Affest not affest", "remove this", "remove this dent", "why are they not responding", "use shadcn UI components", "why demo numbers"

## How this was inspected

Confirmed from source:

- `apps/web/index.html`
- `apps/web/app.js`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/package.json`
- `apps/web/server.mjs`
- `apps/web/README.md`

Confirmed in a real Chromium session against `http://localhost:3000`, including clicks on every nav item and the visible actions. Desktop 1440x900, tablet 768x1024, mobile 375x812. Screenshots live in `docs/audit-screenshots/`.

Glider was inspected only on public pages. I did not sign in.

gstack's own browse daemon could not start in this Windows repo (`.gstack` ACL lock). Screenshots were taken with Chrome 152 via puppeteer-core instead. Same pages, same clicks.

## The important split

There are two Affest UIs in this repo. They do not match.

**Live dashboard (what localhost:3000 actually serves).** `server.mjs` serves `index.html` + `app.js`. Brand is `Affest`. Title is `Overview`. Balances are `12,480 test units` with a `PREVIEW DATA` chip. Wallet connect is labelled `Preview wallet connected`. Sidebar nav switches real views. This is the product a reviewer can click today.

**Next source (what the annotated screenshot is about).** `app/page.tsx` is a single-page React mock. It has `Good morning, operator.`, a date eyebrow `Tuesday, 08 September 2026 · testnet`, `$12,480.00`, and a `DEMO BALANCE` chip. Nav buttons only set `activeNav`. They do not change the page. `package.json` has no Next, React, or shadcn dependencies, so this file is not what `pnpm --filter @affest/web dev` runs.

The annotated screenshot is the Next mock (or a near copy of it), not the live static app. Several red notes are already true of `page.tsx` and already false of `app.js`. An engineer who "fixes the screenshot" against the wrong file will ship a regression.

Do not copy Glider. Affest is a verification-first operator console. Glider's public marketing is a consumer investing site. Those are different jobs.

---

## 1. Typography

### Confirmed facts

| Role | Affest live | Computed |
| --- | --- | --- |
| Body / UI | Manrope, system-ui, sans-serif | 16px / 400 / normal leading |
| Brand wordmark | Manrope 800 | 20px, letter-spacing -0.8px |
| Page title | Manrope 600 | 28px desktop, 22px at 640px, tracking about -0.05em |
| Card title | Manrope 600 | 18px, tracking -0.04em |
| Balance | Manrope 600 | 41px, tracking about -0.07em |
| Labels / chips / chain IDs | DM Mono | 9px, letter-spacing 0.12em to 0.13em, often uppercase |
| Strategy body | Manrope | 12px, line-height 1.65 |
| Footer | DM Mono | 9px |

Fonts load from Google Fonts in `globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
```

Glider marketing (`https://glider.fi/`):

- Body and H1 font-family is `Selecta`, served from `https://cdn.glider.fi/fonts/selecta/`.
- H1 computed: Selecta, 38px, weight 400.
- Mono stack in their CSS: `Paper Mono, Favorit Mono, ui-monospace, ...`
- Selecta files exist at thin/light/regular/medium/bold/black, roman and italic.

Glider docs (`https://docs.glider.fi/`): Mintlify chrome, dark theme, green accent, sentence-case docs voice. This is a docs skin, not the product app.

### Visual inferences

Affest type is an operator console: small mono labels, tight tracking on the wordmark, a big number, then quiet body copy. That is closer to a trading terminal than to Glider's marketing.

Glider marketing type is a consumer brand. Light weight display, generous size, sentence-case headlines (`Investing that works for you.`). The wordmark is `GLIDER` in wide tracking. Do not take that.

Manrope vs Selecta is already a real difference. Keep it.

### Unknowns

- Selecta and Favorit/Paper Mono licensing. They are hosted on Glider's CDN. Treat them as proprietary. Do not download or subset them.
- Product-app type inside a signed-in Glider session. Not observed.

### Brand casing and tone

Live wordmark is `Affest` (capital A). The annotated note "Affest not affest" is already true on localhost. Keep title case `Affest` everywhere, including the diamond mark + wordmark pair.

Live page titles are title case (`Overview`, `Portfolio overview`, `Strategies`). Body copy is sentence case and specific. Eyebrow labels are uppercase mono (`ACTIVE STRATEGY`, `CROSS-CHAIN PROOF RAIL`). That hierarchy is good. Do not add `Good morning, operator.` It is not in the live app, it is in `page.tsx`, and the annotated screenshot asked to remove the date chip above it.

Tagline to keep, exactly:

> Verified cross-chain automation for self-driving portfolios.

---

## 2. Visual system

### Confirmed facts (Affest)

From `:root` and computed styles on localhost:

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#0d1012` | page background |
| sidebar | `#0b0e10` | darker rail |
| `--ink-2` | `#151a1d` | cards / panels |
| `--ink-3` | `#1c2326` | unused in most views |
| `--line` | `#2b3438` | card border |
| `--paper` | `#f1efe7` | primary text (warm, not pure white) |
| `--muted` | `#8f9a9b` | secondary text |
| `--lime` | `#d6f26a` | accent, primary button, positive |
| `--lime-2` | `#a9c440` | eyebrow accent |
| `--amber` | `#f5b96a` | waiting / paused |
| `--blue` | `#8b9bff` | proof / agent |

Surfaces are flat. `box-shadow` is `none` on body, cards, and the wallet button. Depth comes from 1px borders and a one-step background lift.

Radius: nav 7px, buttons 7px, cards 10px, chips 3 to 4px, inputs 6px, avatars 50%.

Spacing is not a named scale. Recurring numbers: 4, 6, 8, 9, 10, 11, 12, 14, 15, 17, 18, 22, 23, 24, 28, 35, 45. Grid gap is 14px. Sidebar is 236px CSS, 231px computed at 1440.

Icons: live static app uses text glyphs (`+`, `Ⅱ`, `✓`, `✦`, `◈`). `page.tsx` imports lucide-react. The two files do not share an icon system.

Charts: CSS sparkline (11 gradient bars, hardcoded heights) and a `conic-gradient` donut (lime 62%, `#546cbe` 38%). No chart library. No live series.

### Confirmed facts (Glider public)

Marketing page background in the screenshot is mint (`#e7f6ea` range), not the dark docs theme. Body background from the rendered DOM was `rgb(31, 31, 31)` at capture time because the hero sits on a dark document with a mint section. Treat the hero as mint, the docs as near-black.

Public CSS hexes that show up often: `#f5f5f7`, `#fcfcfd`, `#101010`, `#1f1f1f`, `#64f5a9`, `#05c600`, plus Tailwind defaults (`#3b82f6`, `#22c55e`). Radius includes 100px pills and 32px hero chips. One real shadow: inset highlight plus `0 2px 2px rgba(0,0,0,.12)`.

Glider docs: dark mintlify, green active nav, 12px-ish cards, search in the header, `Glider App` CTA top-right.

### Visual inferences

Affest already has a face: warm off-white on near-black, chartreuse lime, no glow, no purple gradient. That is enough. Do not "Glider-ify" it with mint, 3D renders, or pill nav.

The live active nav is a filled rounded rect `#1b2424`. There is no clip-path dent in current CSS. The annotated "remove this dent" matches an older mock, not localhost today. Do not add a notch.

### Unknowns

- Glider signed-in dashboard colors, charts, and card chrome. `https://app.glider.fi/` returned Cloudflare 1000 / HTTP 403 ("DNS points to prohibited IP"). Not a login wall I could screenshot. I did not attempt Sign in on glider.fi.

---

## 3. Layout

### Sidebar and header (Affest live)

Left rail: diamond mark, `Affest`, Creditcoin CC3 / Testnet chip, six nav buttons, "Non-custodial by design", "Read the safety guide", testnet wallet row.

Top bar: page title + subtitle on the left, lime `Connect wallet` on the right. No date. No `Good morning, operator.`

Footer: `Affest · verified cross-chain automation` plus Docs / Security / Testnet notes, all of which currently jump to Settings.

At `max-width: 900px` the main grids collapse to one column and the sidebar shrinks to 190px.

At `max-width: 640px` the shell becomes a column, and `.network-chip`, `.sidebar-bottom`, and `.nav-list` are `display: none`. Mobile has no navigation. Confirmed at 375px. This is a product hole, not a polish issue.

Tablet 768px still shows the sidebar. Useable, tight.

### Pages that exist in `app.js` (and work)

| Nav | What you get |
| --- | --- |
| Overview | Connect banner, testnet status, value card, allocation donut, active strategy, proof rail, activity, agent teaser |
| Portfolio | Three metric cards, holdings list (ASTB / ARSK demo tokens), target bar, on-chain guardrail note |
| Strategies | Natural-language textarea, generated rules, security review, save draft |
| Activity | All / Proofs / Actions tabs (visual only), three static rows |
| Agents | MCP copy, preview credential create/revoke, localhost:8787/mcp details |
| Settings | Chain ID 102031, Sepolia, testnet chip, proof/calldata flags, emergency pause, testnet workspace warning |

### `page.tsx` layout

One Overview composition. Nav highlight changes. Content does not. Activity, Agents, Settings, Portfolio, Strategies are not pages in that file.

### Glider public layout (what we can see)

Marketing: floating pill nav (`Explore`, `For Developers`, `Blog`, `Sign in`), huge 3D toggle, `Build your portfolio`. Mobile keeps the pill nav and stacks the CTA under the render.

Docs: three-column docs shell. Left: Get Started, B2B, strategy provider/distributor guides. Center: article. Right: on-this-page. This is Mintlify, not the investor app.

Public writeups (YouTube walkthrough, Bankless, Glider security docs) describe a signed-in app with: sidebar Portfolios / Create / Explore, an overview with performance graph and token mix, a visual block editor, preset portfolios, deposit, pause/start automation. I did not see that UI myself.

### Unknowns

- Exact Glider dashboard grid, card set, and mobile nav.
- Whether Glider still uses a block editor in the current app.

---

## 4. Components

Neither surface uses shadcn/ui or Radix. Live `package.json` has no UI dependencies. `page.tsx` imports lucide-react, which is not installed in `apps/web/package.json`.

Needed mapping (implement in the spec, not here):

| Affest control | shadcn / Radix |
| --- | --- |
| Connect / Save / Generate | `Button` |
| Pause / Resume | `Button variant="outline"` |
| Emergency pause / Revoke | `Button variant="destructive"` plus `AlertDialog` |
| Cards / panels | `Card` |
| PREVIEW DATA, Testnet, Waiting, Draft | `Badge` |
| Activity All / Proofs / Actions | `Tabs` |
| Edit strategy, activate, safety guide | `Dialog` |
| Mobile nav | `Sheet` |
| Truncated addresses, proof steps | `Tooltip` |
| Network chip, wallet row | `DropdownMenu` |
| Connect banner, testnet workspace | `Alert` |
| Allocation vs target | `Progress` |
| Holdings, activity, settings rows | `Table` or definition rows |
| Strategy textarea, future wallet fields | `Textarea`, `Input`, `Label`, `Select`, `Switch` |
| Save / pause / revoke feedback | `sonner` toast |
| First load, chain reads | `Skeleton` |
| No agents, disconnected, no proofs | empty state in `Card` |
| Revoke credential, emergency pause | `AlertDialog` |

---

## 5. Product behavior

Clicked on localhost:3000. Results:

| Control | Live static app | Next `page.tsx` |
| --- | --- | --- |
| Navigation | Works. All six views render. | Broken. `setActiveNav` only. |
| Wallet connect | Toggles a local preview. Label becomes `Preview wallet connected`. Sidebar `Preview · 0x71…b3a8`. | Toggles `0x71…b3a8` with no preview label. |
| Pause / resume | Works. Button flips Pause / Resume. Pill copy follows. Local state only, not chain. | Works on the one Overview card. Local state only. |
| Strategy editing | `Edit strategy` routes to Strategies. Textarea is editable. `Save deterministic draft` becomes `Saved locally`. No parser, no chain submit. | `Edit strategy` has no handler. |
| Strategy creation | One hard-coded "Signal Balanced" draft. No create-new flow. `Activate after review` just goes to Overview. | Missing. |
| Agent credential | Generate / revoke work as local preview. Masked `aff_••••`. Scopes shown. No confirm on revoke. | `Connect an agent` has no handler. |
| Activity filtering | Three tabs. Clicking Proofs / Actions does not change the list or the active tab. | `See all` has no handler. |
| Proof lifecycle | Static four-step rail. Source is `done`, attestation `waiting`. Dismiss X has no handler. | Same static rail. Dismiss has no handler. |
| Approval states | Copy says hybrid / user approved. No signing UI. | Same. |
| Error states | None. Failed RPC, rejected tx, expired proof: not designed. | None. |
| Wrong-network | None. | None. |
| Mobile navigation | Hidden. No substitute. | Same CSS, so also hidden. |
| Help / footer | Routes to Settings. | Anchors do nothing. |
| Network chip | Not a menu. | Shows a chevron, not a menu. |

Console on localhost: one 404 (no favicon). No JS exception on the flows above.

Pause on Settings shares the same `state.paused` as Overview. Clicking Emergency pause after a prior Pause correctly flips back. Still local.

---

## 6. Trust and testnet clarity

The live static app is more honest than the Next mock. It still over-promises in a few places.

### Could read as real money or live execution

| Surface | Risk | Live today | Next mock |
| --- | --- | --- | --- |
| Portfolio value | Fake USD | `12,480 test units` + `PREVIEW DATA`. Still a confident big number before connect. | `$12,480.00` + `DEMO BALANCE`. This is the annotated complaint. |
| Sparkline | Looks like performance | Hard-coded rising bars. Caption says `sample movement`. The chart still reads as a gain. | Same pattern. |
| Allocation 62 / 38 | Looks like a live vault | Shown even when `Not connected`. | Same. |
| `Proof-gated automation ready` | Sounds production | Status row on Overview. | `Proof-gated automation is on`. |
| Proof step 1 `Receipt confirmed` | Sounds like Attestcoin already ran | Static `done` state. | Same. |
| `Guardrails are enforced on-chain` | Sounds deployed | Portfolio page. Architecture docs say live deploy is pending. | Status says `Contracts deployed · permissions pending` in source, while the annotated image says `Contracts not deployed yet`. Two lies in two directions. |
| Wallet `0x71…b3a8` | Looks connected | Live labels it `Preview`. | No preview word. |
| Pause | Looks like a chain pause | Local boolean. | Local boolean. |
| Agent credential | Looks like MCP issued a secret | Live labels `local preview credential`. | Button does nothing. |
| Holdings ASTB / ARSK | Looks like tokens in a vault | Caption says allowlisted demo token. | Not a separate page. |

Do not remove testnet warnings. The Settings `Testnet workspace` note is the right voice. Overview should use that voice before it shows a number.

### What Glider does (public docs, not the app)

Glider's security doc is clear about layers: user owner, session key, Glider automation, assets in a smart account. Start/stop automation is a real API (`/start`, `/stop`). Withdrawals need a fresh signature. Affest should be at least that explicit, with the extra Affest constraint: no execution without a verified Attestcoin proof.

Do not copy Glider's session-key copy. Affest's gate is the proof, not a ZeroDev session key.

---

## 7. Screenshot comparison

Files in `docs/audit-screenshots/`.

### Annotated screenshot vs live vs Next

| Note on the image | Live localhost | `page.tsx` | Do this |
| --- | --- | --- | --- |
| Affest not affest | Already `Affest` | Already `Affest` | Keep title case. Audit any future lowercase lockup. |
| Remove the date chip | Not present | Present | Do not port the date or `Good morning, operator.` into the live app. |
| Remove the dent | No dent. Filled rounded rect. | No dent in CSS | Do not add a notch. Keep a quiet selected state. |
| Nav not clickable | Clickable, six real pages | Not clickable | Port `app.js` views into the Next tree. Do not "rebuild" pages that already exist in `app.js`. |
| Use shadcn | None | None | Add shadcn on the Next path. See `docs/ui-spec.md`. |
| Why demo numbers | `test units` + `PREVIEW DATA` | `$12,480.00` | Never render USD. Hide the hero number until a real read exists. Disconnected state should be empty, not a sample vault. |

### Affest live, desktop Overview

Dark operator console. Lime connect button. Preview banner. Donut + sparkline. Strategy and proof cards. This is the identity to keep.

Problems visible in the shot: sample number still dominates, sparkline still climbs, proof step 1 is pre-checked, mobile-unaware density.

### Affest live, mobile Overview

Brand + connect remain. Sidebar nav is gone. A phone user cannot reach Portfolio, Strategies, Activity, Agents, or Settings.

### Affest live, other pages

Portfolio, Strategies, Activity, Agents, Settings all render and match `app.js`. Strategies `Draft` chip stretches into a tall empty bar (flex stretch on `.builder-head`). Activity is a short list in a tall void. Filters do not filter.

### Glider public marketing

Mint, 3D, pill nav, `Investing that works for you.`, `Trusted by 100,000+ investors`. Consumer brand. Not a control room. Do not borrow layout, 3D, mint, or claims.

### Glider docs

Dark docs site. Useful for IA language (portfolio, strategy, automation, pause) and for the authority model. Not a visual source for Affest cards.

### Glider app

Not available. Cloudflare 1000 on `app.glider.fi`. Sign-in on the marketing site was not used.

---

## Prioritized recommendations

### P0

1. Treat `app.js` as the behavior source of truth and `page.tsx` as a stale mock. Stop shipping two different products in one folder.
2. Keep `Affest` title case. Do not introduce lowercase lockups.
3. Do not add the date eyebrow or `Good morning, operator.`
4. Do not add a sidebar dent.
5. Never show `$` balances. Keep `test units` or show an empty/unavailable state.
6. Do not show a filled vault, sparkline, or `Receipt confirmed` while disconnected or while Attestcoin has not actually confirmed.
7. Build a mobile nav (`Sheet`). Do not hide `.nav-list` without a replacement.
8. Make Activity tabs filter, or remove them.
9. Label every local simulation `Preview` (wallet, pause, save, credential). The static app mostly does. `page.tsx` does not.

### P1

1. Adopt shadcn/Radix with Affest tokens. No default shadcn zinc-on-white, no Inter.
2. Fix the stretched `Draft` chip.
3. Add `AlertDialog` for revoke and emergency pause.
4. Add wrong-network and disconnected empty states.
5. Visible focus rings. 9px body text fails a comfortable reading size. Bump labels to 11px and body to 13 to 14px.
6. One icon set (Lucide). Retire the `+ / Ⅱ / ✦` glyphs.
7. Favicon, so the 404 goes away.
8. Make "Activate after review" open a review dialog, not a silent hop to Overview.

### P2

1. Real chart only after a real series. Until then, no sparkline.
2. Wallet adapter, clearly testnet, no fake address.
3. Wire pause/resume to the actual strategy pause once contracts exist. Until then, keep the preview label.
4. Activity row click targets currently go nowhere.

---

## What to copy from Glider, and what not to

Copy the job, not the face.

Take:

- A sidebar that owns real destinations.
- Pause / resume as a first-class control.
- Allocation as its own readable view.
- Start/stop language that matches a real state machine.
- Honest empty vs funded states (described in public walkthroughs; not screenshotted).

Do not take:

- Selecta, Favorit, Paper Mono
- Mint marketing, 3D hero, pill nav
- `GLIDER` lockup or `Build your portfolio`
- Session-key / smart-account copy verbatim
- Block editor, unless Affest actually builds one
- Any Glider screenshot layout pixel-for-pixel
- USD TVL theater

Affest's wedge is the proof rail. Glider's wedge is consumer automation. If Affest looks like Glider, it throws away the only thing it can say that Glider cannot: nothing moves until Creditcoin verifies Attestcoin.

---

## Evidence index

| File | What it shows |
| --- | --- |
| `docs/audit-screenshots/affest-overview-desktop.jpg` | Live Overview |
| `docs/audit-screenshots/affest-overview-connected.jpg` | Preview wallet connected |
| `docs/audit-screenshots/affest-overview-mobile.jpg` | Nav missing |
| `docs/audit-screenshots/affest-overview-tablet.jpg` | Sidebar still present |
| `docs/audit-screenshots/affest-portfolio-desktop.jpg` | Holdings + target |
| `docs/audit-screenshots/affest-strategies-desktop.jpg` | Builder + stretched Draft chip |
| `docs/audit-screenshots/affest-activity-desktop.jpg` | Static feed |
| `docs/audit-screenshots/affest-agents-desktop.jpg` | Preview credential CTA |
| `docs/audit-screenshots/affest-settings-desktop.jpg` | Testnet warning, emergency pause |
| `docs/audit-screenshots/glider-home-desktop.jpg` | Public marketing |
| `docs/audit-screenshots/glider-home-mobile.jpg` | Public marketing mobile |
| `docs/audit-screenshots/glider-docs-home.jpg` | Public docs |
| `docs/audit-screenshots/glider-app-wall.jpg` | app.glider.fi unavailable |
| `docs/audit-screenshots/affest-computed-styles.json` | Computed CSS |
| `docs/audit-screenshots/affest-behavior.json` | Click results |

Implementation plan: `docs/ui-spec.md`
Tokens: `apps/web/design-tokens.json`
