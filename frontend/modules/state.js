/**
 * State Management Module
 * Centralizes all application state
 * Usage: State.data, State.update(), State.subscribe()
 */

const State = (() => {
  const state = {
    // Mode & Audio
    mode: 'text',
    recorder: null,
    chunks: [],
    audioBlob: null,

    // Tasks & Practice
    tasks: [],
    editingTaskId: null,
    taskGroups: [],

    // Flashcards
    flashcards: [],
    hashtags: [],
    reviewMode: false,

    // Report
    reportMonth: new Date(),

    // Daily Words
    dailyWords: null,
    dailyWordsLoadedDate: null,
    dictionaryEntries: [],
  };

  const subscribers = [];

  return {
    // Get current state (read-only, users should clone if modifying)
    get data() {
      return state;
    },

    // Bulk update state
    update(updates) {
      Object.assign(state, updates);
      this.notify();
    },

    // Update single property
    set(key, value) {
      state[key] = value;
      this.notify();
    },

    // Get single property
    get(key) {
      return state[key];
    },

    // Subscribe to state changes
    subscribe(callback) {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx > -1) subscribers.splice(idx, 1);
      };
    },

    // Notify all subscribers
    notify() {
      subscribers.forEach(cb => cb(state));
    },

    // Reset state to initial
    reset() {
      this.update({
        mode: 'text',
        recorder: null,
        chunks: [],
        audioBlob: null,
        tasks: [],
        editingTaskId: null,
        taskGroups: [],
        flashcards: [],
        hashtags: [],
        reviewMode: false,
        reportMonth: new Date(),
        dailyWords: null,
        dailyWordsLoadedDate: null,
        dictionaryEntries: [],
      });
    },
  };
})();
