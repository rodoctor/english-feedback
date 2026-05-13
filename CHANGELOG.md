# Changelog

All notable changes to this project are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-05-12 - Modular Architecture & Dictionary Search

### Major Refactoring
- **Frontend Modularization**: Reduced monolithic `app.js` from 1,213 to 300 lines
  - Extracted 7 independent modules: `state.js`, `api.js`, `utils.js`, and feature renderers
  - Implemented IIFE pattern for encapsulation and dependency management
  - Improved code maintainability, testability, and reusability

### New Features
- **Dictionary Search**: Search for English words in the dictionary tab
  - Look up new words on-demand with AI assistance
  - Automatically save searched words to personal dictionary
  - Validation ensures only English words can be saved
  - Clear button reloads dictionary to show newly-added words

- **Enhanced Daily Words**: Improved daily vocabulary exercise
  - Separated "Daily Words" from "Dictionary Lookups" for clarity
  - Dictionary lookups don't clutter daily study reports
  - Personal dictionary grows with each search

### Documentation
- Added `ARCHITECTURE.md` - Complete system design and patterns
- Added `DATABASE_SCHEMA.md` - ERD diagram and database reference
- Added `AI_INSTRUCTIONS.md` - Guide for AI developers
- Added `MODULAR_REFACTOR.md` - Refactoring overview
- Added `ARCHITECTURE_DIAGRAMS.md` - 10 visual system diagrams

### Technical Improvements
- Plotly CDN updated from deprecated `plotly-latest.min.js` to `plotly-2.35.2.min.js`
- Fixed frontend module serving in Docker (nginx now copies `modules/` directory)
- Improved error messages for dictionary validation
- Enhanced dictionary state management with separate lookup tracking

### Build & Deployment
- Frontend Dockerfile updated to include `modules/` directory
- All services build and deploy successfully with new architecture
- Backward compatible with existing data and backups

---

## [1.0.0] - Earlier Versions

### v0.05.02 - Audio backup export and restore

- Included uploaded audio files in the backup export ZIP.
- Restored audio files from uploaded ZIP backups during import.
- Preserved session audio references so exported and imported study history stays complete.

### v0.05.01 - Stability and UX refinements

- Fixed report payload validation issues by aligning backend responses with the report schema.
- Corrected the rendering order so task markers appear after report data is loaded.
- Added and verified container rebuilds for the updated frontend and backend.
- Cleaned up Docker Compose configuration with explicit named volumes.
- Verified the report, task, flashcard, and practice flows end to end.

### v0.05.00 - Analytics and chart polish

- Removed `Most common errors` from the analytics panel.
- Added a Plotly-based bar chart for the 10 most studied topics.
- Styled the chart with thin neon bars to match the site visual language.
- Kept a fallback rendering path for environments where Plotly is unavailable.
- Tuned report and analytics presentation to fit the dark neon theme.

### v0.04.00 - Audio metrics and persistence

- Measured audio duration using `ffprobe`.
- Stored `audio_duration_seconds` for practice sessions.
- Added spoken-minute totals to task reporting and analytics.
- Persisted uploaded audio files through a Docker volume so audio history survives container restarts.
- Added a fallback migration path for older records and data cleanup.

### v0.03.00 - Reports, flashcards, and study insights

- Added task-grouped report views.
- Included task title, session count, activity dates, notes/texts, and audio references in report groups.
- Added calendar-based study tracking.
- Added summary stats such as study streaks, most used hashtags, sessions per task, and most active task.
- Extended flashcards with task awareness and added task filtering in the flashcards view.
- Added validation and inline feedback for task and practice forms.
- Added submit locking and a `New` action after a practice session is saved.
- Added visual study markers in the task cards, including text dots, audio dots, and study-day indicators.

### v0.02.00 - Tasks and practice workflow

- Added a new main tab called `Tasks`.
- Implemented full task CRUD: create, list, edit, and delete.
- Added the `Task` database model and linked practice sessions to tasks through `task_id`.
- Required task selection before submitting a practice session.
- Renamed the visible workflow from `Training` to `Practice` in the UI.
- Added backend endpoints for task management.
- Updated the practice submission endpoint to accept `task_id`.
- Added startup migration and backfill logic to keep older data working.

### v0.01.00 - Initial app foundation

- Established the base English Feedback web app.
- Added the core frontend shell with tabs, panels, and the first AI workflow.
- Added the backend FastAPI service, database integration, and Docker-based local setup.
- Added provider configuration support for server-side API key storage.
- Added audio handling and transcription support through the backend stack.
