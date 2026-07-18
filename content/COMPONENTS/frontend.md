# Frontend (React + Vite + Tailwind)

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| Vite | 7.3.1 | Build tool + dev server |
| Tailwind CSS | 4.2.1 | Utility-first CSS |
| react-router-dom | 7.13.1 | Client-side routing |
| axios | 1.16.0 | HTTP client |
| recharts | 3.8.1 | Charts (traffic, metrics) |
| @xyflow/react | 12.11.0 | Topology graph (React Flow) |
| @xterm/xterm | 5.5.0 | Terminal emulator (SSH + console) |
| lucide-react | 0.577.0 | Icons |
| jwt-decode | 4.0.0 | JWT payload reading |

## Routing

**File:** `frontend/src/App.jsx` (75 lines)

| Path | Page | Auth | Layout |
|---|---|---|---|
| `/` | `Home.jsx` | Public | None |
| `/login` | `Login.jsx` | Public (redirects if authed) | None |
| `/setup` | `SetupWizard.jsx` | Protected | None (sidebar hidden) |
| `/dashboard` | `Dashboard.jsx` | Protected | RootLayout |
| `/topology` | `TopologyMap.jsx` | Protected | RootLayout |
| `/ai-chat` | `AiChat.jsx` | Protected | RootLayout |
| `/staging` | `StagingGate.jsx` | Protected | RootLayout |
| `/network-devices` | `NetworkDevices.jsx` | Protected | RootLayout |
| `/audit-logs` | `AuditLogs.jsx` | Protected | RootLayout |
| `/users` | `RBACUsers.jsx` | Protected | RootLayout |
| `/profile` | `Profile.jsx` | Protected | RootLayout |
| `/settings` | `Settings.jsx` | Protected | RootLayout |
| `/playbooks` | `PlaybookManagement.jsx` | Protected | RootLayout |
| `/drift-reports` | `DriftReports.jsx` | Protected | RootLayout |
| `/drift-reports/:hostname` | `DriftReportDetail.jsx` | Protected | RootLayout |
| `/console` | `Console.jsx` | Protected | RootLayout |

Protected routes use `ProtectedRoute.jsx` — redirects to `/login` if no JWT token.
Public routes use `PublicRoute.jsx` — redirects authed users to `/dashboard`.

## Pages (17)

| Page file | State count | Key functionality |
|---|---|---|
| `Home.jsx` | Minimal | Landing page |
| `Login.jsx` | 2-3 | Login form, token storage |
| `Dashboard.jsx` | ~15 | Stat cards, charts, syslog, drift, network table, polling intervals |
| `AiChat.jsx` | ~8 | Chat UI, session sidebar, playbook suggestions |
| `TopologyMap.jsx` | ~5 | React Flow graph, search, detail panel |
| `NetworkDevices.jsx` | ~6 | Device table, add/edit modals |
| `PlaybookManagement.jsx` | ~6 | Playbook table, CRUD, run, delete |
| `DriftReports.jsx` | 3 | Drift report list with DiffViewer previews |
| `DriftReportDetail.jsx` | 4 | Full diff page with copy |
| `AuditLogs.jsx` | ~5 | Audit log table with detail modal |
| `RBACUsers.jsx` | ~5 | User table, add/edit, permission modal |
| `Profile.jsx` | ~4 | User profile view/edit |
| `Settings.jsx` | ~4 | App settings |
| `SetupWizard.jsx` | ~8 | 5-step onboarding form |
| `StagingGate.jsx` | ~4 | Destructive playbook approval |
| `Console.jsx` | ~4 | xterm.js container terminal |
| `Console.jsx` | ~4 | xterm.js WebSocket terminal |

## Components (30+)

