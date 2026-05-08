const state = {
  mode: 'text',
  recorder: null,
  chunks: [],
  audioBlob: null,
  flashcards: [],
  hashtags: [],
  tasks: [],
  taskGroups: [],
  reportMonth: new Date(),
  reviewMode: false,
  editingTaskId: null,
  dailyWords: null,
  dailyWordsLoadedDate: null,
};

const ensureToast = () => {
  return document.getElementById('appToast');
};

const showToast = (message, status = 'pending') => {
  const toast = ensureToast();
  if (!toast) return;
  clearTimeout(window.appToastTimer);
  toast.className = `app-toast ${status}`;
  toast.textContent = message;
  toast.classList.add('visible');
  window.appToastTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
};

const setDailyWordInputState = (entryId) => {
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

const focusFirstEmptyDailyWord = () => {
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

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
};

const el = (id) => document.getElementById(id);

const setStatus = (text) => {
  el('saveStatus').textContent = text;
};

const clearFieldErrors = (fieldIds) => {
  fieldIds.forEach((id) => {
    const elem = el(id);
    if (!elem) return;
    elem.classList.remove('input-error');
    const errorMsg = elem.parentElement?.querySelector('.error-message');
    if (errorMsg) errorMsg.remove();
  });
};

const showFieldError = (elementId, message) => {
  const elem = el(elementId);
  if (!elem) return;
  elem.classList.add('input-error');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  elem.parentElement.appendChild(errorDiv);
};

const validateTaskForm = () => {
  const titleId = 'taskTitleInput';
  clearFieldErrors([titleId]);
  const title = el(titleId).value.trim();
  if (!title) {
    showFieldError(titleId, 'Task title is required');
    return false;
  }
  return true;
};

const validatePracticeForm = () => {
  const titleId = 'trainingTitle';
  const taskId = 'practiceTaskSelect';
  const textId = 'trainingText';
  clearFieldErrors([titleId, taskId, textId]);

  const title = el(titleId).value.trim();
  if (!title) {
    showFieldError(titleId, 'Title is required');
    return false;
  }

  const selectedTask = el(taskId).value;
  if (!selectedTask) {
    showFieldError(taskId, 'Please select a task');
    return false;
  }

  if (state.mode === 'text') {
    const text = el(textId).value.trim();
    if (!text) {
      showFieldError(textId, 'Please enter text');
      return false;
    }
  } else {
    if (!state.audioBlob) {
      setStatus('Please record audio before submitting');
      return false;
    }
  }

  return true;
};

const switchTab = (tabName) => {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  el(`${tabName}Panel`).classList.add('active');
  if (tabName === 'words') {
    openDailyWordsTab().catch((error) => setStatus(error.message));
  }
  if (tabName === 'dictionary') {
    openDictionaryTab().catch((error) => setStatus(error.message));
  }
};

const toggleMode = (mode) => {
  state.mode = mode;
  el('textModeBtn').classList.toggle('active', mode === 'text');
  el('audioModeBtn').classList.toggle('active', mode === 'audio');
  el('textInputWrap').classList.toggle('hidden', mode !== 'text');
  el('audioInputWrap').classList.toggle('hidden', mode !== 'audio');
};

const escapeHtml = (text) => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatMinutes = (minutes) => `${Number(minutes || 0).toFixed(1)} min`;

const renderInlineMarkdown = (text) => escapeHtml(text)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

const renderMarkdown = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType || !listItems.length) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== 'ul') flushList(), listType = 'ul';
      listItems.push(renderInlineMarkdown(bullet[1]));
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (listType !== 'ol') flushList(), listType = 'ol';
      listItems.push(renderInlineMarkdown(numbered[1]));
      continue;
    }

    flushList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  flushList();
  return html.join('');
};

const uniqueHashtags = (items) => [...new Set(items.filter(Boolean))].sort();

const refreshHashtagFilters = () => {
  const filters = [el('flashcardHashtagFilter'), el('reportHashtagFilter')];
  filters.forEach((filter) => {
    const current = filter.value;
    filter.innerHTML = '<option value="">All hashtags</option>' + state.hashtags.map((hashtag) => `<option value="${hashtag}">${hashtag}</option>`).join('');
    filter.value = current;
  });
};

