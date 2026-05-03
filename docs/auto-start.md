# Auto starting Millrace

First, install PM2 globally:

```bash
pnpm add -g pm2
```

Update your `package.json` file to give your specific Millrace app a name, for example:

```json
{
  "name": "millrace-fenton",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "pnpm exec millrace"
  },
  "dependencies": {
    "millrace": "^0.0.7"
  }
}
```

Then run the app using PM2

```bash
pm2 start pnpm --name millrace-fenton -- start
```

Save the process list:

```bash
pm2 save
```

Register PM2 to run at login:

```bash
pm2 startup
```

PM2 will give you a command to configure the startup script, which differs based on your environment (so don't copy this example):

```bash
sudo env PATH=$PATH:/opt/homebrew/bin pm2 startup launchd -u yourname --hp /Users/yourname
```

Check the setup with:

```bash
pm2 status
```

Example output from the `status` command:

| id | name            | mode | ↺ | status | cpu | memory |
| -- | --------------- | ---- | - | ------ | --- | ------ |
| 0  | millrace-fenton | fork | 0 | online | 0%  | 69.6mb |

## Restarting the PM2 Millrace service

If you update Millrace and want to restart it to get the latest changes, you can run:

```bash
pm2 restart millrace-devrel
```

You'll see the same output as for the `status` command showing the service running (with 0 uptime as it just restarted).

## Removing auto-start

Remove the init script:

```bash
pm2 unstartup launchd
```
