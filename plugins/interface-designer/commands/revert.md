---
description: Show commit history for a React design mock in design/{name} and revert it to a previous prompt cycle. Use for interface-designer projects; Astro/CMS sites use /cms-designer:revert.
---

# Interface Designer — Revert Project

**Arguments:** `$ARGUMENTS`

**Format:** `{project-name}`

| Argument | Required | Description |
|----------|----------|-------------|
| `project-name` | Yes | Name of the project to revert (must exist at `design/{project-name}/`) |

**Example:**
```
/interface-designer:revert scheduling-portal
```

## Steps

1. Run `git log --oneline -20` in the `design/{project-name}/` directory
2. Show the log to the user with changelog context
3. Ask which commit they'd like to revert to
4. On confirmation, run `git checkout {hash} -- .` to restore files to that state
5. Restart the dev server if needed and take a fresh screenshot
6. If a remote `origin` exists, warn the user that reverting will require a force-push, then on confirmation: `git push --force origin main`

## Port Management

- Default Vite port: 5173
- If a project is already running on 5173, Vite will auto-increment to 5174, etc.
- Check the terminal output for the actual port and use that for Chrome DevTools navigation
