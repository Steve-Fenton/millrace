#!/usr/bin/env node
/**
 * Serves the Millrace UI and writes task INIs + tasks/localuser.ini under this repo
 * ([user] default owner, [flow] machine-local timestamps, etc.).
 */

export { app, millraceIntegrationStartup } from "./server/createApp.js";
export { setMillraceDataRootForTesting } from "./server/dataRoot.js";

import { startMillraceServerIfPrimary } from "./server/cli.js";

startMillraceServerIfPrimary();
