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

const TRANSLATIONS = {
  en: {
    ui: {
      windowTitle: 'Speed Control',
      title: 'Speed',
      subtitle: 'Control playback on the fly',
      openOptions: 'Settings',
      openOptionsTitle: 'Open settings',
      speedCaption: 'Current tab speed',
      badge(keys) {
        return `Keys ${keys.decrease} · ${keys.reset} · ${keys.increase}`;
      },
      decreaseTitle(keys) {
        return `Decrease speed (${keys.decrease})`;
      },
      increaseTitle(keys) {
        return `Increase speed (${keys.increase})`;
      },
      resetTitle(keys) {
        return `Restore default speed (${keys.reset})`;
      },
      resetButton(keys) {
        return `Default (${keys.reset})`;
      },
      hint(keys) {
        return `Start playback to change the speed. Use ${keys.decrease}, ${keys.reset} and ${keys.increase} directly on the video.`;
      },
      sliderLabel: 'Speed'
    },
    status: {
      updated: 'Speed updated.',
      error: 'Could not apply the speed.',
      playPrompt: 'Start playback to change the speed.',
      tabUnavailable: 'Active tab unavailable.',
      siteUnsupported: 'This site does not allow speed control.'
    }
  },
  'pt-BR': {
    ui: {
      windowTitle: 'Controle de Velocidade',
      title: 'Velocidade',
      subtitle: 'Controle durante a reprodução',
      openOptions: 'Config',
      openOptionsTitle: 'Abrir configurações',
      speedCaption: 'Velocidade atual da aba',
      badge(keys) {
        return `Teclas ${keys.decrease} · ${keys.reset} · ${keys.increase}`;
      },
      decreaseTitle(keys) {
        return `Diminuir velocidade (${keys.decrease})`;
      },
      increaseTitle(keys) {
        return `Aumentar velocidade (${keys.increase})`;
      },
      resetTitle(keys) {
        return `Restaurar velocidade padrão (${keys.reset})`;
      },
      resetButton(keys) {
        return `Padrão (${keys.reset})`;
      },
      hint(keys) {
        return `Inicie a reprodução para alterar a velocidade. Use ${keys.decrease}, ${keys.reset} e ${keys.increase} diretamente no vídeo.`;
      },
      sliderLabel: 'Velocidade'
    },
    status: {
      updated: 'Velocidade atualizada.',
      error: 'Não foi possível aplicar a velocidade.',
      playPrompt: 'Reproduza o vídeo para alterar a velocidade.',
      tabUnavailable: 'Aba ativa indisponível.',
      siteUnsupported: 'Este site não permite controlar a velocidade.'
    }
  }
};

const slider = document.getElementById('speedSlider');
const numberInput = document.getElementById('speedInput');
const speedValue = document.getElementById('speedValue');
const decreaseBtn = document.getElementById('decreaseBtn');
const increaseBtn = document.getElementById('increaseBtn');
const resetBtn = document.getElementById('resetBtn');
const statusLabel = document.getElementById('status');
const openOptionsBtn = document.getElementById('openOptions');
const hintParagraph = document.querySelector('.hint');
const titleHeading = document.querySelector('.title h1');
const subtitleText = document.querySelector('.title p');
const speedCaption = document.querySelector('.speed-caption');
const badgeText = document.querySelector('.badge');
const decreaseKeyHint = decreaseBtn.querySelector('.key-hint');
const increaseKeyHint = increaseBtn.querySelector('.key-hint');

let activeTabId = null;
let settings = { ...DEFAULT_SETTINGS };
let isUpdatingUI = false;
let strings = TRANSLATIONS.en;

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

decreaseBtn.addEventListener('click', () => changeSpeed(-settings.speedStep));
increaseBtn.addEventListener('click', () => changeSpeed(settings.speedStep));
resetBtn.addEventListener('click', () => setSpeed(settings.defaultSpeed));

slider.addEventListener('input', () => {
  if (isUpdatingUI) {
    return;
  }
  setSpeed(Number(slider.value));
});

numberInput.addEventListener('change', () => {
  if (isUpdatingUI) {
    return;
  }
  setSpeed(Number(numberInput.value));
});

