import {
  clearDataRootPendingSync,
  pendingSyncFromSections,
  readLocalUserIniSections,
  syncModeFromPreferencesSection,
  writeLocalUserIniSections,
} from "../localUserIni.js";
import {
  applySwimlaneCollapseUpdate,
  normalizeSwimlaneCollapseMode,
  readSwimlaneCollapseStates,
  SWIMLANE_COLLAPSE_MODES,
} from "../../assets/js/ui/swimlaneCollapse.js";

/** @param {import("express").Application} app */
export function registerLocalUserRoutes(app) {
app.get("/api/local-user", async (_req, res) => {
  try {
    const sections = await readLocalUserIniSections();
    const raw = sections.user?.owner ?? sections.local?.owner ?? "";
    const cg = String(
      sections.flow?.charts_granularity ??
        sections.flow?.chartsGranularity ??
        ""
    )
      .trim()
      .toLowerCase();
    const chartsGranularity =
      cg === "monthly" || cg === "weekly" ? cg : "";
    const mineRaw = sections.user?.mine ?? sections.user?.Mine ?? "";
    res.json({
      owner: String(raw).trim(),
      mine: String(mineRaw).trim(),
      chartsGranularity,
      pendingSync: pendingSyncFromSections(sections),
      syncMode: syncModeFromPreferencesSection(sections.preferences ?? {}),
      swimlaneCollapse: readSwimlaneCollapseStates(sections),
    });
  } catch {
    res.json({
      owner: "",
      mine: "",
      chartsGranularity: "",
      pendingSync: false,
      syncMode: "automatic",
      swimlaneCollapse: {},
    });
  }
});

app.get("/api/local-user/preferences", async (_req, res) => {
  try {
    const sections = await readLocalUserIniSections();
    const ownerRaw = sections.user?.owner ?? sections.local?.owner ?? "";
    const mineRaw = sections.user?.mine ?? sections.user?.Mine ?? "";
    const flow = sections.flow ?? {};
    const lastAutoGitPull = String(
      flow.last_auto_git_pull ?? flow.lastAutoGitPull ?? ""
    ).trim();
    const lastNpmUpdateCheck = String(
      flow.last_npm_update_check ?? flow.lastNpmUpdateCheck ?? ""
    ).trim();
    res.json({
      syncMode: syncModeFromPreferencesSection(sections.preferences ?? {}),
      mine: String(mineRaw).trim(),
      owner: String(ownerRaw).trim(),
      lastAutoGitPull,
      lastNpmUpdateCheck,
    });
  } catch {
    res.json({
      syncMode: "automatic",
      mine: "",
      owner: "",
      lastAutoGitPull: "",
      lastNpmUpdateCheck: "",
    });
  }
});

/**
 * Merge into `tasks/localuser.ini`: optional `chartsGranularity` ([flow]),
 * optional `mine` ([user] mine, empty string clears),
 * optional `syncMode` ([preferences] sync_mode).
 */
app.patch("/api/local-user", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const chartsRaw =
      body.chartsGranularity ?? body.charts_granularity ?? undefined;
    const mineRaw = body.mine !== undefined ? body.mine : undefined;
    const syncRaw =
      body.syncMode !== undefined
        ? body.syncMode
        : body.sync_mode !== undefined
          ? body.sync_mode
          : undefined;
    const swimlaneRaw =
      body.swimlaneCollapse !== undefined
        ? body.swimlaneCollapse
        : body.swimlane_collapse !== undefined
          ? body.swimlane_collapse
          : undefined;

    if (
      chartsRaw === undefined &&
      mineRaw === undefined &&
      syncRaw === undefined &&
      swimlaneRaw === undefined
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with chartsGranularity (weekly or monthly), mine (email), syncMode (automatic or manual), and/or swimlaneCollapse { boardSlug, laneIndex, mode }.",
      });
      return;
    }

    const sections = await readLocalUserIniSections();
    sections.user = sections.user ?? {};
    sections.flow = sections.flow ?? {};

    if (syncRaw !== undefined) {
      const sm = String(syncRaw).trim().toLowerCase();
      if (sm !== "automatic" && sm !== "manual") {
        res.status(400).json({
          message: "syncMode must be automatic or manual.",
        });
        return;
      }
      sections.preferences = sections.preferences ?? {};
      sections.preferences.sync_mode = sm;
      delete sections.preferences.syncMode;
    }

    if (chartsRaw !== undefined) {
      const v = String(chartsRaw).trim().toLowerCase();
      if (v !== "weekly" && v !== "monthly") {
        res.status(400).json({
          message: "chartsGranularity must be weekly or monthly.",
        });
        return;
      }
      delete sections.flow.chartsGranularity;
      sections.flow.charts_granularity = v;
    }

    if (mineRaw !== undefined) {
      const mine = String(mineRaw).trim();
      if (mine && !mine.includes("@")) {
        res.status(400).json({
          message: "mine must look like an email address.",
        });
        return;
      }
      const line = mine.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.mine;
        delete sections.user.Mine;
      } else {
        sections.user.mine = line;
        delete sections.user.Mine;
      }
    }

    if (swimlaneRaw !== undefined) {
      const slugRaw =
        swimlaneRaw && typeof swimlaneRaw === "object"
          ? swimlaneRaw.boardSlug ?? swimlaneRaw.board_slug
          : undefined;
      const laneRaw =
        swimlaneRaw && typeof swimlaneRaw === "object"
          ? swimlaneRaw.laneIndex ?? swimlaneRaw.lane_index
          : undefined;
      const modeRaw =
        swimlaneRaw && typeof swimlaneRaw === "object"
          ? swimlaneRaw.mode
          : undefined;

      const slug = String(slugRaw ?? "").trim();
      if (!slug || !/^[a-zA-Z0-9._-]+$/.test(slug)) {
        res.status(400).json({
          message:
            "swimlaneCollapse.boardSlug must be a non-empty board slug.",
        });
        return;
      }
      const laneIdx = Number(laneRaw);
      if (!Number.isInteger(laneIdx) || laneIdx < 0) {
        res.status(400).json({
          message:
            "swimlaneCollapse.laneIndex must be a non-negative integer.",
        });
        return;
      }
      const mode = String(modeRaw ?? "").trim().toLowerCase();
      if (!SWIMLANE_COLLAPSE_MODES.includes(mode)) {
        res.status(400).json({
          message: `swimlaneCollapse.mode must be one of: ${SWIMLANE_COLLAPSE_MODES.join(", ")}.`,
        });
        return;
      }
      applySwimlaneCollapseUpdate(sections, {
        boardSlug: slug,
        laneIndex: laneIdx,
        mode: normalizeSwimlaneCollapseMode(mode),
      });
    }

    await writeLocalUserIniSections(sections);

    const out = await readLocalUserIniSections();
    const owner = String(out.user?.owner ?? out.local?.owner ?? "").trim();
    const mine = String(out.user?.mine ?? out.user?.Mine ?? "").trim();
    const cg = String(
      out.flow?.charts_granularity ?? out.flow?.chartsGranularity ?? ""
    )
      .trim()
      .toLowerCase();
    const chartsGranularity =
      cg === "monthly" || cg === "weekly" ? cg : "";

    res.json({
      ok: true,
      owner,
      mine,
      chartsGranularity,
      pendingSync: pendingSyncFromSections(out),
      syncMode: syncModeFromPreferencesSection(out.preferences ?? {}),
      swimlaneCollapse: readSwimlaneCollapseStates(out),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update localuser.ini." });
  }
});

