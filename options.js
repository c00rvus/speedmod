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
    saveButton: 'Save',
    restoreButton: 'Restore defaults',
    statusSaved: 'Settings saved.',
    statusErrorPrefix: 'Error saving: ',
    statusInvalidValues: 'Check the values entered.',
    statusInvalidRange: 'Minimum value must be less than maximum.',
    helpHeading: 'Keyboard shortcuts',
    helpText: 'During playback, use the keys <strong>A</strong> (decrease), <strong>S</strong> (default) and <strong>D</strong> (increase). The popup offers the same controls.'
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
    languageOptionPt: 'Português (Brasil)',
    saveButton: 'Salvar',
    restoreButton: 'Restaurar padrão',
    statusSaved: 'Configurações salvas.',
    statusErrorPrefix: 'Erro ao salvar: ',
    statusInvalidValues: 'Revise os valores informados.',
    statusInvalidRange: 'O valor mínimo deve ser menor que o máximo.',
    helpHeading: 'Atalhos rápidos',
    helpText: 'Durante a reprodução, utilize as teclas <strong>A</strong> (diminuir), <strong>S</strong> (padrão) e <strong>D</strong> (aumentar). O popup também permite os mesmos ajustes.'
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
  saveButton.textContent = strings.saveButton;
  restoreDefaultsBtn.textContent = strings.restoreButton;
  helpHeading.textContent = strings.helpHeading;
  helpText.innerHTML = strings.helpText;

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


















