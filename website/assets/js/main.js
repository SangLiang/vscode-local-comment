(function() {
  'use strict';

  // ========== Sidebar Toggle (Accordion) ==========
  function initSidebarToggle() {
    var toggles = document.querySelectorAll('.sidebar-toggle');
    toggles.forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!expanded));
        var list = document.getElementById(this.getAttribute('aria-controls'));
        if (list) {
          list.style.display = expanded ? 'none' : 'block';
        }
      });
    });
  }

  // ========== Mobile Sidebar Toggle ==========
  function initMobileSidebar() {
    var sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // Create toggle button if on mobile
    var btn = document.createElement('button');
    btn.className = 'docs-sidebar-toggle';
    btn.innerHTML = '☰';
    btn.setAttribute('aria-label', '切换侧边栏');
    btn.addEventListener('click', function() {
      sidebar.classList.toggle('open');
    });
    document.body.appendChild(btn);

    // Close sidebar when clicking on a link (mobile)
    sidebar.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth < 768) {
          sidebar.classList.remove('open');
        }
      });
    });
  }

  // ========== ScrollSpy for Sidebar ==========
  function initScrollSpy() {
    var sidebarLinks = document.querySelectorAll('.sidebar-list a');
    if (!sidebarLinks.length) return;

    var headings = Array.from(document.querySelectorAll('.docs-content h2[id], .docs-content h3[id]'));
    if (!headings.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          sidebarLinks.forEach(function(link) {
            link.classList.remove('active');
            if (link.getAttribute('href') === window.location.pathname + '#' + id ||
                link.getAttribute('href').endsWith('#' + id)) {
              link.classList.add('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0
    });

    headings.forEach(function(h) {
      observer.observe(h);
    });
  }

  // ========== Scroll Animations ==========
  function initScrollAnimations() {
    var elements = document.querySelectorAll('[data-animate="fade-up"]');
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach(function(el) {
        el.classList.add('animate-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0
    });

    elements.forEach(function(el) {
      observer.observe(el);
    });
  }

  // ========== Initialize ==========
  document.addEventListener('DOMContentLoaded', function() {
    initSidebarToggle();
    initMobileSidebar();
    initScrollSpy();
    initScrollAnimations();
  });
})();
