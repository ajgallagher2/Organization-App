const NotificationManager = {
  _timers: [],
  _permission: 'default',

  async init() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }
    this._permission = Notification.permission;
  },

  async requestPermission() {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    this._permission = result;
    return result;
  },

  isEnabled() {
    return this._permission === 'granted';
  },

  getPermission() {
    return this._permission;
  },

  scheduleAll(reminders) {
    this.clearAll();

    if (!this.isEnabled()) return;

    const now = new Date();
    reminders.forEach(reminder => {
      if (!reminder.enabled || !isDueToday(reminder)) return;
      if (ReminderStore.isCompleted(reminder.id)) return;

      const target = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        reminder.hour, reminder.minute, 0
      );

      const delay = target.getTime() - now.getTime();
      if (delay <= 0) return; // Already past

      const timer = setTimeout(() => {
        this._showNotification(reminder);
      }, delay);

      this._timers.push(timer);
    });
  },

  _showNotification(reminder) {
    if (!this.isEnabled()) return;

    const category = PRESET_CATEGORIES.find(c => c.id === reminder.category);
    const icon = category ? category.icon : '\ud83d\udd14';
    const title = `${icon} ${reminder.name}`;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: `Time for: ${reminder.name}`,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: reminder.id,
          renotify: true,
          requireInteraction: true,
        });
      });
    } else {
      new Notification(title, {
        body: `Time for: ${reminder.name}`,
        icon: 'icons/icon-192.png',
      });
    }
  },

  clearAll() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  // Send a test notification
  test() {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled');
      return;
    }
    new Notification('\ud83d\udd14 Test Notification', {
      body: 'Notifications are working!',
      icon: 'icons/icon-192.png',
    });
  },
};
