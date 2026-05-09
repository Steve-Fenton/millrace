# Quick start

To use Millrace, follow these steps. It will set up your project and make it automatically run when you start you machine, so you can always open your Milrace instance in a browser and do your work.

## 1. Create a repo

Create an empty git repository to store you work.

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
    "cycle": "pm2 restart millrace-devrel"
  },
  "dependencies": {
    "millrace": "^0.0.21"
  }
}
```

You can choose your own port by adding it to the `start` command, i.e.: `pnpm exec millrace 8080`.

## 3. Add an ignore file

Add a `.gitignore` to make sure you don't commit your local settings.

```text
tasks/localuser.ini
```

## 4. Get ready

Run the following scripts.

Install dependencies:

```bash
pnpm install
```

Install PM2 globally:

```bash
pnpm add -g pm2
```

## Go

Open `http://localhost:8888` and use your app.
