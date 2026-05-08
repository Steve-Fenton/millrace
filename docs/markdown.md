# Card description markdown

Card descriptions support a small, safe markdown subset intended to keep content readable without full markdown complexity.

## Supported block formatting

- Headings: `#`, `##`, `###`
- Unordered lists: `- item` or `* item`
- Ordered lists: `1. item`
- Nested lists: indent list items by 2+ spaces under a parent item
- Paragraphs: plain text lines

## Supported inline formatting

- Bold: `**bold**`
- Italic: `*italic*`
- Links: `[label](https://example.com)`

Only `http://` and `https://` links are rendered as clickable links.

## Notes

- Raw HTML is not rendered.
- Empty lines split paragraphs and lists.
- Unsupported syntax is shown as plain text.

Example nested list:

1. Item
   - Sub item
2. Item
