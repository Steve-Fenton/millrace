import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Matches existing integration tests; cleared before each scenario. */
const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const INTEGRATION_DATA_ROOT = path.resolve(
  FIXTURES_DIR,
  "..",
  "..",
  "tmp",
  "test"
);

export const CATALOG_ONE_BOARD = `[millrace]
boards = test.ini
`;

export const CATALOG_TWO_BOARDS = `[millrace]
boards = test.ini, other.ini
`;

export function boardIniTest() {
  return `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do

[columns.2]
title = Done
is_done = true
`;
}

export function boardIniOther() {
  return `[board]
name = Other Board
slug = other

[columns.1]
title = Backlog

[columns.2]
title = Shipped
is_done = true
`;
}

/** Open card in column 1 (title "To Do"). */
export function cardIniOpenFixture() {
  return `[item]
id = FLOW-fix-open-1
title = Open Fixture Card
description =
owner =
column = To Do
sort_order = 10
created = 2024-01-01T00:00:00.000Z
`;
}

export function cardIniOpenFixtureSecond() {
  return `[item]
id = FLOW-fix-open-2
title = Second Open Card
description =
owner =
column = To Do
sort_order = 20
created = 2024-01-02T00:00:00.000Z
`;
}

/** Completed card on the board (Done column) for charts / completed-cards. */
export function cardIniDoneWithClosed() {
  const closed = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const created = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return `[item]
id = FLOW-fix-done-1
title = Chart Done Card
description =
owner = charts@example.com
column = Done
sort_order = 10
created = ${created}
closed = ${closed}
`;
}

/**
 * @param {string} profile
 * @param {string} [dataRoot]
 */
export async function writeMillraceProfile(profile, dataRoot = INTEGRATION_DATA_ROOT) {
  const tasksRoot = path.join(dataRoot, "tasks");
  await fs.mkdir(tasksRoot, { recursive: true });

  switch (profile) {
    case "flow-board": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_ONE_BOARD,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTest(),
        "utf8"
      );
      break;
    }
    case "with-open-card": {
      await writeMillraceProfile("flow-board", dataRoot);
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-fix-open.ini"),
        cardIniOpenFixture(),
        "utf8"
      );
      break;
    }
    case "two-open-cards": {
      await writeMillraceProfile("flow-board", dataRoot);
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-fix-open.ini"),
        cardIniOpenFixture(),
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-fix-open-2.ini"),
        cardIniOpenFixtureSecond(),
        "utf8"
      );
      break;
    }
    case "two-boards": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_TWO_BOARDS,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTest(),
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "other.ini"),
        boardIniOther(),
        "utf8"
      );
      break;
    }
    case "charts": {
      await writeMillraceProfile("flow-board", dataRoot);
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-chart-done.ini"),
        cardIniDoneWithClosed(),
        "utf8"
      );
      break;
    }
    default:
      throw new Error(`Unknown Millrace test profile: ${profile}`);
  }
}
