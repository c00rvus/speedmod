const DEFAULT_SETTINGS = {
  defaultSpeed: 1,
  speedStep: 0.25,
  minSpeed: 0.1,
  maxSpeed: 4,
  applyOnLoad: true,
  rememberLastSpeed: true,
  language: 'en'
};

const TRANSLATIONS = {
  en: {
    playPrompt: 'Start playback to change the speed.'
  },
  'pt-BR': {
    playPrompt: 'Reproduza o vídeo para alterar a velocidade.'
  }
};

let settings = { ...DEFAULT_SETTINGS };
let currentSpeed = settings.defaultSpeed;
let shouldEnforce = settings.applyOnLoad;
let strings = TRANSLATIONS.en;
const mediaElements = new Set();
const mediaCleanup = new Map();
const observedRoots = new Set();
let overlayElement = null;
let overlayTimer = null;

function clampSpeed(value) {
  const min = Number(settings.minSpeed) || DEFAULT_SETTINGS.minSpeed;
  const max = Number(settings.maxSpeed) || DEFAULT_SETTINGS.maxSpeed;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return currentSpeed;
  }
  return Math.min(Math.max(numeric, min), max);
}

function safeSendMessage(payload) {
  try {
    chrome.runtime.sendMessage(payload, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    // Extension context might have been reloaded; ignore.
  }
}

function setLanguage(language) {
  strings = TRANSLATIONS[language] || TRANSLATIONS.en;
}

function getPlayingMedia() {
  const playing = [];
  mediaElements.forEach((media) => {
    if (!media.paused && !media.ended) {
      playing.push(media);
    }
  });
  return playing;
}

function notifyFrameStatus(overrides = {}) {
  const hasMedia = mediaElements.size > 0;
  let hasPlaying = false;
  mediaElements.forEach((media) => {
    if (!media.paused && !media.ended) {
      hasPlaying = true;
    }
  });
  safeSendMessage({
    type: 'FRAME_STATUS',
    hasMedia,
    hasPlaying,
    speed: currentSpeed,
    ...overrides
  });
}

function applySpeedToMedia(media) {
  if (media instanceof HTMLMediaElement) {
    media.playbackRate = currentSpeed;
  }
}

function setCurrentSpeed(value, options = {}) {
  const { forceEnforce = false, requirePlaying = false, notifyBackground = false } = options;
  const target = clampSpeed(value);
  currentSpeed = target;

  if (forceEnforce) {
    shouldEnforce = true;
  }

  const playing = getPlayingMedia();
  const applied = playing.length > 0;

  if (applied) {
    playing.forEach(applySpeedToMedia);
  }

  if (notifyBackground) {
    safeSendMessage({
      type: 'CONTENT_SPEED_CHANGE',
      speed: currentSpeed,
      applied
    });
  }

  notifyFrameStatus({ hasPlaying: applied });

  if (!applied && requirePlaying) {
    return { speed: currentSpeed, applied: false };
  }

  return { speed: currentSpeed, applied };
}

function cleanupMedia(media) {
  const teardown = mediaCleanup.get(media);
  if (teardown) {
    teardown();
  }
  mediaCleanup.delete(media);
  mediaElements.delete(media);
}

function attachMediaListeners(media) {
  const enforce = () => {
    if (shouldEnforce && !media.paused && !media.ended) {
      applySpeedToMedia(media);
    }
  };

  const report = () => notifyFrameStatus();
  const remove = () => cleanupMedia(media);

  const listeners = [
    ['loadedmetadata', () => {
      enforce();
      report();
    }],
    ['play', () => {
      enforce();
      report();
    }],
    ['pause', report],
    ['ended', report],
    ['emptied', remove],
    ['abort', remove],
    ['error', remove],
    ['ratechange', () => {
      if (Math.abs(media.playbackRate - currentSpeed) > 0.001 && shouldEnforce && !media.paused && !media.ended) {
        media.playbackRate = currentSpeed;
      }
      report();
    }]
  ];

  listeners.forEach(([event, handler]) => {
    media.addEventListener(event, handler);
  });

  mediaCleanup.set(media, () => {
    listeners.forEach(([event, handler]) => {
      media.removeEventListener(event, handler);
    });
  });

  enforce();
  report();
}

function handleMediaElement(media) {
  if (!(media instanceof HTMLMediaElement) || mediaElements.has(media)) {
    return;
  }
  mediaElements.add(media);
  attachMediaListeners(media);
}

function pruneRemovedMedia(node) {
  if (!node) {
    return;
  }
  if (mediaElements.has(node)) {
    cleanupMedia(node);
  }
  if (node.querySelectorAll) {
    node.querySelectorAll('video, audio').forEach((media) => {
      if (mediaElements.has(media)) {
        cleanupMedia(media);
      }
    });
  }
}

function scanNode(node) {
  if (!node) {
    return;
  }
  if (node instanceof HTMLMediaElement) {
    handleMediaElement(node);
  }
  if (node instanceof Element && node.shadowRoot) {
    observeRoot(node.shadowRoot);
  }
  if (typeof node.querySelectorAll === 'function') {
    node.querySelectorAll('video, audio').forEach((media) => handleMediaElement(media));
    if (node instanceof Element) {
      node.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) {
          observeRoot(element.shadowRoot);
        }
      });
    }
  }
}

