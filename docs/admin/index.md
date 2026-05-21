# Admin

The **Admin** view lists your boards and let's you manage them. You can add new boards, or edit existing boards from this view.

![Screenshot: The admin view](../screenshots/demo-admin-full.png)

- **Edit** boards by using the edit icon (shown on hover)
- **Add** boards by entering a name and selecting **Add board**

The **Current** board indicates your local selected project.

## Customizing boards

When you **Edit** a board you can change it's name and customize the columns and swimlanes.

![Screenshot: Editing boards](../screenshots/demo-admin-edit-board-dialog.png)

> [!Tip]
> When you rename a column or swimlane, current cards will be automatically updated with the change. Cards in the archive and cold storage aren't updated, but they are not shown on boards, only the completed view.
> [!WARNING]
> When you delete a column or swimlane, cards will be moved to the first column / first swimlane on your board. This prevents them going missing.

[← Millrace documentation](../index.md)

## Aggregate boards

Aggregate boards don't have tasks, but instead show tasks from one or more other boards. They can be a useful way to track work across multiple boards.

To create an **aggregate board**, tick **Aggregate board** before you add it. Open it with **Edit** and choose which boards to include, then **Save**. At least one source board is required before the aggregate board is useful.

For an **aggregate board**, the editor is different:

- **Source boards** — tick one or more normal boards whose tasks should appear on the aggregate view. Aggregate boards cannot include other aggregate boards, or themselves.
- **Columns** — fixed to the five standard workflow types (Options, To do, In progress, Waiting, Done). You cannot rename or reorder them; cards from each source board are placed by matching column **type**, not column title.
- **Swimlanes** — not configured here. Each selected source board appears as its own swimlane on the aggregate view (using that board's display name).
- **No task folder** — aggregate boards do not create `tasks/{slug}/`. Cards stay on their source boards.
