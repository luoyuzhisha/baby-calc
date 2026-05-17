const QUESTION_MODE_OPTIONS = {
  "10-add": { id: "10-add", rangeMax: 10, operator: "+" },
  "10-subtract": { id: "10-subtract", rangeMax: 10, operator: "-" },
  "20-add": { id: "20-add", rangeMax: 20, operator: "+" },
  "20-subtract": { id: "20-subtract", rangeMax: 20, operator: "-" },
};

const STAGE_ORDER = ["A", "B", "C"];
const STAGE_CONFIG = {
  A: {
    id: "A",
    title: "A 热身关",
    targetCount: 8,
    softLimitMs: 150000,
    modePlan: ["10-add", "10-add", "10-add", "10-subtract"],
    line: "我们先做热身题，拿到第一颗星星。",
  },
  B: {
    id: "B",
    title: "B 主训练关",
    targetCount: 10,
    softLimitMs: 210000,
    modePlan: ["10-subtract", "10-subtract", "20-add", "10-subtract", "20-add"],
    line: "主训练开始，精灵会带你做勇敢题。",
  },
  C: {
    id: "C",
    title: "C 挑战关",
    targetCount: 3,
    softLimitMs: 120000,
    modePlan: ["20-subtract"],
    line: "挑战关来啦，试一试就很棒。",
  },
};

const STORAGE_RECORDS_KEY = "baby_calc_daily_records_v1";
const STORAGE_SETTINGS_KEY = "baby_calc_settings_v1";
const HISTORY_WINDOW_DAYS = 7;
const CLEANUP_BEFORE_DAYS = 8;

const DEFAULT_QUESTION_MS = 30000;
const CLOUD_THRESHOLDS = {
  greenEnd: 0.55,
  midEnd: 0.25,
};
const GENTLE_PROMPT_THRESHOLD = 2;
const BREAK_DURATION_SEC = 30;
const MAX_ANSWER_DIGITS = 2;
const LIGHT_REWARD_DURATION_MS = 1500;
const AUTO_NEXT_DELAY_AFTER_CORRECT_MS = LIGHT_REWARD_DURATION_MS;
const STAGE_VIDEO_MIN = 1;
const STAGE_VIDEO_MAX = 12;
const REWARD_ANIMATION_MODE_VIDEO = "video";
const REWARD_ANIMATION_MODE_GIF = "gif";
const STAGE_REWARD_DURATION_MS = 30000;
const STAGE_PASS_MIN_ACCURACY = 0.8;
const QUESTION_DURATION_MIN_SEC = 10;
const QUESTION_DURATION_MAX_SEC = 90;
const QUESTION_DURATION_STEP_SEC = 10;
const SOUND_RIGHT_URL = "./sound/right.wav";
const SOUND_ERROR_URL = "./sound/error.wav";

const SPRITE_LINES = {
  sessionStart: "准备好了吗？我们先热身！",
  stageAStart: "先拿几颗星星，手感热起来。",
  stageBStart: "主训练开始，我们会遇到一点点挑战。",
  stageCStart: "挑战关登场，试一题就很勇敢。",
  challengeInsert: "我们来试一道勇敢题，你可以的！",
  recoverStart: "没关系，先做两题简单的，再回来找我玩！",
  recoverDone: "你调整得很好，我们继续冒险。",
  challengeLocked: "今天先把主训练做好，明天再挑战大关。",
  breakResume: "休息好了，我们继续吧！",
};

const FEEDBACK_LINES = {
  directCorrect: [
    "你越来越熟练了！",
    "这题答得真稳！",
    "节奏很棒，继续！",
  ],
  assistedCorrect: [
    "我们一起做到了！",
    "刚才的提示你用好啦！",
    "配合得真好！",
  ],
  redSoloCorrect: [
    "你自己想出来了，真厉害！",
  ],
  wrong: [
    "这题先记住答案，下题继续冲！",
    "没关系，下一题会更顺！",
  ],
};

const REWARD_MESSAGES = {
  A: "热身关完成，第一颗星星到手！",
  B: "主训练关完成，你很坚持！",
  C: "挑战关完成，今天很勇敢！",
};

const state = {
  phase: "idle",
  currentStageId: "A",
  stageStartAt: 0,
  stageQuestionIndex: 0,
  currentQuestion: null,
  currentInput: "",
  previousSignature: "",
  questionStartAt: 0,
  lastInteractionAt: 0,
  questionDeadline: 0,
  currentModeId: "10-add",
  timer: {
    rafId: null,
    breakTimerId: null,
  },
  prompt: {
    shownCount: 0,
    modalOpen: false,
  },
  breakState: {
    active: false,
    remainingSec: BREAK_DURATION_SEC,
  },
  assist: {
    used: false,
    splitShown: false,
    binaryShown: false,
    counted: false,
  },
  session: {
    totalQuestions: 0,
    correct: 0,
    wrong: 0,
    assistCount: 0,
    stagesDone: 0,
    challengeAttempted: false,
    challengeCompleted: false,
    refusalEvents: 0,
    recoveryMode: false,
    recoveryQueue: [],
    consecutiveCorrect: 0,
    currentStageMap: {
      A: { done: false, asked: 0, correct: 0 },
      B: { done: false, asked: 0, correct: 0 },
      C: { done: false, asked: 0, correct: 0 },
    },
    modeStats: createEmptyModeStats(),
    questionLogs: [],
  },
  history: {
    dailyRecords: {},
    unlockedToday: false,
  },
  settings: {
    soundOn: false,
    questionDurationMs: DEFAULT_QUESTION_MS,
    rewardAnimationMode: REWARD_ANIMATION_MODE_VIDEO,
  },
  ui: {
    spriteLineKey: "",
    rewardTimerId: null,
    rewardSkippable: false,
    rewardAnimationIndex: STAGE_VIDEO_MIN,
    lightRewardTimerId: null,
  },
};

