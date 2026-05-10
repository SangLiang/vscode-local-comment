(function() {
  'use strict';

  var STORAGE_KEY = 'local-comment-lang';

  function getBaseUrl() {
    var body = document.body;
    return body && body.dataset.baseurl ? body.dataset.baseurl : '';
  }

  function getCurrentLang() {
    var htmlLang = document.documentElement.lang;
    if (htmlLang && htmlLang.indexOf('en') === 0) {
      return 'en';
    }
    var path = window.location.pathname;
    var baseUrl = getBaseUrl();
    if (path.indexOf(baseUrl + '/en/') === 0) {
      return 'en';
    }
    return 'zh';
  }

  function getSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // localStorage not available
    }
  }

  function getEquivalentPath(targetLang) {
    var baseUrl = getBaseUrl();
    var currentPath = window.location.pathname;
    var normalizedBase = baseUrl.replace(/\/$/, '');

    if (targetLang === 'en') {
      if (currentPath === normalizedBase + '/' || currentPath === normalizedBase + '/index.html') {
        return normalizedBase + '/en/';
      } else if (currentPath.indexOf(normalizedBase + '/docs/') === 0) {
        return currentPath.replace(normalizedBase + '/docs/', normalizedBase + '/en/docs/');
      } else if (currentPath.indexOf(normalizedBase + '/en/') === 0) {
        return currentPath;
      } else {
        return normalizedBase + '/en/';
      }
    } else {
      if (currentPath === normalizedBase + '/en/' || currentPath === normalizedBase + '/en/index.html') {
        return normalizedBase + '/';
      } else if (currentPath.indexOf(normalizedBase + '/en/docs/') === 0) {
        return currentPath.replace(normalizedBase + '/en/docs/', normalizedBase + '/docs/');
      } else if (currentPath.indexOf(normalizedBase + '/en/') === 0) {
        return currentPath.replace(normalizedBase + '/en/', normalizedBase + '/');
      } else {
        return currentPath;
      }
    }
  }

  function ensureTrailingSlash(path) {
    if (path && !path.match(/\.(html|md|json|xml)$/)) {
      if (path.slice(-1) !== '/') {
        return path + '/';
      }
    }
    return path;
  }

  function switchLang(targetLang) {
    saveLang(targetLang);
    var newPath = getEquivalentPath(targetLang);
    newPath = ensureTrailingSlash(newPath);
    window.location.href = window.location.origin + newPath;
  }

  // Auto-redirect on page load if saved language differs from current
  function autoRedirect() {
    var savedLang = getSavedLang();
    if (!savedLang) return;

    var currentLang = getCurrentLang();
    if (savedLang === currentLang) return;

    var newPath = getEquivalentPath(savedLang);
    newPath = ensureTrailingSlash(newPath);

    if (newPath !== window.location.pathname) {
      window.location.replace(window.location.origin + newPath);
    }
  }

  // Run immediately to minimize flicker
  autoRedirect();

  document.addEventListener('DOMContentLoaded', function() {
    var zhBtn = document.getElementById('lang-zh');
    var enBtn = document.getElementById('lang-en');

    if (zhBtn) {
      zhBtn.addEventListener('click', function(e) {
        e.preventDefault();
        switchLang('zh');
      });
    }
    if (enBtn) {
      enBtn.addEventListener('click', function(e) {
        e.preventDefault();
        switchLang('en');
      });
    }
  });
})();
