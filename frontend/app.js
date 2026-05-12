/**
 * Main Application Module
 * Orchestrates all other modules and handles initialization
 */

// Expose refresh data globally for modules to call
window.appRefreshData = refreshData;
window.appSwitchTab = switchTab;

async function refreshData() {
  const reportTaskFilter = Utils.el('reportTaskFilter').value;
  const reportHashtagFilter = Utils.el('reportHashtagFilter').value;
  const reportTitleFilter = Utils.el('reportTitleFilter').value;
  const reportQuery = new URLSearchParams({ 
    month: State.data.reportMonth.toISOString().slice(0, 7) 
  });
  
  if (reportTaskFilter) reportQuery.set('task_id', reportTaskFilter);
  if (reportHashtagFilter) reportQuery.set('hashtag', reportHashtagFilter);
  if (reportTitleFilter) reportQuery.set('topic', reportTitleFilter);

  const [config, flashcards, report, tasks] = await Promise.all([
    API.getConfig(),
    API.getFlashcards(),
    API.getReport(reportQuery.toString()),
    API.getTasks(),
  ]);

  Utils.el('providerBadge').textContent = config.provider || 'OpenAI';
  Utils.el('providerSelect').value = config.provider || 'openai';

  State.update({
    flashcards: flashcards.items || [],
    tasks: tasks.items || [],
    hashtags: Utils.uniqueHashtags([
      ...(flashcards.hashtags || []),
      ...(report.hashtags || []),
    ]),
  });

  FlashcardsRenderer.refreshFilters();
  TasksRenderer.renderTaskOptions();
  FlashcardsRenderer.refreshFilters();
  ReportRenderer.render(report);
  TasksRenderer.render();
  FlashcardsRenderer.render();
  ReportRenderer.renderPlotly(report.analytics?.sessions_per_task || []);
  Utils.el('flashcardCount').textContent = String(State.data.flashcards.length);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((button) => 
    button.classList.toggle('active', button.dataset.tab === tabName)
  );
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  Utils.el(`${tabName}Panel`).classList.add('active');
  
  if (tabName === 'words') {
    DailyWordsRenderer.openDailyWordsTab().catch((error) => Utils.setStatus(error.message));
  }
  if (tabName === 'dictionary') {
    DailyWordsRenderer.openDictionaryTab().catch((error) => Utils.setStatus(error.message));
  }
}

function toggleMode(mode) {
  State.set('mode', mode);
  Utils.el('textModeBtn').classList.toggle('active', mode === 'text');
  Utils.el('audioModeBtn').classList.toggle('active', mode === 'audio');
  Utils.el('textInputWrap').classList.toggle('hidden', mode !== 'text');
  Utils.el('audioInputWrap').classList.toggle('hidden', mode !== 'audio');
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  State.update({ chunks: [] });
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) State.data.chunks.push(event.data);
  };
  
  recorder.onstop = () => {
    const audioBlob = new Blob(State.data.chunks, { type: 'audio/webm' });
    State.set('audioBlob', audioBlob);
    Utils.el('audioPreview').src = URL.createObjectURL(audioBlob);
    Utils.el('audioPreview').classList.remove('hidden');
    stream.getTracks().forEach((track) => track.stop());
  };
  
  State.set('recorder', recorder);
  recorder.start();
  Utils.el('recordBtn').textContent = 'Stop recording';
  Utils.setStatus('Recording');
}

function stopRecording() {
  State.data.recorder?.stop();
  Utils.el('recordBtn').textContent = 'Start recording';
  Utils.setStatus('Recording stopped');
}

async function submitTraining() {
  if (!TasksRenderer.validatePracticeForm()) return;

  const title = Utils.el('trainingTitle').value.trim();
  const taskId = Utils.el('practiceTaskSelect').value;
  const formData = new FormData();
  formData.append('title', title);
  formData.append('input_mode', State.data.mode);
  formData.append('task_id', taskId);

  if (State.data.mode === 'text') {
    const text = Utils.el('trainingText').value.trim();
    formData.append('text', text);
  } else {
    formData.append('audio', State.data.audioBlob, 'recording.webm');
  }

  Utils.setStatus('Processing');
  
  // Lock UI
  const disableTrainingUI = (disabled) => {
    Utils.el('submitTrainingBtn').disabled = disabled;
    Utils.el('recordBtn').disabled = disabled;
    Utils.el('trainingTitle').disabled = disabled;
    Utils.el('trainingText').disabled = disabled;
    Utils.el('practiceTaskSelect').disabled = disabled;
    Utils.el('textModeBtn').disabled = disabled;
    Utils.el('audioModeBtn').disabled = disabled;
  };

  disableTrainingUI(true);
  Utils.el('submitTrainingBtn').textContent = 'Processing...';

  try {
    const result = await API.submitTraining(formData);
    Utils.el('resultOutput').innerHTML = Utils.renderMarkdown(result.markdown_response || '## Result\n- No content');
    Utils.setStatus('Saved');
    Utils.el('newPracticeBtn').classList.remove('hidden');
    Utils.el('submitTrainingBtn').classList.add('hidden');
    await refreshData();
  } catch (error) {
    Utils.setStatus(error.message);
    disableTrainingUI(false);
    Utils.el('submitTrainingBtn').textContent = 'Submit';
  }
}

