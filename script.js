const elements = {};
const graduationDate = new Date("2028-06-18T00:00:00-04:00");
const seniorYearStart = new Date("2027-09-07T00:00:00-04:00");
const milestones = [
  {
    id: "current",
    label: "Sophomore Season",
    title: "Sophomore Year Build-Up (2025–26)",
    start: new Date("2025-09-02T00:00:00-04:00"),
    end: new Date("2026-06-24T23:59:59-04:00"),
    blurb:
      "Build strong foundations this year. Focus on good study habits, explore interests, and start thinking about what you want to pursue. Keep the Florida goal in sight and use Islanders games as your reward for hard work.",
  },
  {
    id: "next",
    label: "Junior Season",
    title: "Junior Year Build-Up (2026–27)",
    start: new Date("2026-09-08T00:00:00-04:00"),
    end: new Date("2027-06-24T23:59:59-04:00"),
    blurb:
      "Heavy-weight year for transcripts and leadership. Line up college lists, visit campuses, and keep Isles energy on loop during long study nights.",
  },
  {
    id: "final",
    label: "Final Season",
    title: "Senior Year Faceoff (2027–28)",
    start: seniorYearStart,
    end: graduationDate,
    blurb:
      "Capstones, celebrations, and final commitments. Every assignment finished is another stride toward graduation day and the Florida relocation.",
  },
];
const milestoneTimelineStart =
  milestones[0]?.start ?? milestones[0]?.date ?? seniorYearStart;
const milestoneTimelineEnd =
  milestones.at(-1)?.end ?? milestones.at(-1)?.date ?? graduationDate;
const MS_PER_DAY = 86_400_000;
let userSelectedMilestoneId = null;
let defaultProgressMeta = "";
const overallProgressStart = new Date("2024-09-02T00:00:00-04:00");
const ISLES_TEAM_CODE = "NYI";
// Written by .github/workflows/update-isles-schedule.yml (the NHL API blocks browser requests).
const ISLES_BUNDLED_SCHEDULE_URL = "./data/isles-schedule.json";
const ISLES_BUNDLED_STALE_MS = 12 * 60 * 60 * 1000;
const NHL_SCHEDULE_URL = `https://api-web.nhle.com/v1/club-schedule-season/${ISLES_TEAM_CODE}/now`;
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];
const ISLES_SCHEDULE_CACHE_KEY = "islesScheduleCacheV2";
const ISLES_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const GAME_LENGTH_MS = 3 * 60 * 60 * 1000;
const FINISHED_GAME_STATES = new Set(["OFF", "FINAL"]);
let islesGames = [];
let islesLastFetch = 0;
let islesLoading = false;
let islesTimer = null;
let islesFocusKey = null;

const formatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function initElements() {
  elements.days = document.getElementById("days");
  elements.months = document.getElementById("months");
  elements.years = document.getElementById("years");
  elements.hours = document.getElementById("hours");
  elements.minutes = document.getElementById("minutes");
  elements.seconds = document.getElementById("seconds");
  elements.progress = document.getElementById("progress-bar");
  elements.progressPercent = document.getElementById("progress-percent");
  elements.startDate = document.getElementById("start-date");
  elements.targetDate = document.getElementById("target-date");
  elements.milestoneProgress = document.getElementById("milestone-progress");
  elements.milestoneNodes = document.getElementById("milestone-nodes");
  elements.milestoneCards = document.getElementById("milestone-cards");
  elements.progressMeta = document.getElementById("progress-meta");
  elements.islesCountdown = document.getElementById("isles-countdown");
  elements.islesLabel = document.getElementById("isles-label");
  elements.islesOpponent = document.getElementById("isles-opponent");
  elements.islesGameInfo = document.getElementById("isles-game-info");
  elements.islesBroadcast = document.getElementById("isles-broadcast");
  elements.islesLastResult = document.getElementById("isles-last-result");
  elements.islesScheduleList = document.getElementById("isles-schedule-list");

  if (elements.startDate) {
    elements.startDate.textContent = formatter.format(overallProgressStart);
  }

  if (elements.targetDate) {
    elements.targetDate.textContent = formatter.format(graduationDate);
  }

  if (!defaultProgressMeta && elements.progressMeta) {
    defaultProgressMeta = elements.progressMeta.textContent.trim();
  }
}