const refreshFlashcardFilters = () => {
  const taskFilter = el('flashcardTaskFilter');
  const current = taskFilter.value;
  taskFilter.innerHTML = '<option value="">All tasks</option>' + state.tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join('');
  taskFilter.value = current;
};

const renderTaskOptions = () => {
  const practiceSelect = el('practiceTaskSelect');
  const reportSelect = el('reportTaskFilter');
  const currentPractice = practiceSelect.value;
  const currentReport = reportSelect.value;

  const options = state.tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join('');
  practiceSelect.innerHTML = state.tasks.length
    ? `<option value="">Select a task</option>${options}`
    : '<option value="">Create a task first</option>';
  reportSelect.innerHTML = `<option value="">All tasks</option>${options}`;

  practiceSelect.value = state.tasks.some((task) => String(task.id) === currentPractice) ? currentPractice : '';
  reportSelect.value = state.tasks.some((task) => String(task.id) === currentReport) ? currentReport : '';
  el('submitTrainingBtn').disabled = !state.tasks.length;
};

const resetTaskForm = () => {
  state.editingTaskId = null;
  el('taskTitleInput').value = '';
  el('taskDescriptionInput').value = '';
  el('taskSubmitBtn').textContent = 'Add Task';
  el('taskCancelBtn').classList.add('hidden');
};

const renderTasks = () => {
  const container = el('tasksList');
  if (!state.tasks.length) {
    container.innerHTML = '<div class="source-preview">No tasks yet. Add one to start practicing.</div>';
    return;
  }

  container.innerHTML = state.tasks.map((task) => `
    <article class="task-card">
      <div class="task-card-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p>${escapeHtml(task.description || 'No description')}</p>
        </div>
        <span class="chip">${new Date(task.created_at).toLocaleDateString()}</span>
      </div>
      <div class="task-badges">
        <div class="dots text-dots" data-text-for="${task.id}"></div>
        <div class="dots audio-dots" data-audio-for="${task.id}"></div>
        <div class="flame" data-flame-for="${task.id}">🔥 <span class="count">0</span></div>
      </div>
      <div class="task-duration" data-duration-for="${task.id}">0.0 min spoken</div>
      <div class="task-card-actions">
        <button class="secondary compact" data-task-edit="${task.id}" type="button">Edit</button>
        <button class="secondary compact" data-task-delete="${task.id}" type="button">Delete</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-task-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = state.tasks.find((item) => String(item.id) === button.getAttribute('data-task-edit'));
      if (!task) return;
      state.editingTaskId = task.id;
      el('taskTitleInput').value = task.title;
      el('taskDescriptionInput').value = task.description || '';
      el('taskSubmitBtn').textContent = 'Update Task';
      el('taskCancelBtn').classList.remove('hidden');
    });
  });

  container.querySelectorAll('[data-task-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.getAttribute('data-task-delete');
      if (!taskId || !window.confirm('Delete this task?')) return;
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      resetTaskForm();
      await refreshData();
    });
  });

  // populate dots and flame counts from latest report groups
  state.taskGroups.forEach((group) => {
    const textContainer = document.querySelector(`[data-text-for="${group.task_id}"]`);
    const audioContainer = document.querySelector(`[data-audio-for="${group.task_id}"]`);
    const flameEl = document.querySelector(`[data-flame-for="${group.task_id}"] .count`);
    const durationEl = document.querySelector(`[data-duration-for="${group.task_id}"]`);
    if (textContainer) {
      textContainer.innerHTML = (new Array(group.text_count || 0)).fill('<span class="dot text-dot"></span>').join('');
    }
    if (audioContainer) {
      audioContainer.innerHTML = (new Array(group.audio_count || 0)).fill('<span class="dot audio-dot"></span>').join('');
    }
    if (flameEl) {
      flameEl.textContent = String(group.study_days_count || 0);
    }
    if (durationEl) {
      durationEl.textContent = `${formatMinutes(group.spoken_minutes)} spoken`;
    }
  });
};

const renderFlashcards = () => {
  const container = el('flashcardGrid');
  const hashtagFilter = el('flashcardHashtagFilter').value;
  const taskFilter = el('flashcardTaskFilter').value;
  let items = state.flashcards;
  if (taskFilter) {
    items = items.filter((flashcard) => String(flashcard.task_id) === taskFilter);
  }
  if (hashtagFilter) {
    items = items.filter((flashcard) => (flashcard.hashtags || []).includes(hashtagFilter));
  }

  if (!items.length) {
    container.innerHTML = '<div class="source-preview">No flashcards yet.</div>';
    return;
  }

  container.innerHTML = items.map((flashcard) => `
    <article class="flashcard ${state.reviewMode ? 'review' : ''}" data-id="${flashcard.id}">
      <div class="flashcard-inner">
        <div class="card-face card-front">
          <div class="flashcard-top">
            <strong>Front</strong>
            <button class="delete-flashcard" data-delete-id="${flashcard.id}" type="button">Delete</button>
          </div>
          <p>${escapeHtml(flashcard.front)}</p>
          <span class="hint">Click to flip</span>
        </div>
        <div class="card-face card-back">
          <strong>Back</strong>
          <p>${escapeHtml(flashcard.back)}</p>
          <span class="hint">Click to flip</span>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.flashcard').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
  });

  container.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const flashcardId = button.getAttribute('data-delete-id');
      if (!flashcardId || !window.confirm('Delete this flashcard?')) return;
      await api(`/flashcards/${flashcardId}`, { method: 'DELETE' });
      await refreshData();
    });
  });
};

