/**
 * Tasks Renderer Module
 * Handles rendering and logic for tasks and practice sections
 */

const TasksRenderer = (() => {
  const { el, escapeHtml, setStatus, showFieldError, clearFieldErrors } = Utils;
  const state = State.data;

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

  const resetTaskForm = () => {
    State.set('editingTaskId', null);
    el('taskTitleInput').value = '';
    el('taskDescriptionInput').value = '';
    el('taskSubmitBtn').textContent = 'Add Task';
    el('taskCancelBtn').classList.add('hidden');
  };

  const renderTaskOptions = () => {
    const practiceSelect = el('practiceTaskSelect');
    const reportSelect = el('reportTaskFilter');
    const currentPractice = practiceSelect.value;
    const currentReport = reportSelect.value;

    const options = state.tasks.map((task) => 
      `<option value="${task.id}">${escapeHtml(task.title)}</option>`
    ).join('');
    
    practiceSelect.innerHTML = state.tasks.length
      ? `<option value="">Select a task</option>${options}`
      : '<option value="">Create a task first</option>';
    reportSelect.innerHTML = `<option value="">All tasks</option>${options}`;

    practiceSelect.value = state.tasks.some((task) => String(task.id) === currentPractice) 
      ? currentPractice 
      : '';
    reportSelect.value = state.tasks.some((task) => String(task.id) === currentReport) 
      ? currentReport 
      : '';
    el('submitTrainingBtn').disabled = !state.tasks.length;
  };

  const render = () => {
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

    // Edit handlers
    container.querySelectorAll('[data-task-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const task = state.tasks.find((item) => String(item.id) === button.getAttribute('data-task-edit'));
        if (!task) return;
        State.set('editingTaskId', task.id);
        el('taskTitleInput').value = task.title;
        el('taskDescriptionInput').value = task.description || '';
        el('taskSubmitBtn').textContent = 'Update Task';
        el('taskCancelBtn').classList.remove('hidden');
      });
    });

    // Delete handlers
    container.querySelectorAll('[data-task-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const taskId = button.getAttribute('data-task-delete');
        if (!taskId || !window.confirm('Delete this task?')) return;
        await API.deleteTask(taskId);
        resetTaskForm();
        // Note: Refresh data should be called from app.js
        window.appRefreshData?.();
      });
    });

    // Populate from taskGroups
    state.taskGroups.forEach((group) => {
      const textContainer = document.querySelector(`[data-text-for="${group.task_id}"]`);
      const audioContainer = document.querySelector(`[data-audio-for="${group.task_id}"]`);
      const flameEl = document.querySelector(`[data-flame-for="${group.task_id}"] .count`);
      const durationEl = document.querySelector(`[data-duration-for="${group.task_id}"]`);
      
      if (textContainer) {
        textContainer.innerHTML = (new Array(group.text_count || 0))
          .fill('<span class="dot text-dot"></span>')
          .join('');
      }
      if (audioContainer) {
        audioContainer.innerHTML = (new Array(group.audio_count || 0))
          .fill('<span class="dot audio-dot"></span>')
          .join('');
      }
      if (flameEl) {
        flameEl.textContent = String(group.study_days_count || 0);
      }
      if (durationEl) {
        durationEl.textContent = `${Utils.formatMinutes(group.spoken_minutes)} spoken`;
      }
    });
  };

  return {
    validateTaskForm,
    validatePracticeForm,
    resetTaskForm,
    renderTaskOptions,
    render,
  };
})();