const elements = {
  stageTitle: document.getElementById("stageTitle"),
  stageChipA: document.getElementById("stageChipA"),
  stageChipB: document.getElementById("stageChipB"),
  stageChipC: document.getElementById("stageChipC"),
  stageMeta: document.getElementById("stageMeta"),
  questionDurationSelect: document.getElementById("questionDurationSelect"),
  soundBtn: document.getElementById("soundBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),

  questionCount: document.getElementById("questionCount"),
  questionText: document.getElementById("questionText"),
  answerPreview: document.getElementById("answerPreview"),
  statusText: document.getElementById("statusText"),
  spriteLine: document.getElementById("spriteLine"),
  assistHint: document.getElementById("assistHint"),
  binaryChoices: document.getElementById("binaryChoices"),
  lightReward: document.getElementById("lightReward"),

  answerPad: document.getElementById("answerPad"),
  clearBtn: document.getElementById("clearBtn"),
  submitBtn: document.getElementById("submitBtn"),
  nextBtn: document.getElementById("nextBtn"),

  correctCount: document.getElementById("correctCount"),
  wrongCount: document.getElementById("wrongCount"),
  assistCount: document.getElementById("assistCount"),

  timeLeft: document.getElementById("timeLeft"),
  cloudFriend: document.getElementById("cloudFriend"),
  cloudFace: document.getElementById("cloudFace"),
  cloudText: document.getElementById("cloudText"),

  gentlePromptModal: document.getElementById("gentlePromptModal"),
  gentleContinueBtn: document.getElementById("gentleContinueBtn"),
  gentleBreakBtn: document.getElementById("gentleBreakBtn"),

  breakOverlay: document.getElementById("breakOverlay"),
  breakText: document.getElementById("breakText"),
  breakResumeBtn: document.getElementById("breakResumeBtn"),

  rewardOverlay: document.getElementById("rewardOverlay"),
  rewardTitle: document.getElementById("rewardTitle"),
  rewardText: document.getElementById("rewardText"),
  rewardAnimationModeSelect: document.getElementById("rewardAnimationModeSelect"),
  stageRewardVideo: document.getElementById("stageRewardVideo"),
  stageRewardGif: document.getElementById("stageRewardGif"),
  rewardSkipBtn: document.getElementById("rewardSkipBtn"),

  summaryModal: document.getElementById("summaryModal"),
  summaryText: document.getElementById("summaryText"),
  finalStages: document.getElementById("finalStages"),
  finalAccuracy: document.getElementById("finalAccuracy"),
  finalCourage: document.getElementById("finalCourage"),
  finalStrategy: document.getElementById("finalStrategy"),
  finalProgress: document.getElementById("finalProgress"),
  fireworkBurst: document.getElementById("fireworkBurst"),
  restartBtn: document.getElementById("restartBtn"),
};

document.addEventListener("DOMContentLoaded", () => {
  init();
});

function init() {
  loadHistoryAndSettings();
  mountQuestionDurationOptions();
  syncQuestionDurationSelect();
  syncRewardAnimationModeSelect();
  mountNumberButtons();
  bindEvents();
  setupFullscreenSupport();
  renderSoundButton();
  startSession();
}

function createEmptyModeStats() {
  return {
    "10-add": { asked: 0, correct: 0, assist: 0, totalMs: 0 },
    "10-subtract": { asked: 0, correct: 0, assist: 0, totalMs: 0 },
    "20-add": { asked: 0, correct: 0, assist: 0, totalMs: 0 },
    "20-subtract": { asked: 0, correct: 0, assist: 0, totalMs: 0 },
  };
}

function loadHistoryAndSettings() {
  const recordsRaw = safeParseJson(localStorage.getItem(STORAGE_RECORDS_KEY), {});
  const settingsRaw = safeParseJson(localStorage.getItem(STORAGE_SETTINGS_KEY), {});
  state.history.dailyRecords = cleanupOldRecords(recordsRaw);
  state.settings.soundOn = Boolean(settingsRaw.soundOn);

  const durationMs = Number(settingsRaw.questionDurationMs);
  if (isValidQuestionDurationMs(durationMs)) {
    state.settings.questionDurationMs = durationMs;
  } else {
    state.settings.questionDurationMs = DEFAULT_QUESTION_MS;
  }

  state.settings.rewardAnimationMode = normalizeRewardAnimationMode(settingsRaw.rewardAnimationMode);
}

function safeParseJson(text, fallback) {
  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function cleanupOldRecords(records) {
  const kept = {};
  const today = getTodayDateString();
  const cutoff = dateOffset(today, -(CLEANUP_BEFORE_DAYS - 1));

  Object.keys(records).forEach((key) => {
    if (key >= cutoff && key <= today && Array.isArray(records[key])) {
      kept[key] = records[key];
    }
  });

  persistRecords(kept);
  return kept;
}

function persistRecords(records) {
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

function persistSettings() {
  localStorage.setItem(
    STORAGE_SETTINGS_KEY,
    JSON.stringify({
      soundOn: state.settings.soundOn,
      questionDurationMs: state.settings.questionDurationMs,
      rewardAnimationMode: state.settings.rewardAnimationMode,
    }),
  );
}

function normalizeRewardAnimationMode(mode) {
  if (mode === REWARD_ANIMATION_MODE_GIF) {
    return REWARD_ANIMATION_MODE_GIF;
  }
  return REWARD_ANIMATION_MODE_VIDEO;
}

function mountNumberButtons() {
  elements.answerPad.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (let value = 0; value <= 9; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-btn";
    button.dataset.value = String(value);
    button.textContent = String(value);
    button.setAttribute("aria-label", `数字 ${value}`);
    fragment.appendChild(button);
  }

  elements.answerPad.appendChild(fragment);
}

function bindEvents() {
  elements.answerPad.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-value]");
    if (!target || state.phase !== "answering") {
      return;
    }

    chooseInput(target.dataset.value);
    markInteraction("input");
  });

  elements.clearBtn.addEventListener("click", () => {
    if (state.phase !== "answering") {
      return;
    }

    state.currentInput = state.currentInput.length <= 1 ? "" : state.currentInput.slice(0, -1);
    renderInputPreview();
    syncSelectedNumberButton();
    markInteraction("clear");
  });

  elements.submitBtn.addEventListener("click", () => {
    submitAnswer();
    markInteraction("submit");
  });

  if (elements.nextBtn) {
    elements.nextBtn.addEventListener("click", () => {
      if (state.phase !== "waiting-next") {
        return;
      }
      advanceAfterManualNext();
    });
  }

  elements.soundBtn.addEventListener("click", () => {
    state.settings.soundOn = !state.settings.soundOn;
    persistSettings();
    renderSoundButton();
  });

  if (elements.questionDurationSelect) {
    elements.questionDurationSelect.addEventListener("change", applyQuestionDurationFromSelect);
  }

  if (elements.rewardAnimationModeSelect) {
    elements.rewardAnimationModeSelect.addEventListener("change", () => {
      state.settings.rewardAnimationMode = normalizeRewardAnimationMode(elements.rewardAnimationModeSelect.value);
      persistSettings();
      syncRewardAnimationModeSelect();
      if (!elements.rewardOverlay.classList.contains("hidden")) {
        renderStageRewardMedia(state.currentStageId, state.ui.rewardAnimationIndex);
      }
    });
  }

  elements.restartBtn.addEventListener("click", startSession);

  elements.gentleContinueBtn.addEventListener("click", () => {
    closeGentlePrompt();
    resumeQuestionFromPrompt();
  });

  elements.gentleBreakBtn.addEventListener("click", () => {
    closeGentlePrompt();
    startBreak();
  });

  elements.breakResumeBtn.addEventListener("click", () => {
    finishBreak(true);
  });

  elements.rewardSkipBtn.addEventListener("click", () => {
    closeRewardOverlay();
    proceedAfterReward();
  });

  elements.rewardOverlay.addEventListener("click", (event) => {
    if (!state.ui.rewardSkippable) {
      return;
    }

    closeRewardOverlay();
    proceedAfterReward();
  });

  if (elements.fullscreenBtn) {
    elements.fullscreenBtn.addEventListener("click", () => {
      toggleFullscreen();
    });
  }
}