const renderReport = (report) => {
  const month = state.reportMonth;
  const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  el('calendarLabel').textContent = label;

  const days = report.calendar?.days || [];
  el('calendarGrid').innerHTML = days.map((day) => `
    <div class="calendar-cell ${day.has_study ? 'has-study' : ''}" data-day="${String(day.day).padStart(2,'0')}">
      <strong>${day.day}</strong>
      <small class="hint">${day.weekday}</small>
    </div>
  `).join('');

  // Attach click handlers to days with study
  el('calendarGrid').querySelectorAll('.calendar-cell.has-study').forEach((cell) => {
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', async () => {
      try {
        const day = cell.getAttribute('data-day');
        const yearMonth = state.reportMonth.toISOString().slice(0, 7);
        const date = `${yearMonth}-${day}`;
        await openDaySessionsModal(date);
      } catch (err) {
        setStatus(err.message);
      }
    });
  });
  const analytics = report.analytics || {};
  el('analyticsList').innerHTML = [
    ['Current streak', analytics.current_streak ?? 0],
    ['Max streak', analytics.max_streak ?? 0],
    ['Most used hashtags', (analytics.most_used_hashtags || []).map((item) => `${item.label} (${item.count})`).join(', ') || 'None'],
    ['Sessions per task', (analytics.sessions_per_task || []).map((item) => `${item.label} (${item.count})`).join(', ') || 'None'],
    ['Spoken minutes', formatMinutes(analytics.spoken_minutes ?? 0)],
    ['Most active task', analytics.most_active_task ? `${analytics.most_active_task.label} (${analytics.most_active_task.count})` : 'None'],
  ].map(([labelText, value]) => `<div class="analytics-item"><span>${labelText}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');

  el('studyDayCount').textContent = String(report.calendar?.study_days || 0);
  el('currentStreakBadge').textContent = String(analytics.current_streak ?? 0);
  el('maxStreakBadge').textContent = String(analytics.max_streak ?? 0);

  const taskGroups = report.tasks || [];
  state.taskGroups = taskGroups;
  const groupsContainer = el('reportTaskGroups');
  groupsContainer.innerHTML = taskGroups.length ? taskGroups.map((group) => `
    <article class="report-task-card">
      <div class="report-task-head">
        <div>
          <strong>${escapeHtml(group.title)}</strong>
          <p>${escapeHtml(group.description || 'No description')}</p>
        </div>
        <span class="chip">${group.session_count} sessions</span>
      </div>
      <div class="report-task-meta">
        <span>Activity dates: ${escapeHtml((group.activity_dates || []).join(', ') || 'None')}</span>
        <span>Spoken time: ${escapeHtml(formatMinutes(group.spoken_minutes))}</span>
      </div>
      <div class="report-task-columns">
        <div>
          <h4>Notes / texts</h4>
          ${(group.notes_texts || []).length ? `<ul>${group.notes_texts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="hint">No notes yet.</p>'}
        </div>
        <div>
          <h4>Audios</h4>
          ${(group.audios || []).length ? `<ul>${group.audios.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="hint">No audio sessions yet.</p>'}
        </div>
      </div>
    </article>
  `).join('') : '<div class="source-preview">No practice data yet.</div>';

  const dailyWordsLog = report.daily_words || [];
  const dailyWordsReportList = el('dailyWordsReportList');
  if (dailyWordsReportList) {
    dailyWordsReportList.innerHTML = dailyWordsLog.length ? dailyWordsLog.map((item) => `
      <details class="session-item" ${item.submitted ? 'open' : ''}>
        <summary class="session-summary">
          <span>${escapeHtml(item.practice_date)} - ${item.submitted ? 'submitted' : 'not submitted'}</span>
          <span class="chip">${item.entries.length} words</span>
        </summary>
        <div class="session-body">
          ${item.entries.map((entry) => `
            <article class="daily-word-report-item ${entry.is_correct ? 'correct' : 'incorrect'}">
              <div class="daily-word-head">
                <strong>${escapeHtml(entry.word)}</strong>
                <span class="daily-word-status ${entry.is_correct ? 'correct' : 'incorrect'}">${entry.is_correct ? 'Correct' : (entry.is_correct === false ? 'Needs fix' : 'Pending')}</span>
              </div>
              <p><strong>My phrase:</strong> ${escapeHtml(entry.user_sentence || '-')}</p>
              <p><strong>Improvement:</strong> ${escapeHtml(entry.improved_sentence || '-')}</p>
            </article>
          `).join('')}
        </div>
      </details>
    `).join('') : '<div class="source-preview">No daily words log yet.</div>';
  }
};

const updateDailyWordsSubmitState = () => {
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
    setDailyWordInputState(entry.entry_id);
    return Boolean(typed);
  });

  button.disabled = false;
  button.textContent = 'Submit daily words';
  hint.textContent = allFilled
    ? 'Ready to submit.'
    : 'Complete all 10 sentences, then submit.';
};

const renderDailyWords = (payload) => {
  state.dailyWords = payload;
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
      input.addEventListener('input', updateDailyWordsSubmitState);
      input.addEventListener('focus', () => setDailyWordInputState(entry.entry_id));
    });
  }

  updateDailyWordsSubmitState();
  if (!submitted) {
    setTimeout(() => focusFirstEmptyDailyWord(), 50);
  }
};

const renderDailyWordsDictionary = (payload) => {
  const items = payload?.items || [];
  if (!items.length) {
    el('dailyWordsDictionary').innerHTML = 'No daily words history yet.';
    return;
  }

  el('dailyWordsDictionary').innerHTML = items.map((item) => `
    <article class="daily-word-card ${item.submitted ? 'correct' : 'pending'}">
      <div class="daily-word-head">
        <strong>${item.entries.length} words</strong>
        <span class="daily-word-status ${item.submitted ? 'correct' : 'pending'}">${item.submitted ? 'Available' : 'Pending'}</span>
      </div>
      <div class="daily-word-mini-list">
        ${item.entries.map((entry) => `
          <div class="daily-word-mini-item">
            <strong>${escapeHtml(entry.word)}</strong>
            <span>${escapeHtml(entry.meaning)}</span>
            <small>${escapeHtml(entry.usage_example)}</small>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');
};

const openDictionaryTab = async () => {
  setStatus('Loading dictionary');
  const dictionary = await api('/daily-words/dictionary');
  renderDailyWordsDictionary(dictionary);
  setStatus('Dictionary ready');
};

const openDailyWordsTab = async () => {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (state.dailyWordsLoadedDate === todayKey && state.dailyWords) {
    renderDailyWords(state.dailyWords);
    return;
  }

  setStatus('Loading daily words');
  const payload = await api('/daily-words/today/open', { method: 'POST' });
  state.dailyWordsLoadedDate = payload.practice_date;
  renderDailyWords(payload);
  setStatus('Daily words ready');
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
    focusFirstEmptyDailyWord();
    return;
  }

  showToast('Processing daily words', 'processing');
  setStatus('Evaluating daily words');
  const button = el('dailyWordsSubmitBtn');
  button.disabled = true;
  button.textContent = 'Submitting...';

  try {
    const updated = await api('/daily-words/today/submit', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    renderDailyWords(updated);
    await openDictionaryTab();
    await refreshData();
    switchTab('words');
    showToast('Done: daily words saved', 'done');
    setStatus('Daily words submitted');
  } catch (error) {
    showToast('Error: could not submit daily words', 'error');
    setStatus(error.message);
    updateDailyWordsSubmitState();
  }
};

const renderReportChart = (items) => {
  const canvas = document.getElementById('reportChart');
  if (!canvas || !items) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,w,h);
  const data = items.slice(0,8);
  if (!data.length) return;
  const max = Math.max(...data.map(i => i.count));
  const padding = 20 * devicePixelRatio;
  const barWidth = (w - padding*2) / data.length * 0.7;
  data.forEach((item, idx) => {
    const x = padding + idx * ((w - padding*2) / data.length) + ((w - padding*2)/data.length - barWidth)/2;
    const barH = (h - padding*2) * (item.count / (max || 1));
    const y = h - padding - barH;
    // bar
    ctx.fillStyle = 'rgba(32,217,127,0.9)';
    ctx.fillRect(x, y, barWidth, barH);
    // label
    ctx.fillStyle = '#aee';
    ctx.font = `${12 * devicePixelRatio}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x + barWidth/2, h - padding + 14 * devicePixelRatio);
    // value
    ctx.fillText(String(item.count), x + barWidth/2, y - 6 * devicePixelRatio);
  });
};

const renderReportPlotly = (items) => {
  const plotEl = document.getElementById('reportPlot');
  if (!plotEl) return;
  const data = (items || []).slice(0, 10);
  if (!data.length) {
    plotEl.innerHTML = '<div class="source-preview">No data to display.</div>';
    return;
  }

  const x = data.map((d) => d.label);
  const y = data.map((d) => d.count);
  const neonColor = 'rgba(32,217,127,0.95)';
  const trace = {
    x,
    y,
    type: 'bar',
    marker: {
      color: neonColor,
      line: { color: 'rgba(255,255,255,0.06)', width: 1 },
      // opacity kept high for neon vibrance
      opacity: 0.95,
    },
    hoverinfo: 'x+y',
  };

  const layout = {
    margin: { t: 10, r: 10, l: 36, b: 80 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#aee' },
    xaxis: { tickangle: -35, automargin: true },
    yaxis: { automargin: true },
    bargap: 0.78, // large gap to make bars visually thin
    // set a subtle glow effect via shapes (browser support varies)
  };

  const config = { responsive: true, displayModeBar: false, staticPlot: false };

  if (window.Plotly && window.Plotly.react) {
    try {
      window.Plotly.react(plotEl, [trace], layout, config);
    } catch (err) {
      // fallback to simple canvas chart
      renderReportChart(items);
    }
  } else {
    // Plotly not loaded — fallback
    renderReportChart(items);
  }
};

const refreshData = async () => {
  const reportTaskFilter = el('reportTaskFilter').value;
  const reportHashtagFilter = el('reportHashtagFilter').value;
  const reportTitleFilter = el('reportTitleFilter').value;
  const reportQuery = new URLSearchParams({ month: state.reportMonth.toISOString().slice(0, 7) });
  if (reportTaskFilter) reportQuery.set('task_id', reportTaskFilter);
  if (reportHashtagFilter) reportQuery.set('hashtag', reportHashtagFilter);
  if (reportTitleFilter) reportQuery.set('topic', reportTitleFilter);

  const [config, flashcards, report, tasks] = await Promise.all([
    api('/config'),
    api('/flashcards'),
    api(`/report?${reportQuery.toString()}`),
    api('/tasks'),
  ]);

  el('providerBadge').textContent = config.provider || 'OpenAI';
  el('providerSelect').value = config.provider || 'openai';

  state.flashcards = flashcards.items || [];
  state.tasks = tasks.items || [];
  state.hashtags = uniqueHashtags([...(flashcards.hashtags || []), ...(report.hashtags || [])]);
  refreshHashtagFilters();
  renderTaskOptions();
  refreshFlashcardFilters();
  renderReport(report);
  renderTasks();
  renderFlashcards();
  renderReportPlotly(report.analytics?.sessions_per_task || []);
  el('flashcardCount').textContent = String(state.flashcards.length);
};

// --- Day sessions modal ---
const elOrNull = (id) => document.getElementById(id);
const openDaySessionsModal = async (date) => {
  const modal = elOrNull('daySessionsModal');
  const label = elOrNull('modalDateLabel');
  const content = elOrNull('modalContent');
  const backdrop = elOrNull('modalBackdrop');
  const closeBtn = elOrNull('modalCloseBtn');
  label.textContent = `Sessions for ${date}`;
  content.innerHTML = '<div class="source-preview">Loading sessions...</div>';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  closeBtn.onclick = () => closeDaySessionsModal();
  backdrop.onclick = () => closeDaySessionsModal();

  try {
    const params = new URLSearchParams({ date });
    const taskId = el('reportTaskFilter').value;
    const hashtag = el('reportHashtagFilter').value;
    const topic = el('reportTitleFilter').value;
    if (taskId) params.set('task_id', taskId);
    if (hashtag) params.set('hashtag', hashtag);
    if (topic) params.set('topic', topic);
    const items = await api(`/report/sessions?${params.toString()}`);
    if (!items.length) {
      content.innerHTML = '<div class="source-preview">No sessions found for this date.</div>';
      return;
    }

    content.innerHTML = items.map((s) => {
      const timeLabel = new Date(s.created_at).toLocaleTimeString();
      const summary = `${escapeHtml(s.title)} · ${escapeHtml(timeLabel)} · ${escapeHtml(s.input_mode)}${s.task_title ? ` · ${escapeHtml(s.task_title)}` : ''}`;
      return `
        <details class="session-item">
          <summary class="session-summary">
            <span>${summary}</span>
            <span class="chip">Expand</span>
          </summary>
          <div class="session-body">
            ${s.audio_url ? `<div class="session-audio"><audio controls preload="none" src="${escapeHtml(s.audio_url)}"></audio></div>` : ''}
            <div class="session-transcript"><strong>Transcript</strong><div>${escapeHtml(s.transcript || s.original_content || 'No transcript')}</div></div>
            <div class="markdown-output">${renderMarkdown(s.markdown_response || '')}</div>
          </div>
        </details>
      `;
    }).join('');
  } catch (err) {
    content.innerHTML = `<div class="source-preview">Error loading sessions: ${escapeHtml(err.message)}</div>`;
  }
};

const closeDaySessionsModal = () => {
  const modal = elOrNull('daySessionsModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
};

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.chunks = [];
  state.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  state.recorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.chunks.push(event.data);
  };
  state.recorder.onstop = () => {
    state.audioBlob = new Blob(state.chunks, { type: 'audio/webm' });
    el('audioPreview').src = URL.createObjectURL(state.audioBlob);
    el('audioPreview').classList.remove('hidden');
    stream.getTracks().forEach((track) => track.stop());
  };
  state.recorder.start();
  el('recordBtn').textContent = 'Stop recording';
  setStatus('Recording');
};

const stopRecording = () => {
  state.recorder?.stop();
  el('recordBtn').textContent = 'Start recording';
  setStatus('Recording stopped');
};

const submitTraining = async () => {
  if (!validatePracticeForm()) return;

  const title = el('trainingTitle').value.trim();
  const taskId = el('practiceTaskSelect').value;
  const formData = new FormData();
  formData.append('title', title);
  formData.append('input_mode', state.mode);
  formData.append('task_id', taskId);

  if (state.mode === 'text') {
    const text = el('trainingText').value.trim();
    formData.append('text', text);
  } else {
    formData.append('audio', state.audioBlob, 'recording.webm');
  }

  setStatus('Processing');
  // lock UI to prevent duplicate submits
  el('submitTrainingBtn').disabled = true;
  el('submitTrainingBtn').textContent = 'Processing...';
  el('recordBtn').disabled = true;
  el('trainingTitle').disabled = true;
  el('trainingText').disabled = true;
  el('practiceTaskSelect').disabled = true;
  el('textModeBtn').disabled = true;
  el('audioModeBtn').disabled = true;

  try {
    const result = await api('/analyze', { method: 'POST', body: formData });
    el('resultOutput').innerHTML = renderMarkdown(result.markdown_response || '## Result\n- No content');
    setStatus('Saved');
    // show New button and hide submit until user resets
    el('newPracticeBtn').classList.remove('hidden');
    el('submitTrainingBtn').classList.add('hidden');
    await refreshData();
  } catch (error) {
    setStatus(error.message);
    // Re-enable UI on error
    el('submitTrainingBtn').disabled = false;
    el('submitTrainingBtn').textContent = 'Submit';
    el('recordBtn').disabled = false;
    el('trainingTitle').disabled = false;
    el('trainingText').disabled = false;
    el('practiceTaskSelect').disabled = false;
    el('textModeBtn').disabled = false;
    el('audioModeBtn').disabled = false;
  }
};

const submitTask = async () => {
  if (!validateTaskForm()) return;

  const title = el('taskTitleInput').value.trim();
  const description = el('taskDescriptionInput').value.trim();
  const payload = { title, description: description || null };
  const editing = state.editingTaskId !== null;
  const path = editing ? `/tasks/${state.editingTaskId}` : '/tasks';
  const method = editing ? 'PUT' : 'POST';

  try {
    await api(path, { method, body: JSON.stringify(payload) });
    resetTaskForm();
    setStatus(editing ? 'Task updated' : 'Task created');
    await refreshData();
  } catch (error) {
    setStatus(error.message);
  }
};

const saveConfig = async () => {
  setStatus('Saving config');
  await api('/config', {
    method: 'PUT',
    body: JSON.stringify({
      provider: el('providerSelect').value,
      api_key: el('apiKeyInput').value.trim() || null,
    }),
  });
  el('apiKeyInput').value = '';
  setStatus('Config saved');
  await refreshData();
};

const exportBackup = async () => {
  setStatus('Preparing backup');
  try {
    const res = await fetch('/api/backup/export');
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'english-feedback-backup.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Backup downloaded');
  } catch (err) {
    setStatus(err.message);
  }
};

