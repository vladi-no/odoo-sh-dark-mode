/**
 * Odoo.sh Dark Mode - dynamic patcher
 *
 * content.css handles the vast majority of the UI via Odoo.sh's own
 * classes. This script mops up two things CSS alone can't:
 *
 *   1. Elements that get an inline `style="background-color: ...; color: ..."`
 *      set directly by Odoo's JS (rare in the console pages we've seen so
 *      far, but common in embedded widgets like charts/terminals).
 *   2. Content injected after the page has finished loading (tooltips,
 *      dropdown menus, the Monitor/Logs/Shell tabs, which are loaded via
 *      AJAX navigation rather than full page reloads).
 *
 * It also owns the enable/disable toggle exposed by the popup: the
 * stylesheet is loaded here (rather than declared in the manifest) so it
 * can be added/removed live, and every inline-style tweak this script
 * makes is recorded so it can be undone on disable without a reload.
 */

(function () {
  "use strict";

  const DARK_BG = "#1c1f26";
  const DARK_BORDER = "#383d48";
  const LIGHT_TEXT = "#cfd3da";
  const BRIGHT_TEXT = "#e7e6e3";
  // Dark, desaturated tints of each status color, for the actual visible
  // content background of build cards and alerts (see FORCED_STYLES below).
  const STATUS_BG_SUCCESS = "#14301f";
  const STATUS_BG_FAILED = "#3a1418";
  const STATUS_BG_WARNING = "#3a2a0f";
  const STATUS_BG_DROPPED = "#2b2d33";
  const STATUS_BG_INFO = "#142a38";
  // Same softened accent colors as content.css's --sh-success/--sh-danger/
  // --sh-warning/--sh-info (kept as plain hex here too, rather than a var()
  // reference, so this still works even if content.css fails to load).
  const STATUS_TEXT_SUCCESS = "#4ade80";
  const STATUS_TEXT_FAILED = "#f87171";
  const STATUS_TEXT_WARNING = "#fbbf24";
  const STATUS_TEXT_INFO = "#60c5f1";
  const SKIP_TAGS = new Set(["IMG", "SVG", "CANVAS", "PATH", "SCRIPT", "STYLE", "IFRAME"]);
  const STYLE_ID = "odoo-sh-dark-mode-style";

  let enabled = true;

  // Records the pre-override value/priority of every inline style property
  // we touch, so disabling can restore exactly what was there before.
  const touched = new Map();

  function trackAndSet(el, prop, value, priority) {
    if (!touched.has(el)) touched.set(el, new Map());
    const propMap = touched.get(el);
    if (!propMap.has(prop)) {
      propMap.set(prop, {
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
      });
    }
    el.style.setProperty(prop, value, priority);
  }

  function revertTouched() {
    touched.forEach((propMap, el) => {
      propMap.forEach((orig, prop) => {
        if (orig.value) {
          el.style.setProperty(prop, orig.value, orig.priority);
        } else {
          el.style.removeProperty(prop);
        }
      });
    });
    touched.clear();
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    // Cache-bust: unlike the old manifest-declared css injection, this is a
    // normal HTTP-cacheable request, so without this the browser can keep
    // serving a stale content.css across page reloads after an edit.
    link.href = chrome.runtime.getURL("content.css") + "?v=" + Date.now();
    (document.head || document.documentElement).appendChild(link);
  }

  function removeStyle() {
    const link = document.getElementById(STYLE_ID);
    if (link) link.remove();
  }

  function setEnabled(next) {
    enabled = next;
    if (enabled) {
      injectStyle();
      sweep(document.body);
    } else {
      removeStyle();
      revertTouched();
    }
  }

  function parseRGB(value) {
    if (!value) return null;
    const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/i);
    if (!m) return null;
    return {
      r: +m[1],
      g: +m[2],
      b: +m[3],
      a: m[4] !== undefined ? parseFloat(m[4]) : 1,
    };
  }

  // Thresholds widened after checking Odoo.sh's actual stylesheet: its
  // default border color (#d8dadd = 216,218,221) fell just short of the old
  // >220 cutoff, and its default body text color (#374151 = 55,65,81) fell
  // way short of the old <45 "near black" cutoff, so both were slipping
  // through unconverted and rendering as low-contrast dark-on-dark or
  // light-ish-gray-on-dark. The alpha floor was also dropped to catch low-
  // opacity tints (e.g. a hover background at rgba(0,0,0,0.08)).
  function isNearWhite(rgb) {
    return !!rgb && rgb.a > 0.05 && rgb.r > 200 && rgb.g > 200 && rgb.b > 200;
  }

  function isNearBlack(rgb) {
    return !!rgb && rgb.a > 0.05 && rgb.r < 100 && rgb.g < 100 && rgb.b < 100;
  }

  // Inline styles set directly via JS (e.g. by chart/terminal widgets) that
  // getComputedStyle-based CSS overrides can't reach, since an inline
  // style attribute wins over an external stylesheet unless we also mark
  // ours !important, which we do here.
  function fixInlineStyle(el) {
    const style = el.style;
    if (!style || !style.length) return;

    const bg = parseRGB(style.backgroundColor);
    if (isNearWhite(bg)) {
      trackAndSet(el, "background-color", DARK_BG, "important");
    }

    const color = parseRGB(style.color);
    if (isNearBlack(color)) {
      trackAndSet(el, "color", LIGHT_TEXT, "important");
    }

    ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"].forEach((prop) => {
      const c = parseRGB(style[prop]);
      if (isNearWhite(c)) {
        trackAndSet(el, prop.replace(/([A-Z])/g, "-$1").toLowerCase(), DARK_BORDER, "important");
      }
    });
  }

  // Catches leftover near-white/near-black colors coming from the page's
  // own stylesheet that our class-based overrides in content.css didn't
  // anticipate (e.g. an unfamiliar widget on a page we haven't mapped yet).
  // Applied as an inline !important override, which always wins.
  function fixComputedStyle(el) {
    if (SKIP_TAGS.has(el.tagName)) return;
    const cs = window.getComputedStyle(el);

    const bg = parseRGB(cs.backgroundColor);
    if (isNearWhite(bg)) {
      trackAndSet(el, "background-color", DARK_BG, "important");
    }

    const color = parseRGB(cs.color);
    if (isNearBlack(color)) {
      trackAndSet(el, "color", LIGHT_TEXT, "important");
    }

    // Gating this on border-top-width used to skip the whole check for any
    // element whose top border happens to be 0 - which Bootstrap does on
    // purpose for adjacent .list-group-item siblings (border-top-width: 0,
    // to merge borders between rows), even though their left/right/bottom
    // borders are still full-width and the same near-white color. Setting
    // border-color when a side's width is actually 0 is harmless (nothing
    // renders there either way), so just always fix the color.
    const borderColor = parseRGB(cs.borderTopColor);
    if (isNearWhite(borderColor)) {
      trackAndSet(el, "border-color", DARK_BORDER, "important");
    }
  }

  // Hand-picked overrides, confirmed against Odoo.sh's actual shipped
  // stylesheet (paas_master.paas_app_assets.min.css) rather than guessed:
  //   - .o_branches_searchbar_icon (the icon's own container div, not the
  //     <i> inside it) gets an explicit background-color: #22262C from
  //     Odoo's own CSS - a dark-but-not-near-white/black shade our generic
  //     sweep would never flag, which read as a mismatched "square" once
  //     everything around it went to our own dark palette.
  //   - .o_sh_tracking_icon .gi gets color: #9a9ca5 from a rule that
  //     targets the icon element directly; a color set on an ancestor
  //     (e.g. .o_tracking_stage_change_box) only cascades by inheritance,
  //     which any direct same-element rule beats regardless of specificity.
  //   - .o_tracking_commit_url has no rule of its own in Odoo's CSS at all,
  //     so this is just belt-and-suspenders over the content.css rule.
  // Applied as inline styles via trackAndSet, which always wins over any
  // external stylesheet regardless of that stylesheet's specificity or
  // !important - and works even if content.css fails to load, since these
  // values are hardcoded here rather than referencing its CSS variables.
  const FORCED_STYLES = [
    [".o_branches_searchbar_icon", { "background-color": "transparent" }],
    [".o_branches_searchbar_icon i", { "background-color": "transparent", color: BRIGHT_TEXT }],
    [".o_branches_searchbar input.form-control", { "background-color": "transparent" }],
    [".o_tracking_commit_url", { "background-color": "transparent", color: BRIGHT_TEXT }],
    [".o_sh_tracking_icon .gi", { color: BRIGHT_TEXT }],
    [".o_tracking.shadow-lg", { "box-shadow": "none" }],
    [".o_sh_tracking_icon", { "box-shadow": "none" }],
    [".o_sh_tracking_icon *", { "box-shadow": "none" }],
    [".o_tracking_stage_change_box", { "box-shadow": "none" }],
    [".o_tracking_commit", { "box-shadow": "none", "border-color": DARK_BORDER }],
    [".o_tracking_commit i.gi-git-commit", { color: BRIGHT_TEXT, "background-color": "transparent" }],
    // Build status cards (Builds page): Odoo.sh's own status color
    // (.o_builds_card.o_success{background:#28a745} etc.) lives on the
    // OUTER card, but its .card-body/.o_card_footer children fully cover
    // it edge-to-edge with their own background - which itself gets
    // forced dark by this same script's generic sweep (fixComputedStyle),
    // via an inline style that no CSS rule could ever out-rank. So a
    // content.css fix can only ever color a background nobody sees; this
    // has to recolor the actual visible children, here, after the generic
    // sweep has already run (FORCED_STYLES entries apply last per element,
    // see sweep() below), so this wins the "last write" and sticks.
    [".o_builds_card.o_success .card-body", { "background-color": STATUS_BG_SUCCESS }],
    [".o_builds_card.o_success .o_card_footer", { "background-color": STATUS_BG_SUCCESS }],
    [".o_builds_card.o_failed .card-body", { "background-color": STATUS_BG_FAILED }],
    [".o_builds_card.o_failed .o_card_footer", { "background-color": STATUS_BG_FAILED }],
    [".o_builds_card.o_warning .card-body", { "background-color": STATUS_BG_WARNING }],
    [".o_builds_card.o_warning .o_card_footer", { "background-color": STATUS_BG_WARNING }],
    [".o_builds_card.o_dropped .card-body", { "background-color": STATUS_BG_DROPPED }],
    [".o_builds_card.o_dropped .o_card_footer", { "background-color": STATUS_BG_DROPPED }],
    // Bootstrap 5.3 "subtle" alert tokens (e.g. .alert-success's --alert-bg
    // resolves to #d4edda, a pastel green) are pastel-but-still-near-white,
    // so the generic sweep correctly but unhelpfully flattens every alert
    // variant (success/danger/warning/info) to the same plain dark - same
    // failure mode as the build cards, fixed the same way. The "* " entries
    // are needed because descendants (the check icon, the message text)
    // each get their own independent near-black-text fix from the generic
    // sweep too, as plain neutral gray, overriding what they'd otherwise
    // have inherited from the parent's color here.
    [".alert-success", { "background-color": STATUS_BG_SUCCESS, color: STATUS_TEXT_SUCCESS }],
    [".alert-success *", { color: STATUS_TEXT_SUCCESS }],
    [".alert-danger", { "background-color": STATUS_BG_FAILED, color: STATUS_TEXT_FAILED }],
    [".alert-danger *", { color: STATUS_TEXT_FAILED }],
    [".alert-warning", { "background-color": STATUS_BG_WARNING, color: STATUS_TEXT_WARNING }],
    [".alert-warning *", { color: STATUS_TEXT_WARNING }],
    [".alert-info", { "background-color": STATUS_BG_INFO, color: STATUS_TEXT_INFO }],
    [".alert-info *", { color: STATUS_TEXT_INFO }],
  ];

  function fixForcedStyles(el) {
    if (!el.matches) return;
    for (const [selector, styles] of FORCED_STYLES) {
      if (el.matches(selector)) {
        for (const prop in styles) {
          trackAndSet(el, prop, styles[prop], "important");
        }
      }
    }
  }

  function sweep(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      fixInlineStyle(root);
      fixComputedStyle(root);
      fixForcedStyles(root);
    }
    if (!root.querySelectorAll) return;
    root.querySelectorAll("*").forEach((el) => {
      fixInlineStyle(el);
      fixComputedStyle(el);
      fixForcedStyles(el);
    });
  }

  function run() {
    if (enabled) sweep(document.body);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // Odoo.sh's tabs (History / Shell / Monitor / Logs / ...) and tooltips /
  // dropdowns are injected dynamically without a full navigation, so keep
  // watching for new nodes. We only react to added nodes (not attribute
  // changes), so our own style.setProperty calls above never re-trigger
  // this observer - no infinite loop risk. Kept observing even while
  // disabled (cheap) so re-enabling doesn't need a page reload.
  let pending = false;
  const observer = new MutationObserver((mutations) => {
    if (!enabled || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            sweep(node);
          }
        });
      }
    });
  });

  const start = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      requestAnimationFrame(start);
    }
  };
  start();

  // Enable/disable toggle, driven by the popup via chrome.storage.
  chrome.storage.local.get({ enabled: true }, (data) => {
    setEnabled(data.enabled !== false);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "enabled" in changes) {
      setEnabled(changes.enabled.newValue !== false);
    }
  });
})();
