const DEFAULT_SETTINGS = {
  defaultSpeed: 1,
  speedStep: 0.25,
  minSpeed: 0.1,
  maxSpeed: 4,
  applyOnLoad: true,
  rememberLastSpeed: true,
  language: 'en',
  decreaseKey: 'a',
  resetKey: 's',
  increaseKey: 'd'
};

const tabSpeeds = new Map();
const settingsCache = { ...DEFAULT_SETTINGS };
const frameRegistry = new Map();
let lastFocusedTabId = null;

function toBadgeText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  // Always keep 2 decimals to keep badge width stable
  return n.toFixed(2);
}

function setBadge(tabId, speed, applied = true) {
  const text = toBadgeText(speed);
  try {
    chrome.action.setBadgeText({ tabId, text }, () => { void chrome.runtime?.lastError; });
    chrome.action.setBadgeBackgroundColor(
      { tabId, color: applied ? '#0ea5e9' : '#9ca3af' },
      () => { void chrome.runtime?.lastError; }
    );
  } catch (e) {
    // ignore
  }
}

function clearBadge(tabId) {
  try {
    chrome.action.setBadgeText({ tabId, text: '' }, () => { void chrome.runtime?.lastError; });
  } catch (e) {
    // ignore
  }
}

function loadInitialSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    Object.assign(settingsCache, items);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    const missing = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (items[key] === undefined) {
        missing[key] = DEFAULT_SETTINGS[key];
      }
    }
    if (Object.keys(missing).length > 0) {
      chrome.storage.sync.set(missing);
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') {
    return;
  }
  for (const [key, change] of Object.entries(changes)) {
    settingsCache[key] = change.newValue;
  }
  if (changes.rememberLastSpeed && changes.rememberLastSpeed.newValue === false) {
    tabSpeeds.clear();
  }
});

loadInitialSettings();

function getFrameMap(tabId) {
  let registry = frameRegistry.get(tabId);
  if (!registry) {
    registry = new Map();
    frameRegistry.set(tabId, registry);
  }
  return registry;
}

function updateFrameInfo(tabId, frameId, updates) {
  if (tabId === undefined || frameId === undefined) {
    return;
  }
  const registry = getFrameMap(tabId);
  const existing = registry.get(frameId) || {};
  registry.set(frameId, { ...existing, ...updates });
}

function removeFrameInfo(tabId, frameId) {
  const registry = frameRegistry.get(tabId);
  if (!registry) {
    return;
  }
  registry.delete(frameId);
  if (registry.size === 0) {
    frameRegistry.delete(tabId);
  }
}

function removeAllFrames(tabId) {
  frameRegistry.delete(tabId);
}

function clampSpeedValue(speed) {
  const min = Number(settingsCache.minSpeed) || DEFAULT_SETTINGS.minSpeed;
  const max = Number(settingsCache.maxSpeed) || DEFAULT_SETTINGS.maxSpeed;
  const numeric = Number(speed);
  if (!Number.isFinite(numeric)) {
    return settingsCache.defaultSpeed;
  }
  return Math.min(Math.max(numeric, min), max);
}

function sendMessageToSpecificFrame(tabId, frameId, message) {
  return new Promise((resolve) => {
    const callback = (response) => {
      if (chrome.runtime.lastError) {
        resolve({ response: null, error: chrome.runtime.lastError });
        return;
      }
      resolve({ response: response || null, error: null });
    };
    try {
      if (frameId === 0) {
        chrome.tabs.sendMessage(tabId, message, callback);
      } else {
        chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
      }
    } catch (error) {
      resolve({ response: null, error });
    }
  });
}

async function dispatchMessageToFrames(tabId, message) {
  const registry = frameRegistry.get(tabId);
  const tried = new Set();
  const responses = [];
  const candidates = [];

  if (registry) {
    for (const [frameId, info] of registry.entries()) {
      if (info.hasPlaying) {
        candidates.push(frameId);
      }
    }
    for (const [frameId, info] of registry.entries()) {
      if (!info.hasPlaying && info.hasMedia) {
        candidates.push(frameId);
      }
    }
  }

  if (!candidates.includes(0)) {
    candidates.push(0);
  }

  for (const frameId of candidates) {
    if (tried.has(frameId)) {
      continue;
    }
    tried.add(frameId);

    const { response, error } = await sendMessageToSpecificFrame(tabId, frameId, message);
    if (error) {
      if (frameId !== 0) {
        removeFrameInfo(tabId, frameId);
      }
      continue;
    }

    if (response) {
      updateFrameInfoFromResponse(tabId, frameId, response);
      responses.push({ frameId, response });
      if (response.applied) {
        return { frameId, response };
      }
    }
  }

  if (responses.length > 0) {
    return responses[0];
  }
  return { frameId: undefined, response: null };
}

