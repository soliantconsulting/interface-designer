# interface-designer

A Claude Code plugin for interactive React UI design. Scaffold, build, and iterate on MUI applications with Chrome DevTools visual verification.

## Install

### Step 1: Add the marketplace

```bash
claude plugins marketplace add git@bitbucket.org:soliantconsulting/interface-designer.git
```

### Step 2: Install the plugin

```bash
claude plugins install interface-designer@interface-designer
```

Restart your Claude Code session to activate the plugin.

## Update

After new versions are pushed:

```bash
claude plugins update interface-designer@interface-designer
```

Restart your Claude Code session to apply the changes.

## Prerequisites

- **Node.js** (20.19+ or 22.12+, what Vite 8 requires) and **pnpm** installed
- **Chrome** available for visual verification (`claude --chrome`)

## Commands

| Command | Description |
|---------|-------------|
| `/interface-designer:new {name}` | Scaffold a new React+MUI project in `design/{name}/` |
| `/interface-designer:adopt {name}` | Adopt an existing codebase at `design/{name}/` into the workflow |
| `/interface-designer:mockify {source-path} {name}` | Clone a real production React app from `{source-path}`, copy it to `design/{name}/`, stub auth, and wire up MSW for mock data |
| `/interface-designer:resume {name}` | Resume an existing project — loads changelog, starts dev server |
| `/interface-designer:revert {name}` | Show git history and revert to a previous commit |
| `/interface-designer:genai-demo {name}` | Build a Rapid GenAI Assessment pitch demo: replicate a client's FileMaker or Salesforce UI from screenshots, then overlay suggested AWS AI implementations as a guided tour |

## GenAI pitch demos

`genai-demo` exists for one job: walking into an existing client and showing them
where Generative AI would help, using their own screens rather than a generic mockup.

It builds two layers:

1. **A replica of the client's current system**, from screenshots. Fidelity outranks
   polish here — the normal MUI house style is deliberately suspended, because the
   client has to recognise the software as theirs on sight.
2. **A demo overlay** that spotlights elements in that replica and attaches a suggested
   AWS AI implementation to each, sourced from the client's real pain points.

The AI content lives in a single file, `src/ai/aiOpportunities.ts`, so the AWS team can
rewrite the entire pitch without touching a screen. Every opportunity carries a
mandatory `evidence` field citing a ticket, meeting or document.

Supporting assets:

| Path | Purpose |
|------|---------|
| `templates/genai-skin/` | FileMaker and Salesforce skins: palette, density, and chrome components (`FMWindow`, `FMHeader`, `FMGrid`, `FMField`, `FMTabs`, `FMPortal`) |
| `templates/genai-tour/` | The AI opportunity overlay: provider, spotlight overlay, launcher, and the editable opportunities file |

## How It Works

1. **Scaffold:** Creates a Vite + React + TypeScript project and installs the full CNA dependency stack (MUI 7, TanStack Router, React Query, React Hook Form + Zod, and more)
2. **Build:** Describe what you want in natural language — pages, forms, tables, dashboards — and it builds them iteratively
3. **Verify:** Every change is verified with `pnpm build` and Chrome DevTools screenshots before being shown to you
4. **Track:** Every prompt and change is logged in `CHANGELOG.md` and git-committed, so you can resume or revert at any point
5. **Diagram:** Every mock serves a live entity relationship diagram at `/erd`, generated from its TypeScript types, so you can always see the data model the screens are building on

## Live ERD

Open `http://localhost:{port}/erd` on any running mock (Vite prints it as the `ERD:` line under `Local`). The diagram comes from the entity types in `src/types/`, read with the project's own TypeScript compiler, so it cannot drift from the code:

- Change an entity type and any open diagram redraws within a second. New and changed entities flash, and a toast says what moved.
- `ERD.md` in the mock is rewritten at the same time as a Mermaid `erDiagram`, so every commit's diff shows how the data model changed. Paste it into Confluence or GitHub as is.
- `pnpm build` prints `[erd] N entities, M relationships` and a warning for every id field it could not link, and writes a self-contained copy of the diagram to `dist/erd/index.html` that opens straight from disk.

In the viewer: drag boxes to arrange them (positions are remembered per browser), scroll to pan, Ctrl or ⌘ + scroll to zoom, `/` to search entities and fields, click an entity for its fields and relationships, **Keys only** for big models, **Copy Mermaid** and **Download SVG** to take it elsewhere.

How the diagram reads the types:

