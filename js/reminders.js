const PRESET_CATEGORIES = [
  { id: 'gym',       name: 'Gym',       icon: '\ud83c\udfcb\ufe0f', color: '#FF6B6B' },
  { id: 'study',     name: 'Study',     icon: '\ud83d\udcda', color: '#4ECDC4' },
  { id: 'groceries', name: 'Groceries', icon: '\ud83d\uded2', color: '#45B7D1' },
  { id: 'cooking',   name: 'Cooking',   icon: '\ud83c\udf73', color: '#F7DC6F' },
  { id: 'laundry',   name: 'Laundry',   icon: '\ud83e\uddf9', color: '#BB8FCE' },
  { id: 'bills',     name: 'Bills',     icon: '\ud83d\udcb3', color: '#82E0AA' },
  { id: 'medicine',  name: 'Medicine',  icon: '\ud83d\udc8a', color: '#F1948A' },
  { id: 'water',     name: 'Water',     icon: '\ud83d\udca7', color: '#85C1E9' },
  { id: 'sleep',     name: 'Sleep',     icon: '\ud83d\ude34', color: '#7FB3D8' },
  { id: 'reading',   name: 'Reading',   icon: '\ud83d\udcd6', color: '#D7BDE2' },
];

const RECURRENCE_TYPES = {
  DAILY: 'daily',
  SPECIFIC_DAYS: 'specific_days',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ReminderStore = {
  _key: 'reminders_v1',
  _completionsKey: 'completions_v1',

  getAll() {
    const data = localStorage.getItem(this._key);
    return data ? JSON.parse(data) : [];
  },

  save(reminders) {
    localStorage.setItem(this._key, JSON.stringify(reminders));
  },

  add(reminder) {
    const reminders = this.getAll();
    reminder.id = crypto.randomUUID();
    reminder.createdAt = Date.now();
    reminder.enabled = true;
    reminders.push(reminder);
    this.save(reminders);
    return reminder;
  },

  update(id, updates) {
    const reminders = this.getAll();
    const idx = reminders.findIndex(r => r.id === id);
    if (idx === -1) return null;
    Object.assign(reminders[idx], updates);
    this.save(reminders);
    return reminders[idx];
  },

  remove(id) {
    const reminders = this.getAll().filter(r => r.id !== id);
    this.save(reminders);
  },

  get(id) {
    return this.getAll().find(r => r.id === id) || null;
  },

  // Completions tracking (resets daily)
  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },

  getCompletions() {
    const data = localStorage.getItem(this._completionsKey);
    if (!data) return {};
    const parsed = JSON.parse(data);
    if (parsed._date !== this._todayKey()) return {};
    return parsed;
  },

  toggleCompletion(reminderId) {
    const completions = this.getCompletions();
    completions._date = this._todayKey();
    completions[reminderId] = !completions[reminderId];
    localStorage.setItem(this._completionsKey, JSON.stringify(completions));
    return completions[reminderId];
  },

  isCompleted(reminderId) {
    return !!this.getCompletions()[reminderId];
  },
};

function isDueToday(reminder) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  switch (reminder.recurrence) {
    case RECURRENCE_TYPES.DAILY:
      return true;
    case RECURRENCE_TYPES.SPECIFIC_DAYS:
      return reminder.days && reminder.days.includes(dayOfWeek);
    case RECURRENCE_TYPES.WEEKLY:
      return reminder.days && reminder.days.includes(dayOfWeek);
    case RECURRENCE_TYPES.MONTHLY:
      return reminder.monthDay === dayOfMonth;
    default:
      return false;
  }
}

function getTodaysReminders() {
  return ReminderStore.getAll()
    .filter(r => r.enabled && isDueToday(r))
    .sort((a, b) => {
      const aMin = a.hour * 60 + a.minute;
      const bMin = b.hour * 60 + b.minute;
      return aMin - bMin;
    });
}

function getNextOccurrence(reminder) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), reminder.hour, reminder.minute);

  if (isDueToday(reminder) && today > now) {
    return today;
  }

  // Find next future occurrence
  for (let i = 1; i <= 31; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(reminder.hour, reminder.minute, 0, 0);

    const testReminder = { ...reminder };
    const originalNow = new Date();

    const candDay = candidate.getDay();
    const candDate = candidate.getDate();

    let matches = false;
    switch (reminder.recurrence) {
      case RECURRENCE_TYPES.DAILY:
        matches = true;
        break;
      case RECURRENCE_TYPES.SPECIFIC_DAYS:
      case RECURRENCE_TYPES.WEEKLY:
        matches = reminder.days && reminder.days.includes(candDay);
        break;
      case RECURRENCE_TYPES.MONTHLY:
        matches = reminder.monthDay === candDate;
        break;
    }

    if (matches) return candidate;
  }

  return null;
}

function formatTime(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function formatRecurrence(reminder) {
  switch (reminder.recurrence) {
    case RECURRENCE_TYPES.DAILY:
      return 'Every day';
    case RECURRENCE_TYPES.SPECIFIC_DAYS:
      return reminder.days.map(d => DAY_NAMES[d]).join(', ');
    case RECURRENCE_TYPES.WEEKLY:
      return `Every ${DAY_NAMES[reminder.days[0]]}`;
    case RECURRENCE_TYPES.MONTHLY:
      return `Monthly on the ${ordinal(reminder.monthDay)}`;
    default:
      return '';
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