app.patch("/api/local-user/preferences", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const syncRaw =
      body.syncMode !== undefined
        ? body.syncMode
        : body.sync_mode !== undefined
          ? body.sync_mode
          : undefined;
    const mineRaw = body.mine !== undefined ? body.mine : undefined;
    const ownerRaw = body.owner !== undefined ? body.owner : undefined;
    const clearLastAutoGitPull =
      body.clearLastAutoGitPull === true ||
      body.clear_last_auto_git_pull === true;
    const clearLastNpmUpdateCheck =
      body.clearLastNpmUpdateCheck === true ||
      body.clear_last_npm_update_check === true;

    if (
      syncRaw === undefined &&
      mineRaw === undefined &&
      ownerRaw === undefined &&
      !clearLastAutoGitPull &&
      !clearLastNpmUpdateCheck
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with syncMode (automatic or manual), mine (email), owner (email), clearLastAutoGitPull (true), and/or clearLastNpmUpdateCheck (true).",
      });
      return;
    }

    const sections = await readLocalUserIniSections();
    sections.user = sections.user ?? {};

    if (syncRaw !== undefined) {
      const sm = String(syncRaw).trim().toLowerCase();
      if (sm !== "automatic" && sm !== "manual") {
        res.status(400).json({
          message: "syncMode must be automatic or manual.",
        });
        return;
      }
      sections.preferences = sections.preferences ?? {};
      sections.preferences.sync_mode = sm;
      delete sections.preferences.syncMode;
    }

    if (mineRaw !== undefined) {
      const mine = String(mineRaw).trim();
      if (mine && !mine.includes("@")) {
        res.status(400).json({
          message: "mine must look like an email address.",
        });
        return;
      }
      const line = mine.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.mine;
        delete sections.user.Mine;
      } else {
        sections.user.mine = line;
        delete sections.user.Mine;
      }
    }

    if (ownerRaw !== undefined) {
      const owner = String(ownerRaw).trim();
      if (owner && !owner.includes("@")) {
        res.status(400).json({
          message: "owner must look like an email address.",
        });
        return;
      }
      const line = owner.replace(/\r?\n/g, " ");
      if (!line) {
        delete sections.user.owner;
      } else {
        sections.user.owner = line;
      }
    }

    if (clearLastAutoGitPull || clearLastNpmUpdateCheck) {
      sections.flow = sections.flow ?? {};
      if (clearLastAutoGitPull) {
        delete sections.flow.last_auto_git_pull;
        delete sections.flow.lastAutoGitPull;
      }
      if (clearLastNpmUpdateCheck) {
        delete sections.flow.last_npm_update_check;
        delete sections.flow.lastNpmUpdateCheck;
      }
    }

    await writeLocalUserIniSections(sections);

    const out = await readLocalUserIniSections();
    const ownerOut = String(out.user?.owner ?? out.local?.owner ?? "").trim();
    const mineOut = String(out.user?.mine ?? out.user?.Mine ?? "").trim();
    const flowOut = out.flow ?? {};
    const lastAutoGitPullOut = String(
      flowOut.last_auto_git_pull ?? flowOut.lastAutoGitPull ?? ""
    ).trim();
    const lastNpmUpdateCheckOut = String(
      flowOut.last_npm_update_check ?? flowOut.lastNpmUpdateCheck ?? ""
    ).trim();

    res.json({
      ok: true,
      syncMode: syncModeFromPreferencesSection(out.preferences ?? {}),
      mine: mineOut,
      owner: ownerOut,
      lastAutoGitPull: lastAutoGitPullOut,
      lastNpmUpdateCheck: lastNpmUpdateCheckOut,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update localuser.ini." });
  }
});
}
