# English Feedback - Architecture Documentation

## Overview

English Feedback é uma aplicação full-stack para treinar e melhorar habilidades de escrita e fala em inglês usando IA (OpenAI/Claude). A arquitetura foi refatorada para modularização, facilitando manutenção e expansão futura.

## Stack Tecnológico

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Banco de Dados**: PostgreSQL
- **ORM**: SQLAlchemy
- **Processamento de IA**: OpenAI / Anthropic Claude
- **Transcription**: Whisper (via API)

### Frontend
- **Arquitetura**: Modular com IIFEs (Immediately Invoked Function Expressions)
- **CSS**: Vanilla CSS com tema neon dark
- **JS**: Vanilla JavaScript (sem bundler, carregamento via `<script>`)
- **Grafos**: Plotly.js para visualização

## Estrutura de Diretórios

```
english-feedback/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── crud.py              # Database operations
│   │   ├── core/
│   │   │   ├── config.py        # Settings & env
│   │   │   └── security.py      # Auth & tokens
│   │   ├── db/
│   │   │   └── session.py       # DB session factory
│   │   ├── routers/             # API endpoints
│   │   │   ├── tasks.py
│   │   │   ├── training.py
│   │   │   ├── flashcards.py
│   │   │   ├── report.py
│   │   │   ├── daily_words.py
│   │   │   ├── health.py
│   │   │   └── config.py
│   │   └── services/
│   │       ├── audio.py         # Audio processing
│   │       ├── crud.py          # Business logic
│   │       └── ai/
│   │           ├── base.py      # Base AI service
│   │           ├── openai_service.py
│   │           ├── claude_service.py
│   │           ├── factory.py   # Service factory
│   │           ├── prompts.py   # LLM prompts
│   │           └── utils.py     # AI utilities
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html               # HTML structure
│   ├── styles.css               # Main CSS
│   ├── app.js                   # Orchestrator (refatorado)
│   ├── modules/
│   │   ├── state.js             # State management
│   │   ├── api.js               # HTTP client
│   │   ├── utils.js             # Utilities & helpers
│   │   └── renderers/
│   │       ├── tasks.js         # Tasks & practice UI
│   │       ├── flashcards.js    # Flashcards UI
│   │       ├── report.js        # Analytics & calendar
│   │       └── daily-words.js   # Daily words & dictionary
│   ├── nginx.conf
│   ├── Dockerfile
│   └── favicon.ico
├── database/
│   └── schema.sql
└── docker-compose.yml
```

## Arquitetura do Frontend (Modular)

### Camadas

```
┌─────────────────────────────────────────────────────┐
│  index.html (Markup & Style)                        │
├─────────────────────────────────────────────────────┤
│  app.js (Orchestrator)                              │
│  - Inicializa event listeners                       │
│  - Coordena módulos                                 │
├─────────────────────────────────────────────────────┤
│  Renderers (Feature-specific UI logic)              │
│  - TasksRenderer, FlashcardsRenderer, etc.          │
├─────────────────────────────────────────────────────┤
│  State | API | Utils                                │
│  - Gerenciamento de estado                          │
│  - Chamadas HTTP                                    │
│  - Funções auxiliares                               │
└─────────────────────────────────────────────────────┘
```

### Módulos

#### **state.js** - Gerenciamento de Estado Centralizado
```javascript
// Acesso
State.data              // Lê estado (read-only)
State.get(key)          // Obtém propriedade
State.set(key, value)   // Define propriedade
State.update(obj)       // Atualiza múltiplas props

// Reatividade
State.subscribe(callback)  // Escuta mudanças
State.notify()             // Notifica subscribers
```

**Estado Gerenciado:**
- Modo (texto/áudio)
- Gravador e chunks de áudio
- Tasks, flashcards, hashtags
- Daily words & dicionário
- Modo de revisão
- Mês do relatório

#### **api.js** - Camada HTTP
```javascript
// Todos os endpoints encapsulados
API.getTasks()
API.submitTraining(formData)
API.getReport(query)
API.getDailyWordsToday()
// ... etc
```

**Benefício:** Mudanças em endpoints = mudança em um lugar

#### **utils.js** - Funções Auxiliares
```javascript
// DOM
Utils.el(id)              // document.getElementById
Utils.elOrNull(id)        // null se não existir

// Rendering
Utils.escapeHtml(text)    // XSS prevention
Utils.renderMarkdown(md)  // Markdown → HTML
Utils.formatMinutes(n)    // Formatação

// UI
Utils.showToast(msg, status)
Utils.setStatus(text)
Utils.showFieldError(id, msg)
```

#### **renderers/tasks.js** - Tasks & Practice
```javascript
TasksRenderer.validateTaskForm()
TasksRenderer.validatePracticeForm()
TasksRenderer.render()                // Renderiza lista de tasks
TasksRenderer.renderTaskOptions()     // Popula selects
TasksRenderer.resetTaskForm()
```

#### **renderers/flashcards.js** - Flashcards
```javascript
FlashcardsRenderer.render()           // Renderiza grid
FlashcardsRenderer.refreshFilters()   // Atualiza select de tasks
```

