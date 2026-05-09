const STORAGE_KEY = "leetcode-review-desk-v1";

const state = {
  problems: loadProblems(),
  activeReviewId: null,
  codeVisible: false,
};

const els = {
  form: document.querySelector("#problemForm"),
  formTitle: document.querySelector("#formTitle"),
  problemId: document.querySelector("#problemId"),
  number: document.querySelector("#numberInput"),
  title: document.querySelector("#titleInput"),
  url: document.querySelector("#urlInput"),
  difficulty: document.querySelector("#difficultyInput"),
  language: document.querySelector("#languageInput"),
  tags: document.querySelector("#tagsInput"),
  idea: document.querySelector("#ideaInput"),
  pitfall: document.querySelector("#pitfallInput"),
  code: document.querySelector("#codeInput"),
  resetForm: document.querySelector("#resetFormBtn"),
  search: document.querySelector("#searchInput"),
  tagFilter: document.querySelector("#tagFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  random: document.querySelector("#randomBtn"),
  list: document.querySelector("#problemList"),
  template: document.querySelector("#problemCardTemplate"),
  visibleCount: document.querySelector("#visibleCount"),
  totalCount: document.querySelector("#totalCount"),
  dueCount: document.querySelector("#dueCount"),
  weakCount: document.querySelector("#weakCount"),
  tagCount: document.querySelector("#tagCount"),
  reviewDesk: document.querySelector("#reviewDesk"),
  reviewTitle: document.querySelector("#reviewTitle"),
  reviewMeta: document.querySelector("#reviewMeta"),
  reviewIdea: document.querySelector("#reviewIdea"),
  reviewPitfall: document.querySelector("#reviewPitfall"),
  reviewCode: document.querySelector("#reviewCode"),
  toggleCode: document.querySelector("#toggleCodeBtn"),
  closeReview: document.querySelector("#closeReviewBtn"),
  export: document.querySelector("#exportBtn"),
  import: document.querySelector("#importInput"),
};

render();

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
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
  render();
});

els.resetForm.addEventListener("click", resetForm);
els.search.addEventListener("input", render);
els.tagFilter.addEventListener("change", render);
els.statusFilter.addEventListener("change", render);
els.random.addEventListener("click", () => {
  const candidates = getFilteredProblems();
  if (!candidates.length) return;
  const weighted = candidates.flatMap((problem) => {
    const weight = getReviewWeight(problem);
    return Array.from({ length: weight }, () => problem);
  });
  showReview(weighted[Math.floor(Math.random() * weighted.length)]);
});

els.closeReview.addEventListener("click", () => {
  state.activeReviewId = null;
  state.codeVisible = false;
  renderReview();
});

els.toggleCode.addEventListener("click", () => {
  state.codeVisible = !state.codeVisible;
  renderReview();
});

document.querySelectorAll("[data-review]").forEach((button) => {
  button.addEventListener("click", () => {
    const problem = state.problems.find((item) => item.id === state.activeReviewId);
    if (!problem) return;
    problem.status = button.dataset.review;
    problem.reviewCount += 1;
    problem.lastReviewedAt = new Date().toISOString();
    problem.updatedAt = problem.lastReviewedAt;
    saveProblems();
    render();
  });
});

