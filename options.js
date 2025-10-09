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
    pageTitle: 'Speed Settings',
    title: 'Settings',
    valuesHeading: 'Default values',
    defaultSpeedLabel: 'Default speed',
    speedStepLabel: 'Shortcut increment',
    minSpeedLabel: 'Minimum value',
    maxSpeedLabel: 'Maximum value',
    behaviorHeading: 'Behavior',
    applyOnLoad: 'Apply default speed automatically',
    rememberLastSpeed: 'Remember speed per tab during the session',
    languageLabel: 'Language',
    languageOptionEn: 'English',
    languageOptionPt: 'Portuguese (Brazil)',
    shortcutsHeading: 'Shortcut keys',
    shortcutHint: 'Click a field and press the key you want. Press Backspace to clear.',
    decreaseKeyLabel: 'Decrease speed key',
    resetKeyLabel: 'Default speed key',
    increaseKeyLabel: 'Increase speed key',
    saveButton: 'Save',
    restoreButton: 'Restore defaults',
    statusSaved: 'Settings saved.',
    statusErrorPrefix: 'Error saving: ',
    statusInvalidValues: 'Check the values entered.',
    statusInvalidRange: 'Minimum value must be less than maximum.',
    statusInvalidShortcut: 'Choose one letter or number for each shortcut.',
    statusDuplicateShortcuts: 'Use different keys for each shortcut.',
    helpHeading: 'Keyboard shortcuts',
    helpText(keys) {
      const { decrease, reset, increase } = keys;
      return `During playback, use the keys <strong>${decrease}</strong> (decrease), <strong>${reset}</strong> (default) and <strong>${increase}</strong> (increase). The popup offers the same controls.`;
    }
  },
  'pt-BR': {
    pageTitle: 'Configurações de Velocidade',
    title: 'Configurações',
    valuesHeading: 'Valores padrão',
    defaultSpeedLabel: 'Velocidade padrão',
    speedStepLabel: 'Incremento dos atalhos',
    minSpeedLabel: 'Valor mínimo',
    maxSpeedLabel: 'Valor máximo',
    behaviorHeading: 'Comportamento',
    applyOnLoad: 'Aplicar velocidade padrão automaticamente',
    rememberLastSpeed: 'Lembrar velocidade por aba durante a sessão',
    languageLabel: 'Idioma',
    languageOptionEn: 'Inglês',
    languageOptionPt: 'Portugu\u00EAs (Brasil)',
    shortcutsHeading: 'Atalhos de teclado',
    shortcutHint: 'Clique em um campo e pressione a tecla desejada. Use Backspace para limpar.',
    decreaseKeyLabel: 'Tecla para diminuir a velocidade',
    resetKeyLabel: 'Tecla para velocidade padr\u00E3o',
    increaseKeyLabel: 'Tecla para aumentar a velocidade',
    saveButton: 'Salvar',
    restoreButton: 'Restaurar padrão',
    statusSaved: 'Configurações salvas.',
    statusErrorPrefix: 'Erro ao salvar: ',
    statusInvalidValues: 'Revise os valores informados.',
    statusInvalidRange: 'O valor mínimo deve ser menor que o máximo.',
    helpHeading: 'Atalhos r\u00E1pidos',
    helpText(keys) {
      const { decrease, reset, increase } = keys;
      return `Durante a reprodu\u00E7\u00E3o, utilize as teclas <strong>${decrease}</strong> (diminuir), <strong>${reset}</strong> (padr\u00E3o) e <strong>${increase}</strong> (aumentar). O popup tamb\u00E9m permite os mesmos ajustes.`;
    }
  }
};

const form = document.getElementById('settingsForm');
const defaultSpeedInput = document.getElementById('defaultSpeed');
const speedStepInput = document.getElementById('speedStep');
const minSpeedInput = document.getElementById('minSpeed');
const maxSpeedInput = document.getElementById('maxSpeed');
const applyOnLoadInput = document.getElementById('applyOnLoad');
const rememberLastSpeedInput = document.getElementById('rememberLastSpeed');
const languageSelect = document.getElementById('language');
const saveStatus = document.getElementById('saveStatus');
const restoreDefaultsBtn = document.getElementById('restoreDefaults');
const saveButton = document.getElementById('saveButton');

