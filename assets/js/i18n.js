const translations = {};

async function loadLocale(lang) {
  if (translations[lang]) return translations[lang];
  const res = await fetch(`assets/locales/${lang}.json`);
  if (!res.ok) return {};
  translations[lang] = await res.json();
  return translations[lang];
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function applyTranslations(dict) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getByPath(dict, key);
    if (value !== undefined) el.textContent = value;
  });
}

async function setLanguage(lang) {
  const dict = await loadLocale(lang);
  applyTranslations(dict);
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  const sel = document.getElementById('langSwitcher');
  if (sel) sel.value = lang;
  const frame = document.querySelector('iframe[name="content"]');
  if (frame && frame.contentWindow) {
    frame.contentWindow.location.reload();
  }
}

window.i18n = { applyTranslations };

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('langSwitcher');
  const savedLang = localStorage.getItem('lang') || 'en';

  const catalog = document.getElementById('catalog');
  if (catalog) {
    new MutationObserver(() => applyTranslations()).observe(catalog, {
      childList: true,
      subtree: true
    });
  }

  setLanguage(savedLang);
  if (sel) sel.addEventListener('change', e => setLanguage(e.target.value));
});