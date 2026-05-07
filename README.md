# English Feedback

English Feedback is a study workspace for practicing English writing and speaking with AI-assisted corrections.

It is designed to help you organize study goals, submit practice sessions as text or audio, review corrections, and track progress over time through reports, flashcards, and task-based analytics.

## What the app does

- Create study tasks and group practice sessions under each task.
- Submit a practice session in text or audio mode.
- Select the task before submitting, so every session is tied to a learning goal.
- Review AI feedback in a readable result panel.
- Turn corrections into flashcards for spaced review.
- Browse study history in a calendar-based report.
- Track task activity, study streaks, hashtags, spoken minutes, and top topics.
- Configure the AI provider from the app without exposing keys in the browser.

## Main features

### Tasks

- Create, edit, list, and delete tasks.
- Group all practice sessions by task.
- See quick visual indicators for text sessions, audio sessions, and study-day activity.

### Practice

- Switch between text and audio input.
- Record audio directly in the browser.
- Compress audio before transcription in the backend.
- Lock the submit flow after a session is sent, then start a new one with the `New` action.

### Flashcards

- Review generated flashcards.
- Filter flashcards by task or hashtag.
- Flip cards in place and remove items when needed.

### Reports

- Browse activity by month in a calendar view.
- Open a day to see the sessions submitted on that date.
- View task summaries with dates, notes, audio references, and spoken time.
- See analytics including study streak, most used hashtags, sessions per task, and the most active task.
- View a Plotly bar chart for the 10 most studied topics with a neon-style presentation.

## Tech stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: FastAPI
- Database: PostgreSQL
- Infra: Docker and Docker Compose
- Audio processing: ffmpeg and ffprobe inside the backend container

## Project structure

- `frontend/` - single-page UI, styles, and client-side interactions
- `backend/` - FastAPI application, database models, services, and API routers
- `database/` - SQL schema and bootstrap data
- `docker/` - container-related documentation and support files

## How it works

1. Create one or more tasks from the `Tasks` tab.
2. Go to `Practice`, choose a task, and submit either text or audio.
3. The backend sends the content to the selected AI provider and stores the result.
4. Generated corrections can be reviewed as flashcards.
5. The `Report` tab shows study history, task summaries, chart data, and session details.

## Run with Docker

Start the full stack with Docker Compose:

```bash
docker compose up --build
```

Open the app after the containers start:

- Frontend: http://localhost:8080
- Backend health: http://localhost:8000/health
- PostgreSQL: localhost:5433

## Configuration

Use the `Config` tab to store the provider and API key in the backend database.

The API key stays server-side, so it is not exposed in the browser.

### Backup and restore

Use the backup tools in the `Config` tab to export and import your study data.

- Export generates a ZIP with `data.json` plus any uploaded audio files referenced by practice sessions.
- Import restores the database records and writes the audio files back into `backend/app/static/uploads`.
- This keeps audio practice history playable after moving data between environments.

## Notes

- The backend uses an AI service abstraction layer, which makes it easier to switch providers.
- Audio files are stored in a persistent Docker volume.
- The report data is grouped by task to make study habits easier to compare.
- A `CHANGELOG.md` file is included at the project root with versioned history from the first iteration.

## Development tips

- If you need to inspect backend logs, run:

```bash
docker compose logs -f backend
```

- If you want to rebuild after changes, run:

```bash
docker compose up -d --build frontend backend
```