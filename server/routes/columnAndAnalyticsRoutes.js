import fs from "fs/promises";
import { boardOwnerEmailsForFilter, parseBoardIni } from "../../assets/js/models/boardModel.js";
import { resolveCardSwimlaneIndex } from "../../assets/js/ini/swimlaneResolve.js";
import {
  aggregateColumnSwimlaneStack,
  aggregateCompletionBuckets,
  aggregateCompletionSwimlaneStack,
  buildCardAgeDistribution,
  buildCycleTimeScatter,
  completedClosedInWhenRange,
  completedRowMatchesSearch,
  gatherCompletedArchiveAndOptionalCold,
  legacySwimlaneFilterCandidates,
  parseCompletedWhenFilter,
  resolveCompletedLaneFilterIndices,
} from "../archiveAnalytics.js";
import { resolveBoardIniPathForSlug, sanitizeSegment } from "../boardCatalog.js";
import { sendColumnCards } from "../columnCards.js";

/** @param {import("express").Application} app */
export function registerColumnAndAnalyticsRoutes(app) {
app.get("/api/column-cards", async (req, res) => {
  const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
  const col = Number(req.query.columnIndex);
  await sendColumnCards(res, slug, col);
});

app.get(
  "/api/tasks/:boardSlug/columns/:columnIndex/cards",
  async (req, res) => {
    const slug = sanitizeSegment(req.params.boardSlug);
    const col = Number(req.params.columnIndex);
    await sendColumnCards(res, slug, col);
  }
);


app.get("/api/completed-cards", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const pageRaw = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, limitRaw))
      : 50;

    const ofRaw = String(req.query.of ?? "all").toLowerCase();
    const of = ofRaw === "mine" || ofRaw === "owner" ? ofRaw : "all";
    const pick = String(req.query.pick ?? "").trim();
    const me = String(req.query.me ?? "").trim();

    const deepRaw = String(req.query.deep ?? "").trim().toLowerCase();
    const includeCold =
      deepRaw === "1" ||
      deepRaw === "true" ||
      deepRaw === "yes" ||
      String(req.query.includeCold ?? "")
        .trim()
        .toLowerCase() === "1";

    const searchLower = String(req.query.q ?? "").trim().toLowerCase();
    const laneRaw = String(req.query.lane ?? "").trim();
    const whenFilter = parseCompletedWhenFilter(req.query.when);

    const all = await gatherCompletedArchiveAndOptionalCold(slug, includeCold);

    const ownerSet = new Set();
    for (const row of all) {
      const o = String(row.owner ?? "").trim();
      if (o) ownerSet.add(o);
    }
    const distinctRowOwners = [...ownerSet].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    let ownerNames = [];
    /** @type {Array<{ index: number, title: string }>} */
    let swimlanes = [];
    try {
      const boardPath = await resolveBoardIniPathForSlug(slug);
      const boardText = await fs.readFile(boardPath, "utf8");
      const boardModel = parseBoardIni(boardText);
      ownerNames = boardOwnerEmailsForFilter(boardModel.users ?? []);
      swimlanes = boardModel.swimlanes ?? [];
    } catch {
      ownerNames = [];
      swimlanes = [];
    }
    if (ownerNames.length === 0) {
      ownerNames = distinctRowOwners;
    }

    const legacySwimlaneFilters = legacySwimlaneFilterCandidates(all, swimlanes);

    let filtered = all;
    if (of === "mine" && me) {
      const low = me.toLowerCase();
      filtered = all.filter(
        (r) => String(r.owner ?? "").trim().toLowerCase() === low
      );
    } else if (of === "owner" && pick) {
      filtered = all.filter((r) => String(r.owner ?? "").trim() === pick);
    }

    if (laneRaw) {
      if (swimlanes.length > 0) {
        const laneIndices = resolveCompletedLaneFilterIndices(laneRaw, swimlanes);
        if (laneIndices != null && laneIndices.size > 0) {
          filtered = filtered.filter((r) => {
            const idx = resolveCardSwimlaneIndex(
              /** @type {string | undefined} */ (r.swimlane),
              swimlanes
            );
            if (!laneIndices.has(idx)) return false;
            const raw = String(r.swimlane ?? "").trim();
            if (
              raw &&
              resolveCompletedLaneFilterIndices(raw, swimlanes) == null
            ) {
              return false;
            }
            return true;
          });
        } else {
          const want = laneRaw.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              String(r.swimlane ?? "").trim().toLowerCase() === want
          );
        }
      } else {
        const want = laneRaw.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            String(r.swimlane ?? "").trim().toLowerCase() === want
        );
      }
    }

    if (searchLower) {
      filtered = filtered.filter((r) => completedRowMatchesSearch(r, searchLower));
    }

    if (whenFilter !== "all") {
      filtered = filtered.filter((r) =>
        completedClosedInWhenRange(
          /** @type {string | undefined} */ (r.closed),
          whenFilter
        )
      );
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const slice = filtered
      .slice(start, start + limit)
      .map(({ sortMs: _s, ...rest }) => rest);

    res.json({
      cards: slice,
      page,
      pageSize: limit,
      total,
      ownerNames,
      legacySwimlaneFilters,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to list completed cards." });
  }
});

/**
 * Query: boardSlug, granularity=daily|weekly|monthly (default weekly).
 * Buckets use UTC (day start, ISO-week Monday, or calendar month).
 * One point per bucket with at least one completion (`closed` on board or archive INIs).
 */
app.get("/api/completion-buckets", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const buckets = await aggregateCompletionBuckets(slug, granularity);
    res.json({ boardSlug: slug, granularity, buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load completion buckets." });
  }
});

/**
 * Query: boardSlug, granularity=weekly|monthly (default weekly).
 * Stacked completion counts by swimlane per UTC bucket (same rules as `/api/completion-buckets`).
 */
app.get("/api/completion-swimlane-stack", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const { series, buckets } = await aggregateCompletionSwimlaneStack(
      slug,
      granularity
    );
    res.json({ boardSlug: slug, granularity, series, buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load swimlane completion stack.",
    });
  }
});

/**
 * Query: boardSlug, granularity=daily|weekly|monthly (default weekly).
 * Points: each card with parseable `created` and `closed`; x = UTC bucket of `closed`, y = (closed − created) in days.
 * `medianDays` / `stdevDays` are over those cycle lengths (sample σ, n ≥ 2).
 */
app.get("/api/cycle-time-scatter", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const gRaw = String(req.query.granularity ?? "weekly").toLowerCase();
    let granularity = "weekly";
    if (gRaw === "monthly") granularity = "monthly";
    else if (gRaw === "daily") granularity = "daily";
    const payload = await buildCycleTimeScatter(slug, granularity);
    res.json({ boardSlug: slug, ...payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load cycle time data." });
  }
});

/**
 * Query: boardSlug.
 * Open cards per column, counts stacked by swimlane (live board snapshot).
 */
app.get("/api/column-swimlane-stack", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const payload = await aggregateColumnSwimlaneStack(slug);
    res.json({ boardSlug: slug, ...payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load column swimlane stack.",
    });
  }
});

/**
 * Query: boardSlug.
 * Histogram of open-card age in UTC days (today − created).
 */
app.get("/api/card-age-distribution", async (req, res) => {
  try {
    const slug = sanitizeSegment(String(req.query.boardSlug ?? "board"));
    const payload = await buildCardAgeDistribution(slug);
    res.json({ boardSlug: slug, ...payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load card age distribution.",
    });
  }
});
}