const importBackup = async () => {
  const input = el('importBackupInput');
  if (!input || !input.files || !input.files.length) {
    setStatus('Select a backup file first');
    return;
  }
  const file = input.files[0];
  const form = new FormData();
  form.append('file', file);
  setStatus('Importing backup');
  try {
    await api('/backup/import', { method: 'POST', body: form });
    setStatus('Backup imported');
    input.value = '';
    await refreshData();
  } catch (err) {
    setStatus(err.message);
  }
};

const resetAll = async () => {
  const input = el('resetConfirmInput');
  if (!input) return setStatus('Confirmation input not found');
  const value = input.value.trim();
  if (value !== 'kaboom') return setStatus('Confirmation word does not match');
  setStatus('Resetting data');
  try {
    await api('/reset', { method: 'POST', body: JSON.stringify({ confirm: value }), headers: { 'Content-Type': 'application/json' } });
    setStatus('All data reset');
    await refreshData();
  } catch (err) {
    setStatus(err.message);
  }
};

// config subtabs
const showConfigPane = (name) => {
  const panes = { export: el('cfgExportPane'), import: el('cfgImportPane'), danger: el('cfgDangerPane') };
  Object.keys(panes).forEach((k) => { if (panes[k]) panes[k].style.display = (k === name) ? '' : 'none'; });
  // toggle active class
  el('cfgTabExport').classList.toggle('active', name === 'export');
  el('cfgTabImport').classList.toggle('active', name === 'import');
  el('cfgTabDanger').classList.toggle('active', name === 'danger');
};