function observeRoot(root) {
  if (!root || observedRoots.has(root)) {
    return;
  }
  observedRoots.add(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((added) => {
        scanNode(added);
      });
      mutation.removedNodes.forEach((removed) => {
        pruneRemovedMedia(removed);
      });
    }
    notifyFrameStatus();
  });

  try {
    observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    // Shadow roots with mode 'closed' cannot be observed.
  }

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('play', (event) => {
      if (event.target instanceof HTMLMediaElement) {
        handleMediaElement(event.target);
      }
    }, true);

    root.addEventListener('loadedmetadata', (event) => {
      if (event.target instanceof HTMLMediaElement) {
        handleMediaElement(event.target);
      }
    }, true);

    root.addEventListener('pause', (event) => {
      if (event.target instanceof HTMLMediaElement) {
        notifyFrameStatus();
      }
    }, true);

    root.addEventListener('ended', (event) => {
      if (event.target instanceof HTMLMediaElement) {
        notifyFrameStatus();
      }
    }, true);
  }

  scanNode(root);
}

function hydrateExistingShadowRoots() {
  if (typeof document.querySelectorAll !== 'function') {
    return;
  }
  document.querySelectorAll('*').forEach((element) => {
    if (element.shadowRoot) {
      observeRoot(element.shadowRoot);
    }
  });
}

if (Element.prototype.attachShadow) {
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function patchedAttachShadow(init) {
    const shadow = originalAttachShadow.call(this, init);
    observeRoot(shadow);
    return shadow;
  };
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    settings = { ...DEFAULT_SETTINGS, ...items };
    setLanguage(settings.language || 'en');
    shouldEnforce = Boolean(settings.applyOnLoad);
    setCurrentSpeed(settings.defaultSpeed, {
      forceEnforce: shouldEnforce,
      requirePlaying: false,
      notifyBackground: false
    });
    notifyFrameStatus();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') {
    return;
  }
  let defaultUpdated = false;
  for (const [key, change] of Object.entries(changes)) {
    settings[key] = change.newValue;
    if (key === 'applyOnLoad') {
      shouldEnforce = Boolean(change.newValue);
    }
    if (key === 'defaultSpeed') {
      defaultUpdated = true;
    }
    if (key === 'language') {
      setLanguage(change.newValue);
    }
  }
  if (defaultUpdated) {
    setCurrentSpeed(settings.defaultSpeed, {
      forceEnforce: shouldEnforce,
      requirePlaying: false,
      notifyBackground: false
    });
  }
  notifyFrameStatus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }
  switch (message.type) {
    case 'GET_STATE': {
      const playing = getPlayingMedia();
      sendResponse({
        speed: currentSpeed,
        enforce: shouldEnforce,
        settings,
        hasPlaying: playing.length > 0,
        hasMedia: mediaElements.size > 0
      });
      notifyFrameStatus({ hasPlaying: playing.length > 0 });
      return true;
    }
    case 'SET_SPEED': {
      const result = setCurrentSpeed(message.speed, {
        forceEnforce: true,
        requirePlaying: Boolean(message.requirePlaying),
        notifyBackground: Boolean(message.notifyBackground)
      });
      sendResponse(result);
      return true;
    }
    case 'CHANGE_SPEED': {
      const delta = Number(message.delta || 0);
      const result = setCurrentSpeed(currentSpeed + delta, {
        forceEnforce: true,
        requirePlaying: Boolean(message.requirePlaying),
        notifyBackground: Boolean(message.notifyBackground)
      });
      sendResponse(result);
      return true;
    }
    case 'APPLY_SETTINGS': {
      settings = { ...settings, ...message.settings };
      if (message.settings && message.settings.applyOnLoad !== undefined) {
        shouldEnforce = Boolean(message.settings.applyOnLoad);
      }
      if (message.settings && message.settings.language !== undefined) {
        setLanguage(message.settings.language);
      }
      const nextDefault = message.settings && message.settings.defaultSpeed !== undefined
        ? message.settings.defaultSpeed
        : currentSpeed;
      const result = setCurrentSpeed(nextDefault, {
        forceEnforce: shouldEnforce || Boolean(message.forceEnforce),
        requirePlaying: false,
        notifyBackground: false
      });
      sendResponse(result);
      return true;
    }
    default:
      return false;
  }
});

