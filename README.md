# Link Collector

Link Collector is an Obsidian plugin that keeps frontmatter properties in sync with links found in the body of a note.

## Usage

1. Enable the plugin.
2. Open **Settings -> Link Collector**.
3. Add one rule per property you want to manage.

Each rule has:

- Property: the frontmatter property to update, such as `jira`.
- Matcher: a case-insensitive wildcard matcher, such as `arm.jira.com` or `*youtube*`.
- Save mode: save the first matching link as plain text, or all matching links as a list.

The plugin syncs after paste events and when Markdown files are modified. You can also run **Sync links in current note** from the command palette.

When no matching links remain for a managed property, Link Collector removes that property. Other frontmatter properties are left unchanged.

## Development

Install dependencies:

```bash
npm install
```

Start the development build:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```
