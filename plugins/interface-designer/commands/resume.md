---
description: Resume work on an existing interface-designer project
---

# Interface Designer — Resume Project

**Arguments:** `$ARGUMENTS`

**Format:** `{project-name}`

| Argument | Required | Description |
|----------|----------|-------------|
| `project-name` | Yes | Name of the project to resume (must exist at `design/{project-name}/`) |

**Example:**
```
/interface-designer:resume scheduling-portal
```

## Step 1: Load Context

1. Read `design/{project-name}/CHANGELOG.md` to understand what's been built so far
2. Check if the dev server is already running; if not, start it with `pnpm dev`
3. Before using Chrome DevTools, verify `.mcp.json` has `chrome-devtools` configured. If not, offer to add it.
4. Navigate Chrome DevTools to the app and take a screenshot of the current state

## Step 2: Check Remote Tracking

If a remote `origin` is configured, pull latest before starting:
```bash
cd design/{project-name} && git pull origin main --rebase
```
Handle gracefully if remote is empty or ahead.

## Step 3: Report Status

Show the user:
- Summary of the last few changelog entries (what was most recently built)
- Current screenshot of the app
- Ready for the next prompt

---

## Prompt Cycle (after resume)

When the user gives a prompt describing what to build or change:

1. **Plan** the changes needed (briefly, 2-3 sentences max)
2. **Implement** the changes following the interface-designer agent patterns:
   - Types in `src/types/`
   - Schemas in `src/schemas/`
   - Mock data in `src/services/`
   - Pages in `src/pages/`
   - Components in `src/components/`
   - Routes in `src/router/router.tsx`
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

## Important

- Use the **interface-designer** agent patterns for all code decisions
- **Always use mock data** — generate realistic sample data in `src/services/` for every entity
- **Never install packages** unless the user explicitly asks
- **Always commit** after each prompt cycle
- **Always push** after each commit if a remote is configured
- **Always update CHANGELOG.md** — this is the user's conversation history
- **Always screenshot** after changes — visual verification is mandatory
