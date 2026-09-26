/**
 * Odoo.sh Dark Mode: dynamic patcher
 *
 * content.css handles most of the UI via Odoo.sh's own classes. This
 * script covers two things CSS alone can't:
 *
 *   1. Elements with an inline `style="background-color: ...; color: ..."`
 *      set by Odoo's JS (mostly embedded widgets like charts/terminals).
 *   2. Content injected after page load (tooltips, dropdown menus, and the
 *      tabs that are loaded via AJAX navigation instead of a full reload).
 *
 * It also owns the popup's enable/disable toggle. The stylesheet is loaded
 * here instead of in the manifest so it can be added/removed live, and
 * every inline-style change is recorded so it can be undone on disable
 * without a reload.
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
  // Same accent colors as content.css's --sh-success/--sh-danger/
  // --sh-warning/--sh-info, as plain hex so they work even if content.css
  // fails to load.
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
    // Cache-bust: this is a normal HTTP-cacheable request, so without it the
    // browser can keep serving a stale content.css after an edit.
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

  // Thresholds are set to catch Odoo.sh's default border color
  // (#d8dadd = 216,218,221) and default body text color (#374151 = 55,65,81).
  // The low alpha floor also catches faint tints such as a hover background
  // at rgba(0,0,0,0.08).
  function isNearWhite(rgb) {
    return !!rgb && rgb.a > 0.05 && rgb.r > 200 && rgb.g > 200 && rgb.b > 200;
  }

  function isNearBlack(rgb) {
    return !!rgb && rgb.a > 0.05 && rgb.r < 100 && rgb.g < 100 && rgb.b < 100;
  }

  // Inline styles set via JS (e.g. by chart/terminal widgets). An inline
  // style attribute beats an external stylesheet, so these are overridden
  // with inline !important values.
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

  // Catches near-white/near-black colors from the page's own stylesheet
  // that the class-based rules in content.css don't cover (e.g. a widget on
  // an unmapped page). Applied as an inline !important override.
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

    // Not gated on border width: Bootstrap sets border-top-width: 0 on
    // adjacent .list-group-item rows while their other sides still have a
    // near-white border. Setting a color on a zero-width side is harmless.
    const borderColor = parseRGB(cs.borderTopColor);
    if (isNearWhite(borderColor)) {
      trackAndSet(el, "border-color", DARK_BORDER, "important");
    }
  }

  // Targeted overrides, based on Odoo.sh's shipped stylesheet
  // (paas_master.paas_app_assets.min.css):
  //   - .o_branches_searchbar_icon (the container div, not the <i> inside)
  //     has background-color: #22262C, a shade the generic sweep doesn't
  //     flag, which shows up as a mismatched square on the dark palette.
  //   - .o_sh_tracking_icon .gi has color: #9a9ca5 set on the icon itself,
  //     so a color on an ancestor can't override it by inheritance.
  //   - .o_tracking_commit_url has no rule in Odoo's CSS; this backs up the
  //     content.css rule.
  // Applied as inline styles via trackAndSet, which beat any external
  // stylesheet. The values are hardcoded so they work even if content.css
  // fails to load.
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
    // Build status cards (Builds page): Odoo.sh puts the status color
    // (.o_builds_card.o_success{background:#28a745} etc.) on the outer card,
    // but the .card-body/.o_card_footer children cover it completely, and
    // the generic sweep forces their background dark with an inline style.
    // So the visible children are tinted here instead. FORCED_STYLES apply
    // after the generic sweep for each element (see sweep()), so they win.
    [".o_builds_card.o_success .card-body", { "background-color": STATUS_BG_SUCCESS }],
    [".o_builds_card.o_success .o_card_footer", { "background-color": STATUS_BG_SUCCESS }],
    [".o_builds_card.o_failed .card-body", { "background-color": STATUS_BG_FAILED }],
    [".o_builds_card.o_failed .o_card_footer", { "background-color": STATUS_BG_FAILED }],
    [".o_builds_card.o_warning .card-body", { "background-color": STATUS_BG_WARNING }],
    [".o_builds_card.o_warning .o_card_footer", { "background-color": STATUS_BG_WARNING }],
    [".o_builds_card.o_dropped .card-body", { "background-color": STATUS_BG_DROPPED }],
    [".o_builds_card.o_dropped .o_card_footer", { "background-color": STATUS_BG_DROPPED }],
    // Alerts: Bootstrap 5.3's "subtle" alert backgrounds (e.g. #d4edda for
    // .alert-success) count as near-white, so the generic sweep would turn
    // every variant the same plain dark. Handled like the build cards. The
    // "*" entries are needed because the sweep also gives descendants (icon,
    // message text) their own neutral gray, which would hide the parent's
    // color.
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
  // dropdowns are injected without a full navigation, so keep watching for
  // new nodes. Only added nodes are observed (not attribute changes), so
  // the style.setProperty calls above never re-trigger the observer. It
  // keeps running while disabled so re-enabling doesn't need a reload.
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
