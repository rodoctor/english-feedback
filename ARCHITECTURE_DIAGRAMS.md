# Architecture Diagrams

## 1. Frontend Module Dependencies

```mermaid
graph TD
    A[index.html] -->|loads| B[Utils]
    A -->|loads| C[State]
    A -->|loads| D[API]
    B --> E[Renderers]
    C --> E
    D --> E
    E -->|uses| F[tasks.js]
    E -->|uses| G[flashcards.js]
    E -->|uses| H[report.js]
    E -->|uses| I[daily-words.js]
    E --> J[app.js]
    B --> J
    C --> J
    D --> J
```

## 2. Data Flow Architecture

```mermaid
graph LR
    User["👤 User<br/>Interaction<br/>(click, input)"]
    
    Events["🎯 Event<br/>Listeners<br/>(app.js)"]
    
    Handlers["⚙️ Handlers<br/>(submit, validate)"]
    
    API_Call["🌐 API Call<br/>(modules/api.js)"]
    
    Backend["🚀 Backend<br/>(FastAPI)"]
    
    State_Update["💾 State Update<br/>(modules/state.js)"]
    
    Renderers["🎨 Renderers<br/>(render HTML)"]
    
    DOM["📱 DOM<br/>Updated"]
    
    User -->|triggers| Events
    Events -->|calls| Handlers
    Handlers -->|calls| API_Call
    API_Call -->|POST/GET| Backend
    Backend -->|JSON| State_Update
    State_Update -->|notify| Renderers
    Renderers -->|update| DOM
    DOM -->|user sees| User
```

## 3. Module Responsibilities

```mermaid
graph TB
    subgraph Core["Core Modules"]
        State["State<br/>- Central store<br/>- Reactive updates<br/>- Subscriptions"]
        API["API<br/>- HTTP client<br/>- Endpoint wrapper<br/>- Error handling"]
        Utils["Utils<br/>- DOM helpers<br/>- Formatters<br/>- UI components"]
    end
    
    subgraph Renderers["Feature Renderers"]
        Tasks["Tasks<br/>- Validation<br/>- Rendering<br/>- Event binding"]
        Flashcards["Flashcards<br/>- Grid render<br/>- Flip logic<br/>- Delete handler"]
        Report["Report<br/>- Calendar<br/>- Charts<br/>- Analytics"]
        DailyWords["Daily Words<br/>- Input state<br/>- Submit logic<br/>- Dictionary"]
    end
    
    subgraph Orchestration["Orchestration"]
        App["app.js<br/>- Init listeners<br/>- Coordinate modules<br/>- Handle flow"]
    end
    
    Core --> Renderers
    Renderers --> Orchestration
```

## 4. Backend API Routes

```mermaid
graph TB
    subgraph Tasks_Mgmt["Task Management"]
        T1["POST /tasks<br/>Create task"]
        T2["GET /tasks<br/>List tasks"]
        T3["PUT /tasks/:id<br/>Update task"]
        T4["DELETE /tasks/:id<br/>Delete task"]
    end
    
    subgraph Training["Training & Analysis"]
        TR1["POST /analyze<br/>Submit text/audio"]
        TR2["GET /report<br/>Monthly analytics"]
        TR3["GET /report/sessions<br/>Day details"]
    end
    
    subgraph DW["Daily Words"]
        DW1["POST /daily-words/today/open<br/>Load today words"]
        DW2["POST /daily-words/today/submit<br/>Evaluate words"]
        DW3["GET /daily-words/dictionary<br/>User dictionary"]
    end
    
    subgraph Flashcard["Flashcard Management"]
        FC1["GET /flashcards<br/>List cards"]
        FC2["DELETE /flashcards/:id<br/>Delete card"]
    end
    
    subgraph Config_Backup["Config & Backup"]
        CB1["GET /config<br/>User config"]
        CB2["PUT /config<br/>Update config"]
        CB3["GET/POST /backup/*<br/>Backup operations"]
        CB4["POST /reset<br/>Reset all data"]
    end
```

## 5. State Management Flow

```mermaid
graph LR
    A["User Action<br/>click button"] -->|triggers| B["Event Handler<br/>async function"]
    B -->|calls| C["API Module<br/>API.getX()"]
    C -->|HTTP request| D["Backend<br/>FastAPI"]
    D -->|JSON response| E["State Update<br/>State.set/update"]
    E -->|notify| F["Subscribers<br/>Renderers"]
    F -->|read| G["State.data"]
    G -->|generate HTML| H["DOM Update"]
    H -->|display| I["User Sees<br/>New state"]
```

## 6. Daily Words Feature Flow

```mermaid
graph TD
    A["Tab: Daily Words"] -->|openDailyWordsTab| B["API.getDailyWordsToday()"]
    B -->|/daily-words/today/open| C["Backend generates<br/>10 random words"]
    C -->|return payload| D["renderDailyWords()"]
    D -->|parse entries| E["Render 10 cards<br/>with input fields"]
    E -->|user fills| F["setInputState()<br/>on each input"]
    F -->|red/green borders| G["Visual feedback"]
    G -->|click Submit| H["submitDailyWords()"]
    H -->|API.submitDailyWords| I["Backend evaluates<br/>with IA"]
    I -->|return feedback| J["renderDailyWords<br/>updated"]
    J -->|Switch to Dictionary| K["openDictionaryTab()"]
    K -->|renderDictionary| L["Show alphabetical<br/>word list"]
```