| In `src/types/` | On the diagram |
|---|---|
| Exported type with an `id` field | Entity |
| `listingId: string`, `payeeEmployeeId`, `neighborhoodCode` | Reference to `Listing`, `Employee`, `Neighborhood` (by its `code`) |
| `listingIds: string[]` | Many to many |
| `bedrooms: BedroomSpec[]` (a named type) | Embedded type on a dashed line |
| `/** @ref User */ ownerId` | Reference the name could not express |
| `/** @ref Loss \| Lead */ parentId` | Polymorphic reference |
| `/** @external PayPal */ paypalOrderId` | Id in an outside system, badged `EXT` |
| `/** @ref none */ entityId` | An id with no single target, left unlinked on purpose |
| `slotKey` when the type is `PhotoSlot` (only part of the name) | No line; the build suggests `PhotoSlot` for you to confirm with `@ref` |
| `/** @entity */` on a type without `id` | Entity keyed by `code`, `key` or `slug` (or `/** @entity field */`) |
| `ListFinanceProfile` with no `FinanceProfile` type | Entity (a JSON:API list row that is the resource's only type) |
| `/** @notEntity */`, a `Pick`/`Omit` projection, or `ListDevice` next to a full `Device` | Left off |

Mocks created before 1.6.0 get the ERD the next time you run `/interface-designer:resume` on them; `adopt` and `mockify` install it too. It is a Vite plugin (`erd/vite-plugin-erd.ts`, registered in `vite.config.ts`) with no dependencies beyond the project's own `typescript`, which must still be a 6.x-or-earlier release that exposes the compiler API. Options: `erd({ include, path, output, emit })` for the type folders, the URL, the markdown file (`false` to skip it) and the build copy.

## Tech Stack

Projects are scaffolded with this mandatory stack:

| Category | Packages |
|----------|----------|
| Core | React 19, TypeScript (strict), Vite |
| UI | MUI 7 + Emotion, MUI Icons, Lucide React |
| Routing | TanStack Router, file-based via `@tanstack/router-plugin` |
| Data | TanStack React Query |
| Forms | React Hook Form + Zod + mui-rhf-integration |
| Tables | material-react-table, MUI X Data Grid |
| Dates | Temporal (`temporal-polyfill`), MUI X Date Pickers with the dayjs adapter |
| Utilities | uuid |

## Optional: Remote Git Tracking

Design projects can optionally sync to a remote git repo. During `/interface-designer:new` or `/interface-designer:adopt`, the plugin will ask if you want to configure remote tracking. If you say yes, it adds an entry to `.claude/test-sites.json` in your workspace root.

You can also configure it manually. The file is a shared config — **other plugins (QA, triage, etc.) may also use this file** with their own fields per project. The plugin will merge its entries without overwriting existing data.

### File structure

```json
{
  "my-project": {
    "designReference": "design/my-project",
    "designRepo": "git@bitbucket.org:myorg/my-project-mock.git"
  },
  "another-project": {
    "name": "Another Project",
    "url": "https://another-project.example.com",
    "designReference": "design/another-project",
    "designRepo": "git@bitbucket.org:myorg/another-mock.git",
    "jiraProject": "AP",
    "logins": [
      {
        "role": "admin",
        "loginUrl": "https://another-project.example.com/admin/login",
        "username": "admin@example.com",
        "password": "your-password-here"
      }
    ]
  }
}
```

### Fields used by this plugin

| Field | Description |
|-------|-------------|
| `designReference` | Relative path to the local design project |
| `designRepo` | Git SSH/HTTPS URL for remote tracking |

Other fields (`name`, `url`, `logins`, `jiraProject`, `boltReference`, `notes`, etc.) are used by other plugins and are left untouched.

### Behavior when configured

- **On `new`/`adopt`:** Adds the remote as `origin`
- **On `resume`:** Pulls latest before starting (`git pull origin main --rebase`)
- **After each commit:** Auto-pushes to `origin main`
- **On `revert`:** Force-pushes after confirmation

If the file doesn't exist or has no entry for the project, everything works in local-only mode.

## Project Structure

```
design/{project-name}/
├── CHANGELOG.md              # Conversation history
├── ERD.md                    # Mermaid ERD, rewritten on every model change; never edit
├── erd/                      # Live ERD Vite plugin and viewer (served at /erd); plugin-owned
├── index.html                # Loads src/entry.ts
├── src/
│   ├── entry.ts              # Temporal polyfill + zod config, then main
│   ├── temporal-polyfill.ts
│   ├── main.tsx              # Providers + RouterProvider
│   ├── routeTree.gen.ts      # Generated by the router plugin; never edit
│   ├── routes/__root.tsx     # Root layout (AppBar, Outlet, footer)
│   ├── routes/index.tsx      # /
│   ├── routes/**/-components # Route-private components
│   ├── theme/theme.ts        # MUI theme
│   ├── types/*.ts            # Entity types (what the ERD reads)
│   ├── schemas/*.ts          # Zod validation schemas (zod-config.ts installs the error map)
│   ├── services/*.ts         # Mock data services
│   ├── components/*.tsx      # Reusable components
│   └── hooks/*.ts            # Custom React hooks
```
