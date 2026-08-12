# Authentication Flow

## Diagram

```
Login page ──POST /login──▶ auth_routes.py:7-10
  (username, password)        │
                              ▼
                        auth_service.authenticate_user():10-35
                              │
                      ┌───────┴───────┐
                      ▼               ▼
                        MongoDB users   password verify
                        collection      (bcrypt)
                        find_one()      security.py:16-17
                      │               │
                      └───────┬───────┘
                              │ both match?
                              ▼
                        security.create_access_token():20-40
                        JWT with HS256
                        payload: {sub: username, role, exp}
                        expires: 120 min (config.py:41)
                              │
                              ▼
                        Response: {access_token, token_type: "bearer"}
                              │
                              ▼
                        Frontend stores token in localStorage
                        Sends as: Authorization: Bearer <token>
                              │
                              ▼
                        Protected routes via get_current_user()
                        dependencies.py:10-28
                        Decodes JWT, looks up user in MongoDB
```

## Step-by-step

### 1. User submits credentials

**File:** `frontend/src/pages/Login.jsx`

- User enters username + password
- Calls `POST /login` via `authService.js`

### 2. Backend validates

**File:** `watchman/app/routes/auth_routes.py:7-10`

```python
@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    return await authenticate_user(credentials.username, credentials.password)
```

Delegates to `auth_service.py:10-35`:
- `:12` — Looks up user in MongoDB `users` collection by `{username}`
- `:14` — Verifies password against bcrypt hash using `verify_password()` (`security.py:16-17`)
- `:14-19` — If either user not found or password doesn't match: returns 401 "Invalid credentials"
- `:21-25` — On success: creates JWT via `create_access_token(data={"sub": username, "role": role})` (`security.py:20-40`)

### 3. JWT creation

**File:** `watchman/app/core/security.py:20-40`

```python
def create_access_token(data: dict, expires_delta=None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=120))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt
```

Token contains:
- `sub` — username
- `role` — user role (e.g., "Super Admin", "Admin", "Viewer")
- `exp` — expiration timestamp (default: 120 minutes from now, configurable at `config.py:41`)

### 4. Frontend stores token

**File:** `frontend/src/services/authService.js`

- On successful login: stores `access_token` in `localStorage`
- Sends token on every request via the centralized axios instance (`services/api.js`):
  - Reads token from `localStorage`
  - Sets `Authorization: Bearer <token>` header on every request

### 5. Protected route guard

**File:** `frontend/src/routes/ProtectedRoute.jsx`

- Wraps all authenticated pages (see `App.jsx:48-53`)
- If no token in `localStorage`: redirects to `/login`
- If token exists: renders the protected component

### 6. Backend validates token on each request

**File:** `watchman/app/core/dependencies.py:10-28`

```python
async def get_current_user(token: str = Depends(oauth2_scheme)):
    # 1. Decode JWT with SECRET_KEY + HS256
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    username: str = payload.get("sub")

    # 2. Look up user in MongoDB
    user = await users_collection.find_one({"username": username})

    # 3. Return user dict or raise 401
    return user
```

Used as FastAPI dependency in all protected endpoints:
```python
async def some_endpoint(current_user: dict = Depends(get_current_user)):
```

### 7. RBAC: Super Admin check

**File:** `dependencies.py:30-36`

```python
def require_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Super Admin":
        raise HTTPException(status_code=403, detail="Access denied.")
    return current_user
```

Applied to sensitive endpoints like user management.

### 8. User creation

**File:** `watchman/app/routes/user_routes.py` and `watchman/scripts/create_admin.py`

- Manual admin creation via script: `python watchman/scripts/create_admin.py`
- Setup wizard creates initial Super Admin via `POST /setup/init-user` (`setup_routes.py:138-153`)
- User management via `POST /api/users` (admin only)
- Passwords hashed with bcrypt (`security.py:12-13`)

## Failure modes

| What breaks | Symptom | Root cause |
|---|---|---|
| Wrong credentials | 401 "Invalid credentials" | Username/password mismatch |
| Token expired | 401 "Could not validate credentials" | 120-min expiry with no refresh mechanism |
| No SECRET_KEY set | JWT decode failure | Missing env var |
| User deleted from DB | 401 even with valid token | `dependencies.py:24-26` checks MongoDB |
| CORS issue | Login works in curl but not browser | Missing origin in `BACKEND_CORS_ORIGINS` (`config.py:46-50`) |

## Known gaps

- **No token refresh mechanism**: After 120 minutes, the user must log in again. No silent refresh or refresh token.
- **No frontend 401 interceptor**: If a token expires mid-session, API calls will fail silently (console error) rather than redirecting to login.
- **Passwords stored in `.env`**: MongoDB credentials (`Admin123`) are hardcoded in `.env` files — not production-safe.

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/auth_routes.py` | 1-10 | Login endpoint |
| `watchman/app/services/auth_service.py` | 1-35 | Authentication logic |
| `watchman/app/core/security.py` | 1-41 | JWT create/verify, password hashing |
| `watchman/app/core/dependencies.py` | 1-36 | `get_current_user` + `require_super_admin` |
| `watchman/app/core/config.py` | 39-41 | JWT settings (algorithm, expiry) |
| `watchman/app/models/user.py` | 1-39 | User schemas |
| `watchman/scripts/create_admin.py` | — | CLI admin user creator |
| `frontend/src/routes/ProtectedRoute.jsx` | — | Auth guard component |
| `frontend/src/routes/PublicRoute.jsx` | — | Redirects authed users away from login |
| `frontend/src/services/authService.js` | — | Login/logout API calls |
| `frontend/src/services/api.js` | — | Axios instance with Bearer token |
