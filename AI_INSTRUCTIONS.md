# AI Instructions & Context for Future Development

> Este arquivo facilita comunicação com LLMs para desenvolvimento e manutenção do projeto.

## 🎯 Resumo Executivo

**English Feedback** é uma aplicação de aprendizado de inglês que:
- Permite treino com texto/áudio (auto-transcrição)
- Fornece feedback com IA (OpenAI/Claude)
- Rastreia progresso com relatórios e flashcards
- Treina palavras diárias com avaliação automática

**Stack**: FastAPI (backend) + Vanilla JS Modular (frontend) + PostgreSQL

## 📁 Estrutura Rápida

```
backend/app/
├── main.py → FastAPI app
├── models.py → SQLAlchemy
├── schemas.py → Pydantic
├── routers/ → Endpoints
└── services/ai/ → IA service factory

frontend/
├── index.html
├── app.js → Orquestrador
├── modules/
│   ├── state.js → Redux-like state
│   ├── api.js → HTTP wrapper
│   ├── utils.js → Helpers
│   └── renderers/ → UI por feature
└── styles.css
```

## 🏗️ Padrões de Código

### Frontend - IIFEs com Namespaces

```javascript
// Sempre criar como IIFE retornando objeto público
const MyModule = (() => {
  // Private - não acessível de fora
  const helper = () => {};
  
  // Public API
  return {
    publicMethod: () => helper(),
    publicData: [],
  };
})();

// Uso: MyModule.publicMethod()
```

**Por que?** Encapsulamento sem transpiler, simples, funciona em browsers antigos.

### Backend - FastAPI + SQLAlchemy

```python
# router
@router.post("/endpoint")
async def handler(payload: SchemaIn, user_id: int):
    result = await CRUDService.create(user_id, payload)
    return result  # Pydantic converte automáticamente
```

## 📝 Guia de Mudanças Comuns

### Adicionar novo endpoint

1. **Backend** (`backend/app/routers/new_feature.py`):
```python
from fastapi import APIRouter
router = APIRouter(prefix="/new-feature")

@router.get("/")
async def list_items():
    return {"items": []}

# Registrar em main.py:
# app.include_router(new_feature.router)
```

2. **Frontend** (`frontend/modules/api.js`):
```javascript
const API = (() => {
  return {
    // ... existing
    getNewFeature: () => call('/new-feature'),
  };
})();
```

3. **Renderer** (`frontend/modules/renderers/new_feature.js`):
```javascript
const NewFeatureRenderer = (() => {
  const render = () => {
    // Lê State.data, gera HTML, atualiza DOM
  };
  return { render };
})();
```

### Modificar estrutura de estado

```javascript
// Em state.js:
const state = {
  // Adicionar nova propriedade
  myNewProp: null,  // ← Sempre inicializar
};

// Usar em renderers/app.js:
State.set('myNewProp', value);
State.get('myNewProp');
```

### Adicionar validação

**Backend:**
```python
# Em schemas.py
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    
    model_config = ConfigDict(from_attributes=True)

# FastAPI valida automaticamente
@router.post("/tasks")
async def create(payload: TaskCreate):
    ...
```

**Frontend:**
```javascript
// Em modules/renderers/tasks.js
const validateTaskForm = () => {
  const title = Utils.el('taskTitleInput').value.trim();
  if (!title) {
    Utils.showFieldError('taskTitleInput', 'Required');
    return false;
  }
  return true;
};
```

## 🔄 Fluxos Principais

### Daily Words Workflow
```
Usuário abre aba → openDailyWordsTab() 
→ API.getDailyWordsToday()
→ Backend gera 10 palavras randômicas
→ Frontend renderiza DailyWordsRenderer.renderDailyWords()
→ Usuário escreve 10 frases
→ Submit → API.submitDailyWords({answers})
→ Backend avalia cada com IA
→ Atualiza State → renderiza feedback
```

### Training Session Workflow
```
Seleciona Task → Mode (texto/áudio)
→ Texto: digita / Áudio: grava
→ Submit → API.submitTraining(FormData)
→ Backend: transcreve (áudio) + IA analisa
→ Retorna Markdown com feedback
→ Frontend renderiza em resultOutput
```

