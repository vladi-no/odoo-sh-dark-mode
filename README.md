# Odoo.sh Dark Mode (custom Chrome extension)

A hand-tuned dark theme for the Odoo.sh management console, built by
targeting Odoo.sh's actual CSS classes (`sh-bg-blue-dark`, `sh-bg-blue`,
`bg-white`, `bg-100/200/300`, Bootstrap 5 components, etc.) instead of
relying on a generic filter/invert like Dark Reader.

## Install (unpacked, for personal use)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select this folder (`odoo-sh-dark-mode`)
5. Visit your Odoo.sh console — it should load dark immediately

The only permission requested is `storage`, used to remember whether dark
mode is on or off (see below). It still only runs on `*.odoo.sh` pages.

After editing `content.js` or `manifest.json`, reload the extension in
`chrome://extensions` and then refresh the Odoo.sh tab. A `content.css`-only
edit just needs the tab refreshed.

## Enable/disable toggle

Click the extension's toolbar icon for a popup with a single button that
toggles dark mode on/off for the current tab, live, no reload needed. This
only affects whether the dark theme is applied - it doesn't touch Chrome's
own enable/disable state for the extension itself.

## What's covered

Confirmed working (checked against real page HTML, not just guessed):
- **Branches** — top navbar, left branch-tree sidebar, stage headers, branch
  rows (active/hover/success/warning/error states), main branch panel header
  and tab bar, Clone/Fork/Merge/SSH/SQL/Submodule/Delete button bar + git
  command box, build/commit history timeline (including the connecting line
  between nodes), pagination
- **Builds** — status-colored cards (success/failed/warning/dropped) get a
  colored border ring plus a matching dark-tinted background, since Odoo's
  own status colors get fully covered by the card's own opaque content
- **Settings** (both the branch-level and project-level pages) — list groups
  (GitHub repo links, collaborator rows)
- **Status** — the alert banner (all Bootstrap alert variants: success/
  danger/warning/info), which had the same washed-out-color problem as the
  Builds cards and is fixed the same way
- Generic: buttons, form inputs/selects, cards, dropdowns, tooltips,
  scrollbars

## Out of scope

**Monitor**, **Shell**, **Logs**, **Backups**, **Upgrade**, **Tools** are
intentionally not covered - not used, so not worth the maintenance cost of
fixing pages nobody looks at. If that changes, the most reliable way to fix
a page: in Chrome, **File → Save Page As → Webpage, Complete** (not just
"copy outerHTML") - that saves the actual linked CSS/JS files alongside the
HTML, which is what let every fix in this repo target Odoo.sh's real
stylesheet rules instead of guessing at what might be overriding them. Worth
noting for Monitor specifically: if its charts render as `<canvas>`
(Chart.js-style), the chart itself won't recolor from CSS alone regardless -
the library bakes colors into the pixels.

## Tuning colors

All colors are defined as CSS variables at the top of `content.css`
(`--sh-bg-0` through `--sh-bg-4`, `--sh-blue-dark`, `--sh-link`, etc.).
Change those to adjust the whole theme without hunting through every rule.