function updateFrameInfoFromResponse(tabId, frameId, response) {
  if (!response) {
    return;
  }
  const updates = {};
  if (response.hasMedia !== undefined) {
    updates.hasMedia = Boolean(response.hasMedia);
  }
  if (response.hasPlaying !== undefined) {
    updates.hasPlaying = Boolean(response.hasPlaying);
  }
  if (response.applied !== undefined) {
    updates.hasPlaying = Boolean(response.applied);
    if (updates.hasMedia === undefined) {
      updates.hasMedia = true;
    }
  }
  if (response.speed !== undefined) {
    updates.lastSpeed = response.speed;
  }
  if (Object.keys(updates).length > 0) {
    updateFrameInfo(tabId, frameId, updates);
  }
}

function broadcast(payload) {
  try {
    chrome.runtime.sendMessage(payload, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    // Sem ouvintes (popup fechado)
  }
}

async function setSpeed(tabId, speed, options = {}) {
  const target = clampSpeedValue(speed);
  const message = {
    type: 'SET_SPEED',
    speed: target,
    requirePlaying: Boolean(options.requirePlaying),
    notifyBackground: false
  };

  const { response } = await dispatchMessageToFrames(tabId, message);

  if (!response || typeof response.speed !== 'number') {
    if (!settingsCache.rememberLastSpeed) {
      tabSpeeds.delete(tabId);
    }
    return null;
  }

  if (settingsCache.rememberLastSpeed && !options.skipTracking && response.applied !== false) {
    tabSpeeds.set(tabId, response.speed);
  } else if (!settingsCache.rememberLastSpeed) {
    tabSpeeds.delete(tabId);
  }

  return response;
}

async function changeSpeed(tabId, delta) {
  const message = {
    type: 'CHANGE_SPEED',
    delta,
    requirePlaying: true,
    notifyBackground: false
  };

  const { response } = await dispatchMessageToFrames(tabId, message);

  if (response && typeof response.speed === 'number' && settingsCache.rememberLastSpeed && response.applied !== false) {
    tabSpeeds.set(tabId, response.speed);
  }

  return response;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  const tabId = sender.tab && sender.tab.id;
  const frameId = sender.frameId !== undefined ? sender.frameId : 0;

  if (message.type === 'TAB_FOCUSED') {
    if (tabId !== undefined) {
      lastFocusedTabId = tabId;
      const registry = frameRegistry.get(tabId);
      let shown = false;
      if (registry) {
        for (const info of registry.values()) {
          if (typeof info.lastSpeed === 'number') {
            setBadge(tabId, info.lastSpeed, Boolean(info.hasPlaying));
            shown = true;
            break;
          }
        }
      }
      if (!shown) {
        const stored = tabSpeeds.get(tabId);
        if (typeof stored === 'number') {
          setBadge(tabId, stored, false);
        } else {
          dispatchMessageToFrames(tabId, { type: 'GET_STATE' })
            .then(({ response }) => {
              if (response && typeof response.speed === 'number') {
                setBadge(tabId, response.speed, Boolean(response.hasPlaying));
              }
            })
            .catch(() => {});
        }
      }
    }
    return;
  }

  if (message.type === 'TAB_UNLOADED') {
    if (tabId !== undefined) {
      tabSpeeds.delete(tabId);
      removeAllFrames(tabId);
      if (lastFocusedTabId === tabId) {
        lastFocusedTabId = null;
      }
      clearBadge(tabId);
    }
    return;
  }

  if (message.type === 'FRAME_STATUS') {
    if (tabId !== undefined) {
      updateFrameInfo(tabId, frameId, {
        hasMedia: Boolean(message.hasMedia),
        hasPlaying: Boolean(message.hasPlaying),
        lastSpeed: typeof message.speed === 'number' ? message.speed : undefined
      });
      if (typeof message.speed === 'number') {
        setBadge(tabId, message.speed, Boolean(message.hasPlaying));
      }
      broadcast({
        type: 'FRAME_STATUS',
        tabId,
        frameId,
        hasMedia: Boolean(message.hasMedia),
        hasPlaying: Boolean(message.hasPlaying),
        speed: typeof message.speed === 'number' ? message.speed : undefined
      });
    }
    return;
  }

  if (message.type === 'CONTENT_SPEED_CHANGE') {
    if (tabId !== undefined) {
      // Treat activity from a tab as a signal that it is the
      // current target for the popup, avoiding the need for
      // the tabs permission.
      lastFocusedTabId = tabId;
      if (settingsCache.rememberLastSpeed && message.applied) {
        tabSpeeds.set(tabId, message.speed);
      } else if (!settingsCache.rememberLastSpeed) {
        tabSpeeds.delete(tabId);
      }
      updateFrameInfo(tabId, frameId, {
        hasMedia: true,
        hasPlaying: Boolean(message.applied),
        lastSpeed: message.speed
      });
      setBadge(tabId, message.speed, Boolean(message.applied));
      broadcast({
        type: 'SPEED_UPDATE',
        tabId,
        frameId,
        speed: message.speed,
        applied: message.applied
      });
    }
    return;
  }

  if (message.type === 'POPUP_GET_CACHED_STATE') {
    let targetTabId = Number(message.tabId);
    if (!Number.isFinite(targetTabId)) {
      targetTabId = lastFocusedTabId;
    }
    if (!Number.isFinite(targetTabId)) {
      sendResponse(null);
      return;
    }

    const registry = frameRegistry.get(targetTabId);
    if (registry) {
      for (const info of registry.values()) {
        if (info.lastSpeed !== undefined) {
          sendResponse({
            tabId: targetTabId,
            speed: info.lastSpeed,
            enforce: settingsCache.applyOnLoad,
            settings: { ...settingsCache },
            hasPlaying: Boolean(info.hasPlaying),
            hasMedia: Boolean(info.hasMedia)
          });
          return;
        }
      }
    }

    const stored = tabSpeeds.get(targetTabId);
    if (typeof stored === 'number') {
      sendResponse({
        tabId: targetTabId,
        speed: stored,
        enforce: settingsCache.applyOnLoad,
        settings: { ...settingsCache },
        hasPlaying: false,
        hasMedia: Boolean(registry && registry.size > 0)
      });
      return;
    }

    sendResponse(null);
    return;
  }

  if (message.type === 'POPUP_GET_STATE') {
    let targetTabId = Number(message.tabId);
    if (!Number.isFinite(targetTabId)) {
      targetTabId = lastFocusedTabId;
    }
    if (!Number.isFinite(targetTabId)) {
      sendResponse(null);
      return;
    }

    dispatchMessageToFrames(targetTabId, { type: 'GET_STATE' })
      .then(({ response }) => {
        if (response) {
          sendResponse({ ...response, tabId: targetTabId });
          if (typeof response.speed === 'number') {
            setBadge(targetTabId, response.speed, Boolean(response.hasPlaying));
          }
          return;
        }

        const registry = frameRegistry.get(targetTabId);
        if (registry) {
          for (const info of registry.values()) {
            if (info.lastSpeed !== undefined) {
              sendResponse({
                tabId: targetTabId,
                speed: info.lastSpeed,
                enforce: settingsCache.applyOnLoad,
                settings: { ...settingsCache },
                hasPlaying: Boolean(info.hasPlaying),
                hasMedia: Boolean(info.hasMedia)
              });
              return;
            }
          }
        }

        const stored = tabSpeeds.get(targetTabId);
        if (typeof stored === 'number') {
          sendResponse({
            tabId: targetTabId,
            speed: stored,
            enforce: settingsCache.applyOnLoad,
            settings: { ...settingsCache },
            hasPlaying: false,
            hasMedia: Boolean(registry && registry.size > 0)
          });
          setBadge(targetTabId, stored, false);
          return;
        }

        sendResponse({
          tabId: targetTabId,
          speed: settingsCache.defaultSpeed,
          enforce: settingsCache.applyOnLoad,
          settings: { ...settingsCache },
          hasPlaying: false,
          hasMedia: Boolean(registry && registry.size > 0)
        });
        setBadge(targetTabId, settingsCache.defaultSpeed, false);
      })
      .catch(() => sendResponse(null));
    return true;
  }
  if (message.type === 'POPUP_SET_SPEED') {
    const targetTabId = Number(message.tabId);
    if (!Number.isFinite(targetTabId)) {
      sendResponse(null);
      return;
    }
    setSpeed(targetTabId, message.speed, {
      requirePlaying: Boolean(message.requirePlaying)
    })
      .then((response) => {
        if (response) {
          broadcast({
            type: 'SPEED_UPDATE',
            tabId: targetTabId,
            speed: response.speed,
            applied: response.applied
          });
          setBadge(targetTabId, response.speed, Boolean(response.applied));
        }
        sendResponse(response || null);
      })
      .catch(() => sendResponse(null));
    return true;
  }

  if (message.type === 'POPUP_CHANGE_SPEED') {
    const targetTabId = Number(message.tabId);
    if (!Number.isFinite(targetTabId)) {
      sendResponse(null);
      return;
    }
    changeSpeed(targetTabId, message.delta)
      .then((response) => {
        if (response) {
          broadcast({
            type: 'SPEED_UPDATE',
            tabId: targetTabId,
            speed: response.speed,
            applied: response.applied
          });
          setBadge(targetTabId, response.speed, Boolean(response.applied));
        }
        sendResponse(response || null);
      })
      .catch(() => sendResponse(null));
    return true;
  }
});
