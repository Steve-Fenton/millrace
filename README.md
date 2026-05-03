# Flow

Flow is a **git-friendly** work item manager with a **Kanban-first** workflow. You run it locally with **Node.js**; boards and work items are **INI files** under `tasks/`, so you can **commit, diff, and merge** them with Git like any other project files.

## Running the app

From the repository root:

1. **`pnpm install`**
2. **`pnpm start`** — runs **`node server.js`**, which serves the web UI and HTTP APIs that read and write under **`tasks/`**.

Open **http://localhost:8888/** in your browser (or the URL printed in the terminal). The default port is **8888** unless you set **`PORT`**.

| Environment variable | Purpose |
| --- | --- |
| **`PORT`** | HTTP port (default **8888**). |
| **`HOST`** | If set, the server binds to this host; otherwise it listens on all interfaces. |
| **`FLOW_ROOT`** | Absolute path to the repo root whose **`tasks/`** directory is used. If unset, the server searches for **`tasks/board.ini`** starting from the directory containing **`server.js`**, then the current working directory. |
| **`FLOW_GIT_AUTO_COMMIT`** | If **`1`**, **`true`**, or **`yes`**, the server runs **`git add tasks`** and **`git commit`** after task files change (card create/edit/move/reorder). **Off by default** — export it in the same shell before **`pnpm start`** (e.g. **`FLOW_GIT_AUTO_COMMIT=1 pnpm start`**). Requires a **`.git`** directory at **`FLOW_ROOT`**, **`git`** on **`PATH`**, and Git **user.name** / **user.email** when there is nothing configured yet. Check the server terminal for **`FLOW_GIT_AUTO_COMMIT:`** lines after edits (success, skipped, or git errors). |
| **`FLOW_GIT_COMMIT_DELAY_MS`** | Debounce delay before committing (default **1500** ms) so rapid API calls produce one commit — wait at least this long after a move before checking **`git log`**. Use **`0`** to commit as soon as the timer fires after each queued change (still debounced per event loop batch). |
| **`FLOW_ARCHIVE_CLOSED_AFTER_DAYS`** | Cards with a **`closed`** timestamp older than this many days are moved from **`tasks/{slug}/`** into **`tasks/{slug}/archive/`** whenever column cards are loaded (default **14**). Set **`0`** to disable automatic archiving. |

Opening **`index.html`** as a **`file://`** URL will not load board data; use the server above.

## How it works

- **Kanban UI** — Columns and optional **swimlanes** come from **`tasks/board.ini`**. Each card is a **`.ini` file** directly under **`tasks/{board-slug}/`** (slug comes from the board’s **`slug`**, normalized). **`column = N`** in **`[item]`** selects **`[columns.N]`** (same idea as **`swimlane`**). Older installs may still have cards under **`tasks/{board-slug}/columns.{N}/`** until moved by the app or migrated.
- **Express server** — Serves the static UI and **`/api/*`** endpoints for the board, listing cards, reading/writing a card, moving cards, and **`tasks/localuser.ini`** (default owner for new cards and the **Mine** filter).
- **Versioning** — The app does **not** run **`git`**. You commit and push INI changes with your normal Git workflow.

## Board file (`tasks/board.ini`)

- **`[board]`** — **`name`** (shown in the UI) and **`slug`** (folder name under **`tasks/`**, e.g. **`board`** → **`tasks/board/`**).
- **`[columns.N]`** — **`title`** for each column; **`N`** orders columns left to right (`columns.1`, `columns.2`, …).
  - Optional **`wip_limit = \<non‑negative integer\>`** — Kanban **WIP** cap for that column. The board shows **`Title (current/limit)`** in the column header when set; if **more cards** are in that column than the limit (count includes **all swimlanes**), the column header and cells use a **subtle red** highlight.
  - Optional **`is_done = true`** (also **`1`**, **`yes`**, **`on`**) marks a **done** column. When a card is **moved** into that column (its **`column`** field changes to **`N`** for a done column), Flow adds **`closed = \<ISO-8601 UTC timestamp\>`** to the work item. Moving to a non-done column removes **`closed`** (unless you edit the file by hand).
- **`[swimlanes.N]`** — Optional horizontal rows, top to bottom. If you omit all swimlane sections, the board has a single implicit lane.

