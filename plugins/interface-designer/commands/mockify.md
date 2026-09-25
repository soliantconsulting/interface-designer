---
description: Clone a real production React app into the design/ folder and convert it to use mock data + bypassed auth
---

# Interface Designer — Mockify a Real Production App

**Arguments:** `$ARGUMENTS`

**Format:** `{source-path} {project-name}`

| Argument | Required | Description |
|----------|----------|-------------|
| `source-path` | Yes | Path to the real production React app (relative to workspace root or absolute), e.g. `projects/cambre/cambre-react` |
| `project-name` | Yes | Name for the design folder, e.g. `cambre` → will live at `design/cambre/` |

**Example:**
```
/interface-designer:mockify projects/cambre/cambre-react cambre
```

## What This Command Does (and Doesn't)

This command takes a **real, production React app** (typically pulled from a Bitbucket monorepo) and produces a self-contained **design mock** in `design/{project-name}/`. The mock keeps the real app's components, pages, queries, mutations, types, and routing intact — only the **edges** are replaced:

- **Auth0** → bypassed (passthrough provider, no login required)
- **Real backend fetch** → MSW (Mock Service Worker) intercepting all `/api/*` calls
- **Deployment infra** (CDK, pipelines, Dockerfiles) → stripped (not relevant for a design mock)

This means the design mock looks and behaves exactly like UAT for the user, but runs entirely client-side from in-memory data the designer controls. We get production parity for design iteration without needing a real backend.

This command does **NOT**:
- Rewrite the 100+ query/mutation hooks (they stay untouched — MSW intercepts their fetch calls)
- Touch components, pages, types, schemas, or routing
- Run any tests, lint, or formatters from the real codebase

---

## Step 1: Verify Inputs