## 7. Frontend File Organization

```
frontend/
│
├── index.html                    # 📄 Markup
│   └── Script loading order crucial
│
├── styles.css                    # 🎨 All CSS
│   ├── Dark neon theme
│   └── Responsive grid
│
├── app.js                        # 🎯 Orchestrator
│   ├── initEventListeners()
│   ├── refreshData()
│   ├── switchTab()
│   └── ~20 async handlers
│
└── modules/                      # 📦 Modular Core
    │
    ├── state.js                  # 💾 State
    │   ├── .data (read-only)
    │   ├── .get/set/update()
    │   ├── .subscribe()
    │   └── ~80 lines
    │
    ├── api.js                    # 🌐 HTTP
    │   ├── getTasks()
    │   ├── submitTraining()
    │   ├── getReport()
    │   └── ~60 lines
    │
    ├── utils.js                  # 🛠️ Helpers
    │   ├── DOM: el, elOrNull
    │   ├── Format: escapeHtml, renderMarkdown
    │   ├── UI: showToast, setStatus
    │   └── ~150 lines
    │
    └── renderers/                # 🎨 Features
        │
        ├── tasks.js              # 📋 Tasks & Practice
        │   ├── validateTaskForm()
        │   ├── render()
        │   └── ~120 lines
        │
        ├── flashcards.js         # 🎴 Flashcards
        │   ├── render()
        │   ├── refreshFilters()
        │   └── ~70 lines
        │
        ├── report.js             # 📊 Analytics
        │   ├── render()
        │   ├── renderPlotly()
        │   ├── openDaySessionsModal()
        │   └── ~250 lines
        │
        └── daily-words.js        # 📚 Daily Words
            ├── renderDailyWords()
            ├── renderDictionary()
            ├── submitDailyWords()
            └── ~280 lines
```

## 8. Backend Architecture

```mermaid
graph TB
    subgraph API_Layer["FastAPI Layer"]
        Main["main.py<br/>Create app<br/>Register routers"]
    end
    
    subgraph Routers["API Routers"]
        R1["tasks.py"]
        R2["training.py"]
        R3["flashcards.py"]
        R4["report.py"]
        R5["daily_words.py"]
        R6["config.py"]
    end
    
    subgraph Services["Business Logic"]
        AI["ai/<br/>- base.py<br/>- openai_service.py<br/>- claude_service.py<br/>- factory.py<br/>- prompts.py"]
        Audio["audio.py"]
        CRUD["crud.py"]
    end
    
    subgraph ORM["ORM Layer"]
        Models["models.py<br/>- User<br/>- Task<br/>- TrainingSession<br/>- Flashcard<br/>- DailyWordSet/Entry"]
        Schemas["schemas.py<br/>Pydantic models"]
    end
    
    subgraph DB["Database"]
        PG["PostgreSQL<br/>Tables + Indexes"]
    end
    
    Main --> Routers
    Routers --> Services
    Routers --> ORM
    Services --> ORM
    ORM --> Models
    ORM --> Schemas
    Models --> DB
```

## 9. Database Schema Graph

```mermaid
graph LR
    U["USERS<br/>---<br/>id PK<br/>email"]
    
    T["TASKS<br/>---<br/>id PK<br/>user_id FK<br/>title<br/>description"]
    
    TS["TRAINING<br/>SESSIONS<br/>---<br/>id PK<br/>user_id FK<br/>task_id FK<br/>content<br/>feedback"]
    
    FC["FLASHCARDS<br/>---<br/>id PK<br/>user_id FK<br/>task_id FK<br/>front/back"]
    
    DWS["DAILY WORD<br/>SETS<br/>---<br/>id PK<br/>user_id FK<br/>date<br/>submitted"]
    
    DWE["DAILY WORD<br/>ENTRIES<br/>---<br/>id PK<br/>set_id FK<br/>word<br/>meaning<br/>user_sentence<br/>feedback"]
    
    UC["USER<br/>CONFIG<br/>---<br/>id PK<br/>user_id FK<br/>provider<br/>api_key"]
    
    U --> T
    U --> TS
    U --> FC
    U --> DWS
    U --> UC
    T --> TS
    T --> FC
    DWS --> DWE
```

## 10. Component Interaction Map

```mermaid
graph TB
    subgraph User_Facing["User-Facing Components"]
        Form["Form Fields<br/>(input, textarea)"]
        Buttons["Buttons<br/>(submit, edit, delete)"]
        Display["Display Areas<br/>(grids, cards, modals)"]
    end
    
    subgraph Event_System["Event System"]
        Click["Click Events"]
        Input["Input Events"]
        Submit["Submit Events"]
    end
    
    subgraph State_System["State Management"]
        StateObj["State Object<br/>(Central Store)"]
        Subscribers["Subscribers<br/>(Renderers)"]
    end
    
    subgraph Render_System["Rendering System"]
        Renderers["Renderers<br/>(Each feature)"]
        Generators["HTML Generators"]
        DOM_API["DOM API"]
    end
    
    User_Facing -->|trigger| Event_System
    Event_System -->|update| State_System
    StateObj -->|notify| Subscribers
    Subscribers -->|generate| Render_System
    Renderers -->|call| Generators
    Generators -->|modify| DOM_API
    DOM_API -->|display| User_Facing
```

---

**Visualizações criadas para facilitar compreensão da arquitetura! 📊**
