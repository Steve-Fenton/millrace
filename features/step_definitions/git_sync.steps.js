import { appendFile } from "node:fs/promises";
import path from "node:path";
import { Given, When } from "@cucumber/cucumber";
import { startMillraceForProfileWithGitRemote } from "../support/millrace_test_harness.js";

Given(
  "the Millrace integration server has profile {string} with a git remote",
  async function (profile) {
    await startMillraceForProfileWithGitRemote(this, profile);
  }
);

When(
  "I write extra content to the {string} board INI in the clone",
  async function (boardSlug) {
    const file = path.join(
      this.millraceCloneRoot,
      "tasks",
      `${boardSlug}.ini`
    );
    await appendFile(file, "\n; pending sync update\n", "utf8");
  }
);
