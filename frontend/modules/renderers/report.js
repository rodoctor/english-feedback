/**
 * Report Renderer Module
 * Handles rendering and logic for report, analytics, and calendar
 */

const ReportRenderer = (() => {
  const { el, escapeHtml, formatMinutes, renderMarkdown } = Utils;
  const state = State.data;

  const openDaySessionsModal = async (date) => {
    const modal = Utils.elOrNull('daySessionsModal');
    const label = Utils.elOrNull('modalDateLabel');
    const content = Utils.elOrNull('modalContent');
    const backdrop = Utils.elOrNull('modalBackdrop');
    const closeBtn = Utils.elOrNull('modalCloseBtn');
    
    label.textContent = `Sessions for ${date}`;
    content.innerHTML = '<div class="source-preview">Loading sessions...</div>';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    closeBtn.onclick = closeDaySessionsModal;
    backdrop.onclick = closeDaySessionsModal;

    try {
      const params = new URLSearchParams({ date });
      const taskId = el('reportTaskFilter').value;
      const hashtag = el('reportHashtagFilter').value;
      const topic = el('reportTitleFilter').value;
      if (taskId) params.set('task_id', taskId);
      if (hashtag) params.set('hashtag', hashtag);
      if (topic) params.set('topic', topic);
      
      const items = await API.getDaySessionsSessions(params.toString());
      if (!items.length) {
        content.innerHTML = '<div class="source-preview">No sessions found for this date.</div>';
        return;
      }

      content.innerHTML = items.map((s) => {
        const timeLabel = new Date(s.created_at).toLocaleTimeString();
        const summary = `${escapeHtml(s.title)} · ${escapeHtml(timeLabel)} · ${escapeHtml(s.input_mode)}${
          s.task_title ? ` · ${escapeHtml(s.task_title)}` : ''
        }`;
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
    const modal = Utils.elOrNull('daySessionsModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };

  const renderChart = (items) => {
    const canvas = document.getElementById('reportChart');
    if (!canvas || !items) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, h);
    const data = items.slice(0, 8);
    if (!data.length) return;
    const max = Math.max(...data.map(i => i.count));
    const padding = 20 * devicePixelRatio;
    const barWidth = (w - padding * 2) / data.length * 0.7;
    data.forEach((item, idx) => {
      const x = padding + idx * ((w - padding * 2) / data.length) + ((w - padding * 2) / data.length - barWidth) / 2;
      const barH = (h - padding * 2) * (item.count / (max || 1));
      const y = h - padding - barH;
      ctx.fillStyle = 'rgba(32,217,127,0.9)';
      ctx.fillRect(x, y, barWidth, barH);
      ctx.fillStyle = '#aee';
      ctx.font = `${12 * devicePixelRatio}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, h - padding + 14 * devicePixelRatio);
      ctx.fillText(String(item.count), x + barWidth / 2, y - 6 * devicePixelRatio);
    });
  };

  const renderPlotly = (items) => {
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
      x, y,
      type: 'bar',
      marker: {
        color: neonColor,
        line: { color: 'rgba(255,255,255,0.06)', width: 1 },
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
      bargap: 0.78,
    };

    const config = { responsive: true, displayModeBar: false, staticPlot: false };

    if (window.Plotly && window.Plotly.react) {
      try {
        window.Plotly.react(plotEl, [trace], layout, config);
      } catch (err) {
        renderChart(items);
      }
    } else {
      renderChart(items);
    }
  };

  const render = (report) => {
    const month = state.reportMonth;
    const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    el('calendarLabel').textContent = label;

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
    const currentDay = isCurrentMonth ? today.getDate() : null;

    const days = report.calendar?.days || [];
    el('calendarGrid').innerHTML = days.map((day) => `
      <div class="calendar-cell ${day.has_study ? 'has-study' : ''} ${day.day === currentDay ? 'is-today' : ''}" data-day="${String(day.day).padStart(2, '0')}">
        <strong>${day.day}</strong>
        <small class="hint">${day.weekday}</small>
      </div>
    `).join('');

    // Click handlers for days with study
    el('calendarGrid').querySelectorAll('.calendar-cell.has-study').forEach((cell) => {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', async () => {
        try {
          const day = cell.getAttribute('data-day');
          const yearMonth = state.reportMonth.toISOString().slice(0, 7);
          const date = `${yearMonth}-${day}`;
          await openDaySessionsModal(date);
        } catch (err) {
          Utils.setStatus(err.message);
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
    ].map(([labelText, value]) => 
      `<div class="analytics-item"><span>${labelText}</span><strong>${escapeHtml(String(value))}</strong></div>`
    ).join('');

    el('studyDayCount').textContent = String(report.calendar?.study_days || 0);
    el('currentStreakBadge').textContent = String(analytics.current_streak ?? 0);
    el('maxStreakBadge').textContent = String(analytics.max_streak ?? 0);

    const taskGroups = report.tasks || [];
    State.set('taskGroups', taskGroups);
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
              <article class="daily-word-report-item ${entry.is_correct ? 'correct' : (entry.is_correct === false ? 'incorrect' : 'pending')}">
                <div class="daily-word-head">
                  <strong>${escapeHtml(entry.word)}</strong>
                  <span class="daily-word-status ${entry.is_correct ? 'correct' : (entry.is_correct === false ? 'incorrect' : 'pending')}">${entry.is_correct ? 'Correct' : (entry.is_correct === false ? 'Needs fix' : 'Pending')}</span>
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

  return {
    openDaySessionsModal,
    closeDaySessionsModal,
    renderChart,
    renderPlotly,
    render,
  };
})();