const initCalendarControls = () => {
  el('prevMonthBtn').addEventListener('click', async () => {
    state.reportMonth = new Date(state.reportMonth.getFullYear(), state.reportMonth.getMonth() - 1, 1);
    await refreshData();
  });
  el('nextMonthBtn').addEventListener('click', async () => {
    state.reportMonth = new Date(state.reportMonth.getFullYear(), state.reportMonth.getMonth() + 1, 1);
    await refreshData();
  });
};

document.querySelectorAll('.tabs-wrap .tab').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
el('textModeBtn').addEventListener('click', () => toggleMode('text'));
el('audioModeBtn').addEventListener('click', () => toggleMode('audio'));
el('recordBtn').addEventListener('click', async () => {
  try {
    if (state.recorder && state.recorder.state === 'recording') {
      stopRecording();
    } else {
      await startRecording();
    }
  } catch (error) {
    setStatus(error.message);
  }
});
el('submitTrainingBtn').addEventListener('click', async () => {
  try {
    await submitTraining();
  } catch (error) {
    setStatus(error.message);
  }
});
el('taskSubmitBtn').addEventListener('click', async () => {
  try {
    await submitTask();
  } catch (error) {
    setStatus(error.message);
  }
});
// New practice button behavior: reset form and re-enable submit
if (el('newPracticeBtn')) {
  el('newPracticeBtn').addEventListener('click', () => {
    el('newPracticeBtn').classList.add('hidden');
    el('submitTrainingBtn').classList.remove('hidden');
    el('submitTrainingBtn').disabled = false;
    el('submitTrainingBtn').textContent = 'Submit';
    el('recordBtn').disabled = false;
    el('trainingTitle').disabled = false;
    el('trainingText').disabled = false;
    el('practiceTaskSelect').disabled = false;
    el('textModeBtn').disabled = false;
    el('audioModeBtn').disabled = false;
    el('resultOutput').innerHTML = '';
    el('trainingTitle').value = '';
    el('trainingText').value = '';
    state.audioBlob = null;
    el('audioPreview').classList.add('hidden');
  });
}
el('taskCancelBtn').addEventListener('click', () => resetTaskForm());
el('saveConfigBtn').addEventListener('click', async () => {
  try {
    await saveConfig();
  } catch (error) {
    setStatus(error.message);
  }
});
if (el('exportBackupBtn')) {
  el('exportBackupBtn').addEventListener('click', async () => {
    try {
      await exportBackup();
    } catch (err) {
      setStatus(err.message);
    }
  });
}
if (el('importBackupBtn')) {
  el('importBackupBtn').addEventListener('click', async () => {
    try {
      await importBackup();
    } catch (err) {
      setStatus(err.message);
    }
  });
}
if (el('resetAllBtn')) {
  el('resetAllBtn').addEventListener('click', async () => {
    try {
      await resetAll();
    } catch (err) {
      setStatus(err.message);
    }
  });
}