function updateCountdown() {
  if (!elements.days) return;

  const now = new Date();
  const diffMs = graduationDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    Object.values(elements).forEach((element) => {
      if (!element) return;
      if (element === elements.progress) {
        element.style.width = "100%";
      } else if (element === elements.progressPercent) {
        element.textContent = "100%";
      } else if (element.classList.contains("status-value")) {
        element.textContent = "0";
      }
    });
    if (elements.progressPercent) {
      elements.progressPercent.textContent = "Mission Complete";
    }
    if (elements.progressMeta) {
      elements.progressMeta.textContent = "Senior year wrapped — Florida launch sequence is live!";
    }
    updateMilestones(now);
    return;
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffYears = diffDays / 365.25;
  const diffMonths = diffDays / 30.4375;

  elements.days.textContent = diffDays.toLocaleString();
  elements.months.textContent = diffMonths.toFixed(1);
  elements.years.textContent = diffYears.toFixed(2);
  elements.hours.textContent = diffHours.toLocaleString();
  elements.minutes.textContent = diffMinutes.toLocaleString();
  elements.seconds.textContent = diffSeconds.toLocaleString();

  const timelineStartForProgress =
    overallProgressStart ?? milestoneTimelineStart ?? seniorYearStart;
  const timelineEndForProgress = milestoneTimelineEnd ?? graduationDate;
  const totalDurationMs = timelineEndForProgress.getTime() - timelineStartForProgress.getTime();
  const elapsedMs = Math.min(
    Math.max(now.getTime() - timelineStartForProgress.getTime(), 0),
    totalDurationMs,
  );
  const isPreseason = now < timelineStartForProgress;

  if (isPreseason) {
    const percent = totalDurationMs > 0 ? Math.round((elapsedMs / totalDurationMs) * 100) : 0;
    if (elements.progress) {
      elements.progress.style.width = `${percent}%`;
    }
    if (elements.progressPercent) {
      elements.progressPercent.textContent = `${percent}%`;
    }
    if (elements.progressMeta) {
      const daysUntilStart = Math.max(getDaysUntil(timelineStartForProgress, now), 0);
      elements.progressMeta.textContent =
        daysUntilStart > 0
          ? `${daysUntilStart.toLocaleString()} days until the progress window opens on ${formatter.format(
              timelineStartForProgress,
            )}.`
          : "Progress window opens today — tracking begins now!";
    }
  } else {
    const percent = totalDurationMs > 0 ? Math.round((elapsedMs / totalDurationMs) * 100) : 0;

    if (elements.progress) {
      elements.progress.style.width = `${percent}%`;
    }
    if (elements.progressPercent) {
      elements.progressPercent.textContent =
        percent >= 100 ? "Mission Complete" : `${percent}%`;
    }
    if (elements.progressMeta) {
      elements.progressMeta.textContent = defaultProgressMeta;
    }
  }

  updateMilestones(now);
}

function wireInteractions() {
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetSelector = button.getAttribute("data-scroll-target");
      if (!targetSelector) return;
      const targetElement = document.querySelector(targetSelector);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  const copyButton = document.getElementById("copy-escape-plan");
  if (copyButton) {
    const originalLabel = copyButton.textContent;
    let resetTimer = null;
    copyButton.addEventListener("click", async () => {
      const escapePlanText = buildEscapePlanText();
      try {
        await copyText(escapePlanText);
        copyButton.textContent = "Copied!";
        copyButton.style.opacity = "0.8";
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          copyButton.textContent = originalLabel;
          copyButton.style.opacity = "1";
        }, 2000);
      } catch (error) {
        console.error("Failed to copy text:", error);
        alert(`Copy this text:\n\n${escapePlanText}`);
      }
    });
  }
}

