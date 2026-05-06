import { openGitConflictResolutionScreen } from "./gitConflictScreen.js";
import { showFlowAlert } from "./ui/showMessage.js";
import { gitSyncRequest } from "./client.js";

const MAX_SYNC_ROUNDS = 12;

/**
 * Pull (with autostash when supported), resolve merge conflicts in the UI when needed,
 * commit pending changes under `tasks/`, push, and clear the server pending-sync flag.
 */
export async function runGitSyncWithConflictFlow() {
  /** @type {{ path: string, content: string }[] | undefined} */
  let conflictResolutions;
  for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
    const data = await gitSyncRequest(
      conflictResolutions?.length
        ? { conflictResolutions }
        : {}
    );
    if (data.needConflictResolution) {
      if (!data.files?.length) {
        throw new Error(
          "Merge conflicts were reported but no conflicted files were returned."
        );
      }
      const resolved = await openGitConflictResolutionScreen(data.files);
      if (!resolved) {
        throw new Error("Sync cancelled — merge conflicts were not resolved.");
      }
      conflictResolutions = resolved;
      continue;
    }
    if (!data.ok) {
      const msg =
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "Sync failed.";
      throw new Error(msg);
    }
    return data;
  }
  await showFlowAlert(
    "Too many conflict resolution rounds. Fix the remaining conflicts with Git on the command line, then try Sync again.",
    { title: "Sync stopped" }
  );
  throw new Error("Too many conflict resolution rounds.");
}
