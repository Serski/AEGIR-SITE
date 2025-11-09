(function () {
  const menuButton = document.getElementById('gin-menu-button');
  const menu = document.getElementById('gin-main-menu');

  if (!menuButton || !menu) {
    return;
  }

  const menuLinks = Array.from(menu.querySelectorAll('a'));
  let isOpen = false;

  function setMenuState(open) {
    isOpen = open;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      menu.classList.add('is-open');
      menu.removeAttribute('hidden');
    } else {
      menu.classList.remove('is-open');
      menu.setAttribute('hidden', '');
    }
  }

  function toggleMenu() {
    setMenuState(!isOpen);
  }

  function closeMenuIfClickOutside(event) {
    if (!isOpen) {
      return;
    }

    if (event.target === menuButton || menuButton.contains(event.target)) {
      return;
    }

    if (menu.contains(event.target)) {
      return;
    }

    setMenuState(false);
  }

  menuButton.addEventListener('click', toggleMenu);

  document.addEventListener('click', closeMenuIfClickOutside);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuState(false);
    }
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  setMenuState(false);
})();
