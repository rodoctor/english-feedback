# Docker & Container Documentation

This directory contains configuration and helpers for running English Feedback in containers.

## Container Architecture

The project uses Docker Compose to orchestrate 3 services:

### Services

1. **frontend** (nginx:1.27-alpine)
   - Serves the single-page application
   - Port: `8080`
   - Serves static files: HTML, CSS, JS modules
   - Proxies `/api/` requests to backend
   - Proxies `/uploads/` requests to backend

2. **backend** (python:3.12-slim)
   - FastAPI REST API server
   - Port: `8000`
   - Handles AI processing, database operations, and audio transcription
   - Stores uploaded audio files in persistent volume

3. **postgres** (postgres:16-alpine)
   - PostgreSQL database
   - Port: `5433` (mapped from internal 5432)
   - Persistent data storage with Docker volume
   - Initialized with schema on first run

## Quick Reference

### Start All Services
```bash
# Build and start in background
docker compose up -d --build

# Or with verbose output
docker compose up --build
```

### Stop Services
```bash
# Stop all services (keep data)
docker compose down

# Stop and remove volumes (delete data)
docker compose down -v
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres

# Last 50 lines
docker compose logs --tail=50 backend
```

### Rebuild Services
```bash
# Rebuild one service
docker compose build frontend

# Rebuild all
docker compose build

# Rebuild and restart
docker compose up -d --build
```

### Access Services
```bash
# Frontend (web UI)
http://localhost:8080

# Backend health check
http://localhost:8000/health

# Backend API docs (Swagger)
http://localhost:8000/docs

# PostgreSQL CLI
psql -h localhost -p 5433 -U english_feedback -d english_feedback
```

## Configuration

### Environment Variables

Create `.env` in project root:

```bash
# PostgreSQL
POSTGRES_DB=english_feedback
POSTGRES_USER=english_feedback
POSTGRES_PASSWORD=english_feedback

# Backend
DATABASE_URL=postgresql+psycopg://english_feedback:english_feedback@postgres:5432/english_feedback
APP_SECRET_KEY=your-secret-key-here
AI_DEFAULT_PROVIDER=openai

# Optional: AI keys (also configurable from app)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Volumes

Two persistent Docker volumes:

1. **postgres_data**: Database files
2. **backend_uploads**: Uploaded audio files

They survive container restarts and are only deleted with `docker compose down -v`.

## Troubleshooting

### "Connection refused" to backend
- Wait 5-10 seconds for backend to start
- Check logs: `docker compose logs backend`
- Ensure port 8000 is not in use

### "Connection refused" to database
- Wait 10-15 seconds for PostgreSQL to initialize
- Check logs: `docker compose logs postgres`
- Verify database URL in logs

### Database migration failed
- Reset everything: `docker compose down -v && docker compose up --build`
- Or check logs: `docker compose logs backend | grep -i error`

### Frontend shows blank page
- Clear browser cache (Ctrl+Shift+Del)
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for errors (F12)
- Verify frontend is running: `docker ps | grep frontend`

### Audio files not persisting
- Ensure `backend_uploads` volume exists: `docker volume ls`
- Check upload directory: `docker exec english-feedback-backend-1 ls -la /app/app/static/uploads`
- Verify volume mounted in service: `docker inspect english-feedback-backend-1`

## Monitoring

### Container Status
```bash
# List running containers
docker compose ps

# Detailed info
docker compose ps --services
```

### Resource Usage
```bash
# CPU, memory, network
docker stats

# Or specific container
docker stats english-feedback-backend-1
```

### Database Size
```bash
# Connect to database
docker exec -it english-feedback-postgres-1 psql -U english_feedback -d english_feedback

# Inside psql
\l              -- List databases
\dt             -- List tables
\du             -- List users
\dn             -- List schemas
SELECT pg_size_pretty(pg_database_size('english_feedback')); -- Database size
```

## Production Considerations

### Security
- Change default PostgreSQL password in `.env`
- Set strong `APP_SECRET_KEY`
- Use HTTPS in production (add reverse proxy like Traefik)
- Store API keys in secure secret manager

### Performance
- Use production database (managed service, not container)
- Add load balancer for multiple backend instances
- Use CDN for static frontend assets
- Implement database backups

### Deployment
- Use Docker registry for image management
- Deploy with Kubernetes or Docker Swarm
- Set resource limits in docker-compose
- Configure health checks
- Set up monitoring and alerting

## Maintenance

### Backup Data
```bash
# Backup database
docker exec english-feedback-postgres-1 pg_dump -U english_feedback english_feedback > backup.sql

# Backup uploads
docker run --rm -v english-feedback_backend_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /data .
```

### Restore Data
```bash
# Restore database
cat backup.sql | docker exec -i english-feedback-postgres-1 psql -U english_feedback english_feedback

# Restore uploads
docker run --rm -v english-feedback_backend_uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /data
```

### Clean Up
```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove all (careful!)
docker system prune -a
```

## Related Documentation

- [Main README](../README.md) - Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [docker-compose.yml](../docker-compose.yml) - Service configuration
