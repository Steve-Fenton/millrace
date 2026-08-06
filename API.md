# API endpoints

Handlers live under `server/routes/` (card handlers under `server/routes/card/`). Card identity is the INI **filename** (for example `FLOW-….ini`), not a separate numeric id.

## Board catalog

`/api/flow`

### `GET` catalog

Board catalog from `tasks/.millrace.ini`. No query parameters or body.

## Millrace users

`/api/millrace-users`

### `GET` millrace users

Repo-wide Millrace users. No query parameters or body.

### `PATCH` millrace users

Replace the Millrace users list.

**Body (JSON):** `{ "users": [ … ] }` — `users` is required and must be an array of user objects (email, display name, active, optional admin).

## Package update check

`/api/npm-update-check`

### `GET` package update check

Check whether a newer `millrace` package is available. No query parameters or body.

## Package update cycle

`/api/npm-update-run-cycle`

### `POST` package update cycle

Install/update Millrace and run the project cycle.

**Body (JSON):** either `{ "mode": "install-sync" }`, or `{ "latestVersion": "<semver>" }` (`latest_version` also accepted). One of these shapes is required.

## Board

`/api/board`

### `GET` board

Load a board definition.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |

### `POST` board

Create a board.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Display name (must be unique in the catalog) |
| `kind` | no | Use `aggregate` for an aggregate board |
| `sources` | no | Array of source board slugs (aggregate boards) |

## Board rename

`/api/board/rename`

### `POST` board rename

Rename a board’s display name.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `name` | yes | New display name |

## Board definition

`/api/board-definition`

### `PUT` board definition

Save board definition INI text.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `text` | yes | Full board INI contents |
| `boardSlug` | no | Defaults to `board`; must match `[board]` slug in `text` |

### `DELETE` board definition

Delete a board definition (refuses if it is the only catalog board).

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |

## Board definition history

`/api/board-definition/git-history`

### `GET` board definition history

Git history for a board definition INI.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `limit` | no | Default `40`, max `100` |

## Cards from a column

`/api/column-cards`

Also available as `/api/tasks/:boardSlug/columns/:columnIndex/cards` (board and column in the path instead of query parameters).

### `GET` column cards

| Query | Required | Notes |
| --- | --- | --- |
| `columnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` |

### `GET` column cards (path)

| Path param | Required | Notes |
| --- | --- | --- |
| `boardSlug` | yes | Board slug |
| `columnIndex` | yes | Integer ≥ 1 |

## Completed cards

`/api/completed-cards`

### `GET` completed cards

Paginated completed / archive cards (optional cold-storage search).

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `page` | no | Default `1` |
| `limit` | no | Default `50`, max `100` |
| `of` | no | `all` (default), `mine`, or `owner` |
| `me` | no | Email when `of=mine` |
| `pick` | no | Email when `of=owner` |
| `q` | no | Search string |
| `lane` | no | Swimlane filter |
| `when` | no | `this_week`, `last_week`, `this_month`, `last_month`, or omit for all |
| `deep` / `searchAll` / `includeCold` | no | Truthy values include cold storage |

## Completion buckets

`/api/completion-buckets`

### `GET` completion buckets

Completions over time (charts).

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `granularity` | no | `daily`, `weekly` (default), or `monthly` |

## Completions by swimlane

`/api/completion-swimlane-stack`

### `GET` completions by swimlane

Completions stacked by swimlane.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `granularity` | no | `daily`, `weekly` (default), or `monthly` |

## Cycle time

`/api/cycle-time-scatter`

### `GET` cycle time

Cycle-time scatter data.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `granularity` | no | `daily`, `weekly` (default), or `monthly` |

## Open cards by column and swimlane

`/api/column-swimlane-stack`

### `GET` open cards by column and swimlane

Open cards per column, counts stacked by swimlane.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |

## Cumulative flow

`/api/cumulative-flow-stack`

### `GET` cumulative flow

Cumulative-flow chart from column snapshots.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |
| `granularity` | no | `daily`, `weekly` (default), or `monthly` |

## Card age distribution

`/api/card-age-distribution`

### `GET` card age distribution

Histogram of open-card age.

| Query | Required | Notes |
| --- | --- | --- |
| `boardSlug` | no | Defaults to `board` |

## Card

`/api/card`

### `GET` card

Read one card INI.

| Query | Required | Notes |
| --- | --- | --- |
| `filename` | yes | Card file name (the card id), e.g. `FLOW-….ini` |
| `columnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` |

### `PUT` card

Update a card.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `filename` | yes | Card file name |
| `columnIndex` | yes | Integer ≥ 1 |
| `title` | yes | Non-empty title |
| `boardSlug` | no | Defaults to `board` |
| `description` | no | Card description |
| `owner` | no | Owner email |
| `note` | no | Single-line note; omit to leave unchanged; empty clears |
| `strategic` | no | Truthy sets strategic; present-and-falsy clears |
| `nextActionDate` | no | ISO date string; empty clears |
| `links` | no | Array of link objects; omit to keep existing |

### `DELETE` card

Abandon a card (moves it under `abandoned/`).

| Query | Required | Notes |
| --- | --- | --- |
| `filename` | yes | Card file name |
| `columnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` |

## Card history

`/api/card/git-history`

### `GET` card history

Git history for one card INI.

| Query | Required | Notes |
| --- | --- | --- |
| `filename` | yes | Card file name |
| `columnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` |
| `limit` | no | Default `40`, max `100` |

## Create a card

`/api/cards`

### `POST` create card

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Non-empty title |
| `columnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` (aggregate boards rejected) |
| `swimlaneIndex` | no | Lane index ≥ 1 |
| `description` | no | Card description |
| `note` | no | Single-line note |
| `owner` | no | Owner email |
| `strategic` | no | Boolean |
| `nextActionDate` | no | ISO date string |
| `links` | no | Array of link objects |

## Move a card

`/api/cards/move`

### `POST` move card

Move a card between columns and/or update its swimlane.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `filename` | yes | Card file name |
| `fromColumnIndex` | yes | Integer ≥ 1 |
| `toColumnIndex` | yes | Integer ≥ 1 |
| `boardSlug` | no | Defaults to `board` |
| `swimlaneIndex` | no | Lane index; `0` omits swimlane in the INI |

## Reorder cards

`/api/cards/reorder`

### `POST` reorder cards

Reorder cards within one column + swimlane (`sort_order` in each INI).

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `columnIndex` | yes | Integer ≥ 1 |
| `filenames` | yes | Non-empty array: every card in that column/swimlane, exactly once |
| `boardSlug` | no | Defaults to `board` |
| `swimlaneIndex` | no | Lane index |

## Git status

`/api/git/status`

### `GET` git status

Whether the data root is a Git repo. No query parameters or body.

## Git sync

`/api/git/sync`

### `POST` git sync

Pull (with autostash when supported), optional conflict resolution, commit outstanding `tasks/` changes, and push.

**Body (JSON):** optional. `{ "conflictResolutions": [ { "path", "content" }, … ] }` supplies resolved file contents when a merge conflict is present.

## Local user

`/api/local-user`

### `GET` local user

Machine-local owner / Mine / charts / swimlane-collapse settings from `tasks/localuser.ini`. No query parameters or body.

### `PATCH` local user

Update local user settings. At least one of the fields below is required.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `chartsGranularity` | no | `weekly` or `monthly` |
| `mine` | no | Email; empty string clears |
| `syncMode` | no | `automatic` or `manual` |
| `swimlaneCollapse` | no | `{ boardSlug, laneIndex, mode }` |

## Local user preferences

`/api/local-user/preferences`

### `GET` local user preferences

Theme, sync mode, Mine/owner, and last auto-check timestamps. No query parameters or body.

### `PATCH` local user preferences

Update local preferences. At least one of the fields below is required.

**Body (JSON):**

| Field | Required | Notes |
| --- | --- | --- |
| `syncMode` | no | `automatic` or `manual` |
| `theme` | no | `dark` or `light` |
| `mine` | no | Email; empty string clears |
| `owner` | no | Email; empty string clears |
| `clearLastAutoGitPull` | no | `true` clears the timestamp |
| `clearLastNpmUpdateCheck` | no | `true` clears the timestamp |
