import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAggregateBoardIniText } from "../../server/board/catalog.js";

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

export const CATALOG_AGGREGATE = `[millrace]
boards = test.ini, other.ini, all.ini
`;

export function boardIniTestTypedForAggregate() {
  return `[board]
name = Test Board
slug = test

[columns.1]
title = To Do
type = to_do

[columns.2]
title = Done
type = done
`;
}

export function boardIniOtherTypedForAggregate() {
  return `[board]
name = Other Board
slug = other

[columns.1]
title = Doing
type = in_progress

[columns.2]
title = Done
type = done
`;
}

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

/** Same as {@link boardIniTest} with two swimlanes (for legacy swimlane filter tests). */
export function boardIniTestWithSwimlanes() {
  return `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do

[columns.2]
title = Done
is_done = true

[swimlanes.1]
title = Alpha

[swimlanes.2]
title = Beta
`;
}

/** Three workflow columns (middle is non-done) for rename regression tests. */
export function boardIniTestThreeColumns() {
  return `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do

[columns.2]
title = In Progress

[columns.3]
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
note = Fixture note line
column = To Do
sort_order = 10
created = 2024-01-01T00:00:00.000Z
`;
}

/** Card in the middle column ("In Progress") on {@link boardIniTestThreeColumns}. */
export function cardIniInProgressColumnFixture() {
  return `[item]
id = FLOW-in-progress-1
title = Middle Column Card
description =
owner =
column = In Progress
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
  const now = Date.now();
  // Closed "now" so the card always matches when=this_week (UTC Mon–Sun), including Mondays
  // when a fixed offset like "2 days ago" would fall in the previous week.
  const closed = new Date(now).toISOString();
  const created = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
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
    case "with-in-progress-card": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_ONE_BOARD,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTestThreeColumns(),
        "utf8"
      );
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-in-progress.ini"),
        cardIniInProgressColumnFixture(),
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
    case "aggregate-board": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_AGGREGATE,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTestTypedForAggregate(),
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "other.ini"),
        boardIniOtherTypedForAggregate(),
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "all.ini"),
        defaultAggregateBoardIniText("All Work", "all", ["test", "other"]),
        "utf8"
      );
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.mkdir(path.join(tasksRoot, "other"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-agg-todo.ini"),
        `[item]
id = FLOW-agg-todo
title = Todo On Test
column = To Do
sort_order = 10
created = 2024-01-01T00:00:00.000Z
`,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "other", "FLOW-agg-doing.ini"),
        `[item]
id = FLOW-agg-doing
title = Doing On Other
column = Doing
sort_order = 10
created = 2024-01-02T00:00:00.000Z
`,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-agg-done.ini"),
        `[item]
id = FLOW-agg-done
title = Done On Test
column = Done
closed = ${new Date().toISOString()}
sort_order = 10
created = 2024-01-01T00:00:00.000Z
`,
        "utf8"
      );
      break;
    }
    case "charts": {
      await writeMillraceProfile("flow-board", dataRoot);
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTestWithSwimlanes(),
        "utf8"
      );
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-chart-done.ini"),
        cardIniDoneWithClosed(),
        "utf8"
      );
      const openCreated = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ).toISOString();
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-chart-open-a.ini"),
        `[item]
id = FLOW-chart-open-a
title = Chart Open Alpha
column = To Do
swimlane = Alpha
created = ${openCreated}
`,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-chart-open-b.ini"),
        `[item]
id = FLOW-chart-open-b
title = Chart Open Beta
column = To Do
swimlane = Beta
created = ${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}
`,
        "utf8"
      );
      break;
    }
    case "with-board-users": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_ONE_BOARD,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        `[board]
name = Integration Test Board
slug = test

[columns.1]
title = To Do

[columns.2]
title = Done
is_done = true

[users]
active = active@example.com
`,
        "utf8"
      );
      break;
    }
    case "with-legacy-column-card": {
      await writeMillraceProfile("flow-board", dataRoot);
      const legacyDir = path.join(tasksRoot, "test", "columns.1");
      await fs.mkdir(legacyDir, { recursive: true });
      await fs.writeFile(
        path.join(legacyDir, "FLOW-legacy-1.ini"),
        cardIniOpenFixture().replace(
          "id = FLOW-fix-open-1",
          "id = FLOW-legacy-1"
        ),
        "utf8"
      );
      break;
    }
    case "with-archive-card": {
      await writeMillraceProfile("flow-board", dataRoot);
      const archiveDir = path.join(tasksRoot, "test", "archive");
      await fs.mkdir(archiveDir, { recursive: true });
      const created = new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000
      ).toISOString();
      const closed = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      await fs.writeFile(
        path.join(archiveDir, "FLOW-archive-1.ini"),
        `[item]
id = FLOW-archive-1
title = Archived Card
description =
owner = archive@example.com
column = Done
sort_order = 10
created = ${created}
closed = ${closed}
`,
        "utf8"
      );
      break;
    }
    case "with-archive-legacy-swimlane": {
      await fs.writeFile(
        path.join(tasksRoot, ".millrace.ini"),
        CATALOG_ONE_BOARD,
        "utf8"
      );
      await fs.writeFile(
        path.join(tasksRoot, "test.ini"),
        boardIniTestWithSwimlanes(),
        "utf8"
      );
      const archiveDir = path.join(tasksRoot, "test", "archive");
      await fs.mkdir(archiveDir, { recursive: true });
      const created = new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000
      ).toISOString();
      const closed = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      await fs.writeFile(
        path.join(archiveDir, "FLOW-archive-legacy.ini"),
        `[item]
id = FLOW-archive-legacy
title = Archived Legacy Lane Card
description =
owner = archive@example.com
column = Done
swimlane = Gamma Lane
sort_order = 10
created = ${created}
closed = ${closed}
`,
        "utf8"
      );
      break;
    }
    case "with-cold-storage-card": {
      await writeMillraceProfile("flow-board", dataRoot);
      const coldDir = path.join(
        tasksRoot,
        "test",
        "cold-storage",
        "2022"
      );
      await fs.mkdir(coldDir, { recursive: true });
      await fs.writeFile(
        path.join(coldDir, "FLOW-cold-1.ini"),
        `[item]
id = FLOW-cold-1
title = Cold Storage Card
description =
owner =
column = Done
sort_order = 10
created = 2022-01-01T00:00:00.000Z
closed = 2022-01-05T00:00:00.000Z
`,
        "utf8"
      );
      break;
    }
    case "with-search-all-extras": {
      await writeMillraceProfile("flow-board", dataRoot);
      await fs.mkdir(path.join(tasksRoot, "test"), { recursive: true });
      await fs.writeFile(
        path.join(tasksRoot, "test", "FLOW-inflight-1.ini"),
        `[item]
id = FLOW-inflight-1
title = In-flight Card
description =
owner =
column = To Do
sort_order = 10
created = 2024-06-01T00:00:00.000Z
`,
        "utf8"
      );
      const abandonedDir = path.join(tasksRoot, "test", "abandoned", "2024");
      await fs.mkdir(abandonedDir, { recursive: true });
      await fs.writeFile(
        path.join(abandonedDir, "FLOW-abandoned-1.ini"),
        `[item]
id = FLOW-abandoned-1
title = Abandoned Card
description =
owner =
column = To Do
sort_order = 10
created = 2024-05-01T00:00:00.000Z
`,
        "utf8"
      );
      const coldDir = path.join(
        tasksRoot,
        "test",
        "cold-storage",
        "2022"
      );
      await fs.mkdir(coldDir, { recursive: true });
      await fs.writeFile(
        path.join(coldDir, "FLOW-cold-1.ini"),
        `[item]
id = FLOW-cold-1
title = Cold Storage Card
description =
owner =
column = Done
sort_order = 10
created = 2022-01-01T00:00:00.000Z
closed = 2022-01-05T00:00:00.000Z
`,
        "utf8"
      );
      break;
    }
    default:
      throw new Error(`Unknown Millrace test profile: ${profile}`);
  }
}
