const STORAGE_KEY = "leetcode-review-desk-v2";
const LEGACY_STORAGE_KEY = "leetcode-review-desk-v1";
const STATUS_OPTIONS = ["掌握", "模糊", "不会", "未复习"];

const state = {
  problems: loadProblems(),
  activeView: "home",
  activeHeatmapYear: new Date().getFullYear(),
  activeReviewId: null,
  codeVisible: false,
  codeMode: "summary",
};

const els = {
  navItems: [...document.querySelectorAll(".nav-item")],
  mobileNav: document.querySelector("#mobileNav"),
  views: [...document.querySelectorAll(".page-view")],
  jumpButtons: [...document.querySelectorAll("[data-jump]")],
  form: document.querySelector("#problemForm"),
  problemId: document.querySelector("#problemId"),
  number: document.querySelector("#numberInput"),
  title: document.querySelector("#titleInput"),
  url: document.querySelector("#urlInput"),
  fetchProblem: document.querySelector("#fetchProblemBtn"),
  difficulty: document.querySelector("#difficultyInput"),
  language: document.querySelector("#languageInput"),
  tags: document.querySelector("#tagsInput"),
  description: document.querySelector("#descriptionInput"),
  idea: document.querySelector("#ideaInput"),
  pitfall: document.querySelector("#pitfallInput"),
  code: document.querySelector("#codeInput"),
  resetForm: document.querySelector("#resetFormBtn"),
  saveButton: document.querySelector("#saveButton"),
  saveHint: document.querySelector("#saveHint"),
  search: document.querySelector("#searchInput"),
  tagFilter: document.querySelector("#tagFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  codeModeButtons: [...document.querySelectorAll("[data-code-mode]")],
  list: document.querySelector("#problemList"),
  template: document.querySelector("#problemCardTemplate"),
  visibleCount: document.querySelector("#visibleCount"),
  totalCount: document.querySelector("#totalCount"),
  todayCount: document.querySelector("#todayCount"),
  dueCount: document.querySelector("#dueCount"),
  weakCount: document.querySelector("#weakCount"),
  monthAddedCount: document.querySelector("#monthAddedCount"),
  heatmap: document.querySelector("#heatmap"),
  heatmapYears: document.querySelector("#heatmapYears"),
  statusBars: document.querySelector("#statusBars"),
  recentActivity: document.querySelector("#recentActivity"),
  suggestionList: document.querySelector("#suggestionList"),
  random: document.querySelector("#randomBtn"),
  reviewEmpty: document.querySelector("#reviewEmpty"),
  reviewContent: document.querySelector("#reviewContent"),
  activeReviewTitle: document.querySelector("#activeReviewTitle"),
  reviewMeta: document.querySelector("#reviewMeta"),
  reviewDescription: document.querySelector("#reviewDescription"),
  reviewIdea: document.querySelector("#reviewIdea"),
  reviewPitfall: document.querySelector("#reviewPitfall"),
  reviewCode: document.querySelector("#reviewCode"),
  reviewCountText: document.querySelector("#reviewCountText"),
  toggleCode: document.querySelector("#toggleCodeBtn"),
  dueList: document.querySelector("#dueList"),
  export: document.querySelector("#exportBtn"),
  import: document.querySelector("#importInput"),
};

bindEvents();
render();

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.mobileNav.addEventListener("change", () => setView(els.mobileNav.value));
  els.jumpButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.jump));
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProblemFromForm();
  });

  els.resetForm.addEventListener("click", resetForm);
  els.fetchProblem.addEventListener("click", fetchProblemDetails);
  els.search.addEventListener("input", renderLibrary);
  els.tagFilter.addEventListener("change", renderLibrary);
  els.statusFilter.addEventListener("change", renderLibrary);

  els.codeModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.codeMode = button.dataset.codeMode;
      renderLibrary();
    });
  });

  els.random.addEventListener("click", () => {
    const candidates = getFilteredProblems();
    if (!candidates.length) return;
    const weighted = candidates.flatMap((problem) => {
      return Array.from({ length: getReviewWeight(problem) }, () => problem);
    });
    showReview(weighted[Math.floor(Math.random() * weighted.length)]);
  });

  els.toggleCode.addEventListener("click", () => {
    state.codeVisible = !state.codeVisible;
    renderReview();
  });

  document.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => markReview(button.dataset.review));
  });

  els.export.addEventListener("click", exportProblems);
  els.import.addEventListener("change", importProblems);
}

