# Quick start

To use Millrace, follow these steps. It will set up your project and make it automatically run when you start your machine, so you can always open your Millrace instance in a browser and do your work.

## 1. Create a repo

Create an empty git repository to store your work.

## 2. Add a package file

Add a `package.json` file. You can use this example.

```json
{
  "name": "your-kanban-app",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "pnpm exec millrace",
    "cycle": "pm2 restart millrace"
  },
  "dependencies": {
    "millrace": "^0.0.44"
  }
}
```

You can choose your own port by adding it to the `start` command, i.e.: `pnpm exec millrace 8080`.

## 3. Get ready

Run the following scripts.

Install dependencies:

```bash
pnpm install
```

Install PM2 globally:

```bash
pnpm add -g pm2
```

Spin it up for the first time:

```bash
pnpm start
```

Then set to it to auto-start:

```bash
pnpm cycle
```

## Go

Open `http://localhost:8888` and use your app.

If you changed the port number in step 2, adjust the URL accordingly.

The first time you open Millrace, you'll see a default board.

Head back to the [docs](../index.md) for more information on using Millrace.

Suggested first steps:

1. Visit the admin screen to update board users and customize your board
1. Visit the preferences page to update settings
1. Start adding tasks to your board!

## PM2 tips

Check your setup with:

```bash
pm2 status
```

Example output from the `status` command:

| id | name            | mode | ↺ | status | cpu | memory |
| -- | --------------- | ---- | - | ------ | --- | ------ |
| 0  | millrace-fenton | fork | 0 | online | 0%  | 69.6mb |

### Restarting the PM2 Millrace service

If you update Millrace and want to restart it to get the latest changes, you can run:

```bash
pm2 restart millrace-devrel
```

You'll see the same output as for the `status` command showing the service running (with 0 uptime as it just restarted).

| id | name            | mode | ↺ | status | cpu | memory |
| -- | --------------- | ---- | - | ------ | --- | ------ |
| 0  | millrace-fenton | fork | 0 | online | 0%  | 69.6mb |

### Removing auto-start

Remove the init script:

```bash
pm2 unstartup launchd
```
