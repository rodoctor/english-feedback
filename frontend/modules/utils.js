/**
 * Utilities Module
 * Common helper functions used across the app
 */

const Utils = (() => {
  // DOM helpers
  const el = (id) => document.getElementById(id);
  const elOrNull = (id) => document.getElementById(id);

  const escapeHtml = (text) => text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatMinutes = (minutes) => `${Number(minutes || 0).toFixed(1)} min`;

  const renderInlineMarkdown = (text) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  const renderMarkdown = (markdown) => {
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let listType = null;
    let listItems = [];

    const flushList = () => {
      if (!listType || !listItems.length) return;
      html.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${listType}>`);
      listType = null;
      listItems = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        continue;
      }

      const heading = line.match(/^(#{2,4})\s+(.+)$/);
      if (heading) {
        flushList();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (listType !== 'ul') flushList(), listType = 'ul';
        listItems.push(renderInlineMarkdown(bullet[1]));
        continue;
      }

      const numbered = line.match(/^\d+\.\s+(.+)$/);
      if (numbered) {
        if (listType !== 'ol') flushList(), listType = 'ol';
        listItems.push(renderInlineMarkdown(numbered[1]));
        continue;
      }

      flushList();
      html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }

    flushList();
    return html.join('');
  };

  const uniqueHashtags = (items) => [...new Set(items.filter(Boolean))].sort();

  const showToast = (message, status = 'pending') => {
    const toast = document.getElementById('appToast');
    if (!toast) return;
    clearTimeout(window.appToastTimer);
    toast.className = `app-toast ${status}`;
    toast.textContent = message;
    toast.classList.add('visible');
    window.appToastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2200);
  };

  const setStatus = (text) => {
    const statusEl = el('saveStatus');
    if (statusEl) statusEl.textContent = text;
  };

  const clearFieldErrors = (fieldIds) => {
    fieldIds.forEach((id) => {
      const elem = el(id);
      if (!elem) return;
      elem.classList.remove('input-error');
      const errorMsg = elem.parentElement?.querySelector('.error-message');
      if (errorMsg) errorMsg.remove();
    });
  };

  const showFieldError = (elementId, message) => {
    const elem = el(elementId);
    if (!elem) return;
    elem.classList.add('input-error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    elem.parentElement.appendChild(errorDiv);
  };

  return {
    el,
    elOrNull,
    escapeHtml,
    formatMinutes,
    renderInlineMarkdown,
    renderMarkdown,
    uniqueHashtags,
    showToast,
    setStatus,
    clearFieldErrors,
    showFieldError,
  };
})();