1. Resolve `source-path` to an absolute path. If it doesn't exist, error.
2. Verify the source has `package.json` and `src/` — error if not (this isn't a React app).
3. Verify `design/{project-name}/` does NOT exist — if it does, ask the user whether to abort, rename, or overwrite (default: abort).
4. Read source `package.json` and note:
   - Package manager (look for `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`)
   - Auth library in deps (`@auth0/auth0-react`, `@okta/okta-react`, `firebase`, custom, none)
   - Router (`react-router-dom`, `@tanstack/react-router`)
   - Data layer (`@tanstack/react-query`, `swr`, plain fetch)
   - JSON:API client (`jsonapi-zod-query`, `jsona`, custom)

## Step 2: Copy Source → Design Folder

1. Copy `source-path` → `design/{project-name}/` recursively, EXCLUDING:
   - `.git/` (we'll re-init)
   - `node_modules/` (we'll re-install)
   - `dist/`, `build/`, `.vite/`, `.cache/`
   - `cdk/`, `bitbucket-pipelines.yml`, `Dockerfile`, `lefthook.yml`, `commitlint.config.cjs`, `renovate.json` (deployment + CI infra not relevant for a mock)
   - `.env` (we'll create a new design-mock-friendly one)
   - Any `*.timestamp-*.mjs` Vite leftover files
2. Use `rsync --exclude` or equivalent. Don't recreate everything by hand.

## Step 3: Strip Auth

The strategy depends on what auth library is detected:

### If Auth0 (`@auth0/auth0-react`)

1. **Stub `useAuth0`**: create `src/__mocks__/auth0.ts` that re-exports a `useAuth0` returning a fake authenticated user:
   ```ts
   export const useAuth0 = () => ({
     isAuthenticated: true,
     isLoading: false,
     user: { sub: 'mock|designer', email: 'designer@example.com', name: 'Design User' },
     getAccessTokenSilently: async () => 'mock-token',
     loginWithRedirect: async () => {},
     logout: async () => {},
   });
   export const Auth0Provider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
   ```
2. **Alias** `@auth0/auth0-react` to that stub in `vite.config.ts`:
   ```ts
   resolve: {
     alias: {
       '@auth0/auth0-react': path.resolve(__dirname, 'src/__mocks__/auth0.ts'),
     },
   },
   ```
   (This way the existing `import { useAuth0 } from '@auth0/auth0-react'` calls work unchanged.)
3. **Find any `AuthGuard` component**: replace its body with a passthrough that just renders children.
4. **Find any `useAuthenticatedFetch` hook** (or similar — search `src/hooks/` for files matching `*auth*fetch*` or `*fetch*auth*`): replace with a passthrough:
   ```ts
   export default function useAuthenticatedFetch() {
     return window.fetch.bind(window);
   }
   ```
5. **Remove `Auth0Provider` setup from `main.tsx`** OR rely on the aliased stub (preferred — touches fewer lines).
6. Note in CHANGELOG which files were stubbed.

### If Okta, Firebase, custom auth

Apply the same pattern: stub the hook(s), alias the package or replace the hook file, replace any `AuthGuard`/`ProtectedRoute` component with a passthrough. Ask the user if the pattern isn't obvious from the codebase.

### If no auth library

Skip this step.

## Step 4: Detect Data Layer & Inventory Resources

1. List `src/queries/` and `src/mutations/` (or wherever query hooks live). For each file, extract:
   - The query/mutation key (often the first arg to `useQuery({ queryKey: [...] })`)
   - The URL pattern (often built from `apiUrl(\`/case/by-id/${id}\`)`)
   - The HTTP method (GET/POST/PATCH/DELETE — implied for queries, explicit in mutations)
2. Group by **resource type** (e.g. `case`, `person`, `employee`, `place`, `task`, `template`, `notification`).
3. Save the inventory as `design/{project-name}/.mockify/resource-inventory.json` for later reference. This file documents what handlers need to exist for full coverage.

## Step 5: Install MSW & Generate Handlers

1. Add `msw` to `devDependencies` in `package.json` (use the latest 2.x version).
2. Create the MSW skeleton:
   ```
   design/{project-name}/src/mocks/
   ├── browser.ts          # setupWorker + start
   ├── handlers/
   │   ├── index.ts        # exports all handlers
   │   └── {resource}.ts   # one file per resource type detected in step 4
   ├── data/
   │   ├── index.ts        # in-memory store + reset helpers
   │   └── {resource}.ts   # seed data + CRUD helpers for one resource
   └── jsonapi.ts          # helpers for building JSON:API responses (if jsonapi-zod-query was detected)
   ```
3. `browser.ts`:
   ```ts
   import { setupWorker } from 'msw/browser';
   import { handlers } from './handlers';
   export const worker = setupWorker(...handlers);
   ```
4. **For each resource type**, generate a **handler stub file** that lists every URL pattern found in step 4 with a placeholder response. Designer fills in real seed data later. Example for `case.ts`:
   ```ts
   import { http, HttpResponse } from 'msw';
   import { cases } from '../data/case';
   import { caseToJsonApi } from '../jsonapi';

   export const caseHandlers = [
     http.get('*/case/by-id/:id', ({ params }) => {
       const c = cases.find(x => x.id === params.id);
       if (!c) return HttpResponse.json({ errors: [{ status: '404' }] }, { status: 404 });
       return HttpResponse.json(caseToJsonApi(c));
     }),
     // ... one entry per URL pattern from inventory
   ];
   ```
5. **For each resource type**, generate a **data file** with an empty seed array and CRUD helpers:
   ```ts
   export type Case = { id: string; /* ... infer fields from the zod schema if possible */ };
   export const cases: Case[] = []; // designer fills in
   export const findCase = (id: string) => cases.find(c => c.id === id);
   export const upsertCase = (c: Case) => { /* ... */ };
   export const removeCase = (id: string) => { /* ... */ };
   ```
6. **JSON:API helper** — if the source uses `jsonapi-zod-query`, generate `jsonapi.ts` with a `toJsonApi(resource, type, relationships?)` helper that wraps a plain object in the JSON:API envelope.
7. Run `npx msw init public/ --save` (or equivalent) AFTER `pnpm install` completes — this creates `public/mockServiceWorker.js`.

## Step 6: Wire MSW Into App Boot

1. Edit `src/main.tsx` so MSW starts BEFORE React renders, in dev mode only:
   ```ts
   async function bootstrap() {
     if (import.meta.env.DEV) {
       const { worker } = await import('./mocks/browser');
       await worker.start({ onUnhandledRequest: 'warn' });
     }
     // ... existing createRoot(...).render(...) goes here
   }
   bootstrap();
   ```
2. Make sure `onUnhandledRequest: 'warn'` is set (not `'error'`) so unhandled API calls show a console warning instead of breaking the app while the designer adds handlers.

## Step 7: Clean Env & Vite Config

1. Create a new `.env` with mock-friendly values:
   ```
   VITE_APP_API_ENDPOINT=http://localhost:5173/api
   # Auth0 values are not used (stubbed) but kept so any reads don't crash
   VITE_APP_AUTH0_DOMAIN=mock.local
   VITE_APP_AUTH0_CLIENT_ID=mock-client-id
   VITE_APP_AUTH0_AUDIENCE=mock-audience
   ```
2. In `vite.config.ts`, ensure `server.port` is unset (or set to `5173`) so the default port is used.
3. If the Vite config has a proxy pointing to the real backend, comment it out — MSW intercepts at the fetch level.

## Step 8: Install Dependencies

1. Use the detected package manager. Run `pnpm install` (or `npm install` / `yarn`).
2. Run `npx msw init public/ --save` to create `public/mockServiceWorker.js`.

## Step 9: Initialize Git & Changelog

1. `git init` in `design/{project-name}/`.
2. Create `CHANGELOG.md`:
   ```markdown
   # {Project Name} — Design Mock Changelog

   ## Mockified from {source-path} — {date}
   - Cloned real production app from `{source-path}` into `design/{project-name}/`
   - Stripped deployment infra: cdk/, bitbucket-pipelines.yml, Dockerfile, lefthook.yml, commitlint.config.cjs, renovate.json
   - Auth: {scheme-detected} → stubbed (see src/__mocks__/auth0.ts and aliased in vite.config.ts)
   - Data: added MSW with handlers scaffolded for: {list resource types from inventory}
   - Ready for iterative design prompts. See `.mockify/resource-inventory.json` for the full handler inventory.
   ```
3. Stage and commit: `feat: mockify {project-name} from {source-path}`.

## Step 10: Configure Remote Tracking

Same as `/adopt`:
1. Check workspace `.claude/test-sites.json` for a `designRepo` entry for this project.
2. If found, add as `origin`. If not, ask the user.

## Step 11: Verify Chrome DevTools

Same as `/adopt`: check `.mcp.json` for the `chrome-devtools` MCP entry; add it if the user wants.

## Step 12: Add the ERD, Start & Open

1. Add the live ERD: follow **Installing or refreshing the ERD in an existing mock** in `${CLAUDE_PLUGIN_ROOT}/agents/interface-designer.md`. A production app keeps its resource types in the query layer, so point `include` there (`erd({ include: ["src/queries"] })` for a JSON:API client). The ERD reads resource types such as `ReturnType<typeof deserializeOne>["data"]`, unwraps a type that is the whole document, skips list projections derived from another exported type (`Paginated["data"][number]`), and links relationship fields like `employee` or `primaryContact` by name. Expect a first round of warnings for role-named ids (`bdOwnerId`, `assignedBoxId`); tag the obvious ones and ask the user about the rest.
2. Run `pnpm start` (or detected dev command) in the background.
3. Wait for Vite to be ready.
4. Navigate Chrome DevTools to the dev server URL.
5. Take a screenshot, then screenshot `/erd` on the same port.
6. Check the browser console for unhandled-request warnings: these tell you which URL patterns need MSW handlers next.

## Step 13: Report

Report to the user:
- Project mockified successfully at `design/{project-name}/`
- Auth scheme stubbed: {what was replaced}
- MSW handlers scaffolded for N resource types: {list}
- Inventory of every URL pattern: `.mockify/resource-inventory.json`
- First screenshot of the running app
- The ERD URL (`/erd`), its `[erd]` summary, and the link questions waiting on the user
- **Console warnings** (if any) listing unhandled requests — these are the next handlers to flesh out
- Ready for iterative design prompts to fill in mock data

After this, the normal `/interface-designer:resume` and `/interface-designer:revert` commands work.

---

## Prompt Cycle After Mockify (Production Parity)

After the initial scaffold lands, the iterative loop is:

1. User opens a page (or navigates a flow). Console + Network tab show which `/api/*` calls were unhandled or returned the placeholder 404.
2. For each unhandled call, **add seed data** to `src/mocks/data/{resource}.ts` and **fill in the handler** in `src/mocks/handlers/{resource}.ts`.
3. Reload, verify the page renders the expected content.
4. Test write paths (POST/PATCH/DELETE handlers should mutate the in-memory store so optimistic updates and refetches show the change).
5. Commit + screenshot + log to CHANGELOG.

Goal: every page in the production app renders with realistic data and every write path persists in-memory.

---

## Common Pitfalls

- **MSW service worker not registered**: forgot `npx msw init public/`. Symptom: requests hit the real backend (which isn't running) and fail. Fix: run the init command.
- **Auth0 still active**: missed the alias in vite.config.ts. Symptom: app redirects to Auth0 login. Fix: confirm the alias resolves `@auth0/auth0-react` to the stub.
- **CORS warnings on the mock**: MSW intercepts before CORS. If you see CORS errors, MSW isn't running yet (boot order issue in main.tsx).
- **JSON:API parse errors**: the mock response isn't shaped right for `jsonapi-zod-query` (data/relationships/included envelope). Check `jsonapi.ts` and compare to what `useFetchCase` (or similar) expects.
- **TanStack Query stale cache**: when seed data changes during dev, the cache may hold old values. Use the React Query Devtools button to invalidate, or hard-reload.

## Important Notes

- Use **MSW 2.x** (`http` + `HttpResponse` API), not 1.x (`rest` API).
- **Don't** rewrite query/mutation hooks. They stay untouched.
- **Don't** touch components or pages during mockify. Only the edges (auth, fetch, env, build infra) change.
- **Always** keep `.mockify/resource-inventory.json` up to date when adding new endpoints — it's the source of truth for coverage.
- **Always** commit after each handler-fleshing iteration.
- The designer (you, in a future session) should treat `src/mocks/data/{resource}.ts` like a database fixture file — make it realistic, varied, and large enough to exercise pagination and filters.