function buildEscapePlanText() {
  const todayFormatted = formatter.format(new Date());
  const days = elements.days?.textContent || "0";
  const years = elements.years?.textContent || "0";
  const months = elements.months?.textContent || "0";
  const hours = elements.hours?.textContent || "0";
  const spooky = document.documentElement.dataset.theme === "halloween" ? "spooky " : "";

  return `Here is your ${spooky}daily update for the New York escape plan: ${todayFormatted}. There are only ${days} days left until we escape to Florida! This translates to ${years} years, or ${months} months, or ${hours} hours

Follow along in real time at: https://jbfleesny.github.io/`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) throw new Error("execCommand copy failed");
}

function startCountdown() {
  updateCountdown();
  const timer = setInterval(() => {
    const now = new Date();
    if (now >= graduationDate) {
      clearInterval(timer);
    }
    updateCountdown();
  }, 1000);
}

function renderMilestones() {
  if (!elements.milestoneNodes || !elements.milestoneCards) return;

  elements.milestoneNodes.innerHTML = milestones
    .map(
      (milestone) => `
        <button class="milestone-node" type="button" data-milestone-id="${milestone.id}">
          <span class="milestone-node__label">${milestone.label}</span>
          <span class="milestone-node__date" data-milestone-node-range="${milestone.id}">${formatMilestoneStart(
            milestone,
          )}</span>
          <span class="milestone-node__status" data-milestone-status="${milestone.id}">Loading…</span>
          <span class="milestone-node__count" data-milestone-count="${milestone.id}">–</span>
        </button>
      `,
    )
    .join("");

  elements.milestoneCards.innerHTML = milestones
    .map(
      (milestone) => `
        <article class="milestone-card" data-milestone-card="${milestone.id}">
          <header>
            <h3 class="milestone-card__title">${milestone.title}</h3>
            <p class="milestone-card__date" data-milestone-range="${milestone.id}">${formatMilestoneRange(
              milestone,
            )}</p>
          </header>
          <div class="milestone-card__meta">
            <span class="milestone-card__days" data-milestone-progress-value="${milestone.id}">–</span>
            <span class="milestone-card__status" data-milestone-card-status="${milestone.id}">Loading…</span>
          </div>
          <div class="milestone-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-milestone-progress="${milestone.id}">
            <div class="milestone-card__progress-fill" data-milestone-progress-fill="${milestone.id}"></div>
          </div>
          <p class="milestone-card__progress-label" data-milestone-progress-label="${milestone.id}">Loading…</p>
          <p class="milestone-card__blurb">${milestone.blurb}</p>
        </article>
      `,
    )
    .join("");

  const buttons = elements.milestoneNodes.querySelectorAll("[data-milestone-id]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      userSelectedMilestoneId = button.dataset.milestoneId;
      setActiveMilestone(userSelectedMilestoneId);
    });
  });

  updateMilestones();
}

function getDaysUntil(date, referenceDate) {
  return Math.ceil((date.getTime() - referenceDate.getTime()) / MS_PER_DAY);
}

function formatMilestoneStart(milestone) {
  const start = milestone.start ?? milestone.date;
  return start ? formatter.format(start) : "TBD";
}

function formatMilestoneRange(milestone) {
  const start = milestone.start ?? milestone.date;
  const end = milestone.end ?? milestone.date;
  if (!start && !end) return "TBD";
  if (!end || !start || start.getTime() === end.getTime()) {
    return formatter.format(start ?? end);
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getMilestoneState(milestone, referenceDate) {
  const start = milestone.start ?? milestone.date;
  const end = milestone.end ?? milestone.date;
  if (!start || !end) {
    return {
      status: "upcoming",
      percentComplete: 0,
      daysUntilStart: 0,
      daysRemaining: 0,
      start,
      end,
    };
  }

  if (referenceDate < start) {
    return {
      status: "upcoming",
      percentComplete: 0,
      daysUntilStart: Math.max(0, getDaysUntil(start, referenceDate)),
      daysRemaining: Math.max(0, getDaysUntil(end, referenceDate)),
      start,
      end,
    };
  }

  if (referenceDate >= end) {
    return {
      status: "complete",
      percentComplete: 100,
      daysUntilStart: 0,
      daysRemaining: 0,
      start,
      end,
    };
  }

  const total = end.getTime() - start.getTime();
  const elapsed = referenceDate.getTime() - start.getTime();
  const percentComplete = Math.round((elapsed / total) * 100);
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - referenceDate.getTime()) / MS_PER_DAY),
  );

  return {
    status: "active",
    percentComplete: Math.max(0, Math.min(100, percentComplete)),
    daysUntilStart: 0,
    daysRemaining,
    start,
    end,
  };
}

