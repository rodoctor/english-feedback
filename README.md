# English Feedback

Web app to train English writing and speaking with AI-assisted corrections, flashcards, and reports.

## Stack

- Frontend: HTML, CSS, Vanilla JS
- Backend: FastAPI
- Database: PostgreSQL
- Infra: Docker + docker-compose

## Run with Docker

1. Copy environment variables if needed:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: http://localhost:8080
- Backend health: http://localhost:8000/health
- PostgreSQL: localhost:5433

## Configuration

Use the Config tab to store the provider and API key in the backend database. The app keeps the key server-side and encrypts it at rest.

## Notes

- The app is intentionally modular through an AI service abstraction layer.
- Audio is compressed before transcription using ffmpeg in the backend container.
- The current implementation ships with OpenAI support and a placeholder Claude adapter for future extension.