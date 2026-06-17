const hero = document.querySelector(".hero-stage");
const cardSection = document.querySelector(".kod-unlocked");
const cardHeader = document.querySelector(".kod-section-head");
const cardStack = document.querySelector(".kod-stack");
const cardTrack = document.querySelector(".kod-track");
const cards = [...document.querySelectorAll(".kod-frame")];
let snapTimer = 0;
let settleTimer = 0;
let isSnapping = false;

function setSpotlight(event) {
  if (!hero) return;

  const rect = hero.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  hero.style.setProperty("--spot-x", `${Math.max(0, Math.min(100, x))}%`);
  hero.style.setProperty("--spot-y", `${Math.max(0, Math.min(100, y))}%`);
}

if (hero) {
  hero.addEventListener("pointermove", setSpotlight);
  hero.addEventListener("pointerenter", setSpotlight);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSectionState() {
  if (!cardSection || !cards.length) return null;

  const rect = cardSection.getBoundingClientRect();
  const scrollable = cardSection.offsetHeight - window.innerHeight;
  const progress = scrollable > 0 ? clamp(-rect.top / scrollable, 0, 1) : 0;

  return {
    rect,
    scrollable,
    progress,
    activeIndex: progress * (cards.length - 1),
    sectionInView: rect.top <= 2 && rect.bottom >= window.innerHeight - 2,
  };
}

function updateCardStack() {
  if (!cardSection || !cardStack || !cardTrack || !cards.length) return;

  const state = getSectionState();
  if (!state) return;

  const activeIndex = state.activeIndex;
  const lowerIndex = Math.floor(activeIndex);
  const upperIndex = Math.min(cards.length - 1, lowerIndex + 1);
  const mix = activeIndex - lowerIndex;

  document.body.classList.toggle("is-card-view", state.sectionInView);

  const headFade = clamp(1 - state.progress * 12, 0, 1);
  const headY = -72 * clamp(state.progress * 4, 0, 1);

  if (cardHeader) {
    cardHeader.style.setProperty("--head-opacity", headFade.toFixed(3));
    cardHeader.style.setProperty("--head-y", `${headY.toFixed(2)}px`);
  }

  const frameHeights = cards.map((card) => {
    const figure = card.querySelector("figure");
    return figure ? figure.offsetHeight : card.offsetHeight;
  });
  const cardScales = cards.map((_, index) => {
    const distance = Math.abs(index - activeIndex);
    return clamp(1 - distance * 0.15, 0.66, 1);
  });
  const scaledHeights = frameHeights.map(
    (height, index) => height * cardScales[index]
  );
  const cardTops = scaledHeights.reduce(
    (tops, height, index) => {
      if (index > 0) tops[index] = tops[index - 1] + scaledHeights[index - 1];
      return tops;
    },
    Array(cards.length).fill(0)
  );
  const activeTop =
    cardTops[lowerIndex] + (cardTops[upperIndex] - cardTops[lowerIndex]) * mix;
  const activeHeight =
    scaledHeights[lowerIndex] +
    (scaledHeights[upperIndex] - scaledHeights[lowerIndex]) * mix;
  const centerTop = window.innerHeight / 2 - activeHeight / 2;

  cards.forEach((card, index) => {
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);
    const opacity = clamp(1 - absDistance * 0.58, 0.18, 1);
    const brightness = clamp(1 - absDistance * 0.52, 0.24, 1);
    const wheelY = cardTops[index] - activeTop + centerTop;
    const wheelZ = -Math.min(absDistance * 170, 520);
    const rotate = clamp(distance * -16, -38, 38);

    card.style.setProperty("--card-y", `${wheelY.toFixed(2)}px`);
    card.style.setProperty("--card-z", `${wheelZ.toFixed(2)}px`);
    card.style.setProperty("--card-scale", cardScales[index].toFixed(3));
    card.style.setProperty("--card-rotate", `${rotate.toFixed(2)}deg`);
    card.style.setProperty("--card-opacity", opacity.toFixed(3));
    card.style.setProperty("--card-brightness", brightness.toFixed(3));
    card.style.setProperty(
      "--card-layer",
      `${Math.round(1000 - absDistance * 100)}`
    );
  });
}

function triggerSettle(index) {
  const card = cards[index];
  if (!card) return;

  window.clearTimeout(settleTimer);
  cards.forEach((item) => item.classList.remove("is-settling"));
  card.getBoundingClientRect();
  card.classList.add("is-settling");
  settleTimer = window.setTimeout(() => {
    card.classList.remove("is-settling");
  }, 680);
}

function snapToNearestCard() {
  if (isSnapping) return;

  const state = getSectionState();
  if (!state || !state.sectionInView || state.scrollable <= 0) return;

  const targetIndex = Math.round(state.activeIndex);
  const targetProgress = targetIndex / (cards.length - 1);
  const targetScroll =
    cardSection.offsetTop + state.scrollable * targetProgress;

  if (Math.abs(window.scrollY - targetScroll) < 3) {
    triggerSettle(targetIndex);
    return;
  }

  isSnapping = true;
  window.scrollTo({ top: targetScroll, behavior: "smooth" });

  const startedAt = performance.now();

  function waitForSnap() {
    const closeEnough = Math.abs(window.scrollY - targetScroll) < 2;
    const timedOut = performance.now() - startedAt > 1000;

    updateCardStack();

    if (closeEnough || timedOut) {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, targetScroll);
      requestAnimationFrame(() => {
        root.style.scrollBehavior = previousScrollBehavior;
        isSnapping = false;
        updateCardStack();
        triggerSettle(targetIndex);
      });
      return;
    }

    requestAnimationFrame(waitForSnap);
  }

  requestAnimationFrame(waitForSnap);
}

function scheduleSnap() {
  if (isSnapping) return;

  window.clearTimeout(snapTimer);
  snapTimer = window.setTimeout(snapToNearestCard, 150);
}

function handleScroll() {
  updateCardStack();
  scheduleSnap();
}

window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", () => {
  updateCardStack();
  scheduleSnap();
});
updateCardStack();