function updateMilestones(referenceDate = new Date()) {
  if (!elements.milestoneNodes || !elements.milestoneCards) return;

  let firstActiveId = null;
  let firstUpcomingId = null;

  milestones.forEach((milestone) => {
    const state = getMilestoneState(milestone, referenceDate);
    const nodeButton = elements.milestoneNodes.querySelector(
      `[data-milestone-id="${milestone.id}"]`,
    );
    const card = elements.milestoneCards.querySelector(`[data-milestone-card="${milestone.id}"]`);
    const nodeCount = document.querySelector(`[data-milestone-count="${milestone.id}"]`);
    const nodeStatus = document.querySelector(`[data-milestone-status="${milestone.id}"]`);
    const nodeRange = document.querySelector(`[data-milestone-node-range="${milestone.id}"]`);
    const rangeEl = document.querySelector(`[data-milestone-range="${milestone.id}"]`);
    const progressWrapper = document.querySelector(
      `[data-milestone-progress="${milestone.id}"]`,
    );
    const progressFill = document.querySelector(
      `[data-milestone-progress-fill="${milestone.id}"]`,
    );
    const progressValue = document.querySelector(
      `[data-milestone-progress-value="${milestone.id}"]`,
    );
    const progressLabel = document.querySelector(
      `[data-milestone-progress-label="${milestone.id}"]`,
    );
    const cardStatus = document.querySelector(
      `[data-milestone-card-status="${milestone.id}"]`,
    );

    if (nodeRange) {
      nodeRange.textContent = formatMilestoneStart(milestone);
    }
    if (rangeEl) {
      rangeEl.textContent = formatMilestoneRange(milestone);
    }

    let statusLabel = "";
    let countLabel = "";
    let progressDetail = "";
    let percentForBar = 0;

    if (state.status === "upcoming") {
      // Use different label for final season
      if (milestone.id === "final") {
        statusLabel = "Final stretch";
      } else {
        statusLabel = "Up next";
      }
      countLabel = `${state.daysUntilStart.toLocaleString()}d`;
      progressDetail = `Starts in ${state.daysUntilStart.toLocaleString()} days`;
    } else if (state.status === "active") {
      statusLabel = "In progress";
      countLabel = `${state.percentComplete}%`;
      progressDetail = `${state.percentComplete}% complete • ${state.daysRemaining.toLocaleString()} days left`;
      percentForBar = state.percentComplete;
    } else {
      statusLabel = "Complete";
      countLabel = "Done";
      progressDetail = `Wrapped on ${formatter.format(state.end)}`;
      percentForBar = 100;
    }

    if (nodeCount) {
      nodeCount.textContent = countLabel;
    }
    if (nodeStatus) {
      nodeStatus.textContent = statusLabel;
    }
    if (progressValue) {
      progressValue.textContent =
        state.status === "active" || state.status === "complete"
          ? `${percentForBar}%`
          : "0%";
    }
    if (cardStatus) {
      cardStatus.textContent = statusLabel;
    }
    if (progressLabel) {
      progressLabel.textContent = progressDetail;
    }
    progressFill?.style.setProperty("width", `${percentForBar}%`);
    progressWrapper?.setAttribute("aria-valuenow", `${percentForBar}`);

    nodeButton?.classList.toggle("state-active", state.status === "active");
    nodeButton?.classList.toggle("state-upcoming", state.status === "upcoming");
    nodeButton?.classList.toggle("state-complete", state.status === "complete");
    card?.classList.toggle("state-active", state.status === "active");
    card?.classList.toggle("state-upcoming", state.status === "upcoming");
    card?.classList.toggle("state-complete", state.status === "complete");
    if (!firstActiveId && state.status === "active") {
      firstActiveId = milestone.id;
    }
    if (!firstUpcomingId && state.status === "upcoming") {
      firstUpcomingId = milestone.id;
    }
  });

  const fallbackId = milestones.at(-1)?.id;
  const derivedActiveId =
    userSelectedMilestoneId ?? firstActiveId ?? firstUpcomingId ?? fallbackId;

  setActiveMilestone(derivedActiveId);
  updateMilestoneProgress(referenceDate);
}

