// Halloween Mode: a vintage-postcard theme layered on top of the normal site.
// The <head> script in index.html sets data-theme before first paint; this file
// wires the toggle and adds/removes the decorations.

const STORAGE_KEY = "halloweenMode";
const root = document.documentElement;

const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" class="hw-sprite" aria-hidden="true" focusable="false">
  <symbol id="hw-pumpkin" viewBox="0 0 100 90">
    <path d="M47 22c-1-9 2-15 9-19l4 5c-5 3-7 7-6 14z" fill="#5d6a2c" stroke="#1a0f07" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M57 9c6-4 12-3 15 1" fill="none" stroke="#5d6a2c" stroke-width="2.5" stroke-linecap="round"/>
    <g stroke="#1a0f07" stroke-width="2.5">
      <ellipse cx="29" cy="55" rx="22" ry="29" fill="#c9561a"/>
      <ellipse cx="71" cy="55" rx="22" ry="29" fill="#c9561a"/>
      <ellipse cx="50" cy="55" rx="24" ry="32" fill="#e8741f"/>
    </g>
    <g fill="#ffd35c" stroke="#1a0f07" stroke-width="1.6" stroke-linejoin="round">
      <path d="M29 47l10-11 7 14z"/>
      <path d="M71 47l-10-11-7 14z"/>
      <path d="M50 52l-4.5 7h9z"/>
      <path d="M24 61Q50 70 76 61Q50 94 24 61z"/>
    </g>
    <g fill="#e8741f" stroke="#1a0f07" stroke-width="1.4">
      <rect x="38" y="63" width="6" height="6"/>
      <rect x="56" y="71" width="6" height="6"/>
    </g>
  </symbol>

  <symbol id="hw-spider" viewBox="0 0 60 60">
    <g fill="none" stroke="#120a05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M25 26L14 15 6 21"/><path d="M24 30L10 26 3 34"/>
      <path d="M24 34L10 38 5 48"/><path d="M26 38L16 46 13 57"/>
      <path d="M35 26L46 15 54 21"/><path d="M36 30L50 26 57 34"/>
      <path d="M36 34L50 38 55 48"/><path d="M34 38L44 46 47 57"/>
    </g>
    <ellipse cx="30" cy="38" rx="9" ry="11" fill="#120a05"/>
    <circle cx="30" cy="23" r="6" fill="#120a05"/>
    <circle cx="27.6" cy="22" r="1.4" fill="#f59a35"/>
    <circle cx="32.4" cy="22" r="1.4" fill="#f59a35"/>
  </symbol>

  <symbol id="hw-bat" viewBox="0 0 100 50">
    <path fill="#120a05" d="M50 20c-2-5-3-8-4-10l-2 6c-4-7-13-11-26-10 6 4 6 10 2 14-6-4-14-2-20 4 10 0 16 6 18 12 4-6 12-6 16-2 2-6 8-8 12-4l4-4 4 4c4-4 10-2 12 4 4-4 12-4 16 2 2-6 8-12 18-12-6-6-14-8-20-4-4-4-4-10 2-14-13-1-22 3-26 10l-2-6c-1 2-2 5-4 10z"/>
  </symbol>
</svg>`;

function buildWebSvg(size) {
  const spokes = [0, 15, 30, 45, 60, 75, 90].map((deg) => (deg * Math.PI) / 180);
  const rings = [0.16, 0.33, 0.52, 0.72, 0.93].map((r) => r * size);
  const point = (r, angle) => `${(r * Math.cos(angle)).toFixed(1)} ${(r * Math.sin(angle)).toFixed(1)}`;

  const spokePaths = spokes.map((a) => `M0 0L${point(size, a)}`);
  const ringPaths = rings.map((r) =>
    spokes
      .slice(1)
      .map((a, i) => {
        const prev = spokes[i];
        return `${i === 0 ? `M${point(r, prev)}` : ""}Q${point(r * 0.86, (prev + a) / 2)} ${point(r, a)}`;
      })
      .join(""),
  );

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <path d="${[...spokePaths, ...ringPaths].join("")}" fill="none" stroke="currentColor" stroke-width="1" />
    </svg>`;
}

function decor(tag, className, html = "") {
  const el = document.createElement(tag);
  el.className = className;
  el.dataset.hwDecor = "";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = html;
  return el;
}

const useSymbol = (id, className) =>
  `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;

function addCornerDecor(container, { side, webSize, thread }) {
  if (!container) return;
  container.append(decor("div", `hw-web hw-web--${side}`, buildWebSvg(webSize)));
  if (thread) {
    const spider = decor("div", `hw-spider hw-spider--${side}`, useSymbol("hw-spider", "hw-spider__body"));
    spider.style.setProperty("--thread", `${thread}px`);
    spider.style.setProperty("--delay", `${(Math.random() * 2).toFixed(2)}s`);
    spider.addEventListener("click", () => {
      if (spider.classList.contains("is-scurrying")) return;
      spider.classList.add("is-scurrying");
      setTimeout(() => spider.classList.remove("is-scurrying"), 2500);
    });
    container.append(spider);
  }
}

function addDecorations() {
  addCornerDecor(document.querySelector(".hero"), { side: "left", webSize: 150, thread: 130 });
  addCornerDecor(document.querySelector("#milestones"), { side: "right", webSize: 120, thread: 45 });
  addCornerDecor(document.querySelector("#isles-schedule"), { side: "right", webSize: 130, thread: 70 });

  const orbit = document.querySelector(".orbit");
  if (orbit) {
    orbit.append(decor("div", "hw-moon"));
    [0, 1, 2].forEach((i) => {
      const bat = decor("span", "hw-bat-orbit", useSymbol("hw-bat", "hw-bat"));
      bat.style.setProperty("--i", i);
      orbit.append(bat);
    });
  }

  document
    .getElementById("progress-bar")
    ?.append(decor("span", "hw-runner", useSymbol("hw-pumpkin", "hw-pumpkin")));

  document.querySelector(".hero__visual")?.append(
    decor(
      "div",
      "hw-patch hw-patch--hero",
      useSymbol("hw-pumpkin", "hw-pumpkin hw-pumpkin--sm") + useSymbol("hw-pumpkin", "hw-pumpkin"),
    ),
  );

  document.querySelector(".footer")?.prepend(
    decor(
      "div",
      "hw-patch",
      ["sm", "lg", "md"].map((size) => useSymbol("hw-pumpkin", `hw-pumpkin hw-pumpkin--${size}`)).join(""),
    ),
  );

  document.body.append(decor("div", "hw-sky", useSymbol("hw-bat", "hw-bat")));
}

function swapText(isHalloween) {
  document.querySelectorAll("[data-halloween-text]").forEach((el) => {
    if (el.dataset.defaultText === undefined) {
      el.dataset.defaultText = el.textContent.trim();
    }
    el.textContent = isHalloween ? el.dataset.halloweenText : el.dataset.defaultText;
  });
}

function applyTheme(isHalloween) {
  if (isHalloween) {
    root.dataset.theme = "halloween";
  } else {
    delete root.dataset.theme;
  }
  document.querySelectorAll("[data-hw-decor]").forEach((el) => el.remove());
  if (isHalloween) addDecorations();
  swapText(isHalloween);

  const toggle = document.getElementById("halloween-toggle");
  toggle?.setAttribute("aria-pressed", String(isHalloween));
}

function init() {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  applyTheme(root.dataset.theme === "halloween");

  document.getElementById("halloween-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme !== "halloween";
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Private mode: the toggle still works for this visit.
    }
    applyTheme(next);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
