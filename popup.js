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
    ui: {
      windowTitle: 'Speed Control',
      title: 'Speed',
      subtitle: 'Control playback on the fly',
      openOptions: 'Settings',
      openOptionsTitle: 'Open settings',
      speedCaption: 'Current tab speed',
      badge: 'Keys A · S · D',
      decreaseTitle: 'Decrease speed',
      increaseTitle: 'Increase speed',
      resetTitle: 'Restore default speed',
      resetButton: 'Default (S)',
      hint: 'Start playback to change the speed. Use A, S and D directly on the video.',
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
      badge: 'Teclas A · S · D',
      decreaseTitle: 'Diminuir velocidade',
      increaseTitle: 'Aumentar velocidade',
      resetTitle: 'Restaurar velocidade padrão',
      resetButton: 'Padrão (S)',
      hint: 'Inicie a reprodução para alterar a velocidade. Use A, S e D diretamente no vídeo.',
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
  badgeText.textContent = strings.ui.badge;
  decreaseBtn.title = strings.ui.decreaseTitle;
  increaseBtn.title = strings.ui.increaseTitle;
  resetBtn.title = strings.ui.resetTitle;
  resetBtn.textContent = strings.ui.resetButton;
  hintParagraph.textContent = strings.ui.hint;
  slider.setAttribute('aria-label', strings.ui.sliderLabel);
  numberInput.setAttribute('aria-label', strings.ui.sliderLabel);
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

function handleRuntimeMessage(message) {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'SPEED_UPDATE' && message.tabId === activeTabId) {
    renderSpeed(Number(message.speed) || settings.defaultSpeed);
    if (message.applied) {
      showStatus(strings.status.updated, 'success');
    }
    return;
  }

  if (activeTabId === null) return;

  if (message.type === 'FRAME_STATUS') {
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
  const response = await sendCommandToBackground('POPUP_GET_STATE', {});
  if (!response) {
    setControlsDisabled(true);
    showStatus(strings.status.siteUnsupported, 'error');
    return;
  }

  settings = { ...DEFAULT_SETTINGS, ...response.settings };
  applyTranslations(settings.language || 'en');
  updateBounds(settings);
  renderSpeed(response.speed || settings.defaultSpeed);
  setControlsDisabled(false);

  if (!response.hasPlaying) {
    showStatus(strings.status.playPrompt, 'info');
  } else {
    showStatus('');
  }
}

applyTranslations(DEFAULT_SETTINGS.language);
bootstrap();