function setActiveMilestone(id) {
  if (!id) return;
  const nodeButtons = elements.milestoneNodes?.querySelectorAll(".milestone-node");
  const cards = elements.milestoneCards?.querySelectorAll(".milestone-card");
  nodeButtons?.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.milestoneId === id);
  });
  cards?.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.milestoneCard === id);
  });
}

function updateMilestoneProgress(referenceDate = new Date()) {
  if (!elements.milestoneProgress || !milestoneTimelineStart || !milestoneTimelineEnd) return;

  const totalTimeline = milestoneTimelineEnd.getTime() - milestoneTimelineStart.getTime();
  const elapsed = referenceDate.getTime() - milestoneTimelineStart.getTime();
  const clampedElapsed = Math.max(0, Math.min(elapsed, totalTimeline));
  const ratio = totalTimeline <= 0 ? 0 : clampedElapsed / totalTimeline;

  elements.milestoneProgress.style.width = `${(ratio * 100).toFixed(1)}%`;
}

async function loadIslesSchedule() {
  if (!elements.islesScheduleList || !elements.islesCountdown || islesLoading) return;
  islesLoading = true;

  if (!islesGames.length) {
    const cached = readIslesCache();
    if (cached.length) {
      islesGames = cached;
      renderIsles();
    }
  }

  try {
    const games = (await fetchIslesSchedule())
      .map(normalizeIslesGame)
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (!games.length) throw new Error("Schedule contained no games");

    islesGames = games;
    writeIslesCache(games);
    islesFocusKey = null;
    renderIsles();
  } catch (error) {
    console.error("[Islanders Schedule] Failed to load schedule:", error);
    if (!islesGames.length) renderIslesUnavailable();
  } finally {
    islesLastFetch = Date.now();
    islesLoading = false;
  }
}

async function fetchIslesSchedule() {
  let bundled = null;
  try {
    bundled = await fetchJson(ISLES_BUNDLED_SCHEDULE_URL);
  } catch (error) {
    console.warn("[Islanders Schedule] Bundled schedule unavailable:", error);
  }

  const bundledAge = bundled?.updatedAt
    ? Date.now() - new Date(bundled.updatedAt).getTime()
    : Infinity;
  if (bundled?.games?.length && bundledAge < ISLES_BUNDLED_STALE_MS) {
    return bundled.games;
  }

  for (const proxy of CORS_PROXIES) {
    try {
      const data = await fetchJson(proxy(NHL_SCHEDULE_URL));
      if (data?.games?.length) return data.games;
    } catch (error) {
      console.warn("[Islanders Schedule] Proxy failed:", error);
    }
  }

  if (bundled?.games?.length) return bundled.games;
  throw new Error("No schedule source available");
}

