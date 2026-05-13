# English Feedback

> **Learn English with AI-powered feedback on your writing and speaking**

[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)

English Feedback is a study workspace for practicing English through structured tasks, real-time AI feedback, and progress tracking. Submit practice sessions in text or audio, get detailed corrections, and build a personalized learning dashboard.

## Core Features

### Study Organization
- **Tasks**: Create learning goals and organize practice sessions by topic
- **Tasks Dashboard**: Visual indicators for text sessions, audio sessions, and study-day streaks
- **Quick Stats**: Cards showing flashcard count, study days, and current/max streaks

### Practice Modes
- **Text Input**: Write practice content directly
- **Audio Recording**: Record speech in-browser and auto-transcribe
- **AI Analysis**: Get detailed feedback from OpenAI (GPT-4) or Claude 3 Opus
- **Result Display**: Read corrections in a clean, formatted panel

### Learning Insights
- **Calendar View**: See study activity by month, with indicators for each day
- **Task Reports**: Group sessions by task with activity dates, notes, and audio references
- **Analytics**: Track study streaks, most-used hashtags, spoken minutes, and top topics
- **Charts**: Interactive bar charts showing your 10 most studied topics

### Flashcards
- **Auto-generated**: AI creates flashcards from practice feedback
- **Smart Filtering**: Find cards by task or hashtag
- **Review Mode**: Flip cards and track progress

### Daily Words
- **Daily Exercise**: Get 10 random English words each day
- **Sentence Practice**: Write a sentence for each word
- **AI Evaluation**: Get feedback on grammar and word usage
- **Personal Dictionary**: Search and save words from a growing personal dictionary
- **Alphabet Tabs**: Browse your vocabulary organized by letter

### Data Management
- **Backup & Restore**: Export your complete study data (including audio) as ZIP
- **Provider Switch**: Change between OpenAI and Claude without re-entering data
- **Server-side Storage**: API keys never leave the backend

---

## Quick Start

### Prerequisites
- Docker and Docker Compose (v2.0+)
- 2GB RAM available
- Port 8080 (frontend), 8000 (backend), 5433 (database) available

### Installation

1. **Clone and navigate to the project:**
   ```bash
   git clone <repo-url>
   cd english-feedback
   ```

2. **Start all services:**
   ```bash
   docker compose up --build
   ```

3. **Access the app:**
   - **Frontend**: http://localhost:8080
   - **Backend Health**: http://localhost:8000/health
   - **API Docs**: http://localhost:8000/docs

4. **Configure AI provider:**
   - Open the **Config** tab
   - Select provider (OpenAI or Claude)
   - Enter your API key (stored securely on the backend)

### First Steps

1. **Create a Task**: Go to Tasks tab → enter title and description → "Add Task"
2. **Submit Practice**: Go to Practice tab → select task → enter text or record audio → Submit
3. **Review Feedback**: Results appear in the Result panel
4. **Check Report**: Go to Report tab to see calendar, analytics, and task summaries

---

## Architecture

### Frontend (Modular JavaScript)
- **modules/state.js** - Centralized state management
- **modules/api.js** - HTTP client with all backend calls
- **modules/utils.js** - Shared utilities and DOM helpers
- **modules/renderers/** - Feature-specific UI logic (tasks, practice, flashcards, etc.)
- **app.js** - Application orchestrator

### Backend (FastAPI + PostgreSQL)
- **routers/** - API endpoints for tasks, practice, flashcards, daily words, reports
- **services/ai/** - AI service abstraction (OpenAI, Claude, factory pattern)
- **models.py** - SQLAlchemy database models
- **schemas.py** - Pydantic request/response schemas

### Database
- **Users**: Account and provider configuration
- **Tasks**: Learning goals
- **TrainingSessions**: Practice submissions with AI feedback
- **Flashcards**: Generated study cards
- **DailyWordSets** & **DailyWordEntries**: Daily vocabulary exercises
- **Hashtags**: Tags for organizing sessions and flashcards

---

## Development

### Project Structure
```
english-feedback/
├── frontend/              # HTML, CSS, modular JS
│   ├── modules/          # Modular component files
│   ├── app.js           # Main orchestrator
│   ├── index.html       # Single-page app
│   └── styles.css       # Neon dark theme
├── backend/              # FastAPI server
│   ├── app/
│   │   ├── routers/     # API endpoints
│   │   ├── services/    # Business logic & AI
│   │   ├── models.py    # Database schemas
│   │   └── main.py      # FastAPI setup
│   └── requirements.txt  # Python dependencies
├── database/             # Database initialization
└── docker/              # Container support files
```

### Rebuild After Changes

```bash
# Rebuild one service
docker compose build frontend

# Rebuild everything
docker compose build

# Restart with new images
docker compose up -d
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Database Access

```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U english_feedback -d english_feedback
```

---

## Documentation

Detailed documentation is available in:

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, patterns, and data flow
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database ERD and table descriptions
- **[AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)** - Guide for developers working with AI
- **[MODULAR_REFACTOR.md](MODULAR_REFACTOR.md)** - Frontend refactoring overview
- **[ARCHITECTURE_DIAGRAMS.md](ARCHITECTURE_DIAGRAMS.md)** - Visual system diagrams

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database
POSTGRES_DB=english_feedback
POSTGRES_USER=english_feedback
POSTGRES_PASSWORD=english_feedback

# Backend
DATABASE_URL=postgresql+psycopg://english_feedback:english_feedback@postgres:5432/english_feedback
APP_SECRET_KEY=change-me-in-production
AI_DEFAULT_PROVIDER=openai

# AI Keys (optional - can be set from Config tab)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### AI Providers

- **OpenAI**: GPT-4 Turbo ($) - Better for detailed analysis
- **Claude**: Claude 3 Opus ($) - Good balance of cost and quality

You can switch providers anytime from the Config tab.

---

## Troubleshooting

### "Could not connect to database"
- Ensure PostgreSQL container is running: `docker compose ps`
- Check database URL in logs: `docker compose logs backend`
- Wait 10-15 seconds for PostgreSQL to fully start on first run

### "Module is not defined" console error
- Clear browser cache and hard-refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Check that all script tags in index.html are loading: open DevTools → Network tab

### Audio recording not working
- Check browser permissions (allows microphone access)
- Test in a fresh incognito window
- Ensure HTTPS or localhost (browsers block audio in insecure contexts)

### No AI feedback appears
- Verify API key is saved in Config tab
- Check backend logs for API errors: `docker compose logs backend`
- Confirm your API key has sufficient credits/balance

### Database migration issues
- Reset database: go to Config → Danger → "Reset all data"
- Or manually clear: `docker compose down -v && docker compose up --build`

---

## Status & Roadmap

### Current Version: 2.0 (Modular)

**Completed:**
- Modular frontend architecture
- Dictionary search with auto-save
- Daily vocabulary exercises
- Audio transcription & processing
- Backup/restore with audio
- Task-based organization
- AI provider abstraction
- Comprehensive documentation

**Possible Future Enhancements:**
- TypeScript migration
- Automated tests
- Mobile app (React Native)
- Spaced repetition algorithm
- Community features (share sessions)
- Advanced analytics and insights
- Speech recognition improvements

---

## License

MIT License - see LICENSE file for details

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test locally
4. Commit with clear messages
5. Push and open a Pull Request

For architectural questions, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Support

For issues, questions, or suggestions:
- Check [CHANGELOG.md](CHANGELOG.md) for recent updates
- Review [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for development help
- Open an issue on the repository

---

**Happy learning!**