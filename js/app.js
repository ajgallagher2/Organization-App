const App = {
  currentScreen: 'home',
  selectedCategory: null,
  selectedRecurrence: 'daily',
  selectedDays: [],
  editingId: null,

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.renderCategoryGrid();
    this.updateDateHeader();
    this.switchScreen('home');

    await NotificationManager.init();
    this.updateNotificationButton();

    // First launch: seed presets if no reminders exist
    if (ReminderStore.getAll().length === 0) {
      this.loadPresetReminders();
    }

    // Schedule notifications
    this.scheduleNotifications();

    // Re-schedule when app regains focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateDateHeader();
        this.renderCurrentScreen();
        this.scheduleNotifications();
      }
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js');
    }

    // Prompt to install if not already installed
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._installPrompt = e;
    });
  },

  cacheElements() {
    this.$ = {
      headerDate: document.getElementById('header-date'),
      screens: {
        home: document.getElementById('screen-home'),
        all: document.getElementById('screen-all'),
        settings: document.getElementById('screen-settings'),
      },
      remindersList: document.getElementById('reminders-list'),
      allRemindersList: document.getElementById('all-reminders-list'),
      emptyState: document.getElementById('empty-state'),
      allEmptyState: document.getElementById('all-empty-state'),
      progressBar: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      navBtns: document.querySelectorAll('.nav-btn[data-screen]'),
      addBtn: document.getElementById('btn-add'),
      panelOverlay: document.getElementById('panel-overlay'),
      addPanel: document.getElementById('add-panel'),
      panelTitle: document.getElementById('panel-title'),
      form: document.getElementById('reminder-form'),
      editId: document.getElementById('edit-id'),
      nameInput: document.getElementById('reminder-name'),
      timeInput: document.getElementById('reminder-time'),
      categoryGrid: document.getElementById('category-grid'),
      recBtns: document.querySelectorAll('.rec-btn'),
      dayPicker: document.getElementById('day-picker'),
      dayBtns: document.querySelectorAll('.day-btn'),
      monthDayPicker: document.getElementById('month-day-picker'),
      monthDayInput: document.getElementById('month-day'),
      cancelBtn: document.getElementById('btn-cancel'),
      deleteBtn: document.getElementById('btn-delete'),
      toast: document.getElementById('toast'),
      btnEnableNotifications: document.getElementById('btn-enable-notifications'),
      btnReset: document.getElementById('btn-reset'),
      btnLoadPresets: document.getElementById('btn-load-presets'),
      btnSettings: document.getElementById('btn-settings'),
    };
  },

  bindEvents() {
    // Navigation
    this.$.navBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchScreen(btn.dataset.screen));
    });

    this.$.btnSettings.addEventListener('click', () => this.switchScreen('settings'));

    // Add button
    this.$.addBtn.addEventListener('click', () => this.openAddPanel());

    // Panel overlay
    this.$.panelOverlay.addEventListener('click', () => this.closePanel());

    // Cancel button
    this.$.cancelBtn.addEventListener('click', () => this.closePanel());

    // Delete button
    this.$.deleteBtn.addEventListener('click', () => this.deleteReminder());

    // Form submit
    this.$.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveReminder();
    });

    // Recurrence buttons
    this.$.recBtns.forEach(btn => {
      btn.addEventListener('click', () => this.selectRecurrence(btn.dataset.rec));
    });

    // Day buttons
    this.$.dayBtns.forEach(btn => {
      btn.addEventListener('click', () => this.toggleDay(parseInt(btn.dataset.day)));
    });

    // Settings
    this.$.btnEnableNotifications.addEventListener('click', () => this.toggleNotifications());
    this.$.btnReset.addEventListener('click', () => this.resetAll());
    this.$.btnLoadPresets.addEventListener('click', () => this.loadPresetReminders());
  },

  // --- Screen Navigation ---
  switchScreen(screen) {
    this.currentScreen = screen;

    // Update nav buttons
    this.$.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    // Show/hide screens
    Object.entries(this.$.screens).forEach(([key, el]) => {
      el.classList.toggle('active', key === screen);
    });

    // Update header
    const titles = { home: 'Today', all: 'All Reminders', settings: 'Settings' };
    document.querySelector('#app-header h1').textContent = titles[screen] || 'Reminders';

    this.renderCurrentScreen();
  },

  renderCurrentScreen() {
    if (this.currentScreen === 'home') this.renderTodayReminders();
    else if (this.currentScreen === 'all') this.renderAllReminders();
  },

  // --- Date Header ---
  updateDateHeader() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    this.$.headerDate.textContent = now.toLocaleDateString('en-US', options);
  },

  // --- Today's Reminders ---
  renderTodayReminders() {
    const reminders = getTodaysReminders();

    if (reminders.length === 0) {
      this.$.remindersList.innerHTML = '';
      this.$.emptyState.classList.remove('hidden');
      this.$.progressBar.parentElement.classList.add('hidden');
      return;
    }

    this.$.emptyState.classList.add('hidden');
    this.$.progressBar.parentElement.classList.remove('hidden');

    // Progress
    const completed = reminders.filter(r => ReminderStore.isCompleted(r.id)).length;
    const pct = Math.round((completed / reminders.length) * 100);
    this.$.progressBar.style.width = pct + '%';
    this.$.progressText.textContent = `${completed} / ${reminders.length} done`;

    // Cards
    this.$.remindersList.innerHTML = reminders.map(r => {
      const cat = PRESET_CATEGORIES.find(c => c.id === r.category);
      const icon = cat ? cat.icon : (r.icon || '\ud83d\udd14');
      const color = cat ? cat.color : '#6C63FF';
      const done = ReminderStore.isCompleted(r.id);
      const now = new Date();
      const reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), r.hour, r.minute);
      const isPast = reminderTime < now;

      return `
        <div class="reminder-card ${done ? 'completed' : ''}" data-id="${r.id}">
          <div class="reminder-icon" style="background:${color}20">${icon}</div>
          <div class="reminder-info">
            <div class="reminder-name">${this.escapeHtml(r.name)}</div>
            <div class="reminder-meta">${formatTime(r.hour, r.minute)}${isPast && !done ? ' \u2022 Overdue' : ''}</div>
          </div>
          <div class="reminder-check ${done ? 'checked' : ''}" data-check="${r.id}"></div>
        </div>`;
    }).join('');

    // Bind check buttons
    this.$.remindersList.querySelectorAll('.reminder-check').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        ReminderStore.toggleCompletion(el.dataset.check);
        this.renderTodayReminders();
        this.scheduleNotifications();
      });
    });

    // Bind card tap to edit
    this.$.remindersList.querySelectorAll('.reminder-card').forEach(el => {
      el.addEventListener('click', () => this.openEditPanel(el.dataset.id));
    });
  },

  // --- All Reminders ---
  renderAllReminders() {
    const reminders = ReminderStore.getAll().sort((a, b) => {
      const aMin = a.hour * 60 + a.minute;
      const bMin = b.hour * 60 + b.minute;
      return aMin - bMin;
    });

    if (reminders.length === 0) {
      this.$.allRemindersList.innerHTML = '';
      this.$.allEmptyState.classList.remove('hidden');
      return;
    }

    this.$.allEmptyState.classList.add('hidden');

    this.$.allRemindersList.innerHTML = reminders.map(r => {
      const cat = PRESET_CATEGORIES.find(c => c.id === r.category);
      const icon = cat ? cat.icon : (r.icon || '\ud83d\udd14');
      const color = cat ? cat.color : '#6C63FF';

      return `
        <div class="reminder-card" data-id="${r.id}">
          <div class="reminder-icon" style="background:${color}20">${icon}</div>
          <div class="reminder-info">
            <div class="reminder-name">${this.escapeHtml(r.name)}</div>
            <div class="reminder-meta">${formatTime(r.hour, r.minute)} \u2022 ${formatRecurrence(r)}</div>
          </div>
          <label class="reminder-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} data-toggle="${r.id}">
            <span class="toggle-slider"></span>
          </label>
        </div>`;
    }).join('');

    // Toggle handlers
    this.$.allRemindersList.querySelectorAll('input[data-toggle]').forEach(el => {
      el.addEventListener('change', () => {
        ReminderStore.update(el.dataset.toggle, { enabled: el.checked });
        this.scheduleNotifications();
      });
    });

    // Card tap to edit
    this.$.allRemindersList.querySelectorAll('.reminder-card').forEach(el => {
      el.addEventListener('click', () => this.openEditPanel(el.dataset.id));
    });
  },

  // --- Add/Edit Panel ---
  openAddPanel() {
    this.editingId = null;
    this.$.panelTitle.textContent = 'New Reminder';
    this.$.deleteBtn.classList.add('hidden');
    this.$.editId.value = '';
    this.$.nameInput.value = '';
    this.$.timeInput.value = '09:00';
    this.selectedCategory = null;
    this.selectedRecurrence = 'daily';
    this.selectedDays = [];

    this.updateCategoryGrid();
    this.selectRecurrence('daily');
    this.showPanel();
  },

  openEditPanel(id) {
    const reminder = ReminderStore.get(id);
    if (!reminder) return;

    this.editingId = id;
    this.$.panelTitle.textContent = 'Edit Reminder';
    this.$.deleteBtn.classList.remove('hidden');
    this.$.editId.value = id;
    this.$.nameInput.value = reminder.name;
    this.$.timeInput.value =
      String(reminder.hour).padStart(2, '0') + ':' + String(reminder.minute).padStart(2, '0');
    this.selectedCategory = reminder.category;
    this.selectedRecurrence = reminder.recurrence;
    this.selectedDays = reminder.days ? [...reminder.days] : [];

    if (reminder.monthDay) {
      this.$.monthDayInput.value = reminder.monthDay;
    }

    this.updateCategoryGrid();
    this.selectRecurrence(reminder.recurrence);
    this.updateDayButtons();
    this.showPanel();
  },

  showPanel() {
    this.$.panelOverlay.classList.remove('hidden');
    this.$.addPanel.classList.remove('hidden');
    // Trigger reflow for animation
    requestAnimationFrame(() => {
      this.$.panelOverlay.classList.add('visible');
      this.$.addPanel.classList.add('visible');
    });
  },

  closePanel() {
    this.$.panelOverlay.classList.remove('visible');
    this.$.addPanel.classList.remove('visible');
    setTimeout(() => {
      this.$.panelOverlay.classList.add('hidden');
      this.$.addPanel.classList.add('hidden');
    }, 300);
  },

  // --- Category Grid ---
  renderCategoryGrid() {
    const allCats = [...PRESET_CATEGORIES, { id: 'custom', name: 'Custom', icon: '\u2795', color: '#999' }];
    this.$.categoryGrid.innerHTML = allCats.map(c => `
      <button type="button" class="category-btn" data-cat="${c.id}">
        <span class="cat-icon">${c.icon}</span>
        <span class="cat-name">${c.name}</span>
      </button>
    `).join('');

    this.$.categoryGrid.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.dataset.cat;
        this.updateCategoryGrid();

        // Auto-fill name from category
        if (btn.dataset.cat !== 'custom') {
          const cat = PRESET_CATEGORIES.find(c => c.id === btn.dataset.cat);
          if (cat && !this.$.nameInput.value) {
            this.$.nameInput.value = cat.name;
          }
        } else {
          this.$.nameInput.value = '';
          this.$.nameInput.focus();
        }
      });
    });
  },

  updateCategoryGrid() {
    this.$.categoryGrid.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.cat === this.selectedCategory);
    });
  },

  // --- Recurrence ---
  selectRecurrence(rec) {
    this.selectedRecurrence = rec;
    this.$.recBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.rec === rec);
    });

    // Show/hide day picker
    const showDays = rec === 'specific_days' || rec === 'weekly';
    this.$.dayPicker.classList.toggle('hidden', !showDays);
    this.$.monthDayPicker.classList.toggle('hidden', rec !== 'monthly');

    if (rec === 'weekly' && this.selectedDays.length > 1) {
      this.selectedDays = [this.selectedDays[0]];
      this.updateDayButtons();
    }
  },

  toggleDay(day) {
    if (this.selectedRecurrence === 'weekly') {
      this.selectedDays = [day];
    } else {
      const idx = this.selectedDays.indexOf(day);
      if (idx >= 0) this.selectedDays.splice(idx, 1);
      else this.selectedDays.push(day);
    }
    this.updateDayButtons();
  },

  updateDayButtons() {
    this.$.dayBtns.forEach(btn => {
      btn.classList.toggle('selected', this.selectedDays.includes(parseInt(btn.dataset.day)));
    });
  },

  // --- Save Reminder ---
  saveReminder() {
    const name = this.$.nameInput.value.trim();
    if (!name) {
      this.showToast('Please enter a name');
      return;
    }

    if (!this.selectedCategory) {
      this.showToast('Please select a category');
      return;
    }

    const [hour, minute] = this.$.timeInput.value.split(':').map(Number);

    if ((this.selectedRecurrence === 'specific_days' || this.selectedRecurrence === 'weekly')
        && this.selectedDays.length === 0) {
      this.showToast('Please select at least one day');
      return;
    }

    const reminder = {
      name,
      category: this.selectedCategory,
      hour,
      minute,
      recurrence: this.selectedRecurrence,
      days: this.selectedDays.length > 0 ? [...this.selectedDays] : undefined,
      monthDay: this.selectedRecurrence === 'monthly' ? parseInt(this.$.monthDayInput.value) : undefined,
    };

    if (this.editingId) {
      ReminderStore.update(this.editingId, reminder);
      this.showToast('Reminder updated');
    } else {
      ReminderStore.add(reminder);
      this.showToast('Reminder created');
    }

    this.closePanel();
    this.renderCurrentScreen();
    this.scheduleNotifications();
  },

  deleteReminder() {
    if (!this.editingId) return;

    if (confirm('Delete this reminder?')) {
      ReminderStore.remove(this.editingId);
      this.closePanel();
      this.renderCurrentScreen();
      this.scheduleNotifications();
      this.showToast('Reminder deleted');
    }
  },

  // --- Notifications ---
  async toggleNotifications() {
    if (NotificationManager.isEnabled()) {
      this.showToast('Disable notifications in browser settings');
      return;
    }

    const result = await NotificationManager.requestPermission();
    this.updateNotificationButton();

    if (result === 'granted') {
      this.showToast('Notifications enabled!');
      NotificationManager.test();
      this.scheduleNotifications();
    } else if (result === 'denied') {
      this.showToast('Notifications blocked — check browser settings');
    }
  },

  updateNotificationButton() {
    const btn = this.$.btnEnableNotifications;
    if (NotificationManager.isEnabled()) {
      btn.textContent = 'Enabled';
      btn.classList.add('enabled');
    } else {
      btn.textContent = 'Enable';
      btn.classList.remove('enabled');
    }
  },

  scheduleNotifications() {
    const reminders = ReminderStore.getAll();
    NotificationManager.scheduleAll(reminders);
  },

  // --- Settings Actions ---
  resetAll() {
    if (confirm('Delete all reminders? This cannot be undone.')) {
      ReminderStore.save([]);
      localStorage.removeItem('completions_v1');
      this.renderCurrentScreen();
      this.showToast('All reminders deleted');
    }
  },

  loadPresetReminders() {
    const presets = [
      { name: 'Gym',         category: 'gym',       hour: 7,  minute: 0,  recurrence: 'specific_days', days: [1, 3, 5] },
      { name: 'Study',       category: 'study',     hour: 18, minute: 0,  recurrence: 'daily' },
      { name: 'Buy Groceries', category: 'groceries', hour: 10, minute: 0,  recurrence: 'weekly', days: [0] },
      { name: 'Cook Meals',  category: 'cooking',   hour: 12, minute: 0,  recurrence: 'daily' },
      { name: 'Laundry',     category: 'laundry',   hour: 9,  minute: 0,  recurrence: 'weekly', days: [6] },
      { name: 'Pay Bills',   category: 'bills',     hour: 10, minute: 0,  recurrence: 'monthly', monthDay: 1 },
      { name: 'Take Medicine', category: 'medicine', hour: 8,  minute: 0,  recurrence: 'daily' },
      { name: 'Drink Water', category: 'water',     hour: 9,  minute: 0,  recurrence: 'daily' },
      { name: 'Sleep Early', category: 'sleep',     hour: 22, minute: 30, recurrence: 'daily' },
      { name: 'Read',        category: 'reading',   hour: 21, minute: 0,  recurrence: 'daily' },
    ];

    presets.forEach(p => ReminderStore.add(p));
    this.renderCurrentScreen();
    this.scheduleNotifications();
    this.showToast('Preset reminders loaded');
  },

  // --- Utilities ---
  showToast(msg) {
    this.$.toast.textContent = msg;
    this.$.toast.classList.remove('hidden');
    requestAnimationFrame(() => this.$.toast.classList.add('visible'));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.$.toast.classList.remove('visible');
      setTimeout(() => this.$.toast.classList.add('hidden'), 300);
    }, 2500);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
