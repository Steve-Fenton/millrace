# Millrace

Millrace is a local web app you can use to manage work on customisable Kanban boards. It's built for developers and uses **git as the source of truth** for everything.

You can work in the UI, but all updates are captured in Git commits against human-readable INI files.

## Repository

Source and issue tracking: [github.com/Steve-Fenton/millrace](https://github.com/Steve-Fenton/millrace).

## Getting started

- [Quick start guide](quick-start.md)

## Using Millrace

Run the server using `pnpm exec millrace` or `npx millrace` and open the URL in your browser. By default the URL is `localhost:8888`.

### Kanban boards

Kanban boards are divided into columns and swimlanes.

- **Columns**: Represent stages tasks progress through on their way to done.
- **Swimlanes**: Let you group tasks into workstreams, or types, or whatever you find useful.

You can add, rename, reorder, and delete columns and swimlanes. You should move cards out of a column/swimlane before you delete it, otherwise the cards will be moved to the first column/swimlane so you don't lose them.

Useful features:

- Switch boards using the board name drop-down
- Set the task owner filter to "Mine" to clear the clutter and just see your own work
- Can't find a card? Use the search box
- Remember to use the **Sync** button; it will pulse to remind you to share your changes and avoid merge conflicts

### Task cards

Task cards are units of work. They contain information to help you manage your work, including a title, description, and links to helpful information or working docs and tools. Links are shown on the board view for quick access.

You can access git history for tasks from the task editor view.

## Completed list

To save space, the completed list on the Kanban board just shows the more recent 5 completed items. The completed list view shows more items, split into pages of 50 cards at a time.

You can use the search box to find closed cards.

### Charts

The charts are carefully designed to increase informational value. You'll notice the charts are aggregated for the board and don't show individual numbers or league tables. We want the charts to power your continuous improvement process, not your performance review process.

- **Completions**: The number of cards completed
- **Completions by swimlane**: Completed cards, grouped by their swimlane
- **Cycle times**: A scatter plot of closed card durations, with median and standard deviation

## Features

### Kanban & cards

- **Drag-and-drop** between columns and swimlanes
- **Create, open, edit, and delete** cards from the UI
- **Owner filter**: All, **Mine**, or a specific task owner
- **Search** to find tasks

### Views

- **Board**: Primary Kanban view
- **Completed** : Browse closed items or search
- **Charts**: Informational scatter charts
- **Admin**: Create and customise boards

## Under the hood

This information may be useful to know. You don't normally hand-crank the INI files.

- **`tasks/localuser.ini`** stores machine-local preferences (default owner, charts granularity, sync hints); keep it gitignored.
- **`tasks/.millrace.ini`** (section **`[millrace]`**, key **`boards`**) lists active boards so you can switch between multiple boards in one repo.
- **Board definitions** (`*.ini` under **`tasks/`**) describe columns, optional swimlanes, and WIP limits
- **Task cards** are stored in **INI files** under **`tasks/{board-slug}/`**

To keep current work items clean, an archiving process moves older tasks into archive and cold storage. Configure ages in **`tasks/.millrace.ini`** under **`[millrace]`** (omit a key to use the default):

- **`archive_closed_after_days`** — days after **`closed`** before a card in **`tasks/{slug}/`** moves to **`tasks/{slug}/archive/`** (default **14**; **0** disables).
- **`cold_storage_archive_after_months`** — months after **`closed`** before a file in **`archive/`** moves to **`tasks/{slug}/cold-storage/{year}/`** (default **12**; **0** disables).

The app automatically integrates with Git through the UI.

- **Sync** runs **`git pull`** then **`git push`** at the repo root that owns **`tasks/`** (requires **`.git`** and credentials on the server).
- Optional **`FLOW_GIT_AUTO_COMMIT`**: after changes under **`tasks/`**, stage and **commit** with a debounced delay (**`FLOW_GIT_COMMIT_DELAY_MS`**).
- **Git history** in the UI for a **board definition** file and for an individual **card** INI.
