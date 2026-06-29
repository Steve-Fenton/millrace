# Card description markdown

Card descriptions support a small, safe markdown subset intended to keep content readable without full markdown complexity.

## Supported block formatting

- Headings: `#`, `##`, `###`
- Unordered lists: `- item` or `* item`
- Checkbox lists: `- [ ]` pending, `- [x]` or `- [X]` done
- Ordered lists: `1. item`
- Nested lists: indent list items by 2+ spaces under a parent item
- Fenced code blocks: lines between opening and closing ` ``` ` (optional language tag on the opening line)
- Tables: GFM pipe tables (header row, `| --- |` separator row, then body rows)
- Paragraphs: plain text lines

## Supported inline formatting

- Bold: `**bold**`
- Italic: `*italic*`
- Strikethrough: `~~crossed out~~`
- Inline code: `` `code` ``
- Links: `[label](https://example.com)`

Only `http://` and `https://` links are rendered as clickable links.

## Notes

- Raw HTML is not rendered.
- Empty lines split paragraphs and lists.
- Unsupported syntax is shown as plain text.
- In the card editor’s **Preview** tab, task checkboxes update the description text (`[ ]` ↔ `[x]`).

Example nested list:

1. Item
   - Sub item
2. Item

Example table:

```markdown
| Task | Owner | Status |
| ---- | ----- | ------ |
| Wire API | Alex | Done |
| Update docs | Sam | In progress |
```

Column alignment follows the separator row (`:---` left, `:---:` center, `---:` right).