function setupFullscreenSupport() {
  if (!elements.fullscreenBtn) {
    return;
  }

  if (!isFullscreenAvailable()) {
    elements.fullscreenBtn.disabled = true;
    elements.fullscreenBtn.textContent = "不支持全屏";
    return;
  }

  updateFullscreenButtonState();
  document.addEventListener("fullscreenchange", updateFullscreenButtonState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButtonState);
}

function isFullscreenAvailable() {
  const rootElement = document.documentElement;
  return (
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    typeof rootElement.requestFullscreen === "function" ||
    typeof rootElement.webkitRequestFullscreen === "function"
  );
}

async function toggleFullscreen() {
  if (!isFullscreenAvailable()) {
    return;
  }

  try {
    if (isFullscreenActive()) {
      await exitAnyFullscreen();
    } else {
      await requestFullscreenForRoot();
    }
  } catch (error) {
    console.warn("切换全屏失败", error);
  } finally {
    updateFullscreenButtonState();
  }
}

function updateFullscreenButtonState() {
  if (!elements.fullscreenBtn) {
    return;
  }

  elements.fullscreenBtn.textContent = isFullscreenActive() ? "退出全屏" : "全屏";
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function requestFullscreenForRoot() {
  const rootElement = document.documentElement;

  if (typeof rootElement.requestFullscreen === "function") {
    return rootElement.requestFullscreen();
  }

  if (typeof rootElement.webkitRequestFullscreen === "function") {
    return rootElement.webkitRequestFullscreen();
  }

  return Promise.reject(new Error("当前环境不支持进入全屏"));
}

function exitAnyFullscreen() {
  if (typeof document.exitFullscreen === "function") {
    return document.exitFullscreen();
  }

  if (typeof document.webkitExitFullscreen === "function") {
    return document.webkitExitFullscreen();
  }

  return Promise.reject(new Error("当前环境不支持退出全屏"));
}

function renderSoundButton() {
  elements.soundBtn.textContent = state.settings.soundOn ? "音效：开" : "音效：关";
}

function syncRewardAnimationModeSelect() {
  if (!elements.rewardAnimationModeSelect) {
    return;
  }
  elements.rewardAnimationModeSelect.value = normalizeRewardAnimationMode(state.settings.rewardAnimationMode);
}

function mountQuestionDurationOptions() {
  if (!elements.questionDurationSelect) {
    return;
  }

  elements.questionDurationSelect.innerHTML = "";
  for (
    let second = QUESTION_DURATION_MIN_SEC;
    second <= QUESTION_DURATION_MAX_SEC;
    second += QUESTION_DURATION_STEP_SEC
  ) {
    const option = document.createElement("option");
    option.value = String(second);
    option.textContent = `${second}s`;
    elements.questionDurationSelect.appendChild(option);
  }
}

function syncQuestionDurationSelect() {
  if (!elements.questionDurationSelect) {
    return;
  }

  const seconds = Math.round(state.settings.questionDurationMs / 1000);
  elements.questionDurationSelect.value = String(seconds);
}

function isValidQuestionDurationMs(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return false;
  }

  const second = durationMs / 1000;
  const isValidStep = Number.isInteger((second - QUESTION_DURATION_MIN_SEC) / QUESTION_DURATION_STEP_SEC);
  return (
    Number.isInteger(second) &&
    second >= QUESTION_DURATION_MIN_SEC &&
    second <= QUESTION_DURATION_MAX_SEC &&
    isValidStep
  );
}

function applyQuestionDurationFromSelect() {
  if (!elements.questionDurationSelect) {
    return;
  }

  const selectedSecond = Number(elements.questionDurationSelect.value);
  const isValidStep = Number.isInteger((selectedSecond - QUESTION_DURATION_MIN_SEC) / QUESTION_DURATION_STEP_SEC);
  if (
    !Number.isFinite(selectedSecond) ||
    selectedSecond < QUESTION_DURATION_MIN_SEC ||
    selectedSecond > QUESTION_DURATION_MAX_SEC ||
    !isValidStep
  ) {
    syncQuestionDurationSelect();
    return;
  }

  state.settings.questionDurationMs = selectedSecond * 1000;
  persistSettings();

  if (state.phase === "answering") {
    // Rebase current question timer immediately on duration change.
    const now = performance.now();
    state.questionStartAt = now;
    state.lastInteractionAt = now;
    state.questionDeadline = now + state.settings.questionDurationMs;
    setStatus("info", `本题重新计时：${selectedSecond}s`);
    renderTimerVisuals(state.settings.questionDurationMs, state.settings.questionDurationMs, 1);
  }
}

function startSession() {
  stopQuestionTimer();
  stopBreakCountdown();
  resetSessionState();

  elements.summaryModal.classList.add("hidden");
  elements.fireworkBurst.classList.add("hidden");
  closeRewardOverlay();
  closeGentlePrompt();
  closeBreakOverlay();
  hideLightReward();
  hideNextButton();

  setSpriteLine("sessionStart");
  renderScoreBoard();
  renderStageChips();
  goToStage("A");
}

function resetSessionState() {
  state.phase = "idle";
  state.currentStageId = "A";
  state.stageStartAt = 0;
  state.stageQuestionIndex = 0;
  state.currentQuestion = null;
  state.currentInput = "";
  state.previousSignature = "";
  state.questionStartAt = 0;
  state.lastInteractionAt = 0;
  state.questionDeadline = 0;
  state.currentModeId = "10-add";
  state.prompt.shownCount = 0;
  state.prompt.modalOpen = false;
  state.breakState.active = false;
  state.breakState.remainingSec = BREAK_DURATION_SEC;
  state.assist.used = false;
  state.assist.splitShown = false;
  state.assist.binaryShown = false;
  state.assist.counted = false;

  state.session.totalQuestions = 0;
  state.session.correct = 0;
  state.session.wrong = 0;
  state.session.assistCount = 0;
  state.session.stagesDone = 0;
  state.session.challengeAttempted = false;
  state.session.challengeCompleted = false;
  state.session.refusalEvents = 0;
  state.session.recoveryMode = false;
  state.session.recoveryQueue = [];
  state.session.consecutiveCorrect = 0;
  state.session.currentStageMap = {
    A: { done: false, asked: 0, correct: 0 },
    B: { done: false, asked: 0, correct: 0 },
    C: { done: false, asked: 0, correct: 0 },
  };
  state.session.modeStats = createEmptyModeStats();
  state.session.questionLogs = [];

  state.history.unlockedToday = isChallengeUnlockedByHistory();
}

