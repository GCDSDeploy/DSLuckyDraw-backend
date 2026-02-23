# Local MySQL setup (app user only)

Zero-risk setup: dedicated database user only. No root changes, no auth plugin or config edits.

---

## STEP 1 — Verify MySQL is running

Confirm MySQL is listening on port 3306 (do **not** change any service config):

```bash
# macOS / Linux
lsof -i :3306
# or
nc -zv localhost 3306
```

If nothing is listening, start MySQL using your system’s normal method (e.g. `brew services start mysql`).

---

## STEP 2 — Create isolated database user

Run these commands **manually** in MySQL (e.g. `mysql -u root -p` then paste). This does **not** affect the root user.

```sql
CREATE DATABASE IF NOT EXISTS luckydraw;

CREATE USER IF NOT EXISTS 'luckydraw_user'@'localhost'
IDENTIFIED BY '123456';

GRANT ALL PRIVILEGES ON luckydraw.*
TO 'luckydraw_user'@'localhost';

FLUSH PRIVILEGES;
```

---

## STEP 3 — Backend `.env`

The repo’s `backend/.env` is already set to use the app user:

- `DB_USER=luckydraw_user`
- `DB_PASSWORD=123456`
- `DB_NAME=luckydraw`

Do **not** change any other backend code.

---

## STEP 4 — Test connection

```bash
cd backend
npm run db:test
```

Expect: `✅ Database connection successful`.

---

## STEP 5 — Initialize database

```bash
npm run step1:init
```

---

## STEP 6 — Start backend

```bash
npm run start
```

---

## Validation

1. No `ER_ACCESS_DENIED_ERROR` in the backend console.
2. `POST http://localhost:3000/api/draw` returns JSON (sign or `OUT_OF_STOCK`).
3. Frontend at `http://localhost:5173/draw/shake` no longer shows the error popup.

---

## Rollback (if needed)

To remove the app user and database only:

```sql
DROP USER IF EXISTS 'luckydraw_user'@'localhost';
DROP DATABASE IF EXISTS luckydraw;
```

This restores the system to its previous state; root is untouched.

---

## Important

Do **not**:

- Change root password
- Modify MySQL authentication plugin
- Edit global MySQL config files
- Refactor backend logic

Only the database access layer (dedicated user + `.env`) is used.