function ensureOverlay() {
  if (!overlayElement) {
    overlayElement = document.createElement('div');
    overlayElement.className = 'media-speed-overlay';
    document.documentElement.appendChild(overlayElement);
  }
  if (!document.getElementById('media-speed-style')) {
    const style = document.createElement('style');
    style.id = 'media-speed-style';
    style.textContent = [
      '.media-speed-overlay {',
      '  position: fixed;',
      '  top: 24px;',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  padding: 10px 16px;',
      '  border-radius: 999px;',
      '  background: rgba(15, 23, 42, 0.85);',
      '  color: #ffffff;',
      '  font-size: 15px;',
      '  font-family: Arial, sans-serif;',
      '  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.28);',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 120ms ease;',
      '  z-index: 2147483647;',
      '}',
      '.media-speed-overlay.visible {',
      '  opacity: 1;',
      '}',
      '.media-speed-overlay.error {',
      '  background: rgba(190, 18, 60, 0.92);',
      '}'
    ].join('\n');
    const container = document.head || document.documentElement;
    container.appendChild(style);
  }
}
function showOverlay(message, isError = false) {
  ensureOverlay();
  if (!overlayElement) {
    return;
  }
  overlayElement.textContent = message;
  overlayElement.classList.toggle('error', isError);
  overlayElement.classList.add('visible');

  if (overlayTimer) {
    clearTimeout(overlayTimer);
  }
  overlayTimer = setTimeout(() => {
    if (overlayElement) {
      overlayElement.classList.remove('visible');
    }
  }, 1200);
}

function isEditableTarget(target) {
  if (!target) {
    return false;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  return Boolean(target.closest && target.closest('input, textarea, [contenteditable="true"]'));
}

function handleKeyboard(event) {
  if (event.defaultPrevented || event.repeat) {
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (isEditableTarget(event.target)) {
    return;
  }

  const key = String(event.key).toLowerCase();
  let result = null;

  if (key === 'a') {
    result = setCurrentSpeed(currentSpeed - settings.speedStep, {
      forceEnforce: true,
      requirePlaying: true,
      notifyBackground: true
    });
  } else if (key === 'd') {
    result = setCurrentSpeed(currentSpeed + settings.speedStep, {
      forceEnforce: true,
      requirePlaying: true,
      notifyBackground: true
    });
  } else if (key === 's') {
    result = setCurrentSpeed(settings.defaultSpeed, {
      forceEnforce: true,
      requirePlaying: true,
      notifyBackground: true
    });
  }

  if (!result) {
    return;
  }

  if (result.applied) {
    showOverlay(`${result.speed.toFixed(2)}x`);
  } else {
    showOverlay(strings.playPrompt, true);
  }

  event.preventDefault();
}

function init() {
  observeRoot(document);
  hydrateExistingShadowRoots();
  loadSettings();
  notifyFrameStatus();
  window.addEventListener('keydown', handleKeyboard, true);

  // Inform the background which tab is active without needing the
  // tabs permission. Send when visible now and on visibility changes.
  if (document.visibilityState === 'visible') {
    safeSendMessage({ type: 'TAB_FOCUSED' });
  }
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'visible') {
        safeSendMessage({ type: 'TAB_FOCUSED' });
      }
    },
    true
  );
  // Clean up tracking when the page is being hidden/unloaded.
  window.addEventListener(
    'pagehide',
    () => {
      safeSendMessage({ type: 'TAB_UNLOADED' });
    },
    { once: true }
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}



















