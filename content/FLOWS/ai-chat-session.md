# AI Chat Session Flow

## Diagram

```
User types message ──▶ AiChat.jsx
    │
    ├── POST /llm/chat ──▶ llm_routes.py:180-395
    │   {prompt, model, session_id}
    │       │
    │       ├── 1. Find playbook suggestions
    │       │   catalog_service.find_playbook_suggestions():181-207
    │       │   Scores catalog entries against prompt
    │       │   Returns top 3 matches
    │       │
    │       ├── 2. Build system prompt
    │       │   SYSTEM_PROMPT_BASE (:28-46)
    │       │   + PLAYBOOK_SUGGESTION_INSTRUCTION (:49-91)
    │       │   + matched playbook details (:213-221)
    │       │
    │       ├── 3. Load session memory
    │       │   Load last 10 messages from conversations collection
    │       │   (MAX_HISTORY_MESSAGES = 10, :26)
    │       │
    │       ├── 4. Call HuggingFace Router API
    │       │   POST https://router.huggingface.co/v1/chat/completions
    │       │   Model: deepseek-ai/DeepSeek-R1:novita (default)
    │       │   Retry: up to 3 attempts on 429/5xx (:275-303)
    │       │   Timeout: 120s (:273)
    │       │
    │       └── 5. Persist conversation
    │           Save user + assistant messages to MongoDB (:346-356)
    │           Return {text, reasoning, model, session_id, suggestions}
    │
    └── Render response
        ├── AI text in chat bubble
        ├── PlaybookSuggestions cards (if any)
        ├── "Run" button → POST /playbooks/execute
        └── "Modify" button → POST /playbooks/modify/propose
```

## Step-by-step

### 1. User sends message

**File:** `frontend/src/pages/AiChat.jsx`

- User types a natural language intent (e.g., "Configure OSPF on edge routers")
- Sends `POST /llm/chat` with `{prompt, model, session_id}`

### 2. Backend processes

**File:** `watchman/app/routes/llm_routes.py:180-395`

**API key resolution** (`:188-189`):
- First checks MongoDB `api_keys` collection for stored key
- Falls back to `HUGGINGFACE_API_KEY` env var
- Returns 500 if neither is set

**Playbook suggestions** (`:206`):
- Calls `catalog_service.find_playbook_suggestions(prompt, top_k=3)`
- Scores each catalog entry against the prompt using `score_playbook_match()` (`catalog_service.py:133-154`):
  - Filename match: +5
  - Name match: +4
  - Intent match: +3
  - Tag match: +2
  - Max score capped at 10
- Returns top 3 suggestions sorted by score descending
- Checks `modification_potential` for scope mismatch (`catalog_service.py:157-178`)

**System prompt construction** (`:209-221`):
- Base instructions (`:28-46`): concise, plain text, Cisco IOS
- Suggestion instructions (`:49-91`): 3-step priority (perfect match → scope mismatch → no match)
- Injects suggested playbook details (`:213-221`)

**Session memory** (`:224-256`):
- If `session_id` is provided: loads existing conversation from `conversations` collection
- If not: auto-creates a new conversation with the prompt as title (`:237-246`)
- Trims to last 10 message exchanges (`MAX_HISTORY_MESSAGES = 10` at `:26`)
- Builds messages array: `[system_prompt, ...history, user_message]`

**HuggingFace API call** (`:272-380`):
- POST to `https://router.huggingface.co/v1/chat/completions` (`:22`)
- Supports 4 models defined in `SUPPORTED_MODELS` (`:99-104`):
  - `deepseek-ai/DeepSeek-R1:novita` (default)
  - `google/gemma-4-31B-it:novita`
  - `Qwen/Qwen3.5-4B:featherless-ai`
  - `meta-llama/Llama-3.1-8B-Instruct:novita`
- Retry logic (`:275-303`): up to 3 retries on 429, 500, 502, 503, 504
- Exponential backoff with `Retry-After` header support
- 120-second timeout (`:273`)

**Response persistence** (`:346-356`):
- Saves user message and assistant response to MongoDB `conversations` collection
- Includes playbook suggestions and reasoning (thinking phase) in the stored message

**Response format** (`:358-364`):
```json
{
  "text": "I found NTP_edge.yml...",
  "reasoning": "Step 1 check: ...",
  "model": "deepseek-ai/DeepSeek-R1:novita",
  "session_id": "abc123...",
  "playbook_suggestions": [...]
}
```

### 3. Frontend renders

**File:** `frontend/src/pages/AiChat.jsx`

- Shows AI response text in chat bubble
- If `playbook_suggestions` present, renders `<PlaybookSuggestions>` component (`components/PlaybookSuggestions.jsx`)
- Each suggestion card shows:
  - Playbook name, description, preview, tags
  - Match reason and score
  - "Run" button → calls `POST /playbooks/execute`
  - "Modify" button (if `modification_potential`) → calls `POST /playbooks/modify/propose`

### 4. Session management

**File:** `llm_routes.py:402-507`

| Endpoint | Method | Purpose |
|---|---|---|
| `/llm/sessions` | GET | List all sessions (title, created, message count) |
| `/llm/sessions/{id}` | GET | Get full conversation messages |
| `/llm/sessions` | POST | Create new empty session |
| `/llm/sessions/{id}` | PUT | Update session title |
| `/llm/sessions/{id}` | DELETE | Delete session |

### 5. API key management

**File:** `llm_routes.py:514-631`

| Endpoint | Method | Purpose |
|---|---|---|
| `/llm/api-key-status` | GET | Check if API key is configured |
| `/llm/api-key` | POST | Save key to MongoDB `api_keys` + `.env` |
| `/llm/api-key` | DELETE | Remove stored key |
| `/llm/api-key-test` | POST | Test key validity with a minimal API call |

## Failure modes

| What breaks | Symptom | Root cause |
|---|---|---|
| No API key configured | 500 "API key not configured" | Neither env var nor MongoDB stored key |
| HF Router overloaded | 503 "temporarily overloaded" | Model is busy; retry later or switch model |
| 120s timeout | 502 "No response from HF" | Model too slow or network issue |
| Session not found | 404 "Session {id} not found" | Invalid/expired session_id |
| API key invalid | 401 from `/llm/api-key-test` | Key expired; regenerate at HuggingFace |

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/llm_routes.py` | 1-631 | Chat, sessions, API key management |
| `watchman/app/services/catalog_service.py` | 133-207 | Playbook suggestion engine |
| `watchman/app/database.py` | 26-27 | Conversations + api_keys collections |
| `frontend/src/pages/AiChat.jsx` | — | Chat UI with session sidebar |
| `frontend/src/components/PlaybookSuggestions.jsx` | 1-59 | Suggestion cards with Run/Modify |
| `frontend/src/components/SessionSidebar.jsx` | — | Session list with delete |
| `frontend/src/services/llmService.js` | — | API call wrapper |
| `frontend/src/services/sessionService.js` | — | Session CRUD wrapper |
