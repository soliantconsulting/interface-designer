---
description: Scaffold a new React DESIGN MOCK under design/{name} - Vite + MUI + TanStack Router, in-memory mock data, no backend, git-tracked with screenshot verification. Use for UI prototypes and design iteration; for a real provisioned CNA project use /cna-project-init:new.
---

# Interface Designer — New Project

**Arguments:** `$ARGUMENTS`

**Format:** `{project-name}`

| Argument | Required | Description |
|----------|----------|-------------|
| `project-name` | Yes | Name of the project (used as folder name under `design/`) |

**Example:**
```
/interface-designer:new scheduling-portal
```

## Step 1: Scaffold with Vite

1. Create the project using Vite:
   ```bash
   cd design/ && pnpm create vite {project-name} --template react-ts --no-interactive
   ```
   If the `design/` directory doesn't exist, create it first: `mkdir -p design/`

2. Install the CNA dependency stack:
   ```bash
   cd design/{project-name} && pnpm add \
     @emotion/react @emotion/styled \
     @mui/material @mui/icons-material \
     @mui/x-data-grid @mui/x-date-pickers \
     @tanstack/react-router @tanstack/react-query \
     react-hook-form @hookform/resolvers zod \
     mui-rhf-integration \
     material-react-table \
     lucide-react uuid dayjs temporal-polyfill \
   && pnpm add -D @tanstack/router-plugin
   ```

## Step 2: Apply Project Template

Replace the Vite boilerplate files with the CNA template files from `${CLAUDE_PLUGIN_ROOT}/templates/scaffold/`:

1. Copy these files from the template, **overwriting** the Vite defaults:
   - `index.html` — loads `/src/entry.ts`, not `main.tsx`
   - `vite.config.ts` — router plugin plus the `optimizeDeps.include` list; never add an `optimizeDeps.exclude`
   - `src/entry.ts`
   - `src/temporal-polyfill.ts`
   - `src/schemas/zod-config.ts`
   - `src/main.tsx`
   - `src/index.css`
   - `src/theme/theme.ts`
   - `src/routes/__root.tsx`
   - `src/routes/index.tsx`
   - `src/types/index.ts`

   Then replace `{{PROJECT_NAME}}` in `index.html` and `src/routes/__root.tsx` with the actual project name (title-cased from the folder name, e.g., `scheduling-portal` becomes `Scheduling Portal`).

2. Create empty directory placeholders:
   ```bash
   mkdir -p design/{project-name}/src/{services,components,hooks}
   ```

3. Delete the Vite boilerplate the template replaces (`public/favicon.svg` stays; `index.html` links it):
   ```bash
   rm -rf design/{project-name}/src/App.tsx design/{project-name}/src/App.css design/{project-name}/src/assets design/{project-name}/public/icons.svg
   ```

4. Generate the route tree once, so `tsc` can see it before the dev server has ever run:
   ```bash
   cd design/{project-name} && pnpm exec vite build
   ```
   The router plugin writes `src/routeTree.gen.ts` during the build and rewrites it whenever a route file changes. Commit it; never edit it by hand. The `dist/` output is disposable.

## Step 3: Initialize Git & Changelog

1. Initialize a git repo: `cd design/{project-name} && git init`
2. Create `CHANGELOG.md` with the project header:
   ```markdown
   # {Project Name} — Design Changelog
   ```
3. Stage all files and make an initial commit: `feat: scaffold {project-name} from CNA template`

## Step 4: Configure Remote Tracking

1. Check if `.claude/test-sites.json` exists in the workspace root (the directory where the user ran Claude Code, NOT inside the design project).

2. **If the file exists and has an entry for this project with a `designRepo` field:** add it as the `origin` remote:
   ```bash
   cd design/{project-name} && git remote add origin {designRepo}
   ```
   Tell the user: "Found remote tracking config — pushes will go to {designRepo}."

