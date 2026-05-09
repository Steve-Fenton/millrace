import {
  clearDataRootPendingSync,
  pendingSyncFromSections,
  readLocalUserIniSections,
  syncModeFromPreferencesSection,
  writeLocalUserIniSections,
} from "../localUserIni.js";

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
    });
  } catch {
    res.json({
      owner: "",
      mine: "",
      chartsGranularity: "",
      pendingSync: false,
      syncMode: "automatic",
    });
  }
});

app.get("/api/local-user/preferences", async (_req, res) => {
  try {
    const sections = await readLocalUserIniSections();
    const ownerRaw = sections.user?.owner ?? sections.local?.owner ?? "";
    const mineRaw = sections.user?.mine ?? sections.user?.Mine ?? "";
    res.json({
      syncMode: syncModeFromPreferencesSection(sections.preferences ?? {}),
      mine: String(mineRaw).trim(),
      owner: String(ownerRaw).trim(),
    });
  } catch {
    res.json({ syncMode: "automatic", mine: "", owner: "" });
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

    if (
      chartsRaw === undefined &&
      mineRaw === undefined &&
      syncRaw === undefined
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with chartsGranularity (weekly or monthly), mine (email), and/or syncMode (automatic or manual).",
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

    if (
      syncRaw === undefined &&
      mineRaw === undefined &&
      ownerRaw === undefined
    ) {
      res.status(400).json({
        message:
          "Expected JSON body with syncMode (automatic or manual), mine (email), and/or owner (email).",
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

    await writeLocalUserIniSections(sections);

    const out = await readLocalUserIniSections();
    const ownerOut = String(out.user?.owner ?? out.local?.owner ?? "").trim();
    const mineOut = String(out.user?.mine ?? out.user?.Mine ?? "").trim();

    res.json({
      ok: true,
      syncMode: syncModeFromPreferencesSection(out.preferences ?? {}),
      mine: mineOut,
      owner: ownerOut,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update localuser.ini." });
  }
});
}
