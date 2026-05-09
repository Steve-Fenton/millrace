# Board

The **Board** view is the main Kanban workspace. Each board is divided in to columns and swimlanes, with <abbr title="Work In Process">WIP</abbr> limits shown and highlighted when they are exceeded.

![Screenshot: The board view](../screenshots/demo-board-full.png)

Task cards are arranged on the board and you can drag and drop them to a new location. You can also click a card to open a navigation control that lets you movee the card.

![Screenshot: Card navigation controls](../screenshots/demo-card-move-icons.png)

## Edit task cards

When you hover over a card, you can select the **Edit** icon to opent the card editor. From here you can update you task information, add links.

Card descriptions support limited **Markdown** (see [supported markdown](../markdown.md)).

![Screenshot: Card editor](../screenshots/demo-edit-card-dialog.png)

You'll notice several icons on the card editor.

Along the top:

- **Duplicate**: Creates a copy of the card
- **History**: Shows changes made to the card

Along the bottom:

- **Delete**: Deletes the card (after double-checking with you) 

## Version control sync

The **Sync** button will pulse when you have local changes.

If your board is set to auto-sync, changes to task cards will be automatically committed and pushed after 5 seconds of inactivity.

If you have chosen to manually sync, press the **Sync** button to share your changes.

> [!TIP]
> If you have any merge conflicts, you'll be taken to a resolution view that will help you resolve them. If you are using auto-sync, this will rarely happen. Work in small batches. Sync often.

[← Millrace documentation](../index.md)