function setView(view) {
  state.activeView = view;
  els.views.forEach((page) => page.classList.toggle("active", page.dataset.page === view));
  els.navItems.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  els.mobileNav.value = view;

  if (view === "library") renderLibrary();
  if (view === "review") renderReview();
}

function saveProblemFromForm() {
  const now = new Date().toISOString();
  const id = els.problemId.value || createId();
  const existing = state.problems.find((problem) => problem.id === id);
  const problem = {
    id,
    number: els.number.value.trim(),
    title: els.title.value.trim(),
    url: els.url.value.trim(),
    difficulty: els.difficulty.value,
    language: els.language.value.trim() || "C++",
    tags: parseTags(els.tags.value),
    description: els.description.value.trim(),
    idea: els.idea.value.trim(),
    pitfall: els.pitfall.value.trim(),
    code: els.code.value,
    status: existing?.status || "未复习",
    reviewCount: existing?.reviewCount || 0,
    lastReviewedAt: existing?.lastReviewedAt || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (!problem.number || !problem.title) return;

  state.problems = existing
    ? state.problems.map((item) => (item.id === id ? problem : item))
    : [problem, ...state.problems];

  saveProblems();
  resetForm();
  setView("library");
  render();
}

function resetForm() {
  els.form.reset();
  els.problemId.value = "";
  els.difficulty.value = "Medium";
  els.language.value = "C++";
  els.description.value = "";
  els.saveButton.textContent = "保存题目";
  els.saveHint.textContent = "数据会保存在当前浏览器本地。";
}

async function fetchProblemDetails() {
  const slug = getLeetCodeSlug(els.url.value);
  if (!slug) {
    els.saveHint.textContent = "请先粘贴 LeetCode 题目链接，例如 https://leetcode.cn/problems/two-sum/";
    els.url.focus();
    return;
  }

  const originalText = els.fetchProblem.textContent;
  els.fetchProblem.disabled = true;
  els.fetchProblem.textContent = "抓取中";
  els.saveHint.textContent = "正在从 LeetCode 获取题目信息...";

  try {
    const detail = await requestLeetCodeProblem(slug);
    if (detail.number) els.number.value = detail.number;
    if (detail.title) els.title.value = detail.title;
    if (detail.difficulty) els.difficulty.value = detail.difficulty;
    if (detail.tags.length) els.tags.value = detail.tags.join(", ");
    if (detail.description) els.description.value = detail.description;
    els.saveHint.textContent = "题目信息已填充，请补充自己的思路和代码。";
  } catch (error) {
    els.saveHint.textContent = `抓取失败：${error.message}`;
  } finally {
    els.fetchProblem.disabled = false;
    els.fetchProblem.textContent = originalText;
  }
}

function fillForm(problem) {
  els.problemId.value = problem.id;
  els.number.value = problem.number;
  els.title.value = problem.title;
  els.url.value = problem.url;
  els.difficulty.value = problem.difficulty;
  els.language.value = problem.language;
  els.tags.value = problem.tags.join(", ");
  els.description.value = problem.description;
  els.idea.value = problem.idea;
  els.pitfall.value = problem.pitfall;
  els.code.value = problem.code;
  els.saveButton.textContent = "更新题目";
  els.saveHint.textContent = `正在编辑 #${problem.number} ${problem.title}`;
  setView("submit");
  els.number.focus();
}

function render() {
  renderStats();
  renderHeatmap();
  renderStatusBars();
  renderRecentActivity();
  renderSuggestions();
  renderTagFilter();
  renderLibrary();
  renderReview();
}

function renderStats() {
  const todayKey = dayKey(new Date());
  const todayAdded = state.problems.filter((problem) => dayKey(problem.createdAt) === todayKey).length;
  const weak = state.problems.filter((problem) => ["模糊", "不会", "未复习"].includes(problem.status)).length;

  els.totalCount.textContent = state.problems.length;
  els.todayCount.textContent = todayAdded;
  els.dueCount.textContent = state.problems.filter(isDue).length;
  els.weakCount.textContent = weak;
}

function renderHeatmap() {
  const today = new Date();
  const endDate = new Date(state.activeHeatmapYear, today.getMonth(), today.getDate());
  endDate.setHours(0, 0, 0, 0);
  const days = getContributionDays(endDate);
  const activeKeys = new Set(days.filter((date) => date.inRange).map((date) => dayKey(date)));
  const counts = new Map([...activeKeys].map((key) => [key, 0]));

  state.problems.forEach((problem) => {
    const key = dayKey(problem.createdAt);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  const max = Math.max(1, ...counts.values());
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const months = getContributionMonths(days);

  els.monthAddedCount.textContent = `近一年添加 ${total} 次`;
  els.heatmap.innerHTML = "";
  els.heatmap.style.setProperty("--week-count", String(Math.ceil(days.length / 7)));

  const monthsRow = document.createElement("div");
  monthsRow.className = "contribution-months";
  months.forEach((month) => {
    const label = document.createElement("span");
    label.textContent = month.name;
    label.style.gridColumn = `${month.column} / span ${month.span}`;
    monthsRow.append(label);
  });

  const weekLabels = document.createElement("div");
  weekLabels.className = "contribution-weekdays";
  ["", "Mon", "", "Wed", "", "Fri", ""].forEach((day) => {
    const label = document.createElement("span");
    label.textContent = day;
    weekLabels.append(label);
  });

  const grid = document.createElement("div");
  grid.className = "contribution-grid";
  days.forEach((date) => {
    const count = date.inRange ? counts.get(dayKey(date)) || 0 : 0;
    const level = date.inRange ? getHeatLevel(count, max) : 0;
    const block = document.createElement("button");
    block.className = `heat-cell level-${level}`;
    block.type = "button";
    block.disabled = !date.inRange;
    block.title = date.inRange ? `${formatFullDate(date)} 添加 ${count} 次` : "";
    block.setAttribute("aria-label", block.title || "范围外日期");
    grid.append(block);
  });

  const legend = document.createElement("div");
  legend.className = "contribution-legend";
  legend.innerHTML = '<span>Less</span><i class="heat-cell level-0"></i><i class="heat-cell level-1"></i><i class="heat-cell level-2"></i><i class="heat-cell level-3"></i><i class="heat-cell level-4"></i><span>More</span>';

  els.heatmap.append(monthsRow, weekLabels, grid, legend);
  renderHeatmapYears();
}

function renderHeatmapYears() {
  const years = getHeatmapYears();
  els.heatmapYears.innerHTML = "";

  years.forEach((year) => {
    const button = document.createElement("button");
    button.className = "year-button";
    button.type = "button";
    button.textContent = year;
    button.classList.toggle("active", year === state.activeHeatmapYear);
    button.addEventListener("click", () => {
      state.activeHeatmapYear = year;
      renderHeatmap();
    });
    els.heatmapYears.append(button);
  });
}

function renderStatusBars() {
  els.statusBars.innerHTML = "";
  const total = Math.max(1, state.problems.length);
  STATUS_OPTIONS.forEach((status) => {
    const count = state.problems.filter((problem) => problem.status === status).length;
    const row = document.createElement("div");
    row.className = "status-row";
    row.innerHTML = `
      <span>${status}</span>
      <div class="bar-track"><i style="width: ${(count / total) * 100}%"></i></div>
      <strong>${count}</strong>
    `;
    els.statusBars.append(row);
  });
}

function renderRecentActivity() {
  const recent = [...state.problems]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);
  els.recentActivity.innerHTML = "";

  if (!recent.length) {
    els.recentActivity.append(makeEmpty("还没有记录，先去提交页面添加第一题。"));
    return;
  }

  recent.forEach((problem) => {
    const item = document.createElement("button");
    item.className = "activity-item";
    item.type = "button";
    item.innerHTML = `<strong>#${escapeHtml(problem.number)} ${escapeHtml(problem.title)}</strong><span>${formatDate(problem.updatedAt)} 更新 · ${escapeHtml(problem.status)}</span>`;
    item.addEventListener("click", () => showReview(problem));
    els.recentActivity.append(item);
  });
}

function renderSuggestions() {
  const due = state.problems.filter(isDue).slice(0, 4);
  els.suggestionList.innerHTML = "";

  if (!due.length) {
    els.suggestionList.append(makeEmpty("目前没有明显到期的题，可以补充新题或随机抽查。"));
    return;
  }

  due.forEach((problem) => {
    const item = document.createElement("button");
    item.className = "suggestion-item";
    item.type = "button";
    item.innerHTML = `<strong>${escapeHtml(problem.title)}</strong><span>${escapeHtml(getDueReason(problem))}</span>`;
    item.addEventListener("click", () => showReview(problem));
    els.suggestionList.append(item);
  });
}

function renderTagFilter() {
  const current = els.tagFilter.value;
  const tags = [...new Set(state.problems.flatMap((problem) => problem.tags))].sort();
  els.tagFilter.innerHTML = '<option value="">全部分类</option>';
  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    els.tagFilter.append(option);
  });
  els.tagFilter.value = tags.includes(current) ? current : "";
}

function renderLibrary() {
  els.codeModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.codeMode === state.codeMode);
  });

  const problems = getFilteredProblems();
  els.list.innerHTML = "";
  els.visibleCount.textContent = `${problems.length} 道`;

  if (!problems.length) {
    els.list.append(makeEmpty(state.problems.length ? "当前筛选下没有题目。" : "先添加一道最近写过的题目。"));
    return;
  }

  problems.forEach((problem) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".problem-number").textContent = `#${problem.number}`;
    card.querySelector("h3").textContent = problem.title;

    const difficulty = card.querySelector(".difficulty");
    difficulty.textContent = problem.difficulty;
    difficulty.classList.add(problem.difficulty.toLowerCase());

    const tagRow = card.querySelector(".tag-row");
    problem.tags.forEach((tag) => tagRow.append(makePill(tag, "tag")));
    card.querySelector(".description").textContent = problem.description || "还没有题目描述。";
    card.querySelector(".idea").textContent = problem.idea || "还没有写核心思路。";

    const codePreview = card.querySelector(".code-preview");
    codePreview.classList.toggle("full", state.codeMode === "full");
    renderCodeViewer(codePreview, problem.code, state.codeMode === "full" ? Infinity : 8);

    const meta = card.querySelector(".card-meta");
    meta.append(makePill(problem.language, "meta-pill"));
    meta.append(makePill(problem.status, "meta-pill"));
    meta.append(makePill(`复习 ${problem.reviewCount} 次`, "meta-pill"));
    meta.append(makePill(`上次 ${formatDate(problem.lastReviewedAt)}`, "meta-pill"));

    card.querySelector(".edit-btn").addEventListener("click", () => fillForm(problem));
    card.querySelector(".review-btn").addEventListener("click", () => showReview(problem));
    card.querySelector(".delete-btn").addEventListener("click", () => deleteProblem(problem.id));
    els.list.append(card);
  });
}

