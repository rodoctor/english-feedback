# Changelog

All notable changes to this project are recorded here.

## v0.05.01 - Stability and UX refinements

- Fixed report payload validation issues by aligning backend responses with the report schema.
- Corrected the rendering order so task markers appear after report data is loaded.
- Added and verified container rebuilds for the updated frontend and backend.
- Cleaned up Docker Compose configuration with explicit named volumes.
- Verified the report, task, flashcard, and practice flows end to end.

## v0.05.00 - Analytics and chart polish

- Removed `Most common errors` from the analytics panel.
- Added a Plotly-based bar chart for the 10 most studied topics.
- Styled the chart with thin neon bars to match the site visual language.
- Kept a fallback rendering path for environments where Plotly is unavailable.
- Tuned report and analytics presentation to fit the dark neon theme.

## v0.04.00 - Audio metrics and persistence

- Measured audio duration using `ffprobe`.
- Stored `audio_duration_seconds` for practice sessions.
- Added spoken-minute totals to task reporting and analytics.
- Persisted uploaded audio files through a Docker volume so audio history survives container restarts.
- Added a fallback migration path for older records and data cleanup.

## v0.03.00 - Reports, flashcards, and study insights

- Added task-grouped report views.
- Included task title, session count, activity dates, notes/texts, and audio references in report groups.
- Added calendar-based study tracking.
- Added summary stats such as study streaks, most used hashtags, sessions per task, and most active task.
- Extended flashcards with task awareness and added task filtering in the flashcards view.
- Added validation and inline feedback for task and practice forms.
- Added submit locking and a `New` action after a practice session is saved.
- Added visual study markers in the task cards, including text dots, audio dots, and study-day indicators.

## v0.02.00 - Tasks and practice workflow

- Added a new main tab called `Tasks`.
- Implemented full task CRUD: create, list, edit, and delete.
- Added the `Task` database model and linked practice sessions to tasks through `task_id`.
- Required task selection before submitting a practice session.
- Renamed the visible workflow from `Training` to `Practice` in the UI.
- Added backend endpoints for task management.
- Updated the practice submission endpoint to accept `task_id`.
- Added startup migration and backfill logic to keep older data working.

## v0.01.00 - Initial app foundation

- Established the base English Feedback web app.
- Added the core frontend shell with tabs, panels, and the first AI workflow.
- Added the backend FastAPI service, database integration, and Docker-based local setup.
- Added provider configuration support for server-side API key storage.
- Added audio handling and transcription support through the backend stack.