function isChallengeUnlockedByHistory() {
  const records = getRecentRecords(HISTORY_WINDOW_DAYS);
  if (records.length === 0) {
    return false;
  }

  const lastTwo10Sub = records.filter((item) => item.mode === "10-subtract").slice(-2);
  const last20Add = records.filter((item) => item.mode === "20-add").slice(-1);
  const refusalHeavy = records.filter((item) => item.refusalEvent).length >= 4;

  const tenSubOk =
    lastTwo10Sub.length === 2 &&
    lastTwo10Sub.every((item) => Number(item.correctRate || 0) >= 0.8);
  const twentyAddOk =
    last20Add.length === 1 && Number(last20Add[0].correctRate || 0) >= 0.7;

  return tenSubOk && twentyAddOk && !refusalHeavy;
}

function getRecentRecords(days) {
  const today = getTodayDateString();
  const from = dateOffset(today, -(days - 1));
  const results = [];

  Object.keys(state.history.dailyRecords)
    .sort()
    .forEach((key) => {
      if (key < from || key > today) {
        return;
      }

      const daily = state.history.dailyRecords[key];
      daily.forEach((entry) => {
        results.push(entry);
      });
    });

  return results;
}

function goToStage(stageId) {
  const stage = STAGE_CONFIG[stageId];
  if (!stage) {
    finishSession();
    return;
  }

  if (stageId === "C" && !state.history.unlockedToday) {
    elements.stageTitle.textContent = `${STAGE_CONFIG.C.title}（今日锁定）`;
    elements.stageMeta.textContent = "今天先把主训练练扎实，挑战关明天再来。";
    renderStageChips();
    setSpriteLine("challengeLocked");
    setStatus("info", "挑战关今天先锁定，我们下次再来。");
    finishSession();
    return;
  }

  state.currentStageId = stageId;
  state.stageStartAt = performance.now();
  state.stageQuestionIndex = 0;
  state.phase = "stage";
  state.session.recoveryMode = false;
  state.session.recoveryQueue = [];

  renderStageChips();
  elements.stageTitle.textContent = `${stage.title}`;
  elements.stageMeta.textContent = stage.line;

  if (stageId === "A") {
    setSpriteLine("stageAStart");
  } else if (stageId === "B") {
    setSpriteLine("stageBStart");
  } else {
    setSpriteLine("stageCStart");
  }

  nextQuestion();
}

function nextQuestion() {
  if (state.phase === "finished") {
    return;
  }

  hideLightReward();
  hideNextButton();

  if (state.session.recoveryMode && state.session.recoveryQueue.length === 0) {
    state.session.recoveryMode = false;
    setSpriteLine("recoverDone");
  }

  if (shouldStageEndNow()) {
    completeCurrentStage();
    return;
  }

  const stageId = state.currentStageId;
  const stage = STAGE_CONFIG[stageId];

  const modeId = pickModeForCurrentQuestion(stageId, stage);
  state.currentModeId = modeId;

  if (modeId === "20-subtract") {
    state.session.challengeAttempted = true;
    setSpriteLine("challengeInsert");
  }

  const mode = QUESTION_MODE_OPTIONS[modeId];
  state.stageQuestionIndex += 1;
  state.session.totalQuestions += 1;
  state.session.currentStageMap[stageId].asked += 1;
  state.currentQuestion = generateQuestion(state.previousSignature, mode.rangeMax, mode.operator);
  state.previousSignature = state.currentQuestion.signature;
  state.currentInput = "";
  state.phase = "answering";
  state.questionStartAt = performance.now();
  state.lastInteractionAt = state.questionStartAt;
  state.questionDeadline = state.questionStartAt + state.settings.questionDurationMs;
  state.assist.used = false;
  state.assist.splitShown = false;
  state.assist.binaryShown = false;
  state.assist.counted = false;
  state.prompt.shownCount = 0;

  renderQuestion();
  renderInputPreview();
  syncSelectedNumberButton();
  resetAssistUI();
  setAnswerControlsEnabled(true);
  setStatus("info", "慢慢来，我们一起完成。");
  startQuestionTimer();
}

function shouldStageEndNow() {
  const stage = STAGE_CONFIG[state.currentStageId];
  if (!stage) {
    return true;
  }

  const stageElapsed = performance.now() - state.stageStartAt;
  const reachedCount = state.stageQuestionIndex >= stage.targetCount;
  const reachedSoftLimit = stageElapsed >= stage.softLimitMs;

  if (state.session.recoveryMode) {
    return state.session.recoveryQueue.length === 0;
  }

  return reachedCount || reachedSoftLimit;
}

function completeCurrentStage() {
  stopQuestionTimer();
  const currentStage = state.currentStageId;
  if (!isStageQualifiedForProgress(currentStage)) {
    state.phase = "stage-incomplete";
    setStatus("warning", `${STAGE_CONFIG[currentStage].title}未达成过关条件，本次先结束。`);
    setSpriteLine("今天先到这里，我们下次继续。");
    finishSession();
    return;
  }

  state.phase = "stage-complete";
  state.session.currentStageMap[currentStage].done = true;
  state.session.stagesDone += 1;

  if (currentStage === "C" && state.session.challengeAttempted) {
    state.session.challengeCompleted = true;
  }

  renderStageChips();
  showStageReward(currentStage, REWARD_MESSAGES[currentStage]);
}

function showStageReward(stageId, text) {
  elements.rewardTitle.textContent = `${STAGE_CONFIG[stageId].title} 完成`;
  elements.rewardText.textContent = text;
  state.ui.rewardAnimationIndex = pickRandomStageVideoIndex();
  renderStageRewardMedia(stageId, state.ui.rewardAnimationIndex);
  elements.rewardOverlay.classList.remove("hidden");
  state.ui.rewardSkippable = true;

  if (state.ui.rewardTimerId) {
    window.clearTimeout(state.ui.rewardTimerId);
  }

  state.ui.rewardTimerId = window.setTimeout(() => {
    closeRewardOverlay();
    proceedAfterReward();
  }, STAGE_REWARD_DURATION_MS);
}

function closeRewardOverlay() {
  elements.rewardOverlay.classList.add("hidden");
  state.ui.rewardSkippable = false;
  hideStageRewardMedia();

  if (state.ui.rewardTimerId) {
    window.clearTimeout(state.ui.rewardTimerId);
    state.ui.rewardTimerId = null;
  }
}

function proceedAfterReward() {
  if (state.phase === "finished") {
    return;
  }

  const currentIndex = STAGE_ORDER.indexOf(state.currentStageId);
  const nextStageId = STAGE_ORDER[currentIndex + 1];
  if (!nextStageId) {
    finishSession();
    return;
  }

  goToStage(nextStageId);
}

function renderStageRewardMedia(stageId, index) {
  if (!elements.stageRewardVideo || !elements.stageRewardGif) {
    return;
  }

  if (stageId !== "A" && stageId !== "B" && stageId !== "C") {
    hideStageRewardMedia();
    return;
  }

  const mode = normalizeRewardAnimationMode(state.settings.rewardAnimationMode);
  if (mode === REWARD_ANIMATION_MODE_GIF) {
    renderStageRewardGif(index);
    return;
  }

  renderStageRewardVideo(index);
}

function renderStageRewardVideo(index) {
  if (!elements.stageRewardVideo || !elements.stageRewardGif) {
    return;
  }

  const video = elements.stageRewardVideo;
  const preferredSrc = buildStageRewardSrc(index, REWARD_ANIMATION_MODE_VIDEO);
  const fallbackSrc = buildStageRewardSrc(STAGE_VIDEO_MIN, REWARD_ANIMATION_MODE_VIDEO);
  hideStageRewardGif();

  const playSource = (src, isFallback) => {
    video.onerror = () => {
      video.onerror = null;
      if (isFallback) {
        hideStageRewardMedia();
        return;
      }
      playSource(fallbackSrc, true);
    };

    video.pause();
    video.classList.remove("hidden");
    video.removeAttribute("src");
    video.load();
    video.src = src;
    video.currentTime = 0;
    video.load();
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay rejections and keep UI flow running.
      });
    }
  };

  playSource(preferredSrc, preferredSrc === fallbackSrc);
}

function renderStageRewardGif(index) {
  if (!elements.stageRewardGif || !elements.stageRewardVideo) {
    return;
  }

  const gif = elements.stageRewardGif;
  const preferredSrc = buildStageRewardSrc(index, REWARD_ANIMATION_MODE_GIF);
  const fallbackSrc = buildStageRewardSrc(STAGE_VIDEO_MIN, REWARD_ANIMATION_MODE_GIF);
  hideStageRewardVideo();

  const showSource = (src, isFallback) => {
    gif.onerror = () => {
      gif.onerror = null;
      if (isFallback) {
        hideStageRewardMedia();
        return;
      }
      showSource(fallbackSrc, true);
    };

    gif.classList.remove("hidden");
    gif.removeAttribute("src");
    gif.src = src;
  };

  showSource(preferredSrc, preferredSrc === fallbackSrc);
}

function hideStageRewardMedia() {
  hideStageRewardVideo();
  hideStageRewardGif();
}

function hideStageRewardVideo() {
  if (!elements.stageRewardVideo) {
    return;
  }

  const video = elements.stageRewardVideo;
  video.pause();
  video.classList.add("hidden");
  video.onerror = null;
  video.removeAttribute("src");
  video.load();
}

function hideStageRewardGif() {
  if (!elements.stageRewardGif) {
    return;
  }

  const gif = elements.stageRewardGif;
  gif.classList.add("hidden");
  gif.onerror = null;
  gif.removeAttribute("src");
}

function pickRandomStageVideoIndex() {
  return randomIntInRange(STAGE_VIDEO_MIN, STAGE_VIDEO_MAX);
}

function buildStageRewardSrc(index, mode) {
  if (mode === REWARD_ANIMATION_MODE_GIF) {
    return `./img/jiesuan_${index}.gif`;
  }
  return `./video/jiesuan_${index}.mp4`;
}

function pickModeForCurrentQuestion(stageId, stage) {
  if (state.session.recoveryMode && state.session.recoveryQueue.length > 0) {
    return state.session.recoveryQueue.shift();
  }

  const turn = state.stageQuestionIndex;
  const baseMode = stage.modePlan[turn % stage.modePlan.length];

  if (stageId === "B") {
    const needsEasier = detectNeedsRecoveryByPerformance();
    if (needsEasier) {
      return turn % 3 === 0 ? "10-subtract" : "10-add";
    }

    if (turn % 5 === 3 && state.history.unlockedToday) {
      return "20-subtract";
    }
  }

  if (stageId === "C") {
    return "20-subtract";
  }

  return baseMode;
}

function detectNeedsRecoveryByPerformance() {
  const logs = state.session.questionLogs;
  if (logs.length < 4) {
    return false;
  }

  const recent = logs.slice(-4);
  const wrongCount = recent.filter((item) => !item.correct).length;
  const assistHeavy = recent.filter((item) => item.usedAssist).length >= 3;

  return wrongCount >= 3 || assistHeavy;
}

function renderStageChips() {
  renderStageChip(elements.stageChipA, "A");
  renderStageChip(elements.stageChipB, "B");
  renderStageChip(elements.stageChipC, "C");
}

function renderStageChip(element, stageId) {
  const isCurrent = stageId === state.currentStageId && state.phase !== "finished";
  const isDone = state.session.currentStageMap[stageId].done;
  element.classList.toggle("active", isCurrent);
  element.classList.toggle("done", isDone);
}

function renderQuestion() {
  const stage = STAGE_CONFIG[state.currentStageId];
  const { left, operator, right } = state.currentQuestion;
  const currentAsked = state.session.currentStageMap[state.currentStageId].asked;
  elements.questionCount.textContent = `${stage.title} 第 ${currentAsked} / ${stage.targetCount} 题`;
  elements.questionText.textContent = `${left} ${operator} ${right} = ?`;
}

function setSpriteLine(lineKeyOrText) {
  if (SPRITE_LINES[lineKeyOrText]) {
    if (state.ui.spriteLineKey === lineKeyOrText) {
      return;
    }
    state.ui.spriteLineKey = lineKeyOrText;
    elements.spriteLine.textContent = `小挑战精灵：${SPRITE_LINES[lineKeyOrText]}`;
    return;
  }

  state.ui.spriteLineKey = "custom";
  elements.spriteLine.textContent = `小挑战精灵：${lineKeyOrText}`;
}

function setStatus(status, message) {
  elements.statusText.className = `status-line status-${status}`;
  elements.statusText.textContent = message;
}

function startQuestionTimer() {
  stopQuestionTimer();

  const tick = (now) => {
    if (state.phase !== "answering") {
      return;
    }

    const elapsed = now - state.questionStartAt;
    const totalMs = state.settings.questionDurationMs;
    const remainingMs = Math.max(0, totalMs - elapsed);
    const ratio = remainingMs / totalMs;

    renderTimerVisuals(remainingMs, totalMs, ratio);
    maybeTriggerAutoAssist(ratio);
    maybeTriggerGentlePrompt(now);

    state.timer.rafId = window.requestAnimationFrame(tick);
  };

  state.timer.rafId = window.requestAnimationFrame(tick);
}

function stopQuestionTimer() {
  if (state.timer.rafId !== null) {
    window.cancelAnimationFrame(state.timer.rafId);
    state.timer.rafId = null;
  }
}

function renderTimerVisuals(remainingMs, totalMs, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  elements.timeLeft.textContent = `${(remainingMs / 1000).toFixed(1)}s`;

  if (clamped > CLOUD_THRESHOLDS.greenEnd) {
    setCloudState("green");
  } else if (clamped > CLOUD_THRESHOLDS.midEnd) {
    setCloudState("mid");
  } else {
    setCloudState("red");
  }

  if (remainingMs <= 0) {
    setCloudState("red");
    if (!state.assist.binaryShown) {
      showBinaryChoice();
    }
  }
}

function setCloudState(stage) {
  elements.cloudFriend.classList.remove("cloud-green", "cloud-mid", "cloud-red");
  if (stage === "green") {
    elements.cloudFriend.classList.add("cloud-green");
    elements.cloudFace.textContent = "😊";
    elements.cloudText.textContent = "云朵在陪你想一想";
    return;
  }

  if (stage === "mid") {
    elements.cloudFriend.classList.add("cloud-mid");
    elements.cloudFace.textContent = "🙂";
    elements.cloudText.textContent = "云朵慢慢飘走啦";
    return;
  }

  elements.cloudFriend.classList.add("cloud-red");
  elements.cloudFace.textContent = "😮";
  elements.cloudText.textContent = "云朵快飘走了，看看小提示";
}

function maybeTriggerAutoAssist(ratio) {
  if (ratio > CLOUD_THRESHOLDS.midEnd) {
    return;
  }

  if (state.assist.splitShown) {
    return;
  }

  showSplitAssist();
}

function showSplitAssist() {
  const q = state.currentQuestion;
  const hint = buildSplitHint(q.left, q.operator, q.right);
  state.assist.used = true;
  state.assist.splitShown = true;

  elements.assistHint.textContent = hint;
  elements.assistHint.classList.remove("hidden");
  setStatus("help", "小提示来了，继续试试看。");
  increaseAssistStats();
}

function buildSplitHint(left, operator, right) {
  if (operator === "+") {
    const rest = left >= 10 ? left - 10 : right;
    if (left >= 10) {
      return `小提示：${left} 可以看成 10 和 ${rest}，再加 ${right}。`;
    }
    return `小提示：先算 ${left} + ${Math.min(right, 10 - left)}，再加剩下的。`;
  }

  if (left >= 10 && right <= 9) {
    return `小提示：${left} - ${right} 可以先算 ${left} - ${Math.min(right, 5)}，再减剩下的。`;
  }

  return `小提示：你可以先把 ${right} 分成两小步，再慢慢减。`;
}

function showBinaryChoice() {
  if (state.assist.binaryShown || state.phase !== "answering") {
    return;
  }

  const answer = state.currentQuestion.answer;
  const wrongOption = pickNearbyWrongOption(answer);
  const options = shuffle([answer, wrongOption]);

  elements.binaryChoices.innerHTML = "";
  options.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "binary-choice-btn";
    button.textContent = `${value}`;
    button.addEventListener("click", () => {
      if (state.phase !== "answering") {
        return;
      }

      state.currentInput = String(value);
      renderInputPreview();
      syncSelectedNumberButton();
      submitAnswer();
    });
    elements.binaryChoices.appendChild(button);
  });

  state.assist.used = true;
  state.assist.binaryShown = true;
  elements.binaryChoices.classList.remove("hidden");
  setStatus("help", "选一个你觉得对的答案吧。");
  increaseAssistStats();
}

function pickNearbyWrongOption(answer) {
  const usedAnswers = state.session.questionLogs.slice(-2).map((item) => item.answer);

  for (let delta = 1; delta <= 3; delta += 1) {
    const candidateUp = answer + delta;
    if (!usedAnswers.includes(candidateUp)) {
      return candidateUp;
    }

    const candidateDown = Math.max(0, answer - delta);
    if (!usedAnswers.includes(candidateDown) && candidateDown !== answer) {
      return candidateDown;
    }
  }

  return answer + 1;
}

function maybeTriggerGentlePrompt(now) {
  if (state.prompt.modalOpen || state.breakState.active) {
    return;
  }

  const idleMs = now - state.lastInteractionAt;
  const idleThresholdMs = state.settings.questionDurationMs;
  if (idleMs < idleThresholdMs) {
    return;
  }

  if (state.prompt.shownCount >= GENTLE_PROMPT_THRESHOLD) {
    enterRecoveryMode();
    return;
  }

  openGentlePrompt();
}

function openGentlePrompt() {
  stopQuestionTimer();
  state.prompt.modalOpen = true;
  state.prompt.shownCount += 1;
  elements.gentlePromptModal.classList.remove("hidden");
}

function closeGentlePrompt() {
  state.prompt.modalOpen = false;
  elements.gentlePromptModal.classList.add("hidden");
}

function resumeQuestionFromPrompt() {
  setSpriteLine("breakResume");
  const now = performance.now();
  const elapsed = now - state.questionStartAt;
  state.questionStartAt = now - Math.min(elapsed, state.settings.questionDurationMs * 0.6);
  state.lastInteractionAt = now;
  startQuestionTimer();
}

function startBreak() {
  state.breakState.active = true;
  state.breakState.remainingSec = BREAK_DURATION_SEC;
  elements.breakOverlay.classList.remove("hidden");
  updateBreakText();
  stopQuestionTimer();

  state.timer.breakTimerId = window.setInterval(() => {
    state.breakState.remainingSec -= 1;
    updateBreakText();

    if (state.breakState.remainingSec <= 0) {
      finishBreak(false);
    }
  }, 1000);
}

function stopBreakCountdown() {
  if (state.timer.breakTimerId) {
    window.clearInterval(state.timer.breakTimerId);
    state.timer.breakTimerId = null;
  }
}

function closeBreakOverlay() {
  elements.breakOverlay.classList.add("hidden");
}

function updateBreakText() {
  elements.breakText.textContent = `${state.breakState.remainingSec} 秒后自动继续`;
}

function finishBreak(manualResume) {
  stopBreakCountdown();
  state.breakState.active = false;
  closeBreakOverlay();

  if (manualResume) {
    setSpriteLine("breakResume");
  }
  state.lastInteractionAt = performance.now();

  if (state.phase === "answering" || state.phase === "stage") {
    startQuestionTimer();
  } else if (state.currentQuestion && state.phase !== "finished") {
    state.phase = "answering";
    startQuestionTimer();
  }
}