els.export.addEventListener("click", () => {
  const payload = JSON.stringify({ version: 1, problems: state.problems }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leetcode-review-${formatDate(new Date().toISOString())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

els.import.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.problems;
    if (!Array.isArray(imported)) throw new Error("Invalid data");
    const normalized = imported.map(normalizeProblem);
    state.problems = mergeProblems(state.problems, normalized);
    saveProblems();
    render();
  } catch {
    alert("导入失败：请选择由本工具导出的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
});

function render() {
  renderStats();
  renderTagFilter();
  renderList();
  renderReview();
}

function renderStats() {
  const tags = new Set(state.problems.flatMap((problem) => problem.tags));
  els.totalCount.textContent = state.problems.length;
  els.dueCount.textContent = state.problems.filter(isDue).length;
  els.weakCount.textContent = state.problems.filter((problem) =>
    ["模糊", "不会", "未复习"].includes(problem.status),
  ).length;
  els.tagCount.textContent = tags.size;
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

function renderList() {
  const problems = getFilteredProblems();
  els.list.innerHTML = "";
  els.visibleCount.textContent = `${problems.length} 道`;

  if (!problems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.problems.length
      ? "当前筛选下没有题目。"
      : "先添加一道最近写过的题，复习系统就开始转起来。";
    els.list.append(empty);
    return;
  }

  problems.forEach((problem) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".problem-number").textContent = `#${problem.number}`;
    card.querySelector("h3").textContent = problem.title;
    const difficulty = card.querySelector(".difficulty");
    difficulty.textContent = problem.difficulty;
    difficulty.classList.add(problem.difficulty.toLowerCase());
    card.querySelector(".idea").textContent = problem.idea || "还没有写核心思路。";

    const tags = card.querySelector(".tag-row");
    problem.tags.forEach((tag) => tags.append(makePill(tag, "tag")));

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
  const problem = state.problems.find((item) => item.id === state.activeReviewId);
  els.reviewDesk.hidden = !problem;
  if (!problem) return;

  els.reviewTitle.textContent = `#${problem.number} ${problem.title}`;
  els.reviewMeta.innerHTML = "";
  [problem.difficulty, problem.language, problem.status, ...problem.tags].forEach((item) => {
    els.reviewMeta.append(makePill(item, "meta-pill"));
  });
  els.reviewIdea.textContent = problem.idea || "先自己回忆题意、数据范围、算法主线，再打开代码对照。";
  els.reviewPitfall.textContent = problem.pitfall ? `易错点：${problem.pitfall}` : "易错点：还没有记录。";
  els.reviewCode.textContent = problem.code || "还没有粘贴代码。";
  els.reviewCode.hidden = !state.codeVisible;
  els.toggleCode.textContent = state.codeVisible ? "隐藏代码" : "显示代码";
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
        problem.idea,
        problem.pitfall,
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
  renderReview();
  els.reviewDesk.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillForm(problem) {
  els.formTitle.textContent = "编辑题目";
  els.problemId.value = problem.id;
  els.number.value = problem.number;
  els.title.value = problem.title;
  els.url.value = problem.url;
  els.difficulty.value = problem.difficulty;
  els.language.value = problem.language;
  els.tags.value = problem.tags.join(", ");
  els.idea.value = problem.idea;
  els.pitfall.value = problem.pitfall;
  els.code.value = problem.code;
  els.number.focus();
}

function resetForm() {
  els.form.reset();
  els.formTitle.textContent = "添加题目";
  els.problemId.value = "";
  els.difficulty.value = "Medium";
  els.language.value = "C++";
}

function deleteProblem(id) {
  const problem = state.problems.find((item) => item.id === id);
  if (!problem || !confirm(`删除 #${problem.number} ${problem.title}？`)) return;
  state.problems = state.problems.filter((item) => item.id !== id);
  if (state.activeReviewId === id) state.activeReviewId = null;
  saveProblems();
  render();
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

function formatDate(value) {
  if (!value) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function loadProblems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
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
    difficulty: problem.difficulty || "Medium",
    language: problem.language || "C++",
    tags: Array.isArray(problem.tags) ? problem.tags : parseTags(problem.tags || ""),
    idea: problem.idea || "",
    pitfall: problem.pitfall || "",
    code: problem.code || "",
    status: problem.status || "未复习",
    reviewCount: Number(problem.reviewCount || 0),
    lastReviewedAt: problem.lastReviewedAt || "",
    createdAt: problem.createdAt || now,
    updatedAt: problem.updatedAt || now,
  };
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
      idea: "用 used 数组标记已选元素，递归构造路径，路径长度等于 n 时收集答案。",
      pitfall: "回溯返回时要同时撤销 path 和 used，否则会污染其他分支。",
      code: "// 在这里替换成你自己的代码",
      status: "未复习",
      reviewCount: 0,
      lastReviewedAt: "",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `problem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