function applyTranslations(language) {
  strings = TRANSLATIONS[language] || TRANSLATIONS.en;
  document.documentElement.lang = language;
  document.title = strings.ui.windowTitle;
  titleHeading.textContent = strings.ui.title;
  subtitleText.textContent = strings.ui.subtitle;
  openOptionsBtn.textContent = strings.ui.openOptions;
  openOptionsBtn.title = strings.ui.openOptionsTitle;
  speedCaption.textContent = strings.ui.speedCaption;
  slider.setAttribute('aria-label', strings.ui.sliderLabel);
  numberInput.setAttribute('aria-label', strings.ui.sliderLabel);
  updateShortcutAnnotations();
}
function formatShortcutLabel(value, fallback) {
  const raw = String(value ?? '').trim();
  if (raw) {
    return raw.charAt(0).toUpperCase();
  }
  const fallbackRaw = String(fallback ?? '').trim();
  return fallbackRaw ? fallbackRaw.charAt(0).toUpperCase() : '';
}

function getShortcutLabels() {
  return {
    decrease: formatShortcutLabel(settings.decreaseKey, DEFAULT_SETTINGS.decreaseKey),
    reset: formatShortcutLabel(settings.resetKey, DEFAULT_SETTINGS.resetKey),
    increase: formatShortcutLabel(settings.increaseKey, DEFAULT_SETTINGS.increaseKey)
  };
}

function resolveShortcutTemplate(template, keys) {
  if (typeof template === 'function') {
    return template(keys);
  }
  return template;
}

function updateShortcutAnnotations() {
  if (!strings || !strings.ui) {
    return;
  }
  const keys = getShortcutLabels();
  const badgeValue = resolveShortcutTemplate(strings.ui.badge, keys);
  if (badgeValue !== undefined && badgeText) {
    badgeText.textContent = badgeValue;
  }
  const decreaseTitle = resolveShortcutTemplate(strings.ui.decreaseTitle, keys);
  if (decreaseTitle !== undefined) {
    decreaseBtn.title = decreaseTitle;
  }
  const increaseTitle = resolveShortcutTemplate(strings.ui.increaseTitle, keys);
  if (increaseTitle !== undefined) {
    increaseBtn.title = increaseTitle;
  }
  const resetTitle = resolveShortcutTemplate(strings.ui.resetTitle, keys);
  if (resetTitle !== undefined) {
    resetBtn.title = resetTitle;
  }
  const resetButtonLabel = resolveShortcutTemplate(strings.ui.resetButton, keys);
  if (resetButtonLabel !== undefined) {
    resetBtn.textContent = resetButtonLabel;
  }
  const hintLabel = resolveShortcutTemplate(strings.ui.hint, keys);
  if (hintLabel !== undefined && hintParagraph) {
    hintParagraph.textContent = hintLabel;
  }
  if (decreaseKeyHint) {
    decreaseKeyHint.textContent = keys.decrease;
  }
  if (increaseKeyHint) {
    increaseKeyHint.textContent = keys.increase;
  }
}

function applyStatePayload(state) {
  if (!state) {
    return false;
  }
  if (Number.isFinite(state.tabId)) {
    activeTabId = state.tabId;
  }
  const incomingSettings = (state.settings && typeof state.settings === 'object') ? state.settings : {};
  settings = { ...DEFAULT_SETTINGS, ...incomingSettings };
  applyTranslations(settings.language || DEFAULT_SETTINGS.language);
  updateBounds(settings);
  const numericSpeed = Number(state.speed);
  renderSpeed(Number.isFinite(numericSpeed) ? numericSpeed : settings.defaultSpeed);
  setControlsDisabled(false);
  if (!state.hasPlaying) {
    showStatus(strings.status.playPrompt, 'info');
  } else {
    showStatus('');
  }
  return true;
}

function formatSpeed(value) {
  return `${value.toFixed(2)}x`;
}

function setControlsDisabled(disabled) {
  [slider, numberInput, decreaseBtn, increaseBtn, resetBtn].forEach((control) => {
    control.disabled = disabled;
  });
}

function updateBounds(newSettings) {
  const min = Number(newSettings.minSpeed) || DEFAULT_SETTINGS.minSpeed;
  const max = Number(newSettings.maxSpeed) || DEFAULT_SETTINGS.maxSpeed;
  const step = Number(newSettings.speedStep) || DEFAULT_SETTINGS.speedStep;

  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(Math.max(step / 4, 0.01));
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(Math.max(step / 2, 0.01));
}

