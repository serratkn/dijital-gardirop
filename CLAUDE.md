# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Dijital Gardırop" — a digital wardrobe / outfit-suggestion app. **All user-facing copy, code comments, and commit messages are in Turkish.** Route paths use Turkish slugs (`/gardirop`, `/kombin-oner`, `/profil/hesap-bilgilerim`). Keep writing in Turkish to stay consistent.

Commits follow conventional-commit prefixes with Turkish descriptions, e.g. `feat(profil): profil sayfası ve hesap yönetimi ekranı eklendi`.

## Repo layout

Three independent pieces at the root; there is **no monorepo tooling** — each is run separately from its own directory.

| Path | What it is |
|---|---|
| `frontend/` | Vite + React 19 SPA (Tailwind v4, react-router, lucide-react, Capacitor for Android) |
| `backend/` | Express + `pg` REST API, layered architecture |
| `docker-compose.yml` | PostgreSQL 16 for local dev |

The root `package.json` holds only stray Capacitor deps and no scripts — ignore it; the real Capacitor config lives in `frontend/capacitor.config.json`.

## Commands

```bash
# Database (from repo root)
docker compose up -d                 # start postgres 16 on :5432
docker compose down                  # stop (keeps the postgres_data volume)

# Apply a migration — there is NO migration runner, do it by hand.
# Copy the file INTO the container first: piping SQL through a Windows shell
# corrupts Turkish characters (it silently turned 'Üst' into '??st' once).
docker cp backend/src/db/migrations/001_initial_schema.sql dijitalgardirop-db-1:/tmp/m.sql
docker exec dijitalgardirop-db-1 psql -U postgres -d dijital_gardirop \
  -v ON_ERROR_STOP=1 -f /tmp/m.sql

# Backend (from backend/)
cp .env.example .env                 # required; nothing runs without it
npm install
npm run dev                          # node --watch server.js, :3001
npm start

# Frontend (from frontend/)
npm install
npm run dev                          # vite dev server
npm run lint                         # oxlint — the only automated check in the repo
npm run build
```

**There is no test framework anywhere.** Verification means `npm run lint` for the frontend plus exercising the app/API by hand (browser, `curl`, or a throwaway Node `fetch` script). Don't invent test commands.

**Turkish characters and the Windows shell.** Git Bash mangles UTF-8 on the way through it, in both directions:

- `curl -d '{"name":"Gömlek"}'` sends a corrupted byte — the row lands broken in the database.
- Piping `.sql` into `psql` corrupts seed data the same way (this is how `Üst` became `??st` in `categories`).
- Console *output* is also unreliable, so a mangled `ö` on screen is not proof of a bug.

When encoding matters, bypass the shell: drive the API from a Node `fetch` script, and `docker cp` migrations into the container instead of piping them. To tell a display glitch from real corruption, compare bytes:
`SELECT encode(name::bytea,'hex') FROM categories;` — correct UTF-8 `Ü` is `c39c`, whereas `3f3f` means two literal `?` were stored.

## Backend architecture

Strict layering, class-based, constructor dependency injection:

```
routes/ → controllers/ → services/ → repositories/ → config/database.js (pg Pool)
```

Every controller extends `BaseController`, which owns the single `handleError` that maps a thrown `AppError` subclass to its `statusCode` and everything else to `500`. Subclass constructors must call `super()` before touching `this`.

**The route file is the DI container.** It is the only place that instantiates anything — see `src/routes/clothingItemRoutes.js`:

```js
const repository = new ClothingItemRepository(pool)
const service = new ClothingItemService(repository)
const controller = new ClothingItemController(service)
router.get('/clothing-items', (req, res) => controller.getAll(req, res))
```

Handlers must be wrapped in arrows (or bound) — passing `controller.getAll` directly loses `this`. Follow this same shape for every new resource; `Health*` and `ClothingItem*` are the two reference implementations.

Responsibilities per layer:
- **Repository** — SQL only, always parameterized. Logs and rethrows on error. Returns `null` (not a throw) when a row is missing. Multi-table writes (see `OutfitRepository.create`) take a client from the pool and wrap `BEGIN`/`COMMIT`/`ROLLBACK`, releasing in `finally`.
- **Service** — validation and business rules. Throws `ValidationError` / `NotFoundError` / `ConflictError` from `src/utils/errors.js`. Checks existence before update/delete so the controller gets a real 404. Also where Postgres error codes become meaningful HTTP results: `23505` (unique violation) → 409, `23503` (FK violation) → 400.
- **Controller** — thin HTTP adapter. Every method is `try/catch` around the service call, delegating to `this.handleError(error, res)`.

Existing resources: `health`, `categories` (read-only), `users`, `style-preferences`, `clothing-items`, `outfits`.

### Conventions that bite