async function fetchJson(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeIslesGame(game) {
  const date = new Date(game?.startTimeUTC ?? "");
  if (Number.isNaN(date.getTime())) return null;

  const isHome = game.homeTeam?.abbrev === ISLES_TEAM_CODE;
  const isles = isHome ? game.homeTeam : game.awayTeam;
  const opponent = isHome ? game.awayTeam : game.homeTeam;

  return {
    id: game.id,
    date,
    isHome,
    opponent: getTeamName(opponent),
    venue: game.venue?.default || (isHome ? "UBS Arena" : null),
    broadcast: pickBroadcasts(game.tvBroadcasts, isHome),
    gameType: game.gameType,
    gameState: game.gameState,
    islesScore: isles?.score ?? null,
    opponentScore: opponent?.score ?? null,
    periodType: game.gameOutcome?.lastPeriodType ?? null,
  };
}

function getTeamName(team) {
  const place = team?.placeName?.default ?? "";
  const common = team?.commonName?.default ?? "";
  return [place, common].filter(Boolean).join(" ") || team?.abbrev || "TBD";
}

function pickBroadcasts(broadcasts, isHome) {
  const islesMarket = isHome ? "H" : "A";
  const networks = (Array.isArray(broadcasts) ? broadcasts : [])
    .filter((b) => b?.network && b.countryCode !== "CA")
    .filter((b) => b.market === "N" || b.market === islesMarket)
    .map((b) => b.network);
  return [...new Set(networks)].join(", ") || null;
}

function isGameFinished(game) {
  return FINISHED_GAME_STATES.has(game.gameState);
}

function isGameLive(game, now) {
  const start = game.date.getTime();
  return !isGameFinished(game) && start <= now && now < start + GAME_LENGTH_MS;
}

function renderIsles() {
  renderIslesSchedule();
  renderIslesLastResult();
  if (!islesTimer) {
    islesTimer = setInterval(tickIsles, 1000);
  }
  tickIsles();
}

function tickIsles() {
  const now = Date.now();
  const liveGame = islesGames.find((game) => isGameLive(game, now));
  const focusGame =
    liveGame ?? islesGames.find((game) => !isGameFinished(game) && game.date.getTime() > now);
  const focusKey = focusGame ? `${focusGame.id}:${liveGame ? "live" : "next"}` : "none";

  if (focusKey !== islesFocusKey) {
    islesFocusKey = focusKey;
    renderIslesFocus(focusGame, Boolean(liveGame));
    renderIslesSchedule();
    renderIslesLastResult();
  }
  if (focusGame && !liveGame) {
    renderIslesCountdown(focusGame, now);
  }

  refreshIslesIfStale();
}

function refreshIslesIfStale() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - islesLastFetch > ISLES_REFRESH_INTERVAL_MS) {
    loadIslesSchedule();
  }
}

function renderIslesFocus(game, isLive) {
  if (elements.islesLabel) {
    elements.islesLabel.textContent = isLive ? "Puck Has Dropped" : "Next Puck Drop";
  }

  if (!game) {
    elements.islesOpponent.textContent = "Season Complete";
    elements.islesCountdown.textContent = "—";
    elements.islesGameInfo.textContent = "No upcoming games on the schedule right now.";
    elements.islesBroadcast.textContent = "";
    return;
  }

  elements.islesOpponent.textContent = `${game.isHome ? "vs" : "@"} ${game.opponent}`;
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  }).format(game.date);
  elements.islesGameInfo.textContent = [when, game.venue].filter(Boolean).join(" • ");
  elements.islesBroadcast.textContent = game.broadcast ? `Broadcast: ${game.broadcast}` : "";

  if (isLive) {
    elements.islesCountdown.innerHTML = `<span class="isles-countdown__live">Game On</span>`;
  }
}

