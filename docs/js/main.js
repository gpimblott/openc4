/**
 * OpenC4 Documentation & Showcase Website Script
 * Lightweight, dependency-free script for theme toggling, tabbed guide navigation,
 * code snippet copying, and accessible interactions.
 */

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initGuideTabs();
  initCopyButtons();
});

/**
 * Dark / Light Mode Theme Toggling with LocalStorage & OS Preference Support
 */
function initThemeToggle() {
  const themeToggleBtn = document.getElementById("theme-toggle");
  if (!themeToggleBtn) return;

  const currentTheme = localStorage.getItem("openc4-theme") || 
    (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeToggleIcon(themeToggleBtn, currentTheme);

  themeToggleBtn.addEventListener("click", () => {
    const activeTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = activeTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("openc4-theme", nextTheme);
    updateThemeToggleIcon(themeToggleBtn, nextTheme);
  });
}

function updateThemeToggleIcon(btn, theme) {
  if (theme === "dark") {
    // Sun icon (click to switch to light)
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <line x1="12" y1="2" x2="12" y2="4"></line>
        <line x1="12" y1="20" x2="12" y2="22"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="2" y1="12" x2="4" y2="12"></line>
        <line x1="20" y1="12" x2="22" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
    btn.setAttribute("title", "Switch to light theme");
    btn.setAttribute("aria-label", "Switch to light theme");
  } else {
    // Moon icon (click to switch to dark)
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
    btn.setAttribute("title", "Switch to dark theme");
    btn.setAttribute("aria-label", "Switch to dark theme");
  }
}

/**
 * Documentation / Guide Tabs Navigation
 */
function initGuideTabs() {
  const tabs = document.querySelectorAll(".guide-tab-btn");
  const panes = document.querySelectorAll(".guide-pane");

  if (!tabs.length || !panes.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");

      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");

      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

/**
 * Copy Code Button Functionality with Visual Confirmation
 */
function initCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target");
      let text = "";

      if (targetId) {
        const el = document.getElementById(targetId);
        text = el ? el.innerText : "";
      } else {
        const codeBox = btn.closest(".code-box");
        if (codeBox) {
          const pre = codeBox.querySelector("pre");
          text = pre ? pre.innerText : "";
        }
      }

      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const originalContent = btn.innerHTML;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-emerald);">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color: var(--accent-emerald);">Copied!</span>
        `;
        btn.classList.add("copied");

        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.classList.remove("copied");
        }, 2000);
      } catch (err) {
        console.warn("Unable to copy to clipboard:", err);
      }
    });
  });
}