## 🐛 Troubleshooting

### "Module is not defined"
**Causa**: Ordem de carregamento `<script>` errada em index.html
**Solução**: Verificar que ordem é: utils → state → api → renderers → app

### Estado não atualiza UI
**Causa**: Renderer chamado antes de State.update()
**Solução**: 
```javascript
State.update({...});  // ← Antes
TasksRenderer.render();  // ← Depois
```

### Toast não aparece
**Causa**: HTML não tem `<div id="appToast">`
**Solução**: Verificar index.html tem markup correto

### Fetch 404 em /api/...
**Causa**: Endpoint não registrado em backend/main.py
**Solução**: 
```python
# main.py
app.include_router(new_endpoint.router)
```

## 📊 Dados Importantes

### Variáveis de Ambiente (Backend)
```bash
DATABASE_URL=postgresql://user:pass@localhost/english_feedback
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Configuração FastAPI
```python
# core/config.py
ALLOWED_PROVIDERS = ["openai", "claude"]
DEFAULT_DAILY_WORDS_COUNT = 10
```

### CSS Variables
```css
--ink: #d4e3dc;        /* Texto principal */
--muted: #8ea39a;      /* Texto secundário */
--accent: #00ff88;     /* Neon green */
--line: rgba(0,255,136,0.12);  /* Borders */
--shadow: 0 10px 24px rgba(0,0,0,0.26);
```

## ✅ Checklist para Novas Features

- [ ] Adicionar endpoint em `backend/app/routers/`
- [ ] Criar schema Pydantic se recebe input
- [ ] Incluir router em `main.py`
- [ ] Adicionar métodos em `frontend/modules/api.js`
- [ ] Criar renderer em `frontend/modules/renderers/`
- [ ] Importar renderer em `index.html`
- [ ] Adicionar estado em `frontend/modules/state.js` se necessário
- [ ] Criar event listeners em `app.js`
- [ ] Testar no navegador (F12 console pra erros)
- [ ] Atualizar `ARCHITECTURE.md`

## 🧪 Testing

### Backend (pytest)
```bash
cd backend
pytest tests/
```

### Frontend (manual no navegador)
1. Abrir DevTools (F12)
2. Console para erros
3. Network tab para ver requests
4. Testar cada feature

## 📚 Convenções

| Aspecto | Convenção |
|---------|-----------|
| Nomes variáveis | camelCase |
| Nomes funções | camelCase |
| Nomes classes | PascalCase |
| Nomes constantes | UPPER_SNAKE_CASE |
| IDs HTML | camelCase (ex: `taskTitleInput`) |
| Data attributes | kebab-case (ex: `data-task-edit`) |
| Arquivos | kebab-case (ex: `daily-words.js`) |

## 🎨 Guia Visual

### Cores Neon
- Verde: `rgba(0, 255, 136, ...)`
- Verde escuro: `#1f4a2c`
- Fundo: `rgba(8, 12, 10, 0.94)`
- Status: Ok=verde, Erro=vermelho, Pendente=amarelo/azul

### Componentes Reutilizáveis
- `.modal` - Modais (sessões, dicionário)
- `.card` - Cards (tasks, flashcards)
- `.button` - Botões (.primary, .secondary)
- `.field` - Form fields com labels

## 🚀 Deployment

```bash
# Build
docker compose build

# Start
docker compose up -d

# Logs
docker compose logs -f frontend backend
```

Verifica em `http://localhost:3000`

## 📞 Quando Chamar IA

Bom para:
- ✅ Gerar boilerplate (novo renderer, router)
- ✅ Refatorar código existente
- ✅ Explicar fluxos
- ✅ Debugar erros com stack trace

Ruim para:
- ❌ Design de features sem contexto
- ❌ Mudanças de database schema sem análise
- ❌ Segurança (sempre review humano)

## 📖 Documentação Adicional

- `ARCHITECTURE.md` - Visão geral e padrões
- `DATABASE_SCHEMA.md` - ERD e queries
- `README.md` - Setup e contribuição
- `CHANGELOG.md` - Histórico de mudanças

---

**Última atualização**: 12 de maio de 2026
**Versão**: 2.0 (Modularizada)