function renderIslesCountdown(game, now) {
  const totalSeconds = Math.max(0, Math.floor((game.date.getTime() - now) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => value.toString().padStart(2, "0");

  elements.islesCountdown.innerHTML = `
    <span><strong>${days}</strong><small>Days</small></span>
    <span><strong>${pad(hours)}</strong><small>Hours</small></span>
    <span><strong>${pad(minutes)}</strong><small>Minutes</small></span>
    <span><strong>${pad(seconds)}</strong><small>Seconds</small></span>
  `;
}

function renderIslesSchedule() {
  if (!elements.islesScheduleList) return;

  const now = Date.now();
  const upcoming = islesGames
    .filter((game) => !isGameFinished(game) && game.date.getTime() + GAME_LENGTH_MS > now)
    .slice(0, 6);

  if (!upcoming.length) {
    elements.islesScheduleList.innerHTML = `
      <li class="isles-schedule__item isles-schedule__item--loading">
        The Islanders season is complete. Check back when the new schedule drops.
      </li>
    `;
    return;
  }

  const dateFormat = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  });
  const gameTypeLabels = { 1: "Preseason", 3: "Playoffs" };

  elements.islesScheduleList.innerHTML = upcoming
    .map((game) => {
      const isLive = isGameLive(game, now);
      const matchup = `Isles ${game.isHome ? "vs" : "@"} ${game.opponent}`;
      const meta = [timeFormat.format(game.date), game.venue, game.broadcast]
        .filter(Boolean)
        .join(" • ");
      const badges = [
        isLive ? `<span class="isles-schedule__badge isles-schedule__badge--live">Live</span>` : "",
        gameTypeLabels[game.gameType]
          ? `<span class="isles-schedule__badge">${gameTypeLabels[game.gameType]}</span>`
          : "",
      ].join("");
      const classes = [
        "isles-schedule__item",
        game.isHome ? "isles-schedule__item--home" : "isles-schedule__item--away",
        isLive ? "isles-schedule__item--live" : "",
      ].join(" ");
      return `
        <li class="${classes}">
          <span class="isles-schedule__date">${dateFormat.format(game.date)}${badges}</span>
          <span class="isles-schedule__matchup">${escapeHtml(matchup)}</span>
          <span class="isles-schedule__meta">${escapeHtml(meta)}</span>
        </li>
      `;
    })
    .join("");
}

function renderIslesLastResult() {
  if (!elements.islesLastResult) return;

  const lastGame = islesGames
    .filter((game) => isGameFinished(game) && game.islesScore != null && game.opponentScore != null)
    .at(-1);
  if (!lastGame) {
    elements.islesLastResult.textContent = "";
    return;
  }

  const won = lastGame.islesScore > lastGame.opponentScore;
  const extra = lastGame.periodType && lastGame.periodType !== "REG" ? ` (${lastGame.periodType})` : "";
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    lastGame.date,
  );
  const matchup = `${lastGame.isHome ? "vs" : "@"} ${lastGame.opponent}`;

  elements.islesLastResult.innerHTML = `
    Last game:
    <span class="isles-result isles-result--${won ? "win" : "loss"}">${won ? "W" : "L"} ${
      lastGame.islesScore
    }–${lastGame.opponentScore}${extra}</span>
    ${escapeHtml(matchup)} • ${when}
  `;
}

function renderIslesUnavailable() {
  elements.islesScheduleList.innerHTML = `
    <li class="isles-schedule__item isles-schedule__item--loading">
      Could not load the schedule right now. Refresh to try again.
    </li>
  `;
  elements.islesOpponent.textContent = "Schedule unavailable";
  elements.islesCountdown.textContent = "—";
  elements.islesGameInfo.textContent = "Please check back shortly for the next puck drop.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readIslesCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ISLES_SCHEDULE_CACHE_KEY) ?? "null");
    if (!Array.isArray(parsed?.games)) return [];
    return parsed.games
      .map((game) => ({ ...game, date: new Date(game.date) }))
      .filter((game) => !Number.isNaN(game.date.getTime()));
  } catch (error) {
    console.warn("Failed to read cached Isles schedule", error);
    return [];
  }
}

function writeIslesCache(games) {
  try {
    const payload = {
      timestamp: Date.now(),
      games: games.map((game) => ({ ...game, date: game.date.toISOString() })),
    };
    localStorage.setItem(ISLES_SCHEDULE_CACHE_KEY, JSON.stringify(payload));
    localStorage.removeItem("islesScheduleCacheV1");
  } catch (error) {
    console.warn("Failed to cache Isles schedule", error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initElements();
  wireInteractions();
  renderMilestones();
  startCountdown();
  loadIslesSchedule();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  updateCountdown();
  refreshIslesIfStale();
});