3. **If the file exists but has no entry for this project, OR the file doesn't exist:** ask the user:
   > "Do you want to track this project against a remote git repo? (e.g., for sharing the mock with your team)"

   - **If yes:** ask for the git URL (e.g., `git@bitbucket.org:myorg/my-project-mock.git`)
     - If `.claude/test-sites.json` doesn't exist, create it with the new entry
     - If it exists, read the current contents and **merge** the new entry — do NOT overwrite existing entries from other plugins/projects
     - Add the entry:
       ```json
       "{project-name}": {
         "designReference": "design/{project-name}",
         "designRepo": "{git-url}"
       }
       ```
     - Add the remote: `git remote add origin {git-url}`
   - **If no:** skip — the project operates in local-only mode

## Step 5: Install & Start

1. Run `pnpm install` in the project directory (if not already done)
2. Start the dev server: `cd design/{project-name} && pnpm dev` (run in background)
3. Wait a few seconds for Vite to be ready

## Step 6: Verify Chrome DevTools

Before attempting to use Chrome DevTools for screenshots:

1. Check if `.mcp.json` exists in the workspace root (the directory where the user ran Claude Code, NOT inside the design project).
2. If it exists, check if it has a `chrome-devtools` entry in `mcpServers`.
3. If `.mcp.json` doesn't exist OR doesn't have a `chrome-devtools` entry:
   - Ask the user: "Chrome DevTools MCP is not configured. Visual verification requires it. Do you want me to add it to .mcp.json?"
   - **If yes:** Read the existing `.mcp.json` (or create a new one), merge in the chrome-devtools entry:
     ```json
     "chrome-devtools": {
       "type": "stdio",
       "command": "npx",
       "args": ["-y", "chrome-devtools-mcp@latest"]
     }
     ```
     Then tell the user: "Added chrome-devtools to .mcp.json. You'll need to restart your Claude Code session for visual verification to work."
   - **If no:** Warn that screenshots won't work, but continue without visual verification.

## Step 7: Open in Browser

1. Use Chrome DevTools to navigate to the dev server URL (typically `http://localhost:5173`)
2. Take a screenshot to confirm the template is running
3. Show the screenshot to the user

## Step 8: Ready for Prompts

Tell the user the project is running and ready. They can now describe what they want built.

---

## Prompt Cycle (after setup)

When the user gives a prompt describing what to build or change:

1. **Plan** the changes needed (briefly, 2-3 sentences max)
2. **Implement** the changes following the interface-designer agent patterns - Read ${CLAUDE_PLUGIN_ROOT}/agents/interface-designer.md first if not already loaded this session, then follow its mock-service, RHF+Zod, and changelog conventions:
   - Types in `src/types/`
   - Schemas in `src/schemas/`
   - Mock data in `src/services/`
   - Routes in `src/routes/` (file-based: one file per screen, route-private pieces in a sibling `-components/` folder; the router plugin regenerates `src/routeTree.gen.ts`)
   - Shared components in `src/components/`
3. **Verify:**
   - Run `pnpm build` to check for errors
   - Take a Chrome DevTools screenshot of the result
   - Check for console errors
4. **Log** the prompt and changes in `CHANGELOG.md`
5. **Commit** with a descriptive message
6. **Push** to remote if configured
7. **Show** the user the screenshot and a brief summary of what was built

If the build fails, fix the errors before showing anything to the user. If a visual issue is spotted in the screenshot, fix it and re-screenshot.

## Port Management

- Default Vite port: 5173
- If a project is already running on 5173, Vite will auto-increment to 5174, etc.
- Check the terminal output for the actual port and use that for Chrome DevTools navigation

## Remote Tracking

After each commit, if a remote `origin` exists, auto-push: `git push origin main`. Report push success/failure to the user.

## Important

- Use the **interface-designer** agent patterns for all code decisions
- **Always use mock data** — generate realistic sample data in `src/services/` for every entity
- **Never install packages** unless the user explicitly asks
- **Always commit** after each prompt cycle
- **Always push** after each commit if a remote is configured
- **Always update CHANGELOG.md** — this is the user's conversation history
- **Always screenshot** after changes — visual verification is mandatory