- **Request bodies are camelCase, responses are snake_case.** Services/repositories destructure `userId`, `categoryId`, `imageUrl`, but responses come straight from `RETURNING *`, so clients receive `user_id`, `category_id`, `is_favorite`. There is no serialization layer. (`backend/test-data.json` is a scratch file with snake_case keys — it would fail validation as-is.)
- **Soft delete for `clothing_items` only.** Those rows are never removed; every read filters `is_deleted = false`. `users` and `outfits` are hard-deleted and rely on `ON DELETE CASCADE`. Outfit reads filter deleted items in the `JOIN` condition, so an outfit whose pieces were all deleted still returns with `items: []` rather than vanishing.
- **`users` never uses `RETURNING *`.** `UserRepository` selects an explicit column list because `RETURNING *` would leak `password_hash` into API responses. Keep that list intact when adding columns.
- **`style_preferences` is one row per user**, enforced by a `UNIQUE (user_id)` constraint added in `002`, which is what makes the single-statement `ON CONFLICT` upsert possible. `PUT /api/style-preferences` both creates and updates.
- **`config/database.js` registers a `pool.on('error')` handler.** Do not remove it — `pg` emits `'error'` on idle clients when Postgres restarts, and with no listener Node treats it as unhandled and kills the process.
- Backend reads discrete `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`. The `DATABASE_URL` line in the **root** `.env.example` is unused by the current code.

## Frontend architecture

### The frontend does not talk to the backend yet

Every screen renders mock data from `src/data/clothing.js` (`CLOTHES`, `CATEGORIES`, `OUTFITS`). The CRUD API exists but nothing fetches it. Wiring a screen to the API means replacing those imports and reconciling the camelCase/snake_case split above.

### Persistence is localStorage, centralized

`src/lib/onboarding.js` is the single owner of all persisted state (`dg_`-prefixed keys): the onboarding-completed flag, user profile (name/email/age), and style-quiz answers. Read and write through its exported functions rather than touching `localStorage` directly — `Dashboard`, `Profile`, `AccountInfo`, and `StylePreferences` all depend on that shape.

### Onboarding gate

`App.jsx` holds `showOnboarding` state seeded from `isOnboardingCompleted()`. When true it returns `<Onboarding>` **instead of** the router/nav tree, so onboarding is chrome-free. A deliberately low-contrast `RotateCcw` button in `Navbar` re-triggers it for testing — it is temporary and meant to be removed.

The quiz questions live in `src/data/styleQuestions.js` and the option rendering in `components/onboarding/QuestionOptions.jsx`; both are shared by the first-run wizard (`pages/Onboarding.jsx`) and the editable `pages/StylePreferences.jsx`. Change a question in one place and both stay in sync.

### Two navs must be kept in sync

`Navbar` (desktop, list hidden under `sm:`) and `BottomNav` (mobile, `sm:hidden`) are separate components with separate tab arrays. **Adding a top-level route means editing both.** The content wrapper in `App.jsx` carries `pb-24 sm:pb-0` so the fixed mobile bar doesn't cover content, and `ScrollToTopButton` is offset to `bottom-24 sm:bottom-6` for the same reason.

### Design system

Tokens are defined in `src/index.css` with Tailwind v4's CSS-first `@theme` block — **there is no `tailwind.config.js`.** Add or change design tokens there.

- Colors: `ivory` (page bg), `ink` (text), `warm-gray` (placeholder surfaces), `dusty-rose` (accent), `burgundy` (primary/active)
- Fonts: `font-display` (Playfair Display — headings, always `italic`), `font-body` (Lora), `font-sans` (Inter — UI/body text)
- Animations: `animate-fade-in`, `animate-page-fade`

Recurring idioms worth matching rather than reinventing: full-width pill buttons via `components/ui/Button.jsx` (`rounded-full`), `rounded-2xl border border-ink/10` cards, a `h-px w-16 bg-dusty-rose` rule under page titles, uppercase `tracking-[0.15em]` micro-labels, and burgundy selection state as `border-burgundy bg-burgundy/5 text-burgundy`. `components/ui/` holds the shared primitives (`Button`, `Modal`, `PageHeader`, `EmptyState`, `FilterPills`, `StatCard`, `QuickActionCard`).

Category → lucide icon mapping is centralized in `src/lib/categoryIcons.js`, and the seed data in `001_initial_schema.sql` stores the matching kebab-case icon names (`shirt`, `panel-bottom`, …). Keep the two aligned.

### Dev-only escape hatches

`pages/Wardrobe.jsx` has `DEV_FORCE_EMPTY` and `DEV_FORCE_EMPTY_CATEGORY` module constants for previewing empty states, and several pages fake latency with a `setTimeout` (`LOADING_DURATION`) to exercise skeleton/spinner UI.

## Database

Schema: `users`, `style_preferences`, `categories`, `clothing_items`, `outfits`, `outfit_items` — defined in `backend/src/db/migrations/001_initial_schema.sql` (UUID PKs via `pgcrypto`/`gen_random_uuid()`, `categories.id` is `SERIAL`, seeded with the 6 wardrobe categories).

Schema changes go in a **new** numbered `.sql` file in that directory and are applied manually; do not edit an already-applied migration.
