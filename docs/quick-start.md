# Quick start

To use Millrace, follow these steps.

- Install (with pnpm or npm)
- Add one `.gitignore` rule for `tasks/localuser.ini`

### pnpm

From your project root:

```bash
pnpm add millrace
```

Run the server with **`pnpm exec millrace`** (optionally pass a port: **`pnpm exec millrace 8888`**), or add a script to your **`package.json`** (for example **`"start": "millrace"`**) and run **`pnpm start`**.

### npm

From your project root:

```bash
npm install millrace
```

Run with **`npx millrace`** (or **`npx millrace 8888`** for a port), or add a **`package.json`** script such as **`"start": "millrace"`** and run **`npm run start`**.

### Ignore `tasks/localuser.ini` in Git

Millrace may create **`tasks/localuser.ini`** to store the default owner on this machine (used for new cards and filters). That file is machine-specific, so add it to **`.gitignore`** in the repo where you keep **`tasks/`**:

```gitignore
tasks/localuser.ini
```