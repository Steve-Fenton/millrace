# Millrace

A millrace channels water to and from a water wheel. It has a narrow fast current with plenty of power. You control the flow of water to the wheel using the head race, and the water flows away from the wheel along the tail race.

The ability to control the flow of water along the millrace is crucial. The goal is an optimal flow that efficiently turns the water wheel. When it comes to mills, that's the backshot wheel (the water enters at the top of the wheel, in the opposite direction to the flow of the tail race), but for knowledge work it's Kanban with strategic <abbr title="work in process">WIP</abbr> limits.

![Millrace](assets/svg/millrace.svg)

Millrace is an lightweight git-friendly work management tool designed for optimal flow.

Because it doesn't try to be a project plan, resource schedule, or Gantt chart, Millrace is the backshot wheel of the *project management tools* category. And it's ideal for software teams as it lives in a Git repository.

Millrace is a **git-friendly** work item manager with a **Kanban-first** workflow. You create a git repository for you work, add the Millrace package from npm, and run the app to visuallly manage work, while git does all the hard work tracking changes in high-fidelity.

This isn't a watefall. It's engineering.

[Read the documentation](docs/index.md).

# App design

## `server.js`

The API for the application.

## `assets/js`

Bundled browser modules. Route-specific entry scripts live under **`pages/`**; shared libraries sit in the folders below (alongside top-level modules such as `app.js`, `client.js`, and `flow*.js`).

- **`dialogs/`**: Modal flows for creating or editing boards and task cards (DOM, validation, and API calls).
- **`git/`**: Helpers around Git merge-conflict markers (detecting hunks, choosing a side), not a full Git client.
- **`html/`**: Low-level helpers: escape text for HTML, derive URL-safe slugs, parse markup strings into DOM nodes.
- **`ini/`**: INI parsing plus board/card helpers (sections, columns, swimlanes).
- **`models/`**: Structured board and task-card models derived from parsed INI text.
- **`pages/`**: Page entry bundles wired from each route’s `index.html` (admin, charts, completed work, preferences).
- **`ui/`**: Shared presentation pieces: header brand mark and styled modal alerts, confirms, and email prompts (replacing `alert` / `confirm`).

## features

Logic tests.