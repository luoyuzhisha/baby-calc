const RUNNER_IMAGE_URL = "./img/left.png";
const START_IMAGE_URL = "./img/right.png";

const TOTAL_QUESTIONS = 10;
const DEFAULT_QUESTION_DURATION_MS = 30000;
const MIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 60;
const DURATION_STEP_SEC = 5;
const MATH_RANGE_OPTIONS = [10, 20, 50];
const DEFAULT_MATH_RANGE_MAX = 10;
const MAX_ANSWER_DIGITS = 2;

const state = {
  phase: "idle",
  currentQuestion: null,
  currentInput: "",
  previousSignature: "",
  settings: {
    questionDurationMs: DEFAULT_QUESTION_DURATION_MS,
    mathRangeMax: DEFAULT_MATH_RANGE_MAX,
  },
  stats: {
    total: TOTAL_QUESTIONS,
    currentIndex: 0,
    correct: 0,
    wrong: 0,
    timeout: 0,
  },
  timer: {
    rafId: null,
    durationMs: DEFAULT_QUESTION_DURATION_MS,
    deadline: 0,
  },
};

const elements = {
  questionCount: document.getElementById("questionCount"),
  questionText: document.getElementById("questionText"),
  answerPreview: document.getElementById("answerPreview"),
  statusText: document.getElementById("statusText"),
  answerPad: document.getElementById("answerPad"),
  clearBtn: document.getElementById("clearBtn"),
  submitBtn: document.getElementById("submitBtn"),
  nextBtn: document.getElementById("nextBtn"),
  correctCount: document.getElementById("correctCount"),
  wrongCount: document.getElementById("wrongCount"),
  timeoutCount: document.getElementById("timeoutCount"),
  rangeButtons: Array.from(document.querySelectorAll(".range-btn")),
  timeLeft: document.getElementById("timeLeft"),
  durationSelect: document.getElementById("durationSelect"),
  timerFill: document.getElementById("timerFill"),
  startCharacter: document.getElementById("startCharacter"),
  runnerCharacter: document.getElementById("runnerCharacter"),
  summaryModal: document.getElementById("summaryModal"),
  summaryText: document.getElementById("summaryText"),
  finalCorrect: document.getElementById("finalCorrect"),
  finalWrong: document.getElementById("finalWrong"),
  finalTimeout: document.getElementById("finalTimeout"),
  finalAccuracy: document.getElementById("finalAccuracy"),
  restartBtn: document.getElementById("restartBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
};

document.addEventListener("DOMContentLoaded", () => {
  init();
});

function init() {
  mountNumberButtons();
  mountDurationOptions();
  syncDurationSelect();
  syncRangeButtons();
  bindEvents();
  applyCharacterImages();
  setupFullscreenSupport();
  startSession();
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
  });

  elements.clearBtn.addEventListener("click", () => {
    if (state.phase !== "answering") {
      return;
    }

    state.currentInput = state.currentInput.length <= 1
      ? ""
      : state.currentInput.slice(0, -1);
    renderInputPreview();
    syncSelectedNumberButton();
  });

  elements.submitBtn.addEventListener("click", submitAnswer);

  elements.nextBtn.addEventListener("click", () => {
    if (state.phase !== "result") {
      return;
    }

    if (state.stats.currentIndex >= state.stats.total) {
      finishSession();
      return;
    }

    nextQuestion();
  });

  elements.restartBtn.addEventListener("click", () => {
    startSession();
  });

  if (elements.fullscreenBtn) {
    elements.fullscreenBtn.addEventListener("click", () => {
      toggleFullscreen();
    });
  }

  if (elements.durationSelect) {
    elements.durationSelect.addEventListener("change", () => {
      applyDurationFromSelect();
    });
  }

  elements.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextRange = Number(button.dataset.range);
      if (!MATH_RANGE_OPTIONS.includes(nextRange)) {
        return;
      }

      applyMathRange(nextRange);
    });
  });
}

function setupFullscreenSupport() {
  if (!elements.fullscreenBtn) {
    return;
  }

  if (!isFullscreenAvailable()) {
    elements.fullscreenBtn.disabled = true;
    elements.fullscreenBtn.classList.add("unsupported");
    elements.fullscreenBtn.textContent = "不支持全屏";
    return;
  }

  updateFullscreenButtonState();
  document.addEventListener("fullscreenchange", () => {
    updateFullscreenButtonState();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    updateFullscreenButtonState();
  });
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

function applyCharacterImages() {
  setImageWithFallback(elements.startCharacter, START_IMAGE_URL, "#f3cc7d", "起点");
  setImageWithFallback(elements.runnerCharacter, RUNNER_IMAGE_URL, "#8bd3dd", "冲");
}

function mountDurationOptions() {
  if (!elements.durationSelect) {
    return;
  }

  elements.durationSelect.innerHTML = "";

  for (let second = MIN_DURATION_SEC; second <= MAX_DURATION_SEC; second += DURATION_STEP_SEC) {
    const option = document.createElement("option");
    option.value = String(second);
    option.textContent = `${second}s`;
    if (second * 1000 === DEFAULT_QUESTION_DURATION_MS) {
      option.selected = true;
    }
    elements.durationSelect.appendChild(option);
  }
}

function syncDurationSelect() {
  if (!elements.durationSelect) {
    return;
  }

  const secondValue = String(state.settings.questionDurationMs / 1000);
  elements.durationSelect.value = secondValue;
}

function applyDurationFromSelect() {
  if (!elements.durationSelect) {
    return;
  }

  const selectedSecond = Number(elements.durationSelect.value);
  const isValidStep = Number.isInteger((selectedSecond - MIN_DURATION_SEC) / DURATION_STEP_SEC);
  if (
    !Number.isFinite(selectedSecond) ||
    selectedSecond < MIN_DURATION_SEC ||
    selectedSecond > MAX_DURATION_SEC ||
    !isValidStep
  ) {
    syncDurationSelect();
    return;
  }

  const newDurationMs = selectedSecond * 1000;
  state.settings.questionDurationMs = newDurationMs;
  state.timer.durationMs = newDurationMs;

  if (state.phase === "answering") {
    startQuestionTimer(newDurationMs);
    setStatus("info", `请在 ${selectedSecond} 秒内完成本题`);
    return;
  }

  renderTimer(newDurationMs, newDurationMs);
}

function applyMathRange(nextRange) {
  if (state.settings.mathRangeMax === nextRange) {
    return;
  }

  state.settings.mathRangeMax = nextRange;
  syncRangeButtons();
  startSession();
}

function syncRangeButtons() {
  elements.rangeButtons.forEach((button) => {
    const buttonRange = Number(button.dataset.range);
    const isActive = buttonRange === state.settings.mathRangeMax;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setImageWithFallback(imageElement, sourceUrl, backgroundColor, labelText) {
  imageElement.onerror = () => {
    if (imageElement.dataset.fallbackApplied === "1") {
      return;
    }

    imageElement.dataset.fallbackApplied = "1";
    imageElement.src = createFallbackBadge(backgroundColor, labelText);
  };
  imageElement.src = sourceUrl;
}

function createFallbackBadge(backgroundColor, labelText) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill="${backgroundColor}" />
      <circle cx="60" cy="60" r="54" fill="none" stroke="#ffffff" stroke-width="6" />
      <text x="60" y="70" text-anchor="middle" font-size="38" font-family="Verdana" fill="#233142">${labelText}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function startSession() {
  stopQuestionTimer();

  state.phase = "idle";
  state.currentQuestion = null;
  state.currentInput = "";
  state.previousSignature = "";
  state.stats.currentIndex = 0;
  state.stats.correct = 0;
  state.stats.wrong = 0;
  state.stats.timeout = 0;

  elements.summaryModal.classList.add("hidden");
  updateScoreBoard();
  syncRangeButtons();
  renderTimer(state.settings.questionDurationMs, state.settings.questionDurationMs);
  nextQuestion();
}

function nextQuestion() {
  if (state.stats.currentIndex >= state.stats.total) {
    finishSession();
    return;
  }

  state.stats.currentIndex += 1;
  state.currentQuestion = generateQuestion(
    state.previousSignature,
    state.settings.mathRangeMax,
  );
  state.previousSignature = state.currentQuestion.signature;
  state.currentInput = "";
  state.phase = "answering";
  const questionDurationSec = state.settings.questionDurationMs / 1000;

  renderQuestion();
  setStatus("info", `请在 ${questionDurationSec} 秒内完成本题`);
  renderInputPreview();
  syncSelectedNumberButton();
  elements.nextBtn.classList.add("hidden");
  setAnswerControlsEnabled(true);
  startQuestionTimer(state.settings.questionDurationMs);
}

function finishSession() {
  stopQuestionTimer();
  state.phase = "finished";

  setAnswerControlsEnabled(false);
  elements.nextBtn.classList.add("hidden");

  const { correct, wrong, timeout, total } = state.stats;
  const accuracy = Math.round((correct / total) * 100);

  elements.finalCorrect.textContent = String(correct);
  elements.finalWrong.textContent = String(wrong);
  elements.finalTimeout.textContent = String(timeout);
  elements.finalAccuracy.textContent = `${accuracy}%`;
  elements.summaryText.textContent = buildSummaryMessage(accuracy);
  elements.summaryModal.classList.remove("hidden");
}

function buildSummaryMessage(accuracy) {
  if (accuracy >= 90) {
    return "非常棒！你已经是加减法小达人。";
  }

  if (accuracy >= 70) {
    return "表现不错，再练几轮会更稳。";
  }

  return "继续加油，多练习会越来越快。";
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
  const highlightDigit =
    state.currentInput.length > 0
      ? state.currentInput.charAt(state.currentInput.length - 1)
      : "";
  const buttons = elements.answerPad.querySelectorAll("button[data-value]");
  buttons.forEach((button) => {
    const isSelected = button.dataset.value === highlightDigit;
    button.classList.toggle("selected", isSelected);
  });
}

function submitAnswer() {
  if (state.phase !== "answering") {
    return;
  }

  if (state.currentInput === "") {
    setStatus("warning", "先点一个数字再提交");
    return;
  }

  const selected = Number(state.currentInput);
  const answer = state.currentQuestion.answer;

  if (selected === answer) {
    state.stats.correct += 1;
    finalizeQuestion("correct", "答对了，继续保持！");
    return;
  }

  state.stats.wrong += 1;
  finalizeQuestion("wrong", `答错了，正确答案是 ${answer}`);
}

function handleTimeout() {
  if (state.phase !== "answering") {
    return;
  }

  state.stats.timeout += 1;
  finalizeQuestion("timeout", `时间到，正确答案是 ${state.currentQuestion.answer}`);
}

function finalizeQuestion(status, message) {
  stopQuestionTimer();
  state.phase = "result";
  setAnswerControlsEnabled(false);
  updateScoreBoard();
  setStatus(status, message);

  elements.nextBtn.textContent =
    state.stats.currentIndex >= state.stats.total ? "查看结果" : "下一题";
  elements.nextBtn.classList.remove("hidden");
}

function updateScoreBoard() {
  elements.correctCount.textContent = String(state.stats.correct);
  elements.wrongCount.textContent = String(state.stats.wrong);
  elements.timeoutCount.textContent = String(state.stats.timeout);
}

function renderQuestion() {
  const { left, operator, right } = state.currentQuestion;
  elements.questionCount.textContent = `第 ${state.stats.currentIndex} / ${state.stats.total} 题`;
  elements.questionText.textContent = `${left} ${operator} ${right} = ?`;
}

function setStatus(status, message) {
  elements.statusText.className = `status-line status-${status}`;
  elements.statusText.textContent = message;
}

function setAnswerControlsEnabled(enabled) {
  const numberButtons = elements.answerPad.querySelectorAll("button[data-value]");
  numberButtons.forEach((button) => {
    button.disabled = !enabled;
  });

  elements.clearBtn.disabled = !enabled;
  elements.submitBtn.disabled = !enabled;
}

function startQuestionTimer(durationMs) {
  stopQuestionTimer();
  state.timer.durationMs = durationMs;

  const deadline = performance.now() + durationMs;
  state.timer.deadline = deadline;
  renderTimer(durationMs, durationMs);

  const tick = (now) => {
    if (state.phase !== "answering") {
      return;
    }

    const remainingMs = Math.max(0, deadline - now);
    renderTimer(remainingMs, durationMs);

    if (remainingMs <= 0) {
      handleTimeout();
      return;
    }

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

function renderTimer(remainingMs, totalMs) {
  const clampedProgress = Math.max(0, Math.min(1, remainingMs / totalMs));
  const fillPercent = clampedProgress * 100;
  const runnerPercent = 100 - fillPercent;
  elements.timerFill.style.width = `${fillPercent.toFixed(3)}%`;
  elements.runnerCharacter.style.left = `${runnerPercent.toFixed(3)}%`;
  elements.timeLeft.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
}

function generateQuestion(previousSignature, maxRange) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const operator = Math.random() < 0.5 ? "+" : "-";
    let left;
    let right;

    if (operator === "+") {
      left = randomInt(maxRange);
      right = randomInt(maxRange - left);
    } else {
      left = randomInt(maxRange);
      right = randomInt(left);
    }

    const answer = operator === "+" ? left + right : left - right;
    const signature = `${left}${operator}${right}`;

    if (signature !== previousSignature) {
      return { left, operator, right, answer, signature };
    }
  }

  const fallbackLeft = Math.min(6, maxRange);
  const fallbackRight = Math.min(2, maxRange - fallbackLeft);
  const fallbackAnswer = fallbackLeft + fallbackRight;
  return {
    left: fallbackLeft,
    operator: "+",
    right: fallbackRight,
    answer: fallbackAnswer,
    signature: `${fallbackLeft}+${fallbackRight}`,
  };
}

function randomInt(max) {
  return Math.floor(Math.random() * (max + 1));
}
