(function () {
  const NEWS_SOURCE = 'data/News.rtf';
  const ADS_SOURCE = 'data/Ads.rtf';
  const ROTATOR_COUNT = 3;
  const ROTATOR_INTERVAL = 12000;
  const DESKTOP_BREAKPOINT = 1024;

  const topHeadlineEl = document.getElementById('gin-top-headline');
  const rotatorEl = document.getElementById('gin-rotator');
  const newsFallbackEl = document.getElementById('gin-news-fallback');
  const adFallbackEl = document.getElementById('gin-ad-fallback');
  const adImageEl = document.getElementById('gin-ad-image');
  const adImageFallbackEl = document.getElementById('gin-ad-image-fallback');
  const adTitleEl = document.getElementById('gin-ad-title');
  const adTextEl = document.getElementById('gin-ad-text');
  const adSponsorEl = document.getElementById('gin-ad-sponsor');
  const panels = Array.from(document.querySelectorAll('.gin-panel'));
  const logoEl = document.querySelector('.gin-logo');

  let allHeadlines = [];
  let allAds = [];
  let rotatorTimer = null;
  let currentRotatorIndex = 0;
  let currentRotatorSet = [];
  let isDataReady = false;

  document.addEventListener('DOMContentLoaded', initialise);

  function initialise() {
    setupPanelToggles();
    setupRefreshHotkey();
    loadLogoAsset();
    loadFeeds();
  }

  function loadLogoAsset() {
    if (!logoEl) {
      return;
    }

    const logoSource = logoEl.getAttribute('data-logo-src');
    if (!logoSource) {
      return;
    }

    fetch(logoSource, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch logo: ${response.status}`);
        }
        return response.text();
      })
      .then((raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          throw new Error('Logo payload was empty');
        }

        const cleaned = trimmed.replace(/\s+/g, '');
        const isDataUri = cleaned.startsWith('data:image');
        const finalSource = isDataUri ? cleaned : `data:image/png;base64,${cleaned}`;
        logoEl.src = finalSource;
        logoEl.classList.remove('gin-logo--fallback');
        logoEl.removeAttribute('aria-hidden');
      })
      .catch((error) => {
        console.error('[gin] Unable to load logo asset', error);
        logoEl.classList.add('gin-logo--fallback');
        logoEl.removeAttribute('src');
        logoEl.setAttribute('aria-hidden', 'true');
      });
  }

  function setupRefreshHotkey() {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'r' && event.key !== 'R') {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
          return;
        }
        if (activeElement.isContentEditable) {
          return;
        }
      }

      event.preventDefault();
      handleRefreshRequest();
    });
  }

  function handleRefreshRequest() {
    if (!isDataReady) {
      return;
    }
    randomiseContent();
  }

  async function loadFeeds() {
    const [news, ads] = await Promise.all([fetchRtfJson(NEWS_SOURCE), fetchRtfJson(ADS_SOURCE)]);

    if (Array.isArray(news)) {
      allHeadlines = news.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }

    if (Array.isArray(ads)) {
      allAds = ads.filter((item) => item && typeof item === 'object');
    }

    if (!allHeadlines.length) {
      showNewsFallback('No incoming bulletins.');
    }

    if (!allAds.length) {
      showAdFallback('No sponsored transmissions available.');
    }

    isDataReady = true;
    randomiseContent();
  }

  async function fetchRtfJson(url) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      const raw = await response.text();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start === -1 || end === -1 || end < start) {
        throw new Error('Unable to locate JSON payload');
      }
      const jsonPayload = raw.slice(start, end + 1);
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('[gin] Unable to load', url, error);
      return null;
    }
  }

  function randomiseContent() {
    if (rotatorTimer) {
      clearInterval(rotatorTimer);
      rotatorTimer = null;
    }

    if (allHeadlines.length) {
      const selections = pickHeadlines();
      updateTopHeadline(selections.topHeadline);
      updateRotator(selections.rotatorHeadlines);
      hideNewsFallback();
    } else {
      updateTopHeadline('Awaiting transmission…');
      clearRotator();
      showNewsFallback('No incoming bulletins.');
    }

    if (allAds.length) {
      const ad = pickRandom(allAds);
      updateAdPanel(ad);
      hideAdFallback();
    } else {
      updateAdPanel(null);
      showAdFallback('No sponsored transmissions available.');
    }
  }

  function pickHeadlines() {
    const available = [...allHeadlines];
    const topHeadline = removeRandomItem(available);
    const rotatorHeadlines = [];

    while (available.length && rotatorHeadlines.length < ROTATOR_COUNT) {
      rotatorHeadlines.push(removeRandomItem(available));
    }

    if (!rotatorHeadlines.length && topHeadline) {
      rotatorHeadlines.push(topHeadline);
    }

    return { topHeadline, rotatorHeadlines };
  }

  function pickRandom(collection) {
    return collection[Math.floor(Math.random() * collection.length)];
  }

  function removeRandomItem(collection) {
    if (!collection.length) {
      return null;
    }
    const index = Math.floor(Math.random() * collection.length);
    const [item] = collection.splice(index, 1);
    return item;
  }

  function updateTopHeadline(headline) {
    if (!topHeadlineEl) {
      return;
    }
    const text = headline ? headline.replace(/\s+/g, ' ').trim() : '';
    topHeadlineEl.textContent = text || 'Awaiting transmission…';
    restartHeadlineAnimation();
  }

  function restartHeadlineAnimation() {
    if (!topHeadlineEl) {
      return;
    }
    topHeadlineEl.classList.remove('is-animating');
    // Force reflow to restart the animation.
    void topHeadlineEl.offsetWidth;
    topHeadlineEl.classList.add('is-animating');
  }

  function updateRotator(headlines) {
    if (!rotatorEl) {
      return;
    }

    rotatorEl.innerHTML = '';
    currentRotatorSet = headlines || [];

    currentRotatorSet.forEach((headline, index) => {
      const item = document.createElement('div');
      item.className = 'gin-rotator-item';
      const text = document.createElement('p');
      text.textContent = headline;
      const meta = document.createElement('div');
      meta.className = 'gin-rotator-meta';
      meta.textContent = `Report ${index + 1} of ${currentRotatorSet.length}`;
      item.append(text, meta);
      rotatorEl.appendChild(item);
    });

    currentRotatorIndex = 0;
    activateRotatorItem(currentRotatorIndex);

    if (currentRotatorSet.length > 1) {
      rotatorTimer = window.setInterval(() => {
        currentRotatorIndex = (currentRotatorIndex + 1) % currentRotatorSet.length;
        activateRotatorItem(currentRotatorIndex);
      }, ROTATOR_INTERVAL);
    }
  }

  function activateRotatorItem(index) {
    const items = rotatorEl ? Array.from(rotatorEl.children) : [];
    items.forEach((element, elementIndex) => {
      if (elementIndex === index) {
        element.classList.add('is-active');
      } else {
        element.classList.remove('is-active');
      }
    });
  }

  function clearRotator() {
    if (rotatorEl) {
      rotatorEl.innerHTML = '';
    }
    currentRotatorSet = [];
    currentRotatorIndex = 0;
    if (rotatorTimer) {
      clearInterval(rotatorTimer);
      rotatorTimer = null;
    }
  }

  function updateAdPanel(ad) {
    if (!adTitleEl || !adTextEl || !adSponsorEl) {
      return;
    }

    if (!ad) {
      adTitleEl.textContent = 'Sponsored transmission offline';
      adTextEl.textContent = '';
      adSponsorEl.textContent = '';
      clearAdImage();
      return;
    }

    adTitleEl.textContent = ad.title || 'Sponsored transmission';
    adTextEl.textContent = ad.text || '';
    adSponsorEl.textContent = ad.sponsor ? `Sponsor: ${ad.sponsor}` : '';

    if (ad.image) {
      setAdImage(ad.image, ad.title);
    } else {
      clearAdImage();
    }
  }

  function setAdImage(url, title) {
    if (!adImageEl || !adImageFallbackEl) {
      return;
    }

    const safeUrl = encodeURI(url);
    adImageEl.hidden = false;
    adImageEl.src = safeUrl;
    adImageEl.alt = title ? `${title} artwork` : 'Sponsored transmission image';
    adImageFallbackEl.hidden = true;

    adImageEl.onload = () => {
      adImageEl.hidden = false;
      adImageFallbackEl.hidden = true;
    };

    adImageEl.onerror = () => {
      clearAdImage();
    };
  }

  function clearAdImage() {
    if (!adImageEl || !adImageFallbackEl) {
      return;
    }
    adImageEl.hidden = true;
    adImageEl.removeAttribute('src');
    adImageEl.alt = '';
    adImageFallbackEl.hidden = false;
  }

  function showNewsFallback(message) {
    if (newsFallbackEl) {
      newsFallbackEl.textContent = message;
      newsFallbackEl.hidden = false;
    }
  }

  function hideNewsFallback() {
    if (newsFallbackEl) {
      newsFallbackEl.hidden = true;
    }
  }

  function showAdFallback(message) {
    if (adFallbackEl) {
      adFallbackEl.textContent = message;
      adFallbackEl.hidden = false;
    }
  }

  function hideAdFallback() {
    if (adFallbackEl) {
      adFallbackEl.hidden = true;
    }
  }

  function setupPanelToggles() {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

    panels.forEach((panel) => {
      const toggle = panel.querySelector('.gin-panel-toggle');
      if (!toggle) {
        return;
      }
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        const nextState = !expanded;
        toggle.setAttribute('aria-expanded', String(nextState));
        panel.classList.toggle('is-collapsed', !nextState);
      });
    });

    function syncPanels(e) {
      const isDesktop = typeof e === 'boolean' ? e : e.matches;
      if (isDesktop) {
        panels.forEach((panel) => {
          panel.classList.remove('is-collapsed');
          const toggle = panel.querySelector('.gin-panel-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
          }
        });
      }
    }

    syncPanels(mq.matches);

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', syncPanels);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(syncPanels);
    }
  }
})();
