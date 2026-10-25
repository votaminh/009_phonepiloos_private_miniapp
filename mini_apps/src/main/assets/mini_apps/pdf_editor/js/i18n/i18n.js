(function () {
  'use strict';
  // Chữ nằm trong res/strings.js ({ en, vi }); S() của SDK chọn ngôn ngữ (Pilo hoặc Lang.set).
  function format(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (_, key) { return vars && vars[key] !== undefined ? vars[key] : ''; });
  }
  function t(key, vars) { return format(S(key), vars); }
  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)); });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.setAttribute('title', t(el.dataset.i18nTitle)); });
    scope.querySelectorAll('[data-i18n-alt]').forEach(function (el) { el.setAttribute('alt', t(el.dataset.i18nAlt)); });
    document.documentElement.lang = Lang.get();
  }
  window.I18n = {
    get language() { return Lang.get(); },
    locale: function () { return Lang.get() === 'vi' ? 'vi-VN' : 'en-US'; },
    t: t,
    apply: apply,
    init: function () { apply(document); return Lang.get(); },
    setLanguage: function (value) {
      var result = Lang.set(value);
      apply(document);
      window.dispatchEvent(new CustomEvent('language:changed'));
      return result;
    }
  };
})();
