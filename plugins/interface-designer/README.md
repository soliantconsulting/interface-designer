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

- **Node.js** (18+) and **pnpm** installed
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

## Tech Stack

Projects are scaffolded with this mandatory stack:

| Category | Packages |
|----------|----------|
| Core | React 18, TypeScript (strict), Vite |
| UI | MUI 7 + Emotion, MUI Icons, Lucide React |
| Routing | TanStack Router |
| Data | TanStack React Query |
| Forms | React Hook Form + Zod + mui-rhf-integration |
| Tables | material-react-table, MUI X Data Grid |
| Dates | MUI X Date Pickers + dayjs |
| Utilities | uuid, dayjs |

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
├── src/
│   ├── main.tsx              # App entry (providers)
│   ├── App.tsx               # Root layout (AppBar, Outlet)
│   ├── theme/theme.ts        # MUI theme
│   ├── router/router.tsx     # TanStack Router config
│   ├── types/index.ts        # Shared TypeScript types
│   ├── schemas/*.ts          # Zod validation schemas
│   ├── services/*.ts         # Mock data services
│   ├── pages/*.tsx           # Page components (one per route)
│   ├── components/*.tsx      # Reusable components
│   └── hooks/*.ts            # Custom React hooks
```