const titleHeading = document.getElementById('titleHeading');
const valuesHeading = document.getElementById('valuesHeading');
const labelDefaultSpeed = document.querySelector('#labelDefaultSpeed span');
const labelSpeedStep = document.querySelector('#labelSpeedStep span');
const labelMinSpeed = document.querySelector('#labelMinSpeed span');
const labelMaxSpeed = document.querySelector('#labelMaxSpeed span');
const behaviorHeading = document.getElementById('behaviorHeading');
const labelApplyOnLoad = document.querySelector('#labelApplyOnLoad span');
const labelRememberLastSpeed = document.querySelector('#labelRememberLastSpeed span');
const labelLanguage = document.querySelector('#labelLanguage span');
const helpHeading = document.getElementById('helpHeading');
const helpText = document.getElementById('helpText');
const shortcutsHeading = document.getElementById('shortcutsHeading');
const shortcutHint = document.getElementById('shortcutHint');
const labelDecreaseKey = document.querySelector('#labelDecreaseKey span');
const labelResetKey = document.querySelector('#labelResetKey span');
const labelIncreaseKey = document.querySelector('#labelIncreaseKey span');
const decreaseKeyInput = document.getElementById('decreaseKey');
const resetKeyInput = document.getElementById('resetKey');
const increaseKeyInput = document.getElementById('increaseKey');

let strings = TRANSLATIONS.en;
applyTranslations(DEFAULT_SETTINGS.language);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = readFormValues();
  if (!values) {
    return;
  }
  await saveSettings(values);
});

restoreDefaultsBtn.addEventListener('click', async () => {
  const defaults = { ...DEFAULT_SETTINGS };
  fillForm(defaults);
  await saveSettings(defaults);
});

languageSelect.addEventListener('change', () => {
  applyTranslations(languageSelect.value);
});

[decreaseKeyInput, resetKeyInput, increaseKeyInput].forEach((input) => {
  input.addEventListener('keydown', handleShortcutKeydown);
  input.addEventListener('input', handleShortcutInput);
  input.addEventListener('focus', (event) => {
    event.target.select();
  });
});

function applyTranslations(lang) {
  strings = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.documentElement.lang = lang;

  titleHeading.textContent = strings.title;
  document.title = strings.pageTitle;
  valuesHeading.textContent = strings.valuesHeading;
  labelDefaultSpeed.textContent = strings.defaultSpeedLabel;
  labelSpeedStep.textContent = strings.speedStepLabel;
  labelMinSpeed.textContent = strings.minSpeedLabel;
  labelMaxSpeed.textContent = strings.maxSpeedLabel;
  behaviorHeading.textContent = strings.behaviorHeading;
  labelApplyOnLoad.textContent = strings.applyOnLoad;
  labelRememberLastSpeed.textContent = strings.rememberLastSpeed;
  labelLanguage.textContent = strings.languageLabel;
  shortcutsHeading.textContent = strings.shortcutsHeading;
  shortcutHint.textContent = strings.shortcutHint;
  labelDecreaseKey.textContent = strings.decreaseKeyLabel;
  labelResetKey.textContent = strings.resetKeyLabel;
  labelIncreaseKey.textContent = strings.increaseKeyLabel;
  saveButton.textContent = strings.saveButton;
  restoreDefaultsBtn.textContent = strings.restoreButton;
  helpHeading.textContent = strings.helpHeading;
  updateShortcutSummary();

  const options = languageSelect.options;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i].value === 'en') {
      options[i].textContent = strings.languageOptionEn;
    }
    if (options[i].value === 'pt-BR') {
      options[i].textContent = strings.languageOptionPt;
    }
  }
}

function sanitizeShortcutDisplayValue(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const char = trimmed[0];
  if (!/^[a-z0-9]$/i.test(char)) {
    return '';
  }
  return char.toUpperCase();
}

function normalizeShortcutValue(raw) {
  const formatted = sanitizeShortcutDisplayValue(raw);
  return formatted ? formatted.toLowerCase() : '';
}