function enterRecoveryMode() {
  if (state.session.recoveryMode || state.phase === "finished") {
    return;
  }

  state.session.recoveryMode = true;
  state.session.recoveryQueue = ["10-add", "10-add", "10-subtract"];
  state.session.refusalEvents += 1;
  setSpriteLine("recoverStart");
  state.prompt.shownCount = 0;

  if (state.phase === "answering") {
    stopQuestionTimer();
  }

  nextQuestion();
}

function markInteraction(reason) {
  if (state.phase !== "answering") {
    return;
  }

  if (reason === "input" || reason === "submit" || reason === "clear") {
    state.prompt.shownCount = 0;
    state.lastInteractionAt = performance.now();
  }
}

function chooseInput(value) {
  const digit = String(value);
  if (!/^[0-9]$/.test(digit)) {
    return;
  }

  if (state.currentInput === "") {
    state.currentInput = digit;
  } else if (state.currentInput === "0") {
    state.currentInput = digit;
  } else if (state.currentInput.length < MAX_ANSWER_DIGITS) {
    state.currentInput += digit;
  }

  renderInputPreview();
  syncSelectedNumberButton();
}

function renderInputPreview() {
  elements.answerPreview.textContent = state.currentInput === "" ? "_" : state.currentInput;
}

function syncSelectedNumberButton() {
  const highlightDigit = state.currentInput.length > 0 ? state.currentInput.charAt(state.currentInput.length - 1) : "";
  const buttons = elements.answerPad.querySelectorAll("button[data-value]");
  buttons.forEach((button) => {
    const isSelected = button.dataset.value === highlightDigit;
    button.classList.toggle("selected", isSelected);
  });
}

function resetAssistUI() {
  elements.assistHint.classList.add("hidden");
  elements.assistHint.textContent = "";
  elements.binaryChoices.classList.add("hidden");
  elements.binaryChoices.innerHTML = "";
}

function increaseAssistStats() {
  if (state.assist.counted) {
    return;
  }

  state.session.assistCount += 1;
  const modeStats = state.session.modeStats[state.currentModeId];
  modeStats.assist += 1;
  state.assist.counted = true;
  renderScoreBoard();
}

function submitAnswer() {
  if (state.phase !== "answering") {
    return;
  }

  if (state.currentInput === "") {
    setStatus("warning", "先点一个数字再提交。");
    return;
  }

  const selected = Number(state.currentInput);
  const answer = state.currentQuestion.answer;
  const elapsedMs = Math.max(0, performance.now() - state.questionStartAt);

  if (selected === answer) {
    onCorrectAnswer(elapsedMs);
    return;
  }

  onWrongAnswer(elapsedMs);
}

function onCorrectAnswer(elapsedMs) {
  stopQuestionTimer();
  playAnswerSound("right");
  state.session.correct += 1;
  state.session.consecutiveCorrect += 1;
  state.session.currentStageMap[state.currentStageId].correct += 1;

  const modeStats = state.session.modeStats[state.currentModeId];
  modeStats.asked += 1;
  modeStats.correct += 1;
  modeStats.totalMs += elapsedMs;

  const solvedInRedWithoutAssist =
    elements.cloudFriend.classList.contains("cloud-red") && !state.assist.used;

  const feedbackLine = solvedInRedWithoutAssist
    ? pickFeedbackLine("redSoloCorrect")
    : state.assist.used
      ? pickFeedbackLine("assistedCorrect")
      : pickFeedbackLine("directCorrect");

  setStatus("correct", feedbackLine);

  if (!state.assist.used && !state.session.recoveryMode) {
    showLightReward();
  }

  logQuestion({
    correct: true,
    usedAssist: state.assist.used,
    timeMs: elapsedMs,
    answer: state.currentQuestion.answer,
    refusalEvent: false,
    redSolvedWithoutAssist: solvedInRedWithoutAssist,
  });

  renderScoreBoard();

  if (state.session.recoveryMode && state.session.recoveryQueue.length === 0) {
    state.session.recoveryMode = false;
    setSpriteLine("recoverDone");
  }

  queueNextQuestion(AUTO_NEXT_DELAY_AFTER_CORRECT_MS);
}

function onWrongAnswer(elapsedMs) {
  stopQuestionTimer();
  playAnswerSound("error");
  state.session.wrong += 1;
  state.session.consecutiveCorrect = 0;

  const modeStats = state.session.modeStats[state.currentModeId];
  modeStats.asked += 1;
  modeStats.totalMs += elapsedMs;

  setStatus("wrong", `${pickFeedbackLine("wrong")} 正确答案是 ${state.currentQuestion.answer}`);

  logQuestion({
    correct: false,
    usedAssist: state.assist.used,
    timeMs: elapsedMs,
    answer: state.currentQuestion.answer,
    refusalEvent: false,
    redSolvedWithoutAssist: false,
  });

  renderScoreBoard();

  if (state.session.consecutiveCorrect <= 0 && detectNeedsRecoveryByPerformance()) {
    enterRecoveryMode();
    return;
  }

  pauseForManualNext();
}

function queueNextQuestion(delayMs = 750) {
  setAnswerControlsEnabled(false);
  state.phase = "result";
  hideNextButton();

  window.setTimeout(() => {
    if (state.phase === "finished" || state.phase === "waiting-next") {
      return;
    }

    nextQuestion();
  }, delayMs);
}

function showLightReward() {
  hideLightReward();
  elements.lightReward.classList.remove("hidden");
  state.ui.lightRewardTimerId = window.setTimeout(() => {
    elements.lightReward.classList.add("hidden");
    state.ui.lightRewardTimerId = null;
  }, LIGHT_REWARD_DURATION_MS);
}

function hideLightReward() {
  if (state.ui.lightRewardTimerId) {
    window.clearTimeout(state.ui.lightRewardTimerId);
    state.ui.lightRewardTimerId = null;
  }
  elements.lightReward.classList.add("hidden");
}

function showNextButton() {
  if (!elements.nextBtn) {
    return;
  }
  elements.nextBtn.classList.remove("hidden");
}

function hideNextButton() {
  if (!elements.nextBtn) {
    return;
  }
  elements.nextBtn.classList.add("hidden");
}

function pauseForManualNext() {
  setAnswerControlsEnabled(false);
  state.phase = "waiting-next";
  showNextButton();
}

function advanceAfterManualNext() {
  if (state.phase !== "waiting-next") {
    return;
  }
  hideNextButton();
  nextQuestion();
}

function pickFeedbackLine(kind) {
  const pool = FEEDBACK_LINES[kind] || FEEDBACK_LINES.directCorrect;
  const index = state.session.totalQuestions % pool.length;
  return pool[index];
}