| Component | Used by | Purpose |
|---|---|---|
| `Navbar.jsx` | RootLayout | Top navigation bar |
| `Sidebar.jsx` | RootLayout | Main sidebar navigation |
| `StatCard.jsx` | Dashboard, PlaybookMgmt | Metric display card |
| `DiffViewer.jsx` | Dashboard, DriftReports | Git-style unified diff renderer |
| `NetworkTrafficChart.jsx` | Dashboard | Recharts traffic chart |
| `PlaybookModal.jsx` | PlaybookManagement | Add/edit playbook form |
| `PlaybookSuggestions.jsx` | AiChat | AI-suggested playbook cards |
| `PlaybookStagingGate.jsx` | StagingGate | Destructive playbook staging |
| `SessionSidebar.jsx` | AiChat | Chat session list |
| `RefreshFactsModal.jsx` | NetworkDevices | SSE progress overlay (needs backend) |
| `TerminalDeviceModal.jsx` | NetworkDevices | xterm.js SSH terminal |
| `TerminalConfigCard.jsx` | Settings | Terminal theme/settings |
| `DeviceCard.jsx` | NetworkDevices | Device display card |
| `AddDeviceModal.jsx` | NetworkDevices | Add device form |
| `EditDeviceModal.jsx` | NetworkDevices | Edit device form |
| `TopoPanel.jsx` | TopologyMap | Device detail panel |
| `TopoStat.jsx` | TopologyMap | Topology statistic |
| `SeverityBadge.jsx` | Dashboard | Severity level badge |
| `ErrorBoundary.jsx` | App.jsx | React error boundary |
| `PageHeader.jsx` | Multiple | Reusable page header |
| `ExportLogsModal.jsx` | AuditLogs | Log export |
| `AuditLogDetailModal.jsx` | AuditLogs | Full audit log detail |
| `AddUserModal.jsx` | RBACUsers | Add user form |
| `PermissionModal.jsx` | RBACUsers | Permission editor |
| `ApiKeyModal.jsx` | Settings/AiChat | HuggingFace API key entry |
| `ConfigField.jsx` | Settings | Config field component |
| `ConfigSection.jsx` | Settings | Config section component |
| `SettingRow.jsx` | Settings | Settings row |
| `Toggle.jsx` | Settings | Toggle switch |
| `Cursor.jsx` | Multiple | Cursor indicator |
| `LegendDot.jsx` | Multiple | Legend dot |
| `LegendIcon.jsx` | Multiple | Legend icon |
| `UsageBar.jsx` | Multiple | Usage bar |
| `ExpandableOutput.jsx` | Multiple | Collapsible output |
| `PlaybookModificationCard.jsx` | AiChat | AI playbook modification UI |

## Services (11)

| Service file | Base path | Key functions |
|---|---|---|
| `api.js` | (configurable) | Centralized axios instance, Bearer token |
| `authService.js` | — | Login, logout, token management |
| `adminService.js` | — | Admin API |
| `userService.js` | — | User CRUD |
| `networkService.js` | `/api/network` | Devices, traffic, terminal, WebSocket URLs |
| `inventoryService.js` | `/playbooks` | Dashboard, CRUD, execute, status |
| `auditService.js` | — | Audit logs |
| `llmService.js` | `/llm` | Chat, API key |
| `sessionService.js` | `/llm/sessions` | Session CRUD |
| `topologyService.js` | `/api/topology` | Graph data |
| `profileService.js` | — | Profile |
| `setupService.js` | `/setup` | Wizard status/preview/apply |

## Utilities

| File | Purpose |
|---|---|
| `utils/diffParser.js` | Unified diff parser (DiffLine, DiffHunk, ParsedDiff) |
| `utils/playbookOutput.js` | Ansible output syntax coloring |
| `hooks/useCopyToClipboard.js` | Clipboard copy hook |
| `hooks/useTerminalConfig.js` | Terminal settings (localStorage) |
| `config/terminalThemes.js` | 6 terminal color schemes, 12 flavors |

## Config files

| File | Lines | Role |
|---|---|---|
| `frontend/vite.config.js` | 7 | Vite plugins: react + tailwindcss |
| `frontend/eslint.config.js` | — | Eslint flat config |
| `frontend/nginx.conf` | 24 | Production nginx config (SPA fallback, security headers) |
| `frontend/Dockerfile.prod` | 12 | Multi-stage build: node build → nginx serve |
| `frontend/tailwind.config.js` | — | Tailwind customization |
| `frontend/.prettierrc` | — | Prettier config |

## Production build

**Dockerfile.prod:**
1. `:1-6` — Stage 1: `node:20-alpine`, `npm ci`, `npm run build`
2. `:8-12` — Stage 2: `nginx:alpine`, copy `dist/`, `nginx.conf`, expose 80

**nginx.conf** key points:
- `:16` — `try_files $uri $uri/ /index.html` (SPA fallback)
- `:14` — CSP allowing `connect-src 'self' http://localhost:8000`