function getShortcutDisplay() {
  return {
    decrease: sanitizeShortcutDisplayValue(decreaseKeyInput.value) || DEFAULT_SETTINGS.decreaseKey.toUpperCase(),
    reset: sanitizeShortcutDisplayValue(resetKeyInput.value) || DEFAULT_SETTINGS.resetKey.toUpperCase(),
    increase: sanitizeShortcutDisplayValue(increaseKeyInput.value) || DEFAULT_SETTINGS.increaseKey.toUpperCase()
  };
}

function updateShortcutSummary() {
  if (helpText && typeof strings.helpText === 'function') {
    helpText.innerHTML = strings.helpText(getShortcutDisplay());
  }
}

function handleShortcutKeydown(event) {
  if (event.key === 'Tab') {
    return;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    event.target.value = '';
    updateShortcutSummary();
    return;
  }
  if (event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
    event.preventDefault();
    event.target.value = event.key.toUpperCase();
    updateShortcutSummary();
    return;
  }
  if (event.key.length === 1) {
    event.preventDefault();
  }
}

function handleShortcutInput(event) {
  event.target.value = sanitizeShortcutDisplayValue(event.target.value);
  updateShortcutSummary();
}

function readFormValues() {
  const values = {
    defaultSpeed: parseFloat(defaultSpeedInput.value),
    speedStep: parseFloat(speedStepInput.value),
    minSpeed: parseFloat(minSpeedInput.value),
    maxSpeed: parseFloat(maxSpeedInput.value),
    applyOnLoad: applyOnLoadInput.checked,
    rememberLastSpeed: rememberLastSpeedInput.checked,
    language: languageSelect.value
  };

  if (!Number.isFinite(values.defaultSpeed) || !Number.isFinite(values.speedStep)) {
    showStatus(strings.statusInvalidValues, true);
    return null;
  }

  if (values.minSpeed >= values.maxSpeed) {
    showStatus(strings.statusInvalidRange, true);
    return null;
  }

  const decreaseKey = normalizeShortcutValue(decreaseKeyInput.value);
  const resetKey = normalizeShortcutValue(resetKeyInput.value);
  const increaseKey = normalizeShortcutValue(increaseKeyInput.value);

  if (!decreaseKey || !resetKey || !increaseKey) {
    showStatus(strings.statusInvalidShortcut, true);
    return null;
  }

  const uniqueKeys = new Set([decreaseKey, resetKey, increaseKey]);
  if (uniqueKeys.size < 3) {
    showStatus(strings.statusDuplicateShortcuts, true);
    return null;
  }

  values.decreaseKey = decreaseKey;
  values.resetKey = resetKey;
  values.increaseKey = increaseKey;

  return values;
}

function saveSettings(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, () => {
      if (chrome.runtime.lastError) {
        showStatus(strings.statusErrorPrefix + chrome.runtime.lastError.message, true);
        resolve();
        return;
      }
      showStatus(strings.statusSaved);
      resolve();
    });
  });
}

function fillForm(settings) {
  defaultSpeedInput.value = settings.defaultSpeed;
  speedStepInput.value = settings.speedStep;
  minSpeedInput.value = settings.minSpeed;
  maxSpeedInput.value = settings.maxSpeed;
  applyOnLoadInput.checked = Boolean(settings.applyOnLoad);
  rememberLastSpeedInput.checked = Boolean(settings.rememberLastSpeed);
  decreaseKeyInput.value = sanitizeShortcutDisplayValue(settings.decreaseKey) || DEFAULT_SETTINGS.decreaseKey.toUpperCase();
  resetKeyInput.value = sanitizeShortcutDisplayValue(settings.resetKey) || DEFAULT_SETTINGS.resetKey.toUpperCase();
  increaseKeyInput.value = sanitizeShortcutDisplayValue(settings.increaseKey) || DEFAULT_SETTINGS.increaseKey.toUpperCase();
  languageSelect.value = settings.language || 'en';
  applyTranslations(languageSelect.value);
}

function showStatus(message, isError = false) {
  saveStatus.textContent = message || '';
  saveStatus.style.color = isError ? '#d62828' : '#1f7a1f';
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    fillForm({ ...DEFAULT_SETTINGS, ...items });
    showStatus('');
  });
}

loadSettings();




