if (el('cfgTabExport')) el('cfgTabExport').addEventListener('click', () => showConfigPane('export'));
if (el('cfgTabImport')) el('cfgTabImport').addEventListener('click', () => showConfigPane('import'));
if (el('cfgTabDanger')) el('cfgTabDanger').addEventListener('click', () => showConfigPane('danger'));

// default to export pane
showConfigPane('export');
el('flashcardHashtagFilter').addEventListener('change', renderFlashcards);
el('flashcardTaskFilter').addEventListener('change', renderFlashcards);
el('reportTaskFilter').addEventListener('change', refreshData);
el('reportHashtagFilter').addEventListener('change', refreshData);
el('reportTitleFilter').addEventListener('input', () => {
  clearTimeout(window.reportFilterTimer);
  window.reportFilterTimer = setTimeout(refreshData, 250);
});
el('reviewModeBtn').addEventListener('click', () => {
  state.reviewMode = !state.reviewMode;
  el('reviewModeBtn').textContent = state.reviewMode ? 'Exit review mode' : 'Enter review mode';
  renderFlashcards();
});
if (el('dailyWordsSubmitBtn')) {
  el('dailyWordsSubmitBtn').addEventListener('click', async () => {
    try {
      await submitDailyWords();
    } catch (error) {
      setStatus(error.message);
    }
  });
}

initCalendarControls();
toggleMode('text');
refreshData().catch((error) => setStatus(error.message));