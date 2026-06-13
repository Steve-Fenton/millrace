# Boards

The **Boards** view lists your boards and lets you manage them. You can add new boards, or edit existing boards from this view.

![Screenshot: The boards view](../screenshots/demo-admin-full.png)

- **Edit** boards by using the edit button
- **Rename** boards using the rename button
- **Add** boards by entering a name and selecting **Add board**

The **Current** board indicates your local selected project.

## Rename a board

**Rename** updates the board display name, slug, config file (`{slug}.ini`), and `tasks/{slug}/` folder to match. Use **Edit** to change columns and swimlanes without changing the slug.

## Customizing boards

When you **Edit** a board you can customize columns, swimlanes, and **board access**. The **Git history** button in the editor shows commits for the board definition file.

Each column has a **type** (Options, To do, In progress, Waiting, Done). Exactly one column must be type **Done**; this drives the Done column on the board and completion analytics. You can set an optional **WIP limit** per column.

**Board access** — tick [Millrace users](../users/index.md) to grant access to the board. Users with access power the owner filter and owner picker when creating or editing cards. Inactive Millrace users stay in the catalog but are hidden from pickers until you reactivate them on the Users page.

![Screenshot: Editing boards](../screenshots/demo-admin-edit-board-dialog.png)

> [!Tip]
> When you rename a column or swimlane, current cards will be automatically updated with the change. Cards in the archive and cold storage aren't updated, but they are not shown on boards, only the completed view.

> [!WARNING]
> When you delete a column or swimlane, cards will be moved to the first column / first swimlane on your board. This prevents them going missing.

### Delete a board

**Delete** (in the board editor) removes the board from the catalog and deletes its config file. Task cards under `tasks/{slug}/` remain on disk; remove that folder manually if you no longer need them.

[← Millrace documentation](../index.md)

## Aggregate boards

Aggregate boards don't have tasks, but instead show tasks from one or more other boards. They can be a useful way to track work across multiple boards.

To create an **aggregate board**, tick **Aggregate board** before you add it. Open it with **Edit** and choose which boards to include, then **Save**. At least one source board is required before the aggregate board is useful.

For an **aggregate board**, the editor is different:

- **Source boards** — tick one or more normal boards whose tasks should appear on the aggregate view. Aggregate boards cannot include other aggregate boards, or themselves.
- **Columns** — fixed to the five standard workflow types (Options, To do, In progress, Waiting, Done). You cannot rename or reorder them; cards from each source board are placed by matching column **type**, not column title.
- **Swimlanes** — not configured here. Each selected source board appears as its own swimlane on the aggregate view (using that board's display name).
- **No task folder** — aggregate boards do not create `tasks/{slug}/`. Cards stay on their source boards.