function renderReview() {
  renderDueList();
  const problem = state.problems.find((item) => item.id === state.activeReviewId);
  els.reviewEmpty.hidden = Boolean(problem);
  els.reviewContent.hidden = !problem;
  if (!problem) return;

  els.activeReviewTitle.textContent = `#${problem.number} ${problem.title}`;
  els.reviewMeta.innerHTML = "";
  [problem.difficulty, problem.language, problem.status, ...problem.tags].forEach((item) => {
    els.reviewMeta.append(makePill(item, "meta-pill"));
  });
  els.reviewDescription.textContent = problem.description || "还没有记录，可以在提交页面补充或抓取。";
  els.reviewIdea.textContent = problem.idea || "先自己回忆题意、数据范围、算法主线，再打开代码对照。";
  els.reviewPitfall.textContent = problem.pitfall || "还没有记录。";
  renderCodeViewer(els.reviewCode, problem.code, Infinity);
  els.reviewCode.hidden = !state.codeVisible;
  els.reviewCountText.textContent = `已复习 ${problem.reviewCount} 次`;
  els.toggleCode.textContent = state.codeVisible ? "隐藏代码" : "显示代码";
}

function renderDueList() {
  const due = state.problems.filter(isDue).slice(0, 8);
  els.dueList.innerHTML = "";

  if (!due.length) {
    els.dueList.append(makeEmpty("今天没有必须复习的题。"));
    return;
  }

  due.forEach((problem) => {
    const item = document.createElement("button");
    item.className = "due-item";
    item.type = "button";
    item.innerHTML = `<strong>#${escapeHtml(problem.number)} ${escapeHtml(problem.title)}</strong><span>${escapeHtml(getDueReason(problem))}</span>`;
    item.addEventListener("click", () => showReview(problem));
    els.dueList.append(item);
  });
}