#### **renderers/report.js** - Analytics
```javascript
ReportRenderer.render(report)
ReportRenderer.renderPlotly(items)    // Gráfico com Plotly
ReportRenderer.renderChart(items)     // Canvas fallback
ReportRenderer.openDaySessionsModal(date)
```

#### **renderers/daily-words.js** - Daily Words & Dictionary
```javascript
DailyWordsRenderer.renderDailyWords(payload)
DailyWordsRenderer.submitDailyWords()
DailyWordsRenderer.renderDictionary(payload)
DailyWordsRenderer.openDictionaryTab()
DailyWordsRenderer.openDailyWordsTab()
```

### Fluxo de Dados

```
┌──────────────────┐
│  User Interaction │
│  (click, input)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│  app.js Event Listeners          │
│  (Handlers: submitTask, etc)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  API Module                      │
│  (HTTP calls: POST, GET, etc)   │
└────────┬──────────────┬──────────┘
         │              │
         │              ▼
         │         ┌─────────────┐
         │         │  Backend    │
         │         │  FastAPI    │
         │         └──────┬──────┘
         │                │
         ▼                ▼
┌──────────────────────────────────┐
│  State Module                    │
│  (Atualiza Estado Global)        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Renderers                       │
│  (Lê State, gera HTML)           │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  DOM Updated                     │
│  (User vê mudanças)              │
└──────────────────────────────────┘
```

## Arquitetura do Backend

### Modelos (SQLAlchemy)

```python
# Core
User
Task
Session (práticas)

# Training
TrainingSession (texto/áudio + feedback IA)
Flashcard

# Daily Words
DailyWordSet (10 palavras por dia)
DailyWordEntry (palavra individual + user_sentence + feedback)

# Config
UserConfig (provider, api_key)
```

### Routers (FastAPI)

```
/tasks              POST, GET, PUT, DELETE
/analyze            POST (text/audio training)
/flashcards         GET, DELETE
/report             GET (analytics + calendar)
/daily-words/*      GET, POST (today/open, today/submit, dictionary)
/config             GET, PUT
/backup/*           GET, POST (export/import)
/reset              POST
/health             GET
```

### Services

**ai/** - Estratégia Factory
```python
AIServiceFactory.create(provider)
├─ OpenAIService (gpt-4-turbo)
└─ ClaudeService (claude-3-opus)

# Métodos
generate_daily_words(user_id, count)
evaluate_daily_word(user_sentence, word_meaning)
analyze_training_content(content)
```

**audio.py** - Processamento de áudio
```python
compress_audio(file)
transcribe_audio(file, provider)
```

**crud.py** - Operações de banco
```python
create_task(user_id, data)
get_user_sessions(user_id, filters)
# ... etc
```

## Fluxos Principais

### 1. Treinar (Texto/Áudio)
```
User submits → Validation → API call → 
Backend processes (transcription if audio) → 
AI evaluates → Feedback generated → 
Frontend renders → Toast + refresh
```

### 2. Daily Words
```
Day opens → API loads words → 
User fills 10 sentences → 
Submit → AI evaluates each → 
Store feedback → 
Redirect to dictionary
```

### 3. Report
```
Tab switched → API loads month data → 
Parse calendar + analytics → 
Render calendar + charts + task groups
```

## Padrões Utilizados

### Frontend

**IIFE (Immediately Invoked Function Expression)**
```javascript
const Module = (() => {
  // Private scope
  const privateVar = ...
  
  return {
    // Public API
    method: () => {},
  };
})();
```

**Benefícios:**
- Encapsulamento automático
- Sem build step necessário
- Simples para browser vanilla

**Observer Pattern (State)**
```javascript
State.subscribe(callback)  // Subscribers notificados
State.notify()             // Trigger manual se necessário
```

**Dependency Injection (via globals)**
- Modules acessam uns aos outros via `window.` globals
- Simples para escala atual
- Futuro: considerar ES6 modules com bundler

### Backend

**Factory Pattern (AI Services)**
- Criação dinâmica de serviço correto
- Fácil adicionar novos providers

**Repository Pattern**
- CRUD centralizado
- Lógica de banco em um lugar

## Manutenção & Expansão

### Adicionar Nova Feature

**Frontend:**
1. Criar `modules/renderers/feature-name.js`
2. Exportar métodos públicos
3. Importar em `index.html` (antes de app.js)
4. Usar em `app.js` e outros modules

**Backend:**
1. Criar `routers/feature.py` com endpoints
2. Criar modelos em `models.py` se necessário
3. Criar lógica em `services/`
4. Registrar router em `main.py`

### Modificar Endpoint

1. **Backend**: Editar `routers/*/py`
2. **Frontend**: Editar correspondente em `modules/api.js`
3. **Renderer**: Atualizar renderer que consome

## Otimizações Futuras

- [ ] Bundler (Vite/Webpack) para minificação
- [ ] TypeScript para type safety
- [ ] Testing framework (Jest/Pytest)
- [ ] CI/CD pipeline
- [ ] Caching estratégico
- [ ] Progressive Web App (PWA)
- [ ] Offline support

## Notas

- **Sem autenticação atual** - Implementar JWT/sessions antes de produção
- **Sem rate limiting** - Adicionar antes de expor públicamente
- **CSS não é modular** - Considerar CSS-in-JS ou módulos CSS
- **Estado único global** - Escala bem até ~5MB de dados
