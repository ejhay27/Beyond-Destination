const pad = (value) => String(value).padStart(2, '0');

function clockText(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

const objectives = {
  available: {
    kicker: 'A SMALL FAVOR',
    title: 'The Lantern Post',
    text: 'Find Mira near the pier and ask about the post boat.',
  },
  fetch: {
    kicker: 'ERRAND · STEP 1 OF 2',
    title: 'A sealed parcel',
    text: 'Pick up the amber-marked package from the end of the pier.',
  },
  return: {
    kicker: 'ERRAND · STEP 2 OF 2',
    title: 'Bring it back',
    text: 'Return the parcel to Mira at Lantern Post for 35 credits.',
  },
  done: {
    kicker: 'MORROW BAY',
    title: 'A little more light',
    text: 'The parcel made it safely. The rest of the day is yours.',
  },
};

export class GameUI {
  constructor() {
    this.hud = document.getElementById('gameHud');
    this.dialoguePanel = document.getElementById('dialoguePanel');
    this.menuBackdrop = document.getElementById('menuBackdrop');
    this.interactionPrompt = document.getElementById('interactionPrompt');
    this.captureHint = document.getElementById('captureHint');
    this.toast = document.getElementById('toast');
    this.currentDialogue = null;
    this.isMenuOpen = false;
    this.isDialogueOpen = false;
    this.handlers = {};
    this.toastTimer = 0;
    this.bindButtons();
  }

  bindButtons() {
    document.getElementById('fieldButton').addEventListener('click', () => this.handlers.onOpenSettings?.());
    document.getElementById('closeField').addEventListener('click', () => this.handlers.onCloseSettings?.());
    document.getElementById('resumeButton').addEventListener('click', () => this.handlers.onCloseSettings?.());
    document.getElementById('menuBackdrop').addEventListener('click', (event) => {
      if (event.target === this.menuBackdrop) this.handlers.onCloseSettings?.();
    });
    document.getElementById('saveButton').addEventListener('click', () => this.handlers.onSave?.());
    document.getElementById('loadButton').addEventListener('click', () => this.handlers.onLoad?.());
    document.getElementById('dialogueAction').addEventListener('click', () => this.handlers.onDialogueAction?.());
    document.getElementById('closeDialogue').addEventListener('click', () => this.handlers.onCloseDialogue?.());

    const slotSelect = document.getElementById('slotSelect');
    slotSelect.addEventListener('change', () => this.handlers.onSlotChange?.(Number(slotSelect.value)));

    const sensitivity = document.getElementById('sensitivitySlider');
    sensitivity.addEventListener('input', () => {
      const value = Number(sensitivity.value);
      document.getElementById('sensitivityValue').value = `${Math.round((value / 0.006) * 100)}%`;
      this.handlers.onCameraSettings?.({ sensitivity: value });
    });

    const fov = document.getElementById('fovSlider');
    fov.addEventListener('input', () => {
      const value = Number(fov.value);
      document.getElementById('fovValue').value = `${value}°`;
      this.handlers.onCameraSettings?.({ fov: value });
    });

    const invert = document.getElementById('invertToggle');
    invert.addEventListener('change', () => this.handlers.onCameraSettings?.({ invertY: invert.checked }));

    const shadows = document.getElementById('shadowToggle');
    shadows.addEventListener('change', () => this.handlers.onGraphicsSettings?.({ shadows: shadows.checked }));
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  update(state) {
    document.getElementById('dayLabel').textContent = `DAY ${pad(state.day)}`;
    document.getElementById('clockLabel').textContent = clockText(state.minuteOfDay);
    document.getElementById('creditsLabel').textContent = String(state.credits);
    document.getElementById('energyLabel').textContent = `${Math.round(state.energy)}%`;
    document.getElementById('energyFill').style.width = `${state.energy}%`;
    document.getElementById('energyFill').style.background = state.energy < 25 ? '#d49a78' : '#a0bdb1';

    const objective = objectives[state.taskStage] ?? objectives.available;
    document.getElementById('objectiveKicker').textContent = objective.kicker;
    document.getElementById('objectiveTitle').textContent = objective.title;
    document.getElementById('objectiveText').textContent = objective.text;
  }

  setNearbyAction(label) {
    if (!label) {
      this.interactionPrompt.hidden = true;
      return;
    }
    document.getElementById('interactionText').textContent = label;
    this.interactionPrompt.hidden = false;
  }

  showDialogue({ name = 'Mira Calder', role = 'LANTERN POST KEEPER', text, actionLabel = 'Continue', initial = 'M' }) {
    this.currentDialogue = { name, role, text, actionLabel };
    document.getElementById('dialogueName').textContent = name;
    document.getElementById('dialogueRole').textContent = role;
    document.getElementById('dialogueText').textContent = text;
    document.getElementById('dialogueAction').innerHTML = `${actionLabel} <span>↗</span>`;
    document.getElementById('dialogueInitial').textContent = initial;
    this.dialoguePanel.hidden = false;
    this.isDialogueOpen = true;
    this.hud.classList.add('ui-open');
    this.setNearbyAction(null);
  }

  closeDialogue() {
    this.dialoguePanel.hidden = true;
    this.isDialogueOpen = false;
    this.currentDialogue = null;
    if (!this.isMenuOpen) this.hud.classList.remove('ui-open');
  }

  openSettings() {
    this.menuBackdrop.hidden = false;
    this.isMenuOpen = true;
    this.hud.classList.add('ui-open');
    this.setNearbyAction(null);
  }

  closeSettings() {
    this.menuBackdrop.hidden = true;
    this.isMenuOpen = false;
    if (!this.isDialogueOpen) this.hud.classList.remove('ui-open');
  }

  setSettings({ slot, sensitivity, fov, invertY, shadows, savedSlots = [] }) {
    const slotSelect = document.getElementById('slotSelect');
    for (const option of slotSelect.options) {
      const optionSlot = Number(option.value);
      const label = optionSlot === 1 ? 'Morrow Bay' : 'Journey';
      option.textContent = `${String(optionSlot).padStart(2, '0')} · ${savedSlots.includes(optionSlot) ? label : 'Empty journey'}`;
    }
    if (slot && document.activeElement !== slotSelect) slotSelect.value = String(slot);
    if (Number.isFinite(sensitivity)) {
      const input = document.getElementById('sensitivitySlider');
      if (document.activeElement !== input) input.value = String(sensitivity);
      document.getElementById('sensitivityValue').value = `${Math.round((sensitivity / 0.006) * 100)}%`;
    }
    if (Number.isFinite(fov)) {
      const input = document.getElementById('fovSlider');
      if (document.activeElement !== input) input.value = String(fov);
      document.getElementById('fovValue').value = `${fov}°`;
    }
    if (typeof invertY === 'boolean') document.getElementById('invertToggle').checked = invertY;
    if (typeof shadows === 'boolean') document.getElementById('shadowToggle').checked = shadows;
  }

  showCaptureHint(visible) {
    this.captureHint.classList.toggle('visible', visible && !this.isMenuOpen && !this.isDialogueOpen);
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 2400);
  }

  finishLoading() {
    const screen = document.getElementById('loadingScreen');
    screen.classList.add('complete');
    window.setTimeout(() => screen.remove(), 500);
  }

  showError(message) {
    const screen = document.getElementById('errorScreen');
    screen.textContent = message;
    screen.hidden = false;
  }
}