function getFilteredProblems() {
  const query = els.search.value.trim().toLowerCase();
  const tag = els.tagFilter.value;
  const status = els.statusFilter.value;

  return state.problems
    .filter((problem) => {
      const haystack = [
        problem.number,
        problem.title,
        problem.language,
        problem.difficulty,
        problem.status,
        problem.description,
        problem.idea,
        problem.pitfall,
        problem.code,
        problem.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return (!query || haystack.includes(query)) && (!tag || problem.tags.includes(tag)) && (!status || problem.status === status);
    })
    .sort((a, b) => {
      const dueDiff = Number(isDue(b)) - Number(isDue(a));
      if (dueDiff) return dueDiff;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
}

function showReview(problem) {
  state.activeReviewId = problem.id;
  state.codeVisible = false;
  setView("review");
  renderReview();
}

function markReview(status) {
  const problem = state.problems.find((item) => item.id === state.activeReviewId);
  if (!problem) return;
  problem.status = status;
  problem.reviewCount += 1;
  problem.lastReviewedAt = new Date().toISOString();
  problem.updatedAt = problem.lastReviewedAt;
  saveProblems();
  render();
}

function deleteProblem(id) {
  const problem = state.problems.find((item) => item.id === id);
  if (!problem || !confirm(`删除 #${problem.number} ${problem.title}？`)) return;
  state.problems = state.problems.filter((item) => item.id !== id);
  if (state.activeReviewId === id) state.activeReviewId = null;
  saveProblems();
  render();
}

function getLeetCodeSlug(value) {
  const text = value.trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/problems\/([^/]+)/);
    return match?.[1] || "";
  } catch {
    const match = text.match(/(?:problems\/)?([a-z0-9-]+)\/?$/i);
    return match?.[1] || "";
  }
}

async function requestLeetCodeProblem(slug) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        translatedTitle
        difficulty
        content
        topicTags {
          name
          translatedName
        }
      }
    }
  `;
  const response = await fetch("https://leetcode.cn/graphql/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "questionData",
      query,
      variables: { titleSlug: slug },
    }),
  });

  if (!response.ok) throw new Error("LeetCode 请求失败，可能被浏览器跨域策略拦截。");

  const payload = await response.json();
  const question = payload.data?.question;
  if (!question) throw new Error("没有找到对应题目，请检查链接是否正确。");

  return {
    number: question.questionFrontendId || "",
    title: question.translatedTitle || question.title || "",
    difficulty: question.difficulty || "Medium",
    tags: (question.topicTags || []).map((tag) => tag.translatedName || tag.name).filter(Boolean),
    description: htmlToText(question.content || ""),
  };
}

function htmlToText(html) {
  const container = document.createElement("div");
  container.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/pre>/gi, "\n\n");
  return container.textContent
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTags(value) {
  return value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function makePill(text, className) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.textContent = text || "无";
  return pill;
}

function makeEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function renderCodeViewer(container, code, maxLines) {
  const source = code || "还没有粘贴代码。";
  const lines = source.split("\n");
  const visibleLines = Number.isFinite(maxLines) ? lines.slice(0, maxLines) : lines;
  const shouldTruncate = Number.isFinite(maxLines) && lines.length > maxLines;

  container.innerHTML = "";
  visibleLines.forEach((line, index) => {
    container.append(makeCodeLine(line, index + 1));
  });

  if (shouldTruncate) {
    const more = document.createElement("div");
    more.className = "code-line code-more";
    more.innerHTML = '<span class="line-number"></span><code>...</code>';
    container.append(more);
  }
}

function makeCodeLine(line, number) {
  const row = document.createElement("div");
  row.className = "code-line";
  const gutter = document.createElement("span");
  gutter.className = "line-number";
  gutter.textContent = number;
  const code = document.createElement("code");
  code.innerHTML = highlightCode(line || " ");
  row.append(gutter, code);
  return row;
}

function highlightCode(line) {
  const escaped = escapeHtml(line);
  const tokenPattern =
    /(\/\/.*)|(&lt;[^&]*?&gt;)|\b(class|public|private|protected|return|if|else|for|while|void|int|long|double|float|bool|char|string|vector|const|auto|using|namespace|include)\b|\b(true|false|nullptr|NULL)\b|\b(\d+)\b/g;

  return escaped.replace(tokenPattern, (match, comment, type, keyword, literal, number) => {
    if (comment) return `<span class="tok-comment">${comment}</span>`;
    if (type) return `<span class="tok-type">${type}</span>`;
    if (keyword) return `<span class="tok-keyword">${keyword}</span>`;
    if (literal) return `<span class="tok-literal">${literal}</span>`;
    if (number) return `<span class="tok-number">${number}</span>`;
    return match;
  });
}

function getReviewWeight(problem) {
  if (problem.status === "不会") return 5;
  if (problem.status === "模糊") return 4;
  if (problem.status === "未复习") return 3;
  if (isDue(problem)) return 2;
  return 1;
}

function isDue(problem) {
  if (!problem.lastReviewedAt) return true;
  const days = (Date.now() - new Date(problem.lastReviewedAt).getTime()) / 86400000;
  if (problem.status === "不会") return days >= 1;
  if (problem.status === "模糊") return days >= 2;
  return days >= 5;
}

function getDueReason(problem) {
  if (!problem.lastReviewedAt) return `${problem.status} · 从未复习`;
  return `${problem.status} · 上次 ${formatDate(problem.lastReviewedAt)}`;
}

function exportProblems() {
  const payload = JSON.stringify({ version: 2, problems: state.problems }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leetcode-review-${formatFullDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProblems(event) {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.problems;
    if (!Array.isArray(imported)) throw new Error("Invalid data");
    state.problems = mergeProblems(state.problems, imported.map(normalizeProblem));
    saveProblems();
    render();
  } catch {
    alert("导入失败：请选择由本工具导出的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
}

function loadProblems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) return JSON.parse(saved).map(normalizeProblem);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return seedProblems();
}

function saveProblems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.problems));
}

function normalizeProblem(problem) {
  const now = new Date().toISOString();
  return {
    id: problem.id || createId(),
    number: String(problem.number || "").trim(),
    title: String(problem.title || "").trim(),
    url: String(problem.url || "").trim(),
    difficulty: ["Easy", "Medium", "Hard"].includes(problem.difficulty) ? problem.difficulty : "Medium",
    language: problem.language || "C++",
    tags: Array.isArray(problem.tags) ? problem.tags : parseTags(problem.tags || ""),
    description: problem.description || "",
    idea: problem.idea || "",
    pitfall: problem.pitfall || "",
    code: problem.code || "",
    status: normalizeStatus(problem.status),
    reviewCount: Number(problem.reviewCount || 0),
    lastReviewedAt: problem.lastReviewedAt || "",
    createdAt: problem.createdAt || now,
    updatedAt: problem.updatedAt || now,
  };
}

function normalizeStatus(status) {
  if (STATUS_OPTIONS.includes(status)) return status;
  if (status === "mastered") return "掌握";
  if (status === "weak") return "模糊";
  if (status === "unknown") return "不会";
  return "未复习";
}

function mergeProblems(current, imported) {
  const byKey = new Map();
  [...imported, ...current].forEach((problem) => {
    const key = `${problem.number}-${problem.title}`.toLowerCase();
    byKey.set(key, problem);
  });
  return [...byKey.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function seedProblems() {
  const now = new Date().toISOString();
  return [
    {
      id: createId(),
      number: "46",
      title: "Permutations",
      url: "https://leetcode.cn/problems/permutations/",
      difficulty: "Medium",
      language: "C++",
      tags: ["回溯", "数组", "DFS"],
      description: "给定一个不含重复数字的数组 nums，返回其所有可能的全排列。",
      idea: "使用 used 数组标记已选元素，递归构造路径；当路径长度等于 n 时收集答案。",
      pitfall: "回溯返回时要同时撤销 path 和 used，否则会污染其他分支。",
      code: "class Solution {\npublic:\n    vector<vector<int>> ans;\n    vector<int> path;\n\n    void dfs(vector<int>& nums, vector<int>& used) {\n        if (path.size() == nums.size()) {\n            ans.push_back(path);\n            return;\n        }\n        for (int i = 0; i < nums.size(); ++i) {\n            if (used[i]) continue;\n            used[i] = 1;\n            path.push_back(nums[i]);\n            dfs(nums, used);\n            path.pop_back();\n            used[i] = 0;\n        }\n    }\n};",
      status: "未复习",
      reviewCount: 0,
      lastReviewedAt: "",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getContributionDays(endDate) {
  const days = [];
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 364);

  const gridStart = new Date(startDate);
  gridStart.setDate(startDate.getDate() - gridStart.getDay());

  const gridEnd = new Date(endDate);
  gridEnd.setDate(endDate.getDate() + (6 - gridEnd.getDay()));

  for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
    const item = new Date(date);
    item.inRange = item >= startDate && item <= endDate;
    days.push(item);
  }

  return days;
}

function getContributionMonths(days) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const months = [];
  let activeMonth = "";

  days.forEach((date, index) => {
    if (!date.inRange) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const dayOfMonth = date.getDate();
    if (key === activeMonth || (months.length > 0 && dayOfMonth !== 1)) return;

    activeMonth = key;
    const column = Math.floor(index / 7) + 1;
    const nextMonth = days.findIndex((candidate, candidateIndex) => {
      return candidateIndex > index && candidate.inRange && candidate.getDate() === 1;
    });
    const nextColumn = nextMonth === -1 ? Math.ceil(days.length / 7) + 1 : Math.floor(nextMonth / 7) + 1;
    months.push({
      name: formatter.format(date),
      column,
      span: Math.max(1, nextColumn - column),
    });
  });

  return months;
}

function getHeatmapYears() {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, state.activeHeatmapYear]);

  state.problems.forEach((problem) => {
    const date = new Date(problem.createdAt);
    if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
  });

  return [...years].sort((a, b) => b - a);
}

function getHeatLevel(count, max) {
  if (count <= 0) return 0;
  return Math.max(1, Math.ceil((count / max) * 4));
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatFullDate(value) {
  return dayKey(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `problem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