```ini
[board]
name = Board
slug = board

[columns.1]
title = Backlog

[columns.2]
title = Up next
wip_limit = 5

[columns.3]
title = Doing
wip_limit = 2

[columns.6]
title = Done
is_done = true

[swimlanes.1]
title = Default

[swimlanes.2]
title = Articles
```

## Work item (each card `.ini`)

Each file has **`[item]`** and optional **`[link.M]`** sections.

- **`title`**, **`description`**, **`owner`** — Core fields. **`id`** is set when the card is created in the app.
- **`description`** — Multiline values use **indented continuation** lines (same idea as many INI-style parsers): continuation lines are indented; blank lines inside the description are preserved where supported.
- **`column`** — Optional but recommended. The app writes the column’s **`title`** from **`[columns.N]`** (e.g. **`column = Doing`**). Legacy values still work: **`column = N`**, **`columns.N`**, or a **case-insensitive title** match. If missing or invalid, the card is treated as belonging to the **first** column (lowest **`columns.N`** order).
- **`swimlane`** — Optional. The app writes the swimlane’s **`title`** from **`[swimlanes.N]`**. Legacy: **`swimlane = N`**, **`swimlanes.N`**, or **title** match. If missing or invalid, the card appears in the **default** swimlane (lowest **`swimlanes.N`** order). If the board defines no swimlane sections, omit **`swimlane`**.
- **Bulk migrate older cards** — From the repo root: **`node scripts/migrate-task-cards-to-column-swimlane-names.mjs`** (optional **`--dry-run`**). Respects **`FLOW_ROOT`** like the server. Rewrites **`FLOW-*.ini`** under each board’s **`tasks/{slug}/`** tree (including **`archive/`** and **`cold-storage/**`**).
- **`sort_order`** — Optional integer; lower values appear **above** higher values among cards in the **same column and swimlane**. Set automatically when you **drag cards to reorder** (with the owner filter on **All**); new cards and cards moved from another column/lane are placed at the **end** of the target lane until you reorder.
- **`created`** — Added automatically on create (**ISO-8601 UTC**, e.g. **`2026-05-01T18:00:00.000Z`**).
- **`closed`** — Set automatically when the card is **moved into** a column with **`is_done`**; cleared when moved to a non-done column (same ISO format). Items that stay **closed** for longer than **14 days** (configurable) are moved off the active board into **`tasks/{slug}/archive/`** when the server loads column cards (same filenames; they no longer appear on the Kanban).
- **Links** — **`[link.1]`**, **`[link.2]`, …** each with **`text`** and **`url`**.

**`tasks/localuser.ini`** — Gitignored. When you create or edit a card, the owner field can be remembered here; it drives the **Mine** filter on the board.

```ini
[item]
id = FLOW-abc123-def456
title = Add keyboard shortcuts to the board
description = Power users should move cards and open items without the mouse.
    Cover J/K navigation and ? for help.
owner = sam@example.com
column = Doing
swimlane = Default
created = 2026-04-30T12:00:00.000Z
closed = 2026-05-01T15:30:00.000Z

[link.1]
text = Interaction guidelines
url = https://example.com/design/keyboard

[link.2]
text = Tracking issue #1284
url = https://example.com/org/flow/issues/1284
```

## Local temporary settings

Local temporary settings are automatically saved in `localuser.ini`.

```ini
[user]
owner = your.name@example.com

[flow]
last_auto_git_pull = 2026-05-03T08:40:21.777Z
```

## Web UI

- **Sync** — Runs **`git pull`** then **`git push`** in the repo whose **`tasks/`** directory Flow is using (the server’s “data root”). Requires **`git`** on the server machine, a configured remote, and credentials/SSH access as usual; conflicts or auth failures appear in an alert. The button is disabled if that directory is not a Git clone (no **`.git`**).
- **Drag and drop** cards between columns and swimlanes (updates **`column`**, **`swimlane`**, **`sort_order`**, and related fields in the INI). With the owner filter on **All**, you can also reorder within a column + swimlane by dropping onto the desired position in the list.
- **Cards** filter — **All**, **Mine** (owner matches **`localuser.ini`**), or a specific owner from the board; the choice is stored in the browser (**`localStorage`**).
- **Edit** a card via the pencil control (shown on hover over the card, or when the row/card has keyboard focus). **Links** on a card are shown as clickable rows (open in a new tab).
