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
const ISLES_TEAM_ID = 2;
let islesGames = [];
let islesCountdownInterval = null;
const ISLES_SCHEDULE_CACHE_KEY = "islesScheduleCacheV1";
const ISLES_SCHEDULE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

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
  elements.islesOpponent = document.getElementById("isles-opponent");
  elements.islesGameInfo = document.getElementById("isles-game-info");
  elements.islesBroadcast = document.getElementById("isles-broadcast");
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

  // Copy escape plan update to clipboard
  const copyButton = document.getElementById("copy-escape-plan");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        const today = new Date();
        const todayFormatted = new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(today);

        // Get current countdown values
        const days = elements.days?.textContent || "0";
        const years = elements.years?.textContent || "0";
        const months = elements.months?.textContent || "0";
        const hours = elements.hours?.textContent || "0";

        const escapePlanText = `Here is your daily update for the New York escape plan: ${todayFormatted}. There are only ${days} days left until we escape to Florida! This translates to ${years} years, or ${months} months, or ${hours} hours`;

        // Use Clipboard API (works on desktop and mobile)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(escapePlanText);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = escapePlanText;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }

        // Visual feedback
        const originalText = copyButton.textContent;
        copyButton.textContent = "Copied!";
        copyButton.style.opacity = "0.8";
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.style.opacity = "1";
        }, 2000);
      } catch (error) {
        console.error("Failed to copy text:", error);
        // Fallback: show the text in an alert so user can manually copy
        const today = new Date();
        const todayFormatted = new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(today);
        const days = elements.days?.textContent || "0";
        const years = elements.years?.textContent || "0";
        const months = elements.months?.textContent || "0";
        const hours = elements.hours?.textContent || "0";
        const escapePlanText = `Here is your daily update for the New York escape plan: ${todayFormatted}. There are only ${days} days left until we escape to Florida! This translates to ${years} years, or ${months} months, or ${hours} hours`;
        alert(`Copy this text:\n\n${escapePlanText}`);
      }
    });
  }
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
  console.log("[Islanders Schedule] Starting to load schedule...");
  
  if (!elements.islesScheduleList || !elements.islesCountdown) {
    console.warn("[Islanders Schedule] Required elements not found:", {
      scheduleList: !!elements.islesScheduleList,
      countdown: !!elements.islesCountdown
    });
    return;
  }

  const cached = readIslesCache();
  if (cached) {
    console.log("[Islanders Schedule] Using cached data:", cached.length, "games");
    islesGames = cached;
    renderIslesSchedule();
    startIslesCountdown();
  } else {
    console.log("[Islanders Schedule] No valid cache found");
  }

  const season = computeNhlSeasonCode();
  const apiUrl = `https://api-web.nhle.com/v1/club-schedule-season/${ISLES_TEAM_CODE}/${season}`;
  
  // Always use CORS proxy since NHL API doesn't allow direct access from browsers
  // Try multiple proxy services for reliability
  const proxyServices = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  const proxyUrl = proxyServices[0]; // Primary proxy
  const url = proxyUrl + encodeURIComponent(apiUrl);
  
  console.log("[Islanders Schedule] Fetching from API:", {
    season,
    teamCode: ISLES_TEAM_CODE,
    url
  });

  try {
    const response = await fetch(url);
    console.log("[Islanders Schedule] API Response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error response");
      console.error("[Islanders Schedule] API Error Response:", errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("[Islanders Schedule] API Data received:", {
      hasGames: Array.isArray(data?.games),
      gameCount: data?.games?.length ?? 0,
      dataKeys: Object.keys(data || {})
    });
    
    const games = data?.games ?? [];
    console.log("[Islanders Schedule] Processing", games.length, "games from API");
    
    // Log the first game structure to debug
    if (games.length > 0) {
      console.log("[Islanders Schedule] Sample game structure:", {
        game: games[0],
        homeTeam: games[0]?.homeTeam,
        awayTeam: games[0]?.awayTeam,
        homeTeamKeys: games[0]?.homeTeam ? Object.keys(games[0].homeTeam) : [],
        awayTeamKeys: games[0]?.awayTeam ? Object.keys(games[0].awayTeam) : []
      });
    }
    
    islesGames = games
      .map((game, index) => {
        const startUtc =
          game?.startTimeUTC ||
          game?.gameDate
            ? `${game.gameDate}T${game.gameTimeUTC || game.gameTime || "00:00:00"}Z`
            : null;
        if (!startUtc) {
          console.warn(`[Islanders Schedule] Game ${index} missing start time:`, game);
          return null;
        }
        const date = new Date(startUtc);
        if (Number.isNaN(date.getTime())) {
          console.warn(`[Islanders Schedule] Game ${index} invalid date:`, startUtc);
          return null;
        }
        
        // Try multiple ways to get team names - NHL API can have various structures
        const getTeamName = (team) => {
          if (!team) return "";
          
          // Try direct name fields first
          if (team.name) return team.name;
          if (team.default) return team.default;
          
          // Try placeName + teamName combination (common NHL API pattern)
          const placeName = team.placeName?.default || team.placeName?.name || team.placeName || "";
          const teamName = team.teamName?.default || team.teamName?.name || team.teamName || "";
          
          if (placeName && teamName) {
            return `${placeName} ${teamName}`;
          }
          if (placeName) return placeName;
          if (teamName) return teamName;
          
          // Try other common fields
          if (team.commonName) return team.commonName;
          if (team.fullName) return team.fullName;
          
          return "";
        };
        
        const homeTeam = getTeamName(game.homeTeam);
        const awayTeam = getTeamName(game.awayTeam);
        
        const isHome = game.homeTeam?.abbrev === ISLES_TEAM_CODE;
        const opponent = isHome ? awayTeam : homeTeam;
        
        // Log if opponent is still empty (only for first few games to avoid spam)
        if (!opponent && index < 3) {
          console.warn(`[Islanders Schedule] Game ${index} missing opponent:`, {
            isHome,
            homeTeam,
            awayTeam,
            homeTeamObj: game.homeTeam,
            awayTeamObj: game.awayTeam,
            allHomeTeamKeys: game.homeTeam ? Object.keys(game.homeTeam) : [],
            allAwayTeamKeys: game.awayTeam ? Object.keys(game.awayTeam) : []
          });
        }
        const tvBroadcasts = Array.isArray(game.tvBroadcasts)
          ? game.tvBroadcasts.map((b) => b?.network).filter(Boolean)
          : [];
        const localBroadcast =
          tvBroadcasts.find((network) => network && network !== "ESPN+") || tvBroadcasts[0] || null;
        return {
          id: game.id || game.gameNumber,
          date,
          isHome,
          opponent,
          venue: game.venue?.default || (isHome ? "UBS Arena" : "Away"),
          broadcast: localBroadcast,
          season: game.season,
          gameState: game.gameState,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log("[Islanders Schedule] Successfully processed", islesGames.length, "games");
    const upcoming = islesGames.filter(g => g.date.getTime() >= new Date().getTime() && g.gameState !== "FINAL");
    console.log("[Islanders Schedule] Upcoming games:", upcoming.length);
    if (upcoming.length > 0) {
      console.log("[Islanders Schedule] Next game:", upcoming[0]);
    }

    writeIslesCache(islesGames);

    renderIslesSchedule();
    startIslesCountdown();
  } catch (error) {
    console.error("[Islanders Schedule] Failed to load schedule:", {
      error,
      message: error.message,
      stack: error.stack,
      name: error.name,
      cached: !!cached,
      cachedCount: cached?.length ?? 0
    });
    
    elements.islesScheduleList.innerHTML = `
      <li class="isles-schedule__item isles-schedule__item--loading">
        Could not load the schedule right now. Refresh to try again.
      </li>
    `;
    elements.islesOpponent.textContent = cached ? "Using cached data" : "Schedule unavailable";
    if (!cached) {
      elements.islesCountdown.textContent = "—";
      elements.islesGameInfo.textContent =
        "Please check back shortly for the next puck drop.";
    }
  }
}

function renderIslesSchedule() {
  console.log("[Islanders Schedule] Rendering schedule...", {
    hasListElement: !!elements.islesScheduleList,
    totalGames: islesGames.length
  });
  
  if (!elements.islesScheduleList) {
    console.warn("[Islanders Schedule] Schedule list element not found");
    return;
  }
  
  const now = new Date();
  const upcoming = islesGames
    .filter((game) => game.date.getTime() >= now.getTime() && game.gameState !== "FINAL")
    .slice(0, 6);

  console.log("[Islanders Schedule] Filtered upcoming games:", {
    totalGames: islesGames.length,
    upcomingCount: upcoming.length,
    now: now.toISOString(),
    upcomingGames: upcoming.map(g => ({
      date: g.date.toISOString(),
      opponent: g.opponent,
      isHome: g.isHome,
      gameState: g.gameState
    }))
  });

  if (!upcoming.length) {
    console.log("[Islanders Schedule] No upcoming games found - showing season complete message");
    elements.islesScheduleList.innerHTML = `
      <li class="isles-schedule__item isles-schedule__item--loading">
        The Islanders season is complete. Check back when the new schedule drops.
      </li>
    `;
    return;
  }

  elements.islesScheduleList.innerHTML = upcoming
    .map((game) => {
      const dateStr = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(game.date);
      const timeStr = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
      }).format(game.date);
      const matchup = game.isHome ? `Isles vs ${game.opponent}` : `Isles @ ${game.opponent}`;
      const metaPieces = [timeStr];
      if (game.venue) metaPieces.push(game.venue);
      if (game.broadcast) metaPieces.push(game.broadcast);
      const meta = metaPieces.join(" • ");
      const homeAwayClass = game.isHome ? "isles-schedule__item--home" : "isles-schedule__item--away";
      return `
        <li class="isles-schedule__item ${homeAwayClass}">
          <span class="isles-schedule__date">${dateStr}</span>
          <span class="isles-schedule__matchup">${matchup}</span>
          <span class="isles-schedule__meta">${meta}</span>
        </li>
      `;
    })
    .join("");
}

function startIslesCountdown() {
  console.log("[Islanders Schedule] Starting countdown...", {
    hasCountdownElement: !!elements.islesCountdown,
    totalGames: islesGames.length
  });
  
  if (!elements.islesCountdown) {
    console.warn("[Islanders Schedule] Countdown element not found");
    return;
  }
  
  const now = new Date();
  const nextGame = islesGames.find(
    (game) => game.date.getTime() > now.getTime() && game.gameState !== "FINAL",
  );

  console.log("[Islanders Schedule] Next game search:", {
    now: now.toISOString(),
    nextGame: nextGame ? {
      date: nextGame.date.toISOString(),
      opponent: nextGame.opponent,
      isHome: nextGame.isHome,
      gameState: nextGame.gameState
    } : null
  });

  if (!nextGame) {
    console.log("[Islanders Schedule] No next game found - showing season complete");
    elements.islesOpponent.textContent = "Season Complete";
    elements.islesCountdown.textContent = "—";
    elements.islesGameInfo.textContent = "No upcoming games on the schedule right now.";
    elements.islesBroadcast.textContent = "";
    return;
  }

  elements.islesOpponent.textContent = nextGame.isHome
    ? `vs ${nextGame.opponent}`
    : `@ ${nextGame.opponent}`;
  elements.islesGameInfo.textContent = `${new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  }).format(nextGame.date)} • ${nextGame.isHome ? "UBS Arena" : nextGame.venue}`;
  elements.islesBroadcast.textContent = nextGame.broadcast ? `Broadcast: ${nextGame.broadcast}` : "";

  if (islesCountdownInterval) clearInterval(islesCountdownInterval);
  renderIslesCountdown(nextGame);
  islesCountdownInterval = setInterval(() => {
    renderIslesCountdown(nextGame);
  }, 1000);
}

function renderIslesCountdown(game) {
  if (!elements.islesCountdown) return;
  const now = new Date();
  const diffMs = game.date.getTime() - now.getTime();

  if (diffMs <= 0) {
    elements.islesCountdown.innerHTML = `<span><strong>0</strong><small>Seconds</small></span>`;
    clearInterval(islesCountdownInterval);
    loadIslesSchedule();
    return;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  elements.islesCountdown.innerHTML = `
    <span><strong>${days}</strong><small>Days</small></span>
    <span><strong>${hours.toString().padStart(2, "0")}</strong><small>Hours</small></span>
    <span><strong>${minutes.toString().padStart(2, "0")}</strong><small>Minutes</small></span>
    <span><strong>${seconds.toString().padStart(2, "0")}</strong><small>Seconds</small></span>
  `;
}

function computeNhlSeasonCode(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-11
  const startYear = month >= 6 ? year : year - 1;
  const seasonCode = `${startYear}${startYear + 1}`;
  console.log("[Islanders Schedule] Computed season code:", {
    referenceDate: referenceDate.toISOString(),
    year,
    month,
    startYear,
    seasonCode
  });
  return seasonCode;
}

function readIslesCache() {
  try {
    const raw = localStorage.getItem(ISLES_SCHEDULE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !Array.isArray(parsed.games)) {
      localStorage.removeItem(ISLES_SCHEDULE_CACHE_KEY);
      return null;
    }
    if (Date.now() - parsed.timestamp > ISLES_SCHEDULE_CACHE_TTL) {
      localStorage.removeItem(ISLES_SCHEDULE_CACHE_KEY);
      return null;
    }
    return parsed.games.map((game) => ({
      ...game,
      date: new Date(game.date),
    }));
  } catch (error) {
    console.warn("Failed to read cached Isles schedule", error);
    return null;
  }
}

function writeIslesCache(games) {
  try {
    const payload = {
      timestamp: Date.now(),
      games: games.map((game) => ({
        ...game,
        date: game.date.toISOString(),
      })),
    };
    localStorage.setItem(ISLES_SCHEDULE_CACHE_KEY, JSON.stringify(payload));
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