async function submitTask() {
  if (!TasksRenderer.validateTaskForm()) return;

  const title = Utils.el('taskTitleInput').value.trim();
  const description = Utils.el('taskDescriptionInput').value.trim();
  const payload = { title, description: description || null };
  const editing = State.data.editingTaskId !== null;
  const editId = State.data.editingTaskId;

  try {
    if (editing) {
      await API.updateTask(editId, payload);
    } else {
      await API.createTask(payload);
    }
    TasksRenderer.resetTaskForm();
    Utils.setStatus(editing ? 'Task updated' : 'Task created');
    await refreshData();
  } catch (error) {
    Utils.setStatus(error.message);
  }
}

async function saveConfig() {
  Utils.setStatus('Saving config');
  await API.updateConfig({
    provider: Utils.el('providerSelect').value,
    api_key: Utils.el('apiKeyInput').value.trim() || null,
  });
  Utils.el('apiKeyInput').value = '';
  Utils.setStatus('Config saved');
  await refreshData();
}

async function exportBackup() {
  Utils.setStatus('Preparing backup');
  try {
    const blob = await API.exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'english-feedback-backup.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Utils.setStatus('Backup downloaded');
  } catch (err) {
    Utils.setStatus(err.message);
  }
}

async function importBackup() {
  const input = Utils.el('importBackupInput');
  if (!input || !input.files || !input.files.length) {
    Utils.setStatus('Select a backup file first');
    return;
  }
  const file = input.files[0];
  Utils.setStatus('Importing backup');
  try {
    await API.importBackup(file);
    Utils.setStatus('Backup imported');
    input.value = '';
    await refreshData();
  } catch (err) {
    Utils.setStatus(err.message);
  }
}

async function resetAll() {
  const input = Utils.el('resetConfirmInput');
  if (!input) return Utils.setStatus('Confirmation input not found');
  const value = input.value.trim();
  if (value !== 'kaboom') return Utils.setStatus('Confirmation word does not match');
  Utils.setStatus('Resetting data');
  try {
    await API.resetAll(value);
    Utils.setStatus('All data reset');
    await refreshData();
  } catch (err) {
    Utils.setStatus(err.message);
  }
}

function showConfigPane(name) {
  const panes = {
    export: Utils.el('cfgExportPane'),
    import: Utils.el('cfgImportPane'),
    danger: Utils.el('cfgDangerPane'),
  };
  Object.keys(panes).forEach((k) => {
    if (panes[k]) panes[k].style.display = (k === name) ? '' : 'none';
  });
  Utils.el('cfgTabExport').classList.toggle('active', name === 'export');
  Utils.el('cfgTabImport').classList.toggle('active', name === 'import');
  Utils.el('cfgTabDanger').classList.toggle('active', name === 'danger');
}

function initCalendarControls() {
  Utils.el('prevMonthBtn').addEventListener('click', async () => {
    const d = State.data.reportMonth;
    State.set('reportMonth', new Date(d.getFullYear(), d.getMonth() - 1, 1));
    await refreshData();
  });
  Utils.el('nextMonthBtn').addEventListener('click', async () => {
    const d = State.data.reportMonth;
    State.set('reportMonth', new Date(d.getFullYear(), d.getMonth() + 1, 1));
    await refreshData();
  });
}

// Event Listeners Setup
function initEventListeners() {
  // Tabs
  document.querySelectorAll('.tabs-wrap .tab').forEach((button) => 
    button.addEventListener('click', () => switchTab(button.dataset.tab))
  );

  // Mode toggle
  Utils.el('textModeBtn').addEventListener('click', () => toggleMode('text'));
  Utils.el('audioModeBtn').addEventListener('click', () => toggleMode('audio'));

  // Recording
  Utils.el('recordBtn').addEventListener('click', async () => {
    try {
      if (State.data.recorder && State.data.recorder.state === 'recording') {
        stopRecording();
      } else {
        await startRecording();
      }
    } catch (error) {
      Utils.setStatus(error.message);
    }
  });

  // Training
  Utils.el('submitTrainingBtn').addEventListener('click', async () => {
    try {
      await submitTraining();
    } catch (error) {
      Utils.setStatus(error.message);
    }
  });

  Utils.el('newPracticeBtn').addEventListener('click', () => {
    Utils.el('newPracticeBtn').classList.add('hidden');
    Utils.el('submitTrainingBtn').classList.remove('hidden');
    Utils.el('submitTrainingBtn').disabled = false;
    Utils.el('submitTrainingBtn').textContent = 'Submit';
    Utils.el('recordBtn').disabled = false;
    Utils.el('trainingTitle').disabled = false;
    Utils.el('trainingText').disabled = false;
    Utils.el('practiceTaskSelect').disabled = false;
    Utils.el('textModeBtn').disabled = false;
    Utils.el('audioModeBtn').disabled = false;
    Utils.el('resultOutput').innerHTML = '';
    Utils.el('trainingTitle').value = '';
    Utils.el('trainingText').value = '';
    State.set('audioBlob', null);
    Utils.el('audioPreview').classList.add('hidden');
  });

  // Tasks
  Utils.el('taskSubmitBtn').addEventListener('click', async () => {
    try {
      await submitTask();
    } catch (error) {
      Utils.setStatus(error.message);
    }
  });

  Utils.el('taskCancelBtn').addEventListener('click', () => TasksRenderer.resetTaskForm());

  // Config
  Utils.el('saveConfigBtn').addEventListener('click', async () => {
    try {
      await saveConfig();
    } catch (error) {
      Utils.setStatus(error.message);
    }
  });

  if (Utils.el('exportBackupBtn')) {
    Utils.el('exportBackupBtn').addEventListener('click', async () => {
      try {
        await exportBackup();
      } catch (err) {
        Utils.setStatus(err.message);
      }
    });
  }

  if (Utils.el('importBackupBtn')) {
    Utils.el('importBackupBtn').addEventListener('click', async () => {
      try {
        await importBackup();
      } catch (err) {
        Utils.setStatus(err.message);
      }
    });
  }

  if (Utils.el('resetAllBtn')) {
    Utils.el('resetAllBtn').addEventListener('click', async () => {
      try {
        await resetAll();
      } catch (err) {
        Utils.setStatus(err.message);
      }
    });
  }

  // Config panes
  if (Utils.el('cfgTabExport')) Utils.el('cfgTabExport').addEventListener('click', () => showConfigPane('export'));
  if (Utils.el('cfgTabImport')) Utils.el('cfgTabImport').addEventListener('click', () => showConfigPane('import'));
  if (Utils.el('cfgTabDanger')) Utils.el('cfgTabDanger').addEventListener('click', () => showConfigPane('danger'));
  showConfigPane('export');

  // Flashcards
  Utils.el('flashcardHashtagFilter').addEventListener('change', () => FlashcardsRenderer.render());
  Utils.el('flashcardTaskFilter').addEventListener('change', () => FlashcardsRenderer.render());

  // Report
  Utils.el('reportTaskFilter').addEventListener('change', refreshData);
  Utils.el('reportHashtagFilter').addEventListener('change', refreshData);
  Utils.el('reportTitleFilter').addEventListener('input', () => {
    clearTimeout(window.reportFilterTimer);
    window.reportFilterTimer = setTimeout(refreshData, 250);
  });

  Utils.el('reviewModeBtn').addEventListener('click', () => {
    State.set('reviewMode', !State.data.reviewMode);
    Utils.el('reviewModeBtn').textContent = State.data.reviewMode 
      ? 'Exit review mode' 
      : 'Enter review mode';
    FlashcardsRenderer.render();
  });

  // Daily Words
  if (Utils.el('dailyWordsSubmitBtn')) {
    Utils.el('dailyWordsSubmitBtn').addEventListener('click', async () => {
      try {
        await DailyWordsRenderer.submitDailyWords();
      } catch (error) {
        Utils.setStatus(error.message);
      }
    });
  }

  initCalendarControls();
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initEventListeners();
    toggleMode('text');
    await refreshData();
    Utils.setStatus('Ready');
  } catch (error) {
    Utils.setStatus(`Initialization error: ${error.message}`);
  }
});
