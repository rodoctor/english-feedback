/**
 * Flashcards Renderer Module
 * Handles rendering and logic for flashcards
 */

const FlashcardsRenderer = (() => {
  const { el, escapeHtml } = Utils;
  const state = State.data;

  const refreshFilters = () => {
    const taskFilter = el('flashcardTaskFilter');
    const current = taskFilter.value;
    taskFilter.innerHTML = '<option value="">All tasks</option>' + state.tasks.map((task) => 
      `<option value="${task.id}">${escapeHtml(task.title)}</option>`
    ).join('');
    taskFilter.value = current;
  };

  const render = () => {
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

    // Flip handlers
    container.querySelectorAll('.flashcard').forEach((card) => {
      card.addEventListener('click', () => card.classList.toggle('flipped'));
    });

    // Delete handlers
    container.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const flashcardId = button.getAttribute('data-delete-id');
        if (!flashcardId || !window.confirm('Delete this flashcard?')) return;
        await API.deleteFlashcard(flashcardId);
        window.appRefreshData?.();
      });
    });
  };

  return {
    refreshFilters,
    render,
  };
})();