function renderSpeed(speed) {
  isUpdatingUI = true;
  const clamped = clamp(speed, settings.minSpeed, settings.maxSpeed);
  slider.value = String(clamped);
  numberInput.value = clamped.toFixed(2);
  speedValue.textContent = formatSpeed(clamped);
  isUpdatingUI = false;
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Number(min) || 0;
  }
  const parsedMin = Number(min);
  const parsedMax = Number(max);
  return Math.min(Math.max(numeric, parsedMin), parsedMax);
}

function showStatus(message, variant = 'info') {
  statusLabel.textContent = message || '';
  statusLabel.dataset.variant = variant;
}

function handleSpeedResponse(response) {
  if (!response) {
    showStatus(strings.status.error, 'error');
    return;
  }

  renderSpeed(response.speed);

  if (response.applied) {
    showStatus(strings.status.updated, 'success');
  } else {
    showStatus(strings.status.playPrompt, 'info');
  }
}

function sendCommandToBackground(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

function handleRuntimeMessage(message, sender) {
  if (!message || typeof message !== 'object') return;

  const incomingTabId = sender && sender.tab && sender.tab.id;

  // Fast path: accept direct content-script notifications
  if (message.type === 'CONTENT_SPEED_CHANGE') {
    if (Number.isFinite(incomingTabId)) {
      if (activeTabId === null) {
        activeTabId = incomingTabId;
      }
      if (activeTabId === incomingTabId) {
        renderSpeed(Number(message.speed) || settings.defaultSpeed);
        if (message.applied) {
          showStatus(strings.status.updated, 'success');
        } else {
          showStatus(strings.status.playPrompt, 'info');
        }
      }
    }
    return;
  }

  if (message.type === 'SPEED_UPDATE') {
    if (activeTabId === null && Number.isFinite(message.tabId)) {
      activeTabId = message.tabId;
    }
    if (message.tabId === activeTabId) {
      renderSpeed(Number(message.speed) || settings.defaultSpeed);
      if (message.applied) {
        showStatus(strings.status.updated, 'success');
      }
    }
    return;
  }

  if (message.type === 'TAB_FOCUSED') {
    if (sender && sender.tab && Number.isFinite(sender.tab.id)) {
      activeTabId = sender.tab.id;
    }
    sendCommandToBackground('POPUP_GET_STATE', {})
      .then((response) => {
        if (!applyStatePayload(response) && strings.status.tabUnavailable) {
          showStatus(strings.status.tabUnavailable, 'error');
        }
      })
      .catch(() => {});
    return;
  }

  if (message.type === 'FRAME_STATUS') {
    if (activeTabId === null && Number.isFinite(message.tabId)) {
      activeTabId = message.tabId;
    }
    if (message.tabId !== undefined && message.tabId !== activeTabId) {
      return;
    }
    if (typeof message.speed === 'number') {
      renderSpeed(message.speed);
    }
    if (!message.hasPlaying) {
      showStatus(strings.status.playPrompt, 'info');
    } else {
      showStatus('');
    }
    return;
  }
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

async function changeSpeed(delta) {
  if (activeTabId === null) {
    return;
  }
  const response = await sendCommandToBackground('POPUP_CHANGE_SPEED', {
    tabId: activeTabId,
    delta
  });
  handleSpeedResponse(response);
}

async function setSpeed(speed) {
  if (activeTabId === null) {
    return;
  }
  const response = await sendCommandToBackground('POPUP_SET_SPEED', {
    tabId: activeTabId,
    speed,
    requirePlaying: true
  });
  handleSpeedResponse(response);
}

async function bootstrap() {
  // 1) Try cached state for instant paint
  const cached = await sendCommandToBackground('POPUP_GET_CACHED_STATE', {});
  const cachedApplied = applyStatePayload(cached);

  // 2) Fetch authoritative state from content script
  const response = await sendCommandToBackground('POPUP_GET_STATE', {});
  if (applyStatePayload(response)) {
    return;
  }

  if (!cachedApplied) {
    setControlsDisabled(true);
    showStatus(strings.status.siteUnsupported, 'error');
  }
}

applyTranslations(DEFAULT_SETTINGS.language);
bootstrap();
















