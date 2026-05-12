/**
 * Daily Words Renderer Module
 * Handles rendering and logic for daily words and dictionary
 */

const DailyWordsRenderer = (() => {
  const { el, elOrNull, escapeHtml, renderMarkdown, setStatus, showToast } = Utils;
  const state = State.data;
  let dictionaryHistoryPayload = null;
  let dictionarySearchBound = false;

  // Daily Words Tab Logic

  const setInputState = (entryId) => {
    const input = el(`dailyWordInput-${entryId}`);
    if (!input) return;
    const value = input.value.trim();
    const card = input.closest('.daily-word-card');
    input.classList.toggle('input-empty', !value);
    input.classList.toggle('input-filled', Boolean(value));
    if (card) {
      card.classList.toggle('needs-answer', !value);
      card.classList.toggle('has-answer', Boolean(value));
    }
  };

  const focusFirstEmpty = () => {
    if (!state.dailyWords || state.dailyWords.submitted) return;
    const firstEmpty = (state.dailyWords.entries || []).find((entry) => {
      const input = el(`dailyWordInput-${entry.entry_id}`);
      return input && !input.value.trim();
    });
    if (!firstEmpty) return;
    const input = el(`dailyWordInput-${firstEmpty.entry_id}`);
    if (!input) return;
    input.focus({ preventScroll: false });
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const updateSubmitState = () => {
    const payload = state.dailyWords;
    const button = el('dailyWordsSubmitBtn');
    const hint = el('dailyWordsSubmitHint');
    if (!payload || !button || !hint) return;

    if (payload.submitted) {
      button.disabled = true;
      button.textContent = 'Submitted';
      hint.textContent = 'Submitted. This activity is locked until tomorrow.';
      return;
    }

    const allFilled = (payload.entries || []).every((entry) => {
      const input = el(`dailyWordInput-${entry.entry_id}`);
      const typed = input ? input.value.trim() : '';
      entry.user_sentence = typed;
      setInputState(entry.entry_id);
      return Boolean(typed);
    });

    button.disabled = false;
    button.textContent = 'Submit daily words';
    hint.textContent = allFilled
      ? 'Ready to submit.'
      : 'Complete all 10 sentences, then submit.';
  };

  const renderDailyWords = (payload) => {
    State.set('dailyWords', payload);
    if (!payload) {
      el('dailyWordsList').innerHTML = '<div class="source-preview">Open this tab to load today\'s words.</div>';
      return;
    }

    const submitted = Boolean(payload.submitted);
    el('dailyWordsDateLabel').textContent = `Day: ${payload.practice_date}`;
    el('dailyWordsInfo').textContent = submitted
      ? 'Submitted for today. You can review your answers and feedback below.'
      : 'Write one sentence for each word. After submit, this form is locked until tomorrow.';

    el('dailyWordsList').innerHTML = (payload.entries || []).map((entry) => {
      const statusLabel = entry.is_correct === null || entry.is_correct === undefined
        ? 'Pending'
        : (entry.is_correct ? 'Correct' : 'Needs fix');
      const statusClass = entry.is_correct === null || entry.is_correct === undefined
        ? 'pending'
        : (entry.is_correct ? 'correct' : 'incorrect');

      return `
        <article class="daily-word-card ${statusClass}">
          <div class="daily-word-head">
            <strong>${entry.position}. ${escapeHtml(entry.word)}</strong>
            <span class="daily-word-status ${statusClass}">${escapeHtml(statusLabel)}</span>
          </div>
          <p><strong>Meaning:</strong> ${escapeHtml(entry.meaning)}</p>
          <p><strong>Example:</strong> ${escapeHtml(entry.usage_example)}</p>
          <label class="field">
            <span>Your sentence</span>
            <textarea id="dailyWordInput-${entry.entry_id}" rows="2" ${submitted ? 'disabled' : ''} placeholder="Write a sentence using ${escapeHtml(entry.word)}">${escapeHtml(entry.user_sentence || '')}</textarea>
          </label>
          ${entry.feedback_markdown ? `<div class="daily-word-feedback">${renderMarkdown(entry.feedback_markdown)}</div>` : ''}
          ${entry.improved_sentence && (!entry.is_correct) ? `<p class="hint"><strong>Improved:</strong> ${escapeHtml(entry.improved_sentence)}</p>` : ''}
        </article>
      `;
    }).join('');

    if (!submitted) {
      (payload.entries || []).forEach((entry) => {
        const input = el(`dailyWordInput-${entry.entry_id}`);
        if (!input) return;
        input.addEventListener('input', updateSubmitState);
        input.addEventListener('focus', () => setInputState(entry.entry_id));
      });
    }

    updateSubmitState();
    if (!submitted) {
      setTimeout(() => focusFirstEmpty(), 50);
    }
  };

  const submitDailyWords = async () => {
    const payload = state.dailyWords;
    if (!payload || payload.submitted) return;

    const answers = (payload.entries || []).map((entry) => {
      const value = el(`dailyWordInput-${entry.entry_id}`)?.value?.trim() || '';
      return {
        entry_id: entry.entry_id,
        sentence: value,
      };
    });

    if (answers.some((item) => !item.sentence)) {
      showToast('Pending: fill all sentences first', 'pending');
      setStatus('Fill all daily word sentences first');
      focusFirstEmpty();
      return;
    }

    showToast('Processing daily words', 'processing');
    setStatus('Evaluating daily words');
    const button = el('dailyWordsSubmitBtn');
    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
      const updated = await API.submitDailyWords({ answers });
      renderDailyWords(updated);
      await DailyWordsRenderer.openDictionaryTab();
      window.appRefreshData?.();
      window.appSwitchTab?.('words');
      showToast('Done: daily words saved', 'done');
      setStatus('Daily words submitted');
    } catch (error) {
      showToast('Error: could not submit daily words', 'error');
      setStatus(error.message);
      updateSubmitState();
    }
  };

  // Dictionary Tab Logic

  const openDictionaryWordModal = (entry) => {
    const modal = Utils.elOrNull('dictionaryWordModal');
    const title = Utils.elOrNull('dictionaryWordTitle');
    const content = Utils.elOrNull('dictionaryWordContent');
    const closeBtn = Utils.elOrNull('dictionaryWordCloseBtn');
    const backdrop = Utils.elOrNull('dictionaryWordBackdrop');
    if (!modal || !title || !content || !closeBtn) return;

    title.textContent = entry.word;
    content.innerHTML = `
      <div class="dictionary-modal-word">${escapeHtml(entry.word)}</div>
      <p><strong>Meaning in English:</strong> ${escapeHtml(entry.meaning)}</p>
      <p><strong>Example:</strong> ${escapeHtml(entry.usage_example)}</p>
    `;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    closeBtn.onclick = closeDictionaryWordModal;
    if (backdrop) backdrop.onclick = closeDictionaryWordModal;
  };

  const closeDictionaryWordModal = () => {
    const modal = Utils.elOrNull('dictionaryWordModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };

  const renderDictionaryCard = (entry) => `
    <button class="dictionary-row" type="button" data-word="${escapeHtml(entry.word)}">
      <span class="dictionary-row-word">${escapeHtml(entry.word)}</span>
      <span class="dictionary-row-meaning">${escapeHtml(entry.meaning)}</span>
    </button>
  `;

  const showDictionarySearchResult = (entry, query) => {
    const tabs = elOrNull('dictionaryAlphabetTabs');
    const list = elOrNull('dailyWordsDictionary');
    const hint = elOrNull('dictionarySearchHint');
    if (!list) return;

    if (tabs) tabs.classList.add('hidden');
    list.innerHTML = `
      <div class="dictionary-search-result">
        <div class="dictionary-search-result-head">
          <div>
            <span class="hint">Search result</span>
            <strong>${escapeHtml(query)}</strong>
          </div>
          <span class="chip">Open card</span>
        </div>
        ${renderDictionaryCard(entry)}
      </div>
    `;

    const button = list.querySelector('.dictionary-row');
    if (button) {
      button.addEventListener('click', () => openDictionaryWordModal(entry));
    }

    if (hint) {
      hint.textContent = 'Word found and saved to your dictionary. Open the card to review meaning and example.';
    }
  };

  const restoreDictionaryHistory = () => {
    const tabs = elOrNull('dictionaryAlphabetTabs');
    if (tabs) tabs.classList.remove('hidden');

    if (dictionaryHistoryPayload) {
      renderDictionary(dictionaryHistoryPayload);
      return;
    }

    const list = elOrNull('dailyWordsDictionary');
    if (list) {
      list.innerHTML = 'No daily words history yet.';
    }
  };

  const bindDictionarySearch = () => {
    if (dictionarySearchBound) return;
    const input = elOrNull('dictionarySearchInput');
    const searchBtn = elOrNull('dictionarySearchBtn');
    const clearBtn = elOrNull('dictionarySearchClearBtn');
    const hint = elOrNull('dictionarySearchHint');
    if (!input || !searchBtn || !clearBtn || !hint) return;

    const runSearch = async () => {
      const query = input.value.trim();
      if (!query) {
        hint.textContent = 'Search a word from your dictionary or look up a new English word.';
        restoreDictionaryHistory();
        return;
      }

      try {
        setStatus(`Searching ${query}`);
        hint.textContent = `Searching "${query}"...`;
        const result = await API.searchDailyWordsDictionary(query);
        showDictionarySearchResult(result, query);
        setStatus(`Dictionary result ready for ${query}`);
      } catch (error) {
        const message = error.message || 'Could not search this word';
        hint.textContent = message;
        showToast(message, 'error');
        setStatus(message);
        if (dictionaryHistoryPayload) {
          renderDictionary(dictionaryHistoryPayload);
        }
      }
    };

    searchBtn.addEventListener('click', runSearch);
    clearBtn.addEventListener('click', async () => {
      input.value = '';
      hint.textContent = 'Reloading dictionary...';
      try {
        await openDictionaryTab();
      } catch (error) {
        hint.textContent = error.message || 'Could not reload dictionary';
        showToast(error.message || 'Could not reload dictionary', 'error');
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });

    dictionarySearchBound = true;
  };

  const renderDictionary = (payload) => {
    dictionaryHistoryPayload = payload;
    const items = payload?.items || [];
    const tabs = elOrNull('dictionaryAlphabetTabs');
    if (tabs) tabs.classList.remove('hidden');
    if (!items.length) {
      el('dailyWordsDictionary').innerHTML = 'No daily words history yet.';
      el('dictionaryAlphabetTabs').innerHTML = '';
      State.set('dictionaryEntries', []);
      bindDictionarySearch();
      return;
    }

    const flattened = [];
    const seen = new Set();
    items.forEach((item) => {
      (item.entries || []).forEach((entry) => {
        const key = String(entry.word || '').trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        flattened.push({
          ...entry,
          practice_date: item.practice_date,
          submitted: item.submitted,
        });
      });
    });

    State.set('dictionaryEntries', 
      flattened.sort((left, right) => 
        left.word.localeCompare(right.word, undefined, { sensitivity: 'base' })
      )
    );

    // Group by first letter
    const grouped = {};
    state.dictionaryEntries.forEach((entry) => {
      const letter = (entry.word || '').charAt(0).toUpperCase();
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(entry);
    });

    const letters = Object.keys(grouped).sort();

    // Render alphabet tabs
    el('dictionaryAlphabetTabs').innerHTML = letters.map((letter, idx) => `
      <button class="dictionary-letter-tab ${idx === 0 ? 'active' : ''}" data-letter="${letter}" type="button">
        ${letter}
      </button>
    `).join('');

    // Render words for a letter
    const renderLetterWords = (letter) => {
      const words = grouped[letter] || [];
      el('dailyWordsDictionary').innerHTML = words.map((entry) => renderDictionaryCard(entry)).join('');

      el('dailyWordsDictionary').querySelectorAll('.dictionary-row').forEach((button) => {
        button.addEventListener('click', () => {
          const word = button.getAttribute('data-word');
          const entry = state.dictionaryEntries.find((e) => e.word.toLowerCase() === String(word || '').toLowerCase());
          if (entry) openDictionaryWordModal(entry);
        });
      });
    };

    // Initial render with first letter
    renderLetterWords(letters[0]);

    // Handle letter tab clicks
    el('dictionaryAlphabetTabs').querySelectorAll('.dictionary-letter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const letter = tab.getAttribute('data-letter');
        el('dictionaryAlphabetTabs').querySelectorAll('.dictionary-letter-tab').forEach((t) => {
          t.classList.toggle('active', t.getAttribute('data-letter') === letter);
        });
        const hint = elOrNull('dictionarySearchHint');
        if (hint) hint.textContent = 'Search a word from your dictionary or look up a new English word.';
        renderLetterWords(letter);
      });
    });

    bindDictionarySearch();
  };

  const openDictionaryTab = async () => {
    setStatus('Loading dictionary');
    const dictionary = await API.getDailyWordsDictionary();
    const input = elOrNull('dictionarySearchInput');
    const hint = elOrNull('dictionarySearchHint');
    if (input) input.value = '';
    if (hint) hint.textContent = 'Search a word from your dictionary or look up a new English word.';
    renderDictionary(dictionary);
    setStatus('Dictionary ready');
  };

  const openDailyWordsTab = async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (state.dailyWordsLoadedDate === todayKey && state.dailyWords) {
      renderDailyWords(state.dailyWords);
      return;
    }

    setStatus('Loading daily words');
    const payload = await API.getDailyWordsToday();
    State.set('dailyWordsLoadedDate', payload.practice_date);
    renderDailyWords(payload);
    setStatus('Daily words ready');
  };

  return {
    setInputState,
    focusFirstEmpty,
    updateSubmitState,
    renderDailyWords,
    submitDailyWords,
    openDictionaryWordModal,
    closeDictionaryWordModal,
    renderDictionary,
    openDictionaryTab,
    openDailyWordsTab,
  };
})();
