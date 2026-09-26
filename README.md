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
5. Visit your Odoo.sh console, it should load dark immediately

The only permission requested is `storage`, used to remember whether dark
mode is on or off (see below). It still only runs on `*.odoo.sh` pages and
the `/odoo-sh/` webshell path.

After editing `content.js` or `manifest.json`, reload the extension in
`chrome://extensions` and then refresh the Odoo.sh tab. A `content.css`-only
edit just needs the tab refreshed.

## Enable/disable toggle

Click the extension's toolbar icon for a popup with a single button that
toggles dark mode on/off for the current tab, live, no reload needed. This
only affects whether the dark theme is applied. It doesn't touch Chrome's
own enable/disable state for the extension itself.

## What's covered

- **Branches**: top navbar, left branch-tree sidebar, stage headers, branch
  rows (active/hover/success/warning/error states), main branch panel header
  and tab bar, Clone/Fork/Merge/SSH/SQL/Submodule/Delete button bar, git
  command box, build/commit history timeline (including the connecting line
  between nodes), pagination
- **Builds**: status-colored cards (success/failed/warning/dropped) get a
  colored border ring plus a matching dark-tinted background, since Odoo's
  own status colors are fully covered by the card's opaque content
- **Settings** (both the branch-level and project-level pages): list groups
  (GitHub repo links, collaborator rows)
- **Status**: the alert banner, in all Bootstrap alert variants
  (success/danger/warning/info)
- **Shell**: the JupyterLab webshell background, which is served in an
  iframe from `<project>.dev.odoo.com/odoo-sh/webshell`
- Generic: buttons, form inputs/selects, cards, dropdowns, tooltips,
  scrollbars

## Out of scope

**Monitor**, **Logs**, **Backups**, **Upgrade** and **Tools** are not
covered, since they aren't used.

To add a page later, save it in Chrome with **File → Save Page As → Webpage,
Complete** (not just "copy outerHTML"). That keeps the linked CSS/JS files
next to the HTML, so a fix can target Odoo.sh's real stylesheet rules. If
Monitor's charts render as `<canvas>` (Chart.js-style), CSS alone can't
recolor them, because the library draws the colors into the pixels.

## Tuning colors

All colors are defined as CSS variables at the top of `content.css`
(`--sh-bg-0` through `--sh-bg-4`, `--sh-blue-dark`, `--sh-link`, etc.).
Change those to adjust the whole theme without hunting through every rule.
