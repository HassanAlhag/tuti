# Environment Configuration

This project supports local development defaults and production-safe environment validation.

## Required Variables

### Backend

- `NODE_ENV`: `development` or `production`
- `PORT`: API port (default: `5055`)
- `JWT_SECRET`: required in production
- `JWT_REFRESH_SECRET`: required in production
- `MONGO_URI`: Mongo connection string (optional for local seed/in-memory mode)

### CORS Origins

Set one of:

- `CORS_ORIGINS` (comma-separated), or
- `CLIENT_ORIGINS` (backward-compatible alias)

Optional single-origin aliases:

- `CORS_ORIGIN`
- `CLIENT_ORIGIN`

In development, localhost origins are allowed automatically:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`

In production, origin allowlist must be explicitly configured.

### Uploads

- `UPLOAD_DIR` (optional): absolute or relative path for uploaded images.
  - If omitted, backend uses `backend/uploads`.

## Local Development Example

```env
NODE_ENV=development
PORT=5055
JWT_SECRET=replace-with-local-secret
JWT_REFRESH_SECRET=replace-with-local-refresh-secret
MONGO_URI=
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
VITE_API_URL=http://localhost:5055/api
```

## Production Checklist

1. Set `NODE_ENV=production`.
2. Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`.
3. Set `CORS_ORIGINS` to real frontend domains only.
4. Set `MONGO_URI` for production database.
5. Set `PORT` from hosting environment.
6. Optionally set `UPLOAD_DIR` for persistent storage.
7. Ensure frontend `VITE_API_URL` points to production API URL.

## Notes

- If `MONGO_URI` is empty, backend runs with seed/in-memory mode.
- API clients use `VITE_API_URL` when set.
- In development only, API base falls back to `http://localhost:5055/api`.
