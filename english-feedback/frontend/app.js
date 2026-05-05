const state = {
  mode: 'text',
  recorder: null,
  chunks: [],
  audioBlob: null,
  flashcards: [],
  hashtags: [],
  reportMonth: new Date(),
  reviewMode: false,
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

const switchTab = (tabName) => {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  el(`${tabName}Panel`).classList.add('active');
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

const renderFlashcards = () => {
  const container = el('flashcardGrid');
  const filter = el('flashcardHashtagFilter').value;
  const items = filter ? state.flashcards.filter((flashcard) => (flashcard.hashtags || []).includes(filter)) : state.flashcards;

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
    ['Study streak', analytics.study_streak ?? 0],
    ['Most common errors', (analytics.most_common_errors || []).map((item) => `${item.label} (${item.count})`).join(', ') || 'None'],
    ['Most used hashtags', (analytics.most_used_hashtags || []).map((item) => `${item.label} (${item.count})`).join(', ') || 'None'],
  ].map(([labelText, value]) => `<div class="analytics-item"><span>${labelText}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');

  el('studyDayCount').textContent = String(report.calendar?.study_days || 0);
};

const refreshData = async () => {
  const [config, flashcards, report] = await Promise.all([
    api('/config'),
    api('/flashcards'),
    api(`/report?month=${state.reportMonth.toISOString().slice(0, 7)}&hashtag=${encodeURIComponent(el('reportHashtagFilter').value)}&topic=${encodeURIComponent(el('reportTitleFilter').value)}`),
  ]);

  el('providerBadge').textContent = config.provider || 'OpenAI';
  el('providerSelect').value = config.provider || 'openai';

  state.flashcards = flashcards.items || [];
  state.hashtags = uniqueHashtags([...(flashcards.hashtags || []), ...(report.hashtags || [])]);
  refreshHashtagFilters();
  renderFlashcards();
  renderReport(report);
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
    const items = await api(`/report/sessions?date=${encodeURIComponent(date)}`);
    if (!items.length) {
      content.innerHTML = '<div class="source-preview">No sessions found for this date.</div>';
      return;
    }

    content.innerHTML = items.map((s) => {
      const timeLabel = new Date(s.created_at).toLocaleTimeString();
      const summary = `${escapeHtml(s.title)} · ${escapeHtml(timeLabel)} · ${escapeHtml(s.input_mode)}`;
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
  const title = el('trainingTitle').value.trim();
  if (!title) throw new Error('Title is required');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('input_mode', state.mode);

  if (state.mode === 'text') {
    const text = el('trainingText').value.trim();
    if (!text) throw new Error('Text is required');
    formData.append('text', text);
  } else {
    if (!state.audioBlob) throw new Error('Record audio before submitting');
    formData.append('audio', state.audioBlob, 'recording.webm');
  }

  setStatus('Processing');
  const result = await api('/trainings', { method: 'POST', body: formData });
  el('resultOutput').innerHTML = renderMarkdown(result.markdown_response || '## Result\n- No content');
  el('sourcePreview').textContent = result.transcript || result.original_content || 'No content submitted yet.';
  setStatus('Saved');
  await refreshData();
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

const syncSourcePreview = () => {
  const text = el('trainingText').value.trim();
  if (state.mode === 'text') {
    el('sourcePreview').textContent = text || 'No content submitted yet.';
  }
};

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
el('textModeBtn').addEventListener('click', () => toggleMode('text'));
el('audioModeBtn').addEventListener('click', () => toggleMode('audio'));
el('trainingText').addEventListener('input', syncSourcePreview);
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
el('saveConfigBtn').addEventListener('click', async () => {
  try {
    await saveConfig();
  } catch (error) {
    setStatus(error.message);
  }
});
el('flashcardHashtagFilter').addEventListener('change', renderFlashcards);
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

initCalendarControls();
toggleMode('text');
syncSourcePreview();
refreshData().catch((error) => setStatus(error.message));