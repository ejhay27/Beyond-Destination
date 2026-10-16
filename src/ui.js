const pad = (value) => String(value).padStart(2, '0');
export const objectives = {
  available: { kicker: 'A SMALL FAVOR', title: 'The Lantern Post', text: 'Find Mira near the pier and ask about the post boat.' },
  fetch: { kicker: 'ERRAND · STEP 1 OF 2', title: 'A sealed parcel', text: 'Pick up the amber-marked package from the end of the pier.' },
  return: { kicker: 'ERRAND · STEP 2 OF 2', title: 'Bring it back', text: 'Return the parcel to Mira at Lantern Post for 35 credits.' },
  done: { kicker: 'MORROW BAY', title: 'A little more light', text: 'The parcel made it safely. The rest of the day is yours.' },
};
const panelCopy = {
  settings: ['PERSONAL FIELD KIT', 'Take a breath.', 'Make the view yours, or keep a local copy of this life.'],
  inventory: ['YOUR BELONGINGS', 'Travel light.', 'Everything you are carrying, on PC or Android.'],
  journal: ['PHONE · LOCAL JOURNAL', 'A day by the bay.', 'Your errand and a few familiar places. Available offline.'],
};

export class GameUI {
  constructor() {
    this.nodes = new Map();
    this.handlers = {};
    this.activePanel = null;
    this.isDialogueOpen = false;
    this.confirmation = null;
    this.toastTimer = 0;
    this.inventoryKey = '';
    this.previousFocus = null;
    this.abort = new AbortController();
    this.bindButtons();
  }

  node(id) {
    if (!this.nodes.has(id)) this.nodes.set(id, document.getElementById(id));
    return this.nodes.get(id);
  }
  text(id, text) {
    const node = this.node(id);
    const value = String(text);
    if (node.textContent !== value) node.textContent = value;
  }
  get isMenuOpen() { return this.activePanel !== null; }
  get isConfirmOpen() { return this.confirmation !== null; }
  get isBlocking() { return this.isMenuOpen || this.isDialogueOpen || this.isConfirmOpen; }

  bindButtons() {
    const on = (id, event, fn) => this.node(id).addEventListener(event, fn, { signal: this.abort.signal });
    on('fieldButton', 'click', () => this.handlers.onOpenSettings?.());
    for (const id of ['closeField', 'resumeButton']) on(id, 'click', () => this.handlers.onCloseSettings?.());
    on('menuBackdrop', 'click', (event) => { if (event.target === this.node('menuBackdrop') && !this.isConfirmOpen) this.handlers.onCloseSettings?.(); });
    on('saveButton', 'click', () => this.handlers.onSave?.());
    on('loadButton', 'click', () => this.handlers.onLoad?.());
    on('exportButton', 'click', () => this.handlers.onExport?.());
    on('importButton', 'click', () => this.node('importFile').click());
    on('importFile', 'change', async () => {
      const file = this.node('importFile').files?.[0];
      if (!file) return;
      if (file.size > 1_000_000) this.showToast('That save is too large. Choose a Beyond Destination JSON file under 1 MB.');
      else {
        try { await this.handlers.onImport?.(await file.text()); }
        catch { this.showToast('The selected file could not be read. Your current life was not replaced.'); }
      }
      this.node('importFile').value = '';
    });
    on('fullscreenButton', 'click', () => this.handlers.onFullscreen?.());
    on('quitButton', 'click', () => this.handlers.onQuit?.());
    on('dialogueAction', 'click', () => this.handlers.onDialogueAction?.());
    on('closeDialogue', 'click', () => this.handlers.onCloseDialogue?.());
    on('slotSelect', 'change', () => this.handlers.onSlotChange?.(Number(this.node('slotSelect').value)));
    on('qualitySelect', 'change', () => this.handlers.onGraphicsSettings?.({ quality: this.node('qualitySelect').value }));
    on('touchSelect', 'change', () => this.handlers.onTouchSettings?.(this.node('touchSelect').value));
    for (const [id, field, output, format] of [
      ['sensitivitySlider', 'sensitivity', 'sensitivityValue', (v) => `${Math.round(v / 0.006 * 100)}%`],
      ['fovSlider', 'fov', 'fovValue', (v) => `${v}°`],
      ['resolutionSlider', 'renderScale', 'resolutionValue', (v) => `${Math.round(v * 100)}%`],
    ]) on(id, 'input', () => {
      const value = Number(this.node(id).value);
      this.node(output).value = format(value);
      if (field === 'renderScale') this.handlers.onGraphicsSettings?.({ [field]: value });
      else this.handlers.onCameraSettings?.({ [field]: value });
    });
    on('invertToggle', 'change', () => this.handlers.onCameraSettings?.({ invertY: this.node('invertToggle').checked }));
    on('shadowToggle', 'change', () => this.handlers.onGraphicsSettings?.({ shadows: this.node('shadowToggle').checked }));
    on('confirmCancel', 'click', () => this.resolveConfirmation(false));
    on('confirmAccept', 'click', () => this.resolveConfirmation(true));
    document.addEventListener('keydown', (event) => this.trapFocus(event), { signal: this.abort.signal });
  }

  setHandlers(handlers) { this.handlers = { ...this.handlers, ...handlers }; }
  changed() {
    this.node('gameHud').classList.toggle('ui-open', this.isBlocking);
    this.node('worldControls').inert = this.isBlocking;
    this.node('menuBackdrop').inert = this.isConfirmOpen;
    this.node('dialoguePanel').inert = this.isConfirmOpen;
    this.node('fieldButton').disabled = this.isBlocking;
    if (this.isBlocking) this.setNearbyAction(null);
    this.handlers.onUIChange?.();
  }
  rememberFocus() { if (!this.isBlocking) this.previousFocus = document.activeElement; }
  restoreFocus() {
    if (this.previousFocus?.isConnected && !this.previousFocus.closest('[hidden]')) this.previousFocus.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
  }

  update(state) {
    this.text('dayLabel', `DAY ${pad(state.day)}`);
    this.text('clockLabel', `${pad(Math.floor(state.minuteOfDay / 60) % 24)}:${pad(state.minuteOfDay % 60)}`);
    this.text('creditsLabel', state.credits);
    this.text('energyLabel', `${Math.round(state.energy)}%`);
    this.node('energyFill').style.width = `${state.energy}%`;
    this.node('energyFill').style.background = state.energy < 25 ? '#d49a78' : '#a0bdb1';
    const objective = objectives[state.taskStage] ?? objectives.available;
    for (const [id, value] of [['objectiveKicker', objective.kicker], ['objectiveTitle', objective.title], ['objectiveText', objective.text], ['journalKicker', objective.kicker], ['journalTitle', objective.title], ['journalText', objective.text]]) this.text(id, value);
    this.text('journalRoute', {
      available: 'From the road, walk toward the waterfront plaza. Mira stands just to the right of the pier entrance, beside Lantern Post.',
      fetch: 'Walk along the narrow wooden pier into the bay. The parcel is near its far end. The railing keeps you out of the water.',
      return: 'Retrace the pier toward the plaza. Mira is beside Lantern Post, to the right as you reach shore.',
      done: 'Delivered · 35 credits earned. Mira is still at Lantern Post if you want to say hello.',
    }[state.taskStage]);
    if (this.activePanel === 'inventory') this.updateInventory(state);
    const thirdPerson = state.camera.mode === 'third';
    for (const button of document.querySelectorAll('[data-zoom]')) button.disabled = !thirdPerson;
  }

  updateInventory(state) {
    const key = JSON.stringify(state.inventory);
    if (this.inventoryKey === key) return;
    this.inventoryKey = key;
    const items = this.node('inventoryItems');
    items.replaceChildren();
    const append = (icon, title, count, description) => {
      const card = document.createElement('article'); card.className = 'item-card';
      for (const [tag, className, text] of [['div', 'item-icon', icon], ['h3', '', title], ['strong', 'item-count', count], ['p', '', description]]) {
        const node = document.createElement(tag); node.className = className; node.textContent = text; card.append(node);
      }
      items.append(card);
    };
    if (state.inventory.sealedParcel) append('▣', 'Sealed parcel', '× 1 · QUEST ITEM', 'A dry amber seal. Return it to Mira at Lantern Post.');
    if (state.inventory.shells) append('◌', 'Shells', `× ${state.inventory.shells}`, 'Small keepsakes from the coast.');
    if (!items.childElementCount) append('◇', 'Room for a journey', 'BAG EMPTY', 'You are not carrying any items. Speak with Mira to take on her parcel errand.');
  }

  setNearbyAction(label) {
    this.node('interactionPrompt').hidden = !label || this.isBlocking;
    if (label) this.text('interactionText', label);
  }
  setTouchMode(active) {
    document.documentElement.dataset.touch = String(active);
    this.node('touchControls').hidden = !active;
  }

  showDialogue({ name = 'Mira Calder', role = 'LANTERN POST KEEPER', text, actionLabel = 'Continue', initial = 'M' }) {
    this.rememberFocus();
    for (const [id, value] of [['dialogueName', name], ['dialogueRole', role], ['dialogueText', text], ['dialogueAction', `${actionLabel} ↗`], ['dialogueInitial', initial]]) this.text(id, value);
    this.node('dialoguePanel').hidden = false;
    this.isDialogueOpen = true;
    this.changed();
    this.node('dialogueAction').focus({ preventScroll: true });
  }
  closeDialogue() {
    this.node('dialoguePanel').hidden = true;
    this.isDialogueOpen = false;
    this.changed();
    this.restoreFocus();
  }

  openPanel(panel = 'settings') {
    if (!panelCopy[panel]) return;
    this.rememberFocus();
    this.activePanel = panel;
    this.node('menuBackdrop').hidden = false;
    for (const name of Object.keys(panelCopy)) this.node(`${name === 'settings' ? 'settings' : name === 'inventory' ? 'inventory' : 'journal'}Page`).hidden = name !== panel;
    const [kicker, title, description] = panelCopy[panel];
    this.text('panelKicker', kicker); this.text('fieldTitle', title); this.text('panelDescription', description);
    this.node('fieldPanel').scrollTop = 0;
    this.changed();
    this.node('closeField').focus({ preventScroll: true });
  }
  openSettings() { this.openPanel('settings'); }
  closeSettings() {
    if (this.isConfirmOpen) return;
    this.node('menuBackdrop').hidden = true;
    this.activePanel = null;
    this.changed();
    this.restoreFocus();
  }

  setSettings({ slot, sensitivity, fov, invertY, shadows, quality, renderScale, touchControls, savedSlots = [], occupiedSlots = [], activeSlot = slot, native = false }) {
    const slotSelect = this.node('slotSelect');
    for (const option of slotSelect.options) {
      const n = Number(option.value);
      option.textContent = `${pad(n)} · ${savedSlots.includes(n) ? 'Morrow Bay' : occupiedSlots.includes(n) ? 'Unreadable save' : 'Empty journey'}`;
    }
    const setValue = (id, value) => { if (value !== undefined && document.activeElement !== this.node(id)) this.node(id).value = String(value); };
    setValue('slotSelect', slot); setValue('qualitySelect', quality); setValue('touchSelect', touchControls);
    if (Number.isFinite(sensitivity)) { setValue('sensitivitySlider', sensitivity); this.node('sensitivityValue').value = `${Math.round(sensitivity / 0.006 * 100)}%`; }
    if (Number.isFinite(fov)) { setValue('fovSlider', fov); this.node('fovValue').value = `${fov}°`; }
    if (Number.isFinite(renderScale)) { setValue('resolutionSlider', renderScale); this.node('resolutionValue').value = `${Math.round(renderScale * 100)}%`; }
    if (typeof invertY === 'boolean') this.node('invertToggle').checked = invertY;
    if (typeof shadows === 'boolean') this.node('shadowToggle').checked = shadows;
    this.text('storageLabel', native ? 'Android app storage · local only' : 'This browser and origin only');
    this.text('saveStatus', `Active journey: slot ${pad(activeSlot)}. Autosave stays here until you explicitly save or load another slot.`);
    this.node('fullscreenButton').hidden = !document.fullscreenEnabled;
    this.node('quitButton').hidden = !native;
  }

  askConfirmation({ title, text, accept = 'Continue', cancel = 'Keep playing' }) {
    if (this.confirmation) return Promise.resolve(false);
    const focus = document.activeElement;
    this.text('confirmTitle', title); this.text('confirmText', text);
    this.text('confirmAccept', accept); this.text('confirmCancel', cancel);
    this.node('confirmBackdrop').hidden = false;
    return new Promise((resolve) => {
      this.confirmation = { resolve, focus };
      this.changed();
      this.node('confirmCancel').focus({ preventScroll: true });
    });
  }
  resolveConfirmation(accepted) {
    if (!this.confirmation) return;
    const { resolve, focus } = this.confirmation;
    this.confirmation = null;
    this.node('confirmBackdrop').hidden = true;
    this.changed();
    if (focus?.isConnected && !focus.closest('[hidden]')) focus.focus({ preventScroll: true });
    resolve(accepted);
  }
  trapFocus(event) {
    if (event.key !== 'Tab' || !this.isBlocking) return;
    const panel = this.node(this.isConfirmOpen ? 'confirmPanel' : this.isMenuOpen ? 'fieldPanel' : 'dialoguePanel');
    const nodes = [...panel.querySelectorAll('button, input, select, a[href], [tabindex="0"]')].filter((node) => !node.disabled && !node.closest('[hidden]') && node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (!first) { event.preventDefault(); panel.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  showCaptureHint(visible) { this.node('captureHint').classList.toggle('visible', visible && !this.isBlocking); }
  showToast(message) {
    this.text('toast', message); this.node('toast').classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.node('toast').classList.remove('visible'), 4200);
  }
  finishLoading() {
    const screen = this.node('loadingScreen');
    screen?.classList.add('complete');
    window.setTimeout(() => screen?.remove(), 350);
  }
  showError(message) { this.text('errorScreen', message); this.node('errorScreen').hidden = false; }
  dispose() { this.abort.abort(); clearTimeout(this.toastTimer); }
}