function setAnswerControlsEnabled(enabled) {
  const numberButtons = elements.answerPad.querySelectorAll("button[data-value]");
  numberButtons.forEach((button) => {
    button.disabled = !enabled;
  });

  elements.clearBtn.disabled = !enabled;
  elements.submitBtn.disabled = !enabled;
}

function renderScoreBoard() {
  elements.correctCount.textContent = String(state.session.correct);
  elements.wrongCount.textContent = String(state.session.wrong);
  elements.assistCount.textContent = String(state.session.assistCount);
}

function finishSession() {
  stopQuestionTimer();
  stopBreakCountdown();
  state.phase = "finished";

  setAnswerControlsEnabled(false);
  hideNextButton();
  hideLightReward();
  closeRewardOverlay();
  closeGentlePrompt();
  closeBreakOverlay();

  const accuracy = state.session.totalQuestions > 0
    ? Math.round((state.session.correct / state.session.totalQuestions) * 100)
    : 0;

  elements.finalStages.textContent = `${state.session.stagesDone}`;
  elements.finalAccuracy.textContent = `${accuracy}%`;
  elements.finalCourage.textContent = state.session.challengeAttempted ? "勇敢" : "稳定";
  elements.finalStrategy.textContent = state.session.assistCount > 0 ? "会用提示" : "独立作答";
  elements.finalProgress.textContent = buildProgressStarLabel(accuracy);
  elements.summaryText.textContent = buildSummaryText(accuracy);

  elements.summaryModal.classList.remove("hidden");
  triggerFireworkBurst();
  setSpriteLine("今天的冒险完成啦，明天再见！");

  persistSessionToHistory(accuracy);
}

function triggerFireworkBurst() {
  if (!elements.fireworkBurst) {
    return;
  }

  const fireworkSrc = "./img/fireworks-transparent.gif";
  elements.fireworkBurst.src = "";
  // Force replay by resetting src before showing again.
  elements.fireworkBurst.src = fireworkSrc;
  elements.fireworkBurst.classList.remove("hidden");
  if (state.settings.soundOn) {
    playSimpleBeep();
  }
}

function playAnswerSound(type) {
  if (!state.settings.soundOn) {
    return;
  }

  const src = type === "right" ? SOUND_RIGHT_URL : SOUND_ERROR_URL;
  if (!src) {
    return;
  }

  try {
    const audio = new Audio(src);
    audio.play().catch(() => {
      // Ignore play failures (e.g., missing file before assets are provided).
    });
  } catch (error) {
    // Ignore unsupported audio environments.
  }
}

function playSimpleBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 660;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.04;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (error) {
    // Ignore unsupported audio environments.
  }
}

function buildSummaryText(accuracy) {
  if (accuracy >= 90) {
    return "今天状态超棒，精灵给你大拇指！";
  }

  if (accuracy >= 75) {
    return "今天很稳，继续保持这个节奏。";
  }

  return "今天坚持完成了训练，已经很厉害。";
}

function buildProgressStarLabel(currentAccuracy) {
  const recent = getRecentRecords(1);
  const previous = recent.length > 0 ? Number(recent[recent.length - 1].accuracy || 0) : currentAccuracy;
  if (currentAccuracy >= previous + 5) {
    return "上升";
  }

  if (currentAccuracy <= previous - 5) {
    return "蓄力";
  }

  return "稳定";
}

function isStageQualifiedForProgress(stageId) {
  const stage = STAGE_CONFIG[stageId];
  const stageStats = state.session.currentStageMap[stageId];
  if (!stage || !stageStats) {
    return false;
  }

  const reachedTarget = stageStats.asked >= stage.targetCount;
  if (!reachedTarget) {
    return false;
  }

  if (stageId === "A" || stageId === "B") {
    return getStageAccuracy(stageId) >= STAGE_PASS_MIN_ACCURACY;
  }

  return true;
}

function getStageAccuracy(stageId) {
  const stageStats = state.session.currentStageMap[stageId];
  if (!stageStats || stageStats.asked <= 0) {
    return 0;
  }
  return stageStats.correct / stageStats.asked;
}

function persistSessionToHistory(accuracy) {
  const day = getTodayDateString();
  const dayItems = Array.isArray(state.history.dailyRecords[day]) ? state.history.dailyRecords[day] : [];

  Object.keys(state.session.modeStats).forEach((mode) => {
    const modeStat = state.session.modeStats[mode];
    if (modeStat.asked === 0) {
      return;
    }

    dayItems.push({
      mode,
      asked: modeStat.asked,
      correctRate: modeStat.correct / modeStat.asked,
      avgTimeMs: Math.round(modeStat.totalMs / modeStat.asked),
      assistRate: modeStat.assist / modeStat.asked,
      refusalEvent: state.session.refusalEvents > 0,
      accuracy,
      ts: Date.now(),
    });
  });

  state.history.dailyRecords[day] = dayItems;
  persistRecords(state.history.dailyRecords);
}

function logQuestion(payload) {
  state.session.questionLogs.push({
    stage: state.currentStageId,
    mode: state.currentModeId,
    correct: payload.correct,
    usedAssist: payload.usedAssist,
    timeMs: payload.timeMs,
    answer: payload.answer,
    refusalEvent: payload.refusalEvent,
    redSolvedWithoutAssist: payload.redSolvedWithoutAssist,
  });
}

function generateQuestion(previousSignature, maxRange, operator) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    let left;
    let right;

    if (operator === "+") {
      left = randomInt(maxRange);
      right = randomInt(maxRange - left);
    } else if (operator === "-") {
      left = randomInt(maxRange);
      right = randomInt(left);
    } else {
      continue;
    }

    const answer = operator === "+" ? left + right : left - right;
    const signature = `${left}${operator}${right}`;

    if (signature !== previousSignature) {
      return { left, operator, right, answer, signature };
    }
  }

  const fallbackOperator = operator === "-" ? "-" : "+";
  const fallbackLeft = Math.min(6, maxRange);
  const fallbackRight = fallbackOperator === "+"
    ? Math.min(2, maxRange - fallbackLeft)
    : Math.min(2, fallbackLeft);
  const fallbackAnswer = fallbackOperator === "+"
    ? fallbackLeft + fallbackRight
    : fallbackLeft - fallbackRight;

  return {
    left: fallbackLeft,
    operator: fallbackOperator,
    right: fallbackRight,
    answer: fallbackAnswer,
    signature: `${fallbackLeft}${fallbackOperator}${fallbackRight}`,
  };
}

function randomInt(max) {
  return Math.floor(Math.random() * (max + 1));
}

function randomIntInRange(min, max) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function shuffle(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }

  return list;
}

function getTodayDateString() {
  const now = new Date();
  return formatDate(now);
}

function dateOffset(yyyyMmDd, offsetDays) {
  const [y, m, d] = yyyyMmDd.split("-").map((value) => Number(value));
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + offsetDays);
  return formatDate(base);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
