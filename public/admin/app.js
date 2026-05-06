function createEmptyPaperTemplate() {
  return {
    id: `paper-${Date.now()}`,
    title: "新基础题库",
    sourceFile: "manual.json",
    sortOrder: 0,
    quizConfig: {
      durationMinutes: 120,
      questionCount: 75,
      passThreshold: 70,
    },
    questions: [
      {
        id: `question-${Date.now()}`,
        number: 1,
        reference: "",
        tags: [],
        stem: "请输入题干",
        options: [
          { key: "A", text: "选项 A" },
          { key: "B", text: "选项 B" },
          { key: "C", text: "选项 C" },
          { key: "D", text: "选项 D" },
        ],
        answer: "A",
        explanation: "请输入解析",
      },
    ],
  };
}

function createEmptyBrokerForm() {
  return {
    id: 0,
    name: "",
    qrImagePath: "",
    qrImageUrl: "",
    miniProgramCodePath: "",
    miniProgramCodeUrl: "",
    enabled: true,
    isDefault: false,
  };
}

function createEmptyUserForm() {
  return {
    id: 0,
    openid: "",
    nickname: "",
    friendStatus: "pending",
    displayName: "",
    attemptCount: 0,
    latestAttemptAt: "",
    latestPaperTitle: "",
    latestAttemptId: "",
    lastLoginAt: "",
  };
}

function createEmptyUsersPage() {
  return {
    items: [],
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  };
}

function createPaperEditorPayload(paper) {
  const payload = { ...paper };
  delete payload.quizConfig;
  delete payload.sortOrder;
  delete payload.bankType;
  delete payload.basePaperId;
  delete payload.updatePaper;
  delete payload.updateQuestionCount;
  delete payload.combinedQuestionCount;
  delete payload.duplicateQuestionCount;
  delete payload.rawQuestionCount;
  return payload;
}

const state = {
  activeSection: "papers",
  overview: null,
  currentAdmin: null,
  selectedPaperDetail: null,
  selectedPaperId: "",
  paperMode: "create",
  activePaperBank: "base",
  paperViewMode: "list",
  paperQuestionPage: 1,
  paperQuestionPageSize: 10,
  selectedQuestionIndex: 0,
  pendingPdfPreview: null,
  paperDrafts: {
    base: null,
    update: null,
  },
  paperJson: JSON.stringify(createEmptyPaperTemplate(), null, 2),
  selectedBrokerId: 0,
  brokerForm: createEmptyBrokerForm(),
  selectedUserId: 0,
  userForm: createEmptyUserForm(),
  userAttempts: [],
  usersPage: createEmptyUsersPage(),
  userModalOpen: false,
};

const elements = {
  menuItems: Array.from(document.querySelectorAll(".menu__item")),
  sectionTitle: document.getElementById("section-title"),
  sections: {
    papers: document.getElementById("section-papers"),
    brokers: document.getElementById("section-brokers"),
    users: document.getElementById("section-users"),
    admin: document.getElementById("section-admin"),
  },
  adminIdentity: document.getElementById("admin-identity"),
  logoutButton: document.getElementById("logout-button"),
  paperCount: document.getElementById("paper-count"),
  brokerCount: document.getElementById("broker-count"),
  userCount: document.getElementById("user-count"),
  paperList: document.getElementById("paper-list"),
  paperEditorMode: document.getElementById("paper-editor-mode"),
  paperTitleInput: document.getElementById("paper-title-input"),
  paperSortOrder: document.getElementById("paper-sort-order"),
  paperDurationMinutes: document.getElementById("paper-duration-minutes"),
  paperQuestionCount: document.getElementById("paper-question-count"),
  paperPassThreshold: document.getElementById("paper-pass-threshold"),
  paperJson: document.getElementById("paper-json"),
  paperBankBase: document.getElementById("paper-bank-base"),
  paperBankUpdate: document.getElementById("paper-bank-update"),
  paperBankBaseCount: document.getElementById("paper-bank-base-count"),
  paperBankUpdateCount: document.getElementById("paper-bank-update-count"),
  paperViewList: document.getElementById("paper-view-list"),
  paperViewJson: document.getElementById("paper-view-json"),
  paperQuestionSummary: document.getElementById("paper-question-summary"),
  paperQuestionListView: document.getElementById("paper-question-list-view"),
  paperQuestionTableBody: document.getElementById("paper-question-table-body"),
  paperQuestionPrevPage: document.getElementById("paper-question-prev-page"),
  paperQuestionNextPage: document.getElementById("paper-question-next-page"),
  paperQuestionPageCurrent: document.getElementById("paper-question-page-current"),
  questionEditorTitle: document.getElementById("question-editor-title"),
  questionReference: document.getElementById("question-reference"),
  questionTags: document.getElementById("question-tags"),
  questionStem: document.getElementById("question-stem"),
  questionOptionA: document.getElementById("question-option-a"),
  questionOptionB: document.getElementById("question-option-b"),
  questionOptionC: document.getElementById("question-option-c"),
  questionOptionD: document.getElementById("question-option-d"),
  questionAnswer: document.getElementById("question-answer"),
  questionExplanation: document.getElementById("question-explanation"),
  questionApply: document.getElementById("question-apply"),
  paperNew: document.getElementById("paper-new"),
  paperSave: document.getElementById("paper-save"),
  paperDelete: document.getElementById("paper-delete"),
  paperUpload: document.getElementById("paper-upload"),
  paperUpdateUpload: document.getElementById("paper-update-upload"),
  pdfPreviewModal: document.getElementById("pdf-preview-modal"),
  pdfPreviewTitle: document.getElementById("pdf-preview-title"),
  pdfPreviewSummary: document.getElementById("pdf-preview-summary"),
  pdfPreviewConfirm: document.getElementById("pdf-preview-confirm"),
  pdfPreviewCancel: document.getElementById("pdf-preview-cancel"),
  paperUpdateInfo: document.getElementById("paper-update-info"),
  paperImportDemos: document.getElementById("paper-import-demos"),
  brokerList: document.getElementById("broker-list"),
  brokerForm: document.getElementById("broker-form"),
  brokerName: document.getElementById("broker-name"),
  brokerEnabled: document.getElementById("broker-enabled"),
  brokerDefault: document.getElementById("broker-default"),
  brokerImage: document.getElementById("broker-image"),
  brokerQrPath: document.getElementById("broker-qr-path"),
  brokerPreview: document.getElementById("broker-preview"),
  brokerMiniCodeGenerate: document.getElementById("broker-generate-minicode"),
  brokerMiniCodePath: document.getElementById("broker-minicode-path"),
  brokerMiniCodePreview: document.getElementById("broker-minicode-preview"),
  brokerMiniCodeDownload: document.getElementById("broker-minicode-download"),
  brokerNew: document.getElementById("broker-new"),
  brokerDelete: document.getElementById("broker-delete"),
  userTableBody: document.getElementById("user-table-body"),
  userPaginationSummary: document.getElementById("user-pagination-summary"),
  userPrevPage: document.getElementById("user-prev-page"),
  userNextPage: document.getElementById("user-next-page"),
  userPageCurrent: document.getElementById("user-page-current"),
  userModal: document.getElementById("user-modal"),
  userModalTitle: document.getElementById("user-modal-title"),
  userModalClose: document.getElementById("user-modal-close"),
  userForm: document.getElementById("user-form"),
  userNickname: document.getElementById("user-nickname"),
  userOpenid: document.getElementById("user-openid"),
  userFriendStatus: document.getElementById("user-friend-status"),
  userMeta: document.getElementById("user-meta"),
  userAttemptList: document.getElementById("user-attempt-list"),
  configForm: document.getElementById("config-form"),
  configRequireFriendForAnswers: document.getElementById("config-require-friend-for-answers"),
  adminForm: document.getElementById("admin-form"),
  adminUsername: document.getElementById("admin-username"),
  adminPassword: document.getElementById("admin-password"),
  toast: document.getElementById("toast"),
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("toast--visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove("toast--visible");
  }, 2200);
}

async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const init = {
    credentials: "include",
    ...options,
    headers,
  };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error(payload.message || "请重新登录");
  }

  if (!response.ok) {
    throw new Error(payload.message || "请求失败");
  }

  return payload;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateText(value = "", maxLength = 56) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function parseCurrentPaperJson() {
  try {
    return JSON.parse(elements.paperJson.value || "{}");
  } catch {
    return null;
  }
}

function setCurrentPaperJson(paper) {
  state.paperJson = JSON.stringify(paper, null, 2);
  elements.paperJson.value = state.paperJson;
}

function getOptionText(question, key) {
  const option = (question.options || []).find((item) => item.key === key);
  return option?.text || "";
}

async function loadSession() {
  const payload = await requestJson("/admin/api/session");
  state.currentAdmin = payload.admin;
  elements.adminIdentity.textContent = payload.admin.username;
  elements.adminUsername.value = payload.admin.username;
}

function setActiveSection(section) {
  state.activeSection = section;
  const labels = {
    papers: "题库管理",
    brokers: "中介人管理",
    users: "用户与答题记录",
    admin: "管理员设置",
  };
  elements.sectionTitle.textContent = labels[section] || "后台管理";

  elements.menuItems.forEach((button) => {
    button.classList.toggle("menu__item--active", button.dataset.section === section);
  });

  Object.entries(elements.sections).forEach(([key, element]) => {
    element.classList.toggle("section--active", key === section);
  });
}

function syncBrokerForm() {
  elements.brokerName.value = state.brokerForm.name;
  elements.brokerEnabled.checked = Boolean(state.brokerForm.enabled);
  elements.brokerDefault.checked = Boolean(state.brokerForm.isDefault);
  elements.brokerQrPath.value = state.brokerForm.qrImagePath || "";
  elements.brokerMiniCodePath.value = state.brokerForm.miniProgramCodePath || "";

  if (state.brokerForm.qrImageUrl) {
    elements.brokerPreview.className = "image-preview";
    elements.brokerPreview.innerHTML = `<img src="${state.brokerForm.qrImageUrl}" alt="二维码" />`;
  } else {
    elements.brokerPreview.className = "image-preview image-preview--empty";
    elements.brokerPreview.textContent = "暂未上传二维码";
  }

  if (state.brokerForm.miniProgramCodeUrl) {
    elements.brokerMiniCodePreview.className = "image-preview";
    elements.brokerMiniCodePreview.innerHTML = `<img src="${state.brokerForm.miniProgramCodeUrl}" alt="小程序碼" />`;
    elements.brokerMiniCodeDownload.hidden = false;
    elements.brokerMiniCodeDownload.href = state.brokerForm.miniProgramCodeUrl;
  } else {
    elements.brokerMiniCodePreview.className = "image-preview image-preview--empty";
    elements.brokerMiniCodePreview.textContent = "暂未生成小程序碼";
    elements.brokerMiniCodeDownload.hidden = true;
    elements.brokerMiniCodeDownload.removeAttribute("href");
  }

  elements.brokerMiniCodeGenerate.disabled = !state.selectedBrokerId;
}

function syncUserForm() {
  elements.userNickname.value = state.userForm.nickname || "";
  elements.userOpenid.value = state.userForm.openid || "";
  elements.userFriendStatus.value = state.userForm.friendStatus || "pending";
  elements.userModalTitle.textContent = state.userForm.displayName || state.userForm.openid || "用户资料";

  const metaParts = [];
  if (state.userForm.lastLoginAt) {
    metaParts.push(`最近登录：${state.userForm.lastLoginAt}`);
  }
  if (state.userForm.attemptCount) {
    metaParts.push(`答题次数：${state.userForm.attemptCount}`);
  }
  if (state.userForm.latestPaperTitle) {
    metaParts.push(`最近试卷：${state.userForm.latestPaperTitle}`);
  }
  if (state.userForm.latestAttemptAt) {
    metaParts.push(`最近交卷：${state.userForm.latestAttemptAt}`);
  }

  elements.userMeta.textContent = metaParts.join(" · ") || "暂无用户信息";
}

function formatPaperUpdateInfo(paper) {
  const updatePaper = paper.updatePaper;
  const baseCount = Number(paper.questionCount || 0);
  const updateCount = Number(paper.updateQuestionCount || updatePaper?.questionCount || 0);
  const combinedCount = Number(paper.combinedQuestionCount || baseCount + updateCount);
  if (!updatePaper) {
    return `当前未上传更新题库。基础题库 ${baseCount} 题，抽题时仅从基础题库随机抽取。`;
  }

  const sourceText = updatePaper.sourceFile ? `，来源：${updatePaper.sourceFile}` : "";
  return `当前更新题库 ${updateCount} 题${sourceText}。合计题池 ${combinedCount} 题。`;
}

function clonePaper(paper) {
  return paper ? JSON.parse(JSON.stringify(paper)) : null;
}

function createPaperDraft(paper) {
  const draft = clonePaper(paper) || createEmptyPaperTemplate();
  delete draft.updatePaper;
  delete draft.updateQuestionCount;
  delete draft.combinedQuestionCount;
  delete draft.duplicateQuestionCount;
  delete draft.rawQuestionCount;
  return draft;
}

function applyOverallPaperControlsToBasePaper(paper) {
  const targetPaper = paper || createPaperDraft(createEmptyPaperTemplate());
  const sortOrder = Number(elements.paperSortOrder.value);
  const durationMinutes = Number(elements.paperDurationMinutes.value);
  const questionCount = Number(elements.paperQuestionCount.value);
  const passThreshold = Number(elements.paperPassThreshold.value);

  targetPaper.title = elements.paperTitleInput.value.trim() || targetPaper.title || "未命名题库";
  targetPaper.sortOrder = Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0;
  targetPaper.bankType = "base";
  targetPaper.basePaperId = "";
  targetPaper.quizConfig = {
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : 60,
    questionCount: Number.isFinite(questionCount) && questionCount > 0 ? Math.round(questionCount) : 1,
    passThreshold: Number.isFinite(passThreshold)
      ? Math.max(0, Math.min(100, Math.round(passThreshold)))
      : 70,
  };

  return targetPaper;
}

function syncOverallPaperControlsToDrafts() {
  state.paperDrafts.base = applyOverallPaperControlsToBasePaper(state.paperDrafts.base);
  if (state.paperDrafts.update) {
    state.paperDrafts.update.title = state.paperDrafts.base.title;
  }
  return state.paperDrafts.base;
}

function loadPaperDraft(bankType) {
  const nextBankType = bankType === "update" && state.paperDrafts.update ? "update" : "base";
  const paper = state.paperDrafts[nextBankType] || createPaperDraft(createEmptyPaperTemplate());
  if (nextBankType === "update" && state.paperDrafts.base?.title) {
    paper.title = state.paperDrafts.base.title;
  }

  state.activePaperBank = nextBankType;
  state.paperQuestionPage = 1;
  state.selectedQuestionIndex = 0;
  setCurrentPaperJson(createPaperEditorPayload(paper));
  setPaperControlsFromPaper(paper, state.paperMode);
  renderPaperBankSwitch();
  renderPaperQuestionWorkspace();
}

function setPaperControlsFromPaper(paper, mode) {
  const basePaper = state.paperDrafts.base || state.selectedPaperDetail || paper;
  elements.paperTitleInput.value = basePaper?.title || "";
  elements.paperSortOrder.value = String(basePaper?.sortOrder ?? 0);
  elements.paperDurationMinutes.value = String(basePaper?.quizConfig?.durationMinutes || "");
  elements.paperQuestionCount.value = String(basePaper?.quizConfig?.questionCount || basePaper?.questionCount || "");
  elements.paperPassThreshold.value = String(basePaper?.quizConfig?.passThreshold || "");
  elements.paperUpdateInfo.textContent = mode === "edit" && state.selectedPaperDetail
    ? formatPaperUpdateInfo(state.selectedPaperDetail)
    : "保存基础题库后，可继续上传关联的更新题库。";
  elements.paperEditorMode.textContent = mode === "edit"
    ? `编辑题库: ${basePaper?.title || "未命名题库"}`
    : "新增题库";
  elements.paperSave.textContent = "保存全部题库";
  elements.paperDelete.textContent = state.activePaperBank === "update" ? "删除更新题库" : "删除基础题库";

  elements.paperSortOrder.disabled = false;
  elements.paperDurationMinutes.disabled = false;
  elements.paperQuestionCount.disabled = false;
  elements.paperPassThreshold.disabled = false;
}

function renderPaperBankSwitch() {
  const detail = state.selectedPaperDetail;
  const baseDraft = state.paperDrafts.base;
  const updateDraft = state.paperDrafts.update;
  const baseCount = Number(baseDraft?.questions?.length || detail?.questionCount || 0);
  const updateCount = Number(updateDraft?.questions?.length || detail?.updatePaper?.questionCount || detail?.updateQuestionCount || 0);
  elements.paperBankBaseCount.textContent = `${baseCount} 题`;
  elements.paperBankUpdateCount.textContent = updateCount ? `${updateCount} 题` : "未上传";
  elements.paperBankBase.closest(".paper-bank-switch__item")
    ?.classList.toggle("paper-bank-switch__item--active", state.activePaperBank === "base");
  elements.paperBankUpdate.closest(".paper-bank-switch__item")
    ?.classList.toggle("paper-bank-switch__item--active", state.activePaperBank === "update");
  elements.paperBankUpdate.disabled = state.paperMode !== "edit" || !updateDraft;
  elements.paperUpdateUpload.closest(".paper-bank-switch__upload")
    ?.classList.toggle("is-disabled", state.paperMode !== "edit" || !state.selectedPaperId);
}

function setPaperEditor(paper, mode = "edit", bankType = "base") {
  state.paperMode = mode;
  state.selectedPaperId = mode === "edit" ? paper.id : "";
  state.selectedPaperDetail = mode === "edit" ? paper : null;
  state.paperDrafts = {
    base: createPaperDraft(paper),
    update: mode === "edit" && paper.updatePaper ? createPaperDraft(paper.updatePaper) : null,
  };

  loadPaperDraft(bankType);
}

function renderPaperList() {
  const papers = state.overview?.papers || [];
  elements.paperList.innerHTML = papers.map((paper) => `
    <article class="list-card ${state.selectedPaperId === paper.id ? "list-card--active" : ""}" data-action="select-paper" data-id="${paper.id}">
      <div class="list-card__title">${escapeHtml(paper.title)}</div>
      <div class="list-card__meta">排序值：${paper.sortOrder ?? 0} · 抽取 ${paper.quizConfig?.questionCount || paper.questionCount} 题 · 限时 ${paper.quizConfig?.durationMinutes || 0} 分钟</div>
      <div class="paper-tree">
        <div class="paper-tree__row">
          <div>
            <div class="paper-tree__name">基础题库</div>
            <div class="paper-tree__meta">${paper.questionCount} 题 · ${escapeHtml(paper.sourceFile || "手动编辑")}</div>
          </div>
        </div>
        <div class="paper-tree__row">
          <div>
            <div class="paper-tree__name">更新题库</div>
            <div class="paper-tree__meta">${paper.updateQuestionCount || 0} 题 · ${escapeHtml(paper.updatePaper ? (paper.updatePaper.sourceFile || "手动编辑") : "未上传")}</div>
          </div>
        </div>
      </div>
      <div class="list-card__meta">合计题池：${paper.combinedQuestionCount || paper.questionCount} 题${paper.duplicateQuestionCount ? `，已按内容去重 ${paper.duplicateQuestionCount} 题` : ""}</div>
    </article>
  `).join("") || '<article class="list-card"><div class="list-card__title">暂无题库</div></article>';
}

function syncTitleInputToJson() {
  const nextTitle = elements.paperTitleInput.value.trim();
  if (state.paperDrafts.base) {
    state.paperDrafts.base.title = nextTitle;
  }
  if (state.paperDrafts.update) {
    state.paperDrafts.update.title = nextTitle;
  }

  const paper = parseCurrentPaperJson();
  if (!paper) {
    return null;
  }
  paper.title = nextTitle;
  setCurrentPaperJson(paper);
  return paper;
}

function setPaperViewMode(mode) {
  const nextMode = mode === "json" ? "json" : "list";
  if (state.paperViewMode === "list" && nextMode === "json" && getCurrentQuestions().length) {
    try {
      applyQuestionEdit();
    } catch (error) {
      showToast(error.message);
      return;
    }
  }

  state.paperViewMode = nextMode;
  elements.paperViewList.classList.toggle("segmented-control__item--active", state.paperViewMode === "list");
  elements.paperViewJson.classList.toggle("segmented-control__item--active", state.paperViewMode === "json");
  elements.paperQuestionListView.hidden = state.paperViewMode !== "list";
  elements.paperJson.hidden = state.paperViewMode !== "json";
  if (state.paperViewMode === "list") {
    renderPaperQuestionWorkspace();
  }
}

function getCurrentQuestions() {
  const paper = parseCurrentPaperJson();
  return Array.isArray(paper?.questions) ? paper.questions : [];
}

function getQuestionPageInfo(questions) {
  const pageSize = state.paperQuestionPageSize;
  const totalPages = Math.max(1, Math.ceil(questions.length / pageSize));
  const page = Math.min(Math.max(1, state.paperQuestionPage), totalPages);
  const start = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    start,
    items: questions.slice(start, start + pageSize),
  };
}

function syncQuestionForm(question, index) {
  const hasQuestion = Boolean(question);
  elements.questionEditorTitle.textContent = hasQuestion ? `题目 ${index + 1}` : "题目编辑";
  elements.questionReference.value = question?.reference || "";
  elements.questionTags.value = Array.isArray(question?.tags) ? question.tags.join(", ") : "";
  elements.questionStem.value = question?.stem || "";
  elements.questionOptionA.value = getOptionText(question || {}, "A");
  elements.questionOptionB.value = getOptionText(question || {}, "B");
  elements.questionOptionC.value = getOptionText(question || {}, "C");
  elements.questionOptionD.value = getOptionText(question || {}, "D");
  elements.questionAnswer.value = ["A", "B", "C", "D"].includes(question?.answer) ? question.answer : "A";
  elements.questionExplanation.value = question?.explanation || "";

  [
    elements.questionReference,
    elements.questionTags,
    elements.questionStem,
    elements.questionOptionA,
    elements.questionOptionB,
    elements.questionOptionC,
    elements.questionOptionD,
    elements.questionAnswer,
    elements.questionExplanation,
    elements.questionApply,
  ].forEach((element) => {
    element.disabled = !hasQuestion;
  });
}

function renderPaperQuestionWorkspace() {
  const paper = parseCurrentPaperJson();
  const questions = Array.isArray(paper?.questions) ? paper.questions : [];
  const pageInfo = getQuestionPageInfo(questions);
  state.paperQuestionPage = pageInfo.page;
  const selectedIndex = Math.min(Math.max(0, state.selectedQuestionIndex), Math.max(0, questions.length - 1));
  state.selectedQuestionIndex = selectedIndex;

  elements.paperQuestionSummary.textContent = paper
    ? `${state.activePaperBank === "update" ? "更新题库" : "基础题库"} · ${questions.length} 题`
    : "JSON 格式不合法";
  elements.paperQuestionTableBody.innerHTML = pageInfo.items.map((question, offset) => {
    const index = pageInfo.start + offset;
    const activeClass = index === state.selectedQuestionIndex ? "question-row--active" : "";
    return `
      <tr class="question-row ${activeClass}" data-action="select-question" data-index="${index}">
        <td>${index + 1}</td>
        <td><div class="question-row__stem">${escapeHtml(truncateText(question.stem, 72))}</div></td>
        <td>${escapeHtml(question.answer || "")}</td>
      </tr>
    `;
  }).join("") || '<tr><td class="data-table__empty" colspan="3">暂无题目</td></tr>';

  elements.paperQuestionPageCurrent.textContent = `第 ${pageInfo.page} / ${pageInfo.totalPages} 页`;
  elements.paperQuestionPrevPage.disabled = pageInfo.page <= 1;
  elements.paperQuestionNextPage.disabled = pageInfo.page >= pageInfo.totalPages;
  syncQuestionForm(questions[selectedIndex], selectedIndex);
}

function applyQuestionEdit() {
  const paper = parseCurrentPaperJson();
  if (!paper || !Array.isArray(paper.questions)) {
    throw new Error("题库 JSON 格式不合法");
  }

  const index = state.selectedQuestionIndex;
  const current = paper.questions[index];
  if (!current) {
    throw new Error("请先选择题目");
  }

  paper.questions[index] = {
    ...current,
    number: index + 1,
    reference: elements.questionReference.value.trim(),
    tags: elements.questionTags.value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean),
    stem: elements.questionStem.value.trim(),
    options: [
      { key: "A", text: elements.questionOptionA.value.trim() },
      { key: "B", text: elements.questionOptionB.value.trim() },
      { key: "C", text: elements.questionOptionC.value.trim() },
      { key: "D", text: elements.questionOptionD.value.trim() },
    ],
    answer: elements.questionAnswer.value,
    explanation: elements.questionExplanation.value.trim(),
  };
  setCurrentPaperJson(paper);
  renderPaperQuestionWorkspace();
}

function renderPdfPreviewModal() {
  const preview = state.pendingPdfPreview;
  if (!preview) {
    return;
  }

  const summary = preview.summary || {};
  const bankLabel = preview.bankType === "update" ? "更新题库" : "基础题库";
  elements.pdfPreviewTitle.textContent = `${bankLabel} PDF 解析成功`;
  elements.pdfPreviewSummary.innerHTML = [
    ["PDF 文件", preview.fileName || summary.sourceFile || ""],
    ["识别状态", "成功"],
    ["题库名称", summary.title || ""],
    ["唯一题目数量", `${summary.questionCount || 0} 题`],
    ["PDF 原始题目行", `${summary.rawQuestionCount || summary.questionCount || 0} 行`],
    ["内容去重数量", `${summary.duplicateQuestionCount || 0} 题`],
    ["导入位置", bankLabel],
  ].map(([label, value]) => `
    <div class="pdf-preview-summary__row">
      <div class="pdf-preview-summary__label">${escapeHtml(label)}</div>
      <div class="pdf-preview-summary__value">${escapeHtml(value)}</div>
    </div>
  `).join("");
  elements.pdfPreviewModal.classList.add("modal--open");
}

async function closePdfPreviewModal({ cancel = false } = {}) {
  const token = state.pendingPdfPreview?.token;
  elements.pdfPreviewModal.classList.remove("modal--open");
  state.pendingPdfPreview = null;
  if (cancel && token) {
    await requestJson("/admin/api/upload-pdf/cancel", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
}

function renderBrokerList() {
  const brokers = state.overview?.brokers || [];
  elements.brokerList.innerHTML = brokers.map((broker) => `
    <article class="list-card ${state.selectedBrokerId === broker.id ? "list-card--active" : ""}" data-action="select-broker" data-id="${broker.id}">
      <div class="list-card__title">${broker.name || `中介人 #${broker.id}`}</div>
      <div class="list-card__meta">小程序碼：${broker.miniProgramCodeUrl ? "已生成" : "未生成"}</div>
      <div class="tag-row">
        ${broker.isDefault ? '<span class="tag tag--primary">默认</span>' : ""}
        <span class="tag ${broker.enabled ? "tag--success" : "tag--danger"}">${broker.enabled ? "启用" : "停用"}</span>
      </div>
    </article>
  `).join("") || '<article class="list-card"><div class="list-card__title">暂无中介人</div></article>';
}

function renderUserAttempts() {
  const attempts = state.userAttempts || [];
  elements.userAttemptList.innerHTML = attempts.map((attempt) => `
    <article class="attempt-card">
      <div class="attempt-card__head">
        <div class="attempt-card__title">${attempt.paperTitle || "未命名试卷"}</div>
        <span class="tag ${attempt.passed ? "tag--success" : "tag--danger"}">${attempt.passed ? "合格" : "未合格"}</span>
      </div>
      <div class="attempt-card__meta">提交时间：${attempt.createdAt}</div>
      <div class="attempt-card__meta">分数：${attempt.score}% · 题数：${attempt.total} · 方式：${attempt.submitMode === "timeout" ? "超时自动交卷" : "手动交卷"}</div>
      <div class="attempt-card__meta">中介人：${attempt.broker?.name || (attempt.broker?.id ? `#${attempt.broker.id}` : "未关联")}</div>
    </article>
  `).join("") || '<div class="attempt-empty">暂无答题记录</div>';
}

function renderUserTable() {
  const { items, page, totalPages, total, pageSize } = state.usersPage;

  elements.userTableBody.innerHTML = items.map((user) => `
    <tr data-user-id="${user.id}">
      <td>
        <div class="data-table__user">
          <div class="data-table__name">${user.displayName || user.openid}</div>
          <div class="data-table__sub">${user.nickname ? "已授权昵称" : "未授权昵称"}</div>
        </div>
      </td>
      <td><div class="data-table__sub">${user.openid}</div></td>
      <td>${user.attemptCount || 0}</td>
      <td><div class="data-table__sub">${user.latestPaperTitle || "暂无"}</div></td>
      <td>
        <select class="table-select" data-action="change-user-status" data-id="${user.id}">
          <option value="pending" ${user.friendStatus === "pending" ? "selected" : ""}>未确认</option>
          <option value="added" ${user.friendStatus === "added" ? "selected" : ""}>已加好友</option>
        </select>
      </td>
      <td>
        <div class="table-actions">
          <button class="link-button" type="button" data-action="open-user" data-id="${user.id}">查看详情</button>
          <button class="link-button link-button--danger" type="button" data-action="delete-user" data-id="${user.id}">删除</button>
        </div>
      </td>
    </tr>
  `).join("") || '<tr><td class="data-table__empty" colspan="6">暂无用户</td></tr>';

  elements.userPaginationSummary.textContent = `共 ${total} 位用户，每页 ${pageSize} 位`;
  elements.userPageCurrent.textContent = `第 ${page} / ${totalPages} 页`;
  elements.userPrevPage.disabled = page <= 1;
  elements.userNextPage.disabled = page >= totalPages;
}

function renderOverview() {
  const overview = state.overview || { papers: [], brokers: [], userCount: 0 };
  elements.paperCount.textContent = overview.papers.length;
  elements.brokerCount.textContent = overview.brokers.length;
  elements.userCount.textContent = overview.userCount || 0;
  elements.configRequireFriendForAnswers.checked = Boolean(overview.config?.requireFriendForAnswers);
  renderPaperList();
  renderBrokerList();
  renderUserTable();
  syncBrokerForm();
  if (state.userModalOpen) {
    syncUserForm();
    renderUserAttempts();
  }
}

function patchUserInState(user) {
  if (!user?.id) {
    return;
  }

  state.usersPage.items = state.usersPage.items.map((item) => (item.id === user.id ? { ...item, ...user } : item));
  if (state.selectedUserId === user.id) {
    state.userForm = { ...state.userForm, ...user };
  }
}

function syncBrokerSelectionFromOverview() {
  const brokers = state.overview?.brokers || [];
  const selectedBroker = brokers.find((item) => item.id === state.selectedBrokerId) || brokers[0] || null;

  state.selectedBrokerId = selectedBroker?.id || 0;
  state.brokerForm = selectedBroker ? { ...selectedBroker } : createEmptyBrokerForm();
  renderBrokerList();
  syncBrokerForm();
}

async function syncPaperSelectionFromOverview() {
  const papers = state.overview?.papers || [];
  const selectedPaperId = String(state.selectedPaperId || "").trim();
  const nextPaperId = papers.some((item) => item.id === selectedPaperId)
    ? selectedPaperId
    : (papers[0]?.id || "");

  if (!nextPaperId) {
    state.selectedPaperId = "";
    setPaperEditor(createEmptyPaperTemplate(), "create");
    renderPaperList();
    return;
  }

  await loadPaperDetail(nextPaperId, state.activePaperBank);
}

async function loadOverview() {
  state.overview = await requestJson("/admin/api/overview");
  if (!state.currentAdmin) {
    state.currentAdmin = state.overview.admin || null;
  }

  if (!state.selectedPaperId && state.overview.papers[0]) {
    const detail = await requestJson(`/admin/api/papers/${encodeURIComponent(state.overview.papers[0].id)}`);
    setPaperEditor(detail.paper, "edit");
  }

  if (!state.selectedBrokerId && state.overview.brokers[0]) {
    state.selectedBrokerId = state.overview.brokers[0].id;
    state.brokerForm = { ...state.overview.brokers[0] };
  }

  renderOverview();
}

async function refreshSection(section = state.activeSection) {
  const targetSection = section || "papers";

  if (targetSection === "users") {
    await Promise.all([loadOverview(), loadUsersPage(state.usersPage.page || 1)]);
    if (state.userModalOpen && state.selectedUserId) {
      await loadUserDetail(state.selectedUserId);
      syncUserForm();
      renderUserAttempts();
    }
    return;
  }

  await loadOverview();

  if (targetSection === "papers") {
    await syncPaperSelectionFromOverview();
    return;
  }

  if (targetSection === "brokers") {
    syncBrokerSelectionFromOverview();
    return;
  }

  if (targetSection === "admin" && state.currentAdmin) {
    elements.adminIdentity.textContent = state.currentAdmin.username;
    elements.adminUsername.value = state.currentAdmin.username;
  }
}

async function loadUsersPage(page = state.usersPage.page) {
  const payload = await requestJson(`/admin/api/users?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(state.usersPage.pageSize)}`);
  state.usersPage = {
    items: payload.users || [],
    ...(payload.pagination || createEmptyUsersPage()),
  };
  renderUserTable();
}

async function loadPaperDetail(paperId, bankType = state.activePaperBank) {
  const payload = await requestJson(`/admin/api/papers/${encodeURIComponent(paperId)}`);
  setPaperEditor(payload.paper, "edit", bankType);
  renderPaperList();
}

function selectBrokerById(brokerId) {
  const broker = state.overview?.brokers?.find((item) => item.id === Number(brokerId));
  if (!broker) {
    return;
  }

  state.selectedBrokerId = broker.id;
  state.brokerForm = { ...broker };
  renderBrokerList();
  syncBrokerForm();
}

async function loadUserDetail(userId) {
  if (!userId) {
    state.userForm = createEmptyUserForm();
    state.userAttempts = [];
    return;
  }

  const payload = await requestJson(`/admin/api/users/${encodeURIComponent(userId)}/attempts`);
  state.selectedUserId = Number(userId);
  state.userForm = { ...payload.user };
  state.userAttempts = payload.attempts || [];
  patchUserInState(payload.user);
}

function openUserModal() {
  state.userModalOpen = true;
  elements.userModal.classList.add("modal--open");
  syncUserForm();
  renderUserAttempts();
}

function closeUserModal() {
  state.userModalOpen = false;
  elements.userModal.classList.remove("modal--open");
}

async function openUserDetail(userId) {
  await loadUserDetail(userId);
  openUserModal();
  renderUserTable();
}

function parsePaperJson() {
  try {
    const paper = JSON.parse(elements.paperJson.value);
    const overallTitle = elements.paperTitleInput.value.trim() || state.paperDrafts.base?.title || paper.title || "未命名题库";
    paper.title = overallTitle;

    if (state.activePaperBank === "update") {
      paper.bankType = "update";
      paper.basePaperId = state.selectedPaperId;
    } else {
      applyOverallPaperControlsToBasePaper(paper);
    }
    return paper;
  } catch {
    throw new Error("题库 JSON 格式不合法");
  }
}

function captureActivePaperDraft() {
  if (state.paperViewMode === "list" && getCurrentQuestions().length) {
    applyQuestionEdit();
  }

  const paper = parsePaperJson();
  if (state.activePaperBank === "base" && state.paperMode === "edit" && state.selectedPaperId) {
    paper.id = state.selectedPaperId;
  }
  if (state.activePaperBank === "update" && state.selectedPaperDetail?.updatePaper?.id) {
    paper.id = state.selectedPaperDetail.updatePaper.id;
  }

  state.paperDrafts[state.activePaperBank] = paper;
  syncOverallPaperControlsToDrafts();
  return state.paperDrafts[state.activePaperBank];
}

async function savePaper() {
  const activeBank = state.activePaperBank;
  captureActivePaperDraft();

  const basePaper = state.paperDrafts.base;
  if (!basePaper?.id || !Array.isArray(basePaper.questions) || !basePaper.questions.length) {
    throw new Error("基础题库内容不完整，无法保存");
  }

  basePaper.bankType = "base";
  basePaper.basePaperId = "";

  if (state.paperMode === "edit" && state.selectedPaperId) {
    basePaper.id = state.selectedPaperId;
    await requestJson(`/admin/api/papers/${encodeURIComponent(state.selectedPaperId)}`, {
      method: "PUT",
      body: JSON.stringify({ paper: basePaper }),
    });
  } else {
    const response = await requestJson("/admin/api/papers", {
      method: "POST",
      body: JSON.stringify({ paper: basePaper }),
    });
    state.selectedPaperId = response.paper?.id || basePaper.id;
  }

  const updatePaper = state.paperDrafts.update;
  let savedUpdatePaper = false;
  if (updatePaper?.id) {
    const updatePaperId = state.selectedPaperDetail?.updatePaper?.id || updatePaper.id;
    updatePaper.id = updatePaperId;
    updatePaper.title = basePaper.title;
    updatePaper.bankType = "update";
    updatePaper.basePaperId = state.selectedPaperId;
    await requestJson(`/admin/api/papers/${encodeURIComponent(updatePaperId)}`, {
      method: "PUT",
      body: JSON.stringify({ paper: updatePaper }),
    });
    savedUpdatePaper = true;
  }

  state.paperMode = "edit";
  await loadOverview();
  await loadPaperDetail(state.selectedPaperId, activeBank === "update" && savedUpdatePaper ? "update" : "base");
  showToast(savedUpdatePaper ? "基础题库和更新题库已保存" : "基础题库已保存");
}

async function deleteCurrentPaper() {
  if (!state.selectedPaperId || state.paperMode !== "edit") {
    showToast("请先选择要删除的基础题库");
    return;
  }

  if (state.activePaperBank === "update") {
    const updatePaper = parseCurrentPaperJson();
    const updatePaperId = state.selectedPaperDetail?.updatePaper?.id || updatePaper?.id;
    if (!updatePaperId) {
      showToast("当前基础题库还没有更新题库");
      return;
    }
    const confirmed = window.confirm("确定删除当前更新题库吗？");
    if (!confirmed) {
      return;
    }
    await requestJson(`/admin/api/papers/${encodeURIComponent(updatePaperId)}`, {
      method: "DELETE",
    });
    await loadOverview();
    await loadPaperDetail(state.selectedPaperId, "base");
    showToast("更新题库已删除");
    return;
  }

  const confirmed = window.confirm("删除基础题库会同时删除关联的更新题库。确定继续吗？");
  if (!confirmed) {
    return;
  }

  await requestJson(`/admin/api/papers/${encodeURIComponent(state.selectedPaperId)}`, {
    method: "DELETE",
  });
  state.selectedPaperId = "";
  setPaperEditor(createEmptyPaperTemplate(), "create");
  await loadOverview();
  showToast("基础题库已删除");
}

async function uploadPdf(file, options = {}) {
  const bankType = String(options.bankType || "base").trim().toLowerCase();
  if (bankType === "update" && (!state.selectedPaperId || state.paperMode !== "edit")) {
    showToast("请先选择基础题库");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);
  formData.append("bankType", bankType);

  const payload = await requestJson("/admin/api/upload-pdf", {
    method: "POST",
    body: formData,
  });

  state.pendingPdfPreview = {
    token: payload.token,
    summary: payload.summary || {},
    fileName: file.name,
    bankType,
    basePaperId: bankType === "update" ? state.selectedPaperId : "",
    replacePaperId: bankType === "base" && state.paperMode === "edit" ? state.selectedPaperId : "",
  };
  renderPdfPreviewModal();
  showToast(payload.message || "PDF 解析完成");
}

async function confirmPdfUpload() {
  const preview = state.pendingPdfPreview;
  if (!preview?.token) {
    showToast("没有待确认的 PDF");
    return;
  }

  const payload = await requestJson("/admin/api/upload-pdf/confirm", {
    method: "POST",
    body: JSON.stringify({
      token: preview.token,
      bankType: preview.bankType,
      basePaperId: preview.basePaperId,
      replacePaperId: preview.replacePaperId,
    }),
  });

  const nextPaperId = preview.bankType === "update" ? preview.basePaperId : payload.paper.id;
  const nextBankType = preview.bankType;
  await closePdfPreviewModal();
  await loadOverview();
  await loadPaperDetail(nextPaperId, nextBankType);
  showToast(payload.message || "PDF 上传成功");
}

async function saveBroker(event) {
  event.preventDefault();

  const payload = {
    name: elements.brokerName.value.trim(),
    qrImagePath: elements.brokerQrPath.value.trim(),
    miniProgramCodePath: elements.brokerMiniCodePath.value.trim(),
    enabled: elements.brokerEnabled.checked,
    isDefault: elements.brokerDefault.checked,
  };

  if (!payload.name) {
    showToast("请填写中介人名称");
    return;
  }

  const url = state.selectedBrokerId
    ? `/admin/api/brokers/${state.selectedBrokerId}`
    : "/admin/api/brokers";
  const method = state.selectedBrokerId ? "PUT" : "POST";

  const response = await requestJson(url, {
    method,
    body: JSON.stringify(payload),
  });

  state.selectedBrokerId = response.broker.id;
  state.brokerForm = { ...response.broker };
  await loadOverview();
  showToast("中介人已保存");
}

async function deleteCurrentBroker() {
  if (!state.selectedBrokerId) {
    showToast("请先选择要删除的中介人");
    return;
  }

  await requestJson(`/admin/api/brokers/${state.selectedBrokerId}`, {
    method: "DELETE",
  });
  state.selectedBrokerId = 0;
  state.brokerForm = createEmptyBrokerForm();
  await loadOverview();
  showToast("中介人已删除");
}

async function uploadBrokerImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await requestJson("/admin/api/upload-image", {
    method: "POST",
    body: formData,
  });

  state.brokerForm.qrImagePath = response.file.path;
  state.brokerForm.qrImageUrl = response.file.url;
  syncBrokerForm();
  showToast("二维码上传成功");
}

async function generateBrokerMiniCode() {
  if (!state.selectedBrokerId) {
    showToast("请先保存中介人资料");
    return;
  }

  const response = await requestJson(`/admin/api/brokers/${encodeURIComponent(state.selectedBrokerId)}/generate-minicode`, {
    method: "POST",
  });

  state.brokerForm = {
    ...state.brokerForm,
    ...response.broker,
  };
  await loadOverview();
  syncBrokerForm();
  showToast(response.message || "小程序碼已生成");
}

async function updateUserFriendStatus(userId, friendStatus, options = {}) {
  const { silent = false, refreshDetail = false } = options;
  if (!userId) {
    return;
  }

  const response = await requestJson(`/admin/api/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ friendStatus }),
  });

  patchUserInState(response.user);
  renderUserTable();

  if (refreshDetail && state.selectedUserId === response.user.id) {
    await loadUserDetail(response.user.id);
    syncUserForm();
    renderUserAttempts();
  } else if (state.selectedUserId === response.user.id) {
    syncUserForm();
  }

  if (!silent) {
    showToast("用户状态已更新");
  }
}

async function saveUser(event) {
  event.preventDefault();

  if (!state.selectedUserId) {
    showToast("请先选择用户");
    return;
  }

  await updateUserFriendStatus(state.selectedUserId, elements.userFriendStatus.value, {
    refreshDetail: true,
  });
}

async function deleteCurrentUser(userId) {
  if (!userId) {
    showToast("请先选择用户");
    return;
  }

  const confirmed = window.confirm("删除该用户后，其答题记录也会一并删除。确定继续吗？");
  if (!confirmed) {
    return;
  }

  await requestJson(`/admin/api/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  if (state.selectedUserId === Number(userId)) {
    state.selectedUserId = 0;
    state.userForm = createEmptyUserForm();
    state.userAttempts = [];
    closeUserModal();
  }

  await Promise.all([loadOverview(), loadUsersPage(state.usersPage.page)]);
  showToast("用户已删除");
}

async function saveAdmin(event) {
  event.preventDefault();

  const payload = {
    username: elements.adminUsername.value.trim(),
    password: elements.adminPassword.value,
  };

  if (!payload.username) {
    showToast("管理员账号不能为空");
    return;
  }

  const response = await requestJson("/admin/api/settings/admin", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  state.currentAdmin = response.admin;
  elements.adminIdentity.textContent = response.admin.username;
  elements.adminPassword.value = "";
  showToast("管理员信息已更新");
}

async function saveConfig(event) {
  event.preventDefault();

  const response = await requestJson("/admin/api/config", {
    method: "POST",
    body: JSON.stringify({
      requireFriendForAnswers: elements.configRequireFriendForAnswers.checked,
    }),
  });

  state.overview = {
    ...(state.overview || {}),
    config: response.config || {},
  };
  renderOverview();
  showToast("结果查看设置已更新");
}

elements.menuItems.forEach((button) => {
  button.addEventListener("click", async () => {
    setActiveSection(button.dataset.section);
    try {
      await refreshSection(button.dataset.section);
    } catch (error) {
      showToast(error.message);
    }
  });
});

elements.logoutButton.addEventListener("click", async () => {
  await requestJson("/admin/api/logout", { method: "POST" });
  window.location.replace("/admin/login");
});

elements.paperList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action='select-paper']");
  if (!target) {
    return;
  }

  loadPaperDetail(target.dataset.id, "base").catch((error) => showToast(error.message));
});

elements.paperNew.addEventListener("click", () => {
  state.selectedPaperDetail = null;
  state.activePaperBank = "base";
  setPaperEditor(createEmptyPaperTemplate(), "create");
  renderPaperList();
});

elements.paperTitleInput.addEventListener("input", () => {
  syncTitleInputToJson();
});

[elements.paperBankBase, elements.paperBankUpdate].forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled || state.paperMode !== "edit" || !state.selectedPaperDetail) {
      return;
    }
    const bankType = button.dataset.bankType;
    if (bankType === state.activePaperBank) {
      return;
    }
    if (!state.paperDrafts[bankType]) {
      showToast("当前基础题库还没有更新题库");
      return;
    }
    try {
      captureActivePaperDraft();
      loadPaperDraft(bankType);
    } catch (error) {
      showToast(error.message);
    }
  });
});

[elements.paperViewList, elements.paperViewJson].forEach((button) => {
  button.addEventListener("click", () => {
    setPaperViewMode(button.dataset.viewMode);
  });
});

elements.paperQuestionTableBody.addEventListener("click", (event) => {
  const row = event.target.closest("[data-action='select-question']");
  if (!row) {
    return;
  }
  state.selectedQuestionIndex = Number(row.dataset.index || 0);
  renderPaperQuestionWorkspace();
});

elements.paperQuestionPrevPage.addEventListener("click", () => {
  if (state.paperQuestionPage <= 1) {
    return;
  }
  state.paperQuestionPage -= 1;
  state.selectedQuestionIndex = (state.paperQuestionPage - 1) * state.paperQuestionPageSize;
  renderPaperQuestionWorkspace();
});

elements.paperQuestionNextPage.addEventListener("click", () => {
  state.paperQuestionPage += 1;
  state.selectedQuestionIndex = (state.paperQuestionPage - 1) * state.paperQuestionPageSize;
  renderPaperQuestionWorkspace();
});

elements.questionApply.addEventListener("click", () => {
  try {
    applyQuestionEdit();
    showToast("当前题目已更新，保存题库后生效");
  } catch (error) {
    showToast(error.message);
  }
});

elements.paperJson.addEventListener("input", () => {
  if (state.paperViewMode === "list") {
    renderPaperQuestionWorkspace();
  }
});

elements.paperSave.addEventListener("click", () => {
  savePaper().catch((error) => showToast(error.message));
});

elements.paperDelete.addEventListener("click", () => {
  deleteCurrentPaper().catch((error) => showToast(error.message));
});

elements.paperUpload.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  uploadPdf(file).catch((error) => showToast(error.message));
  event.target.value = "";
});

elements.paperUpdateUpload.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  uploadPdf(file, { bankType: "update" }).catch((error) => showToast(error.message));
  event.target.value = "";
});

elements.pdfPreviewConfirm.addEventListener("click", () => {
  confirmPdfUpload().catch((error) => showToast(error.message));
});

elements.pdfPreviewCancel.addEventListener("click", () => {
  closePdfPreviewModal({ cancel: true }).catch((error) => showToast(error.message));
});

elements.pdfPreviewModal.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-pdf-preview") {
    closePdfPreviewModal({ cancel: true }).catch((error) => showToast(error.message));
  }
});

elements.paperImportDemos.addEventListener("click", async () => {
  try {
    await requestJson("/admin/api/import-demos", { method: "POST" });
    state.selectedPaperId = "";
    setPaperEditor(createEmptyPaperTemplate(), "create");
    await loadOverview();
    showToast("示例 PDF 已重新导入");
  } catch (error) {
    showToast(error.message);
  }
});

elements.brokerList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action='select-broker']");
  if (!target) {
    return;
  }

  selectBrokerById(target.dataset.id);
});

elements.brokerNew.addEventListener("click", () => {
  state.selectedBrokerId = 0;
  state.brokerForm = createEmptyBrokerForm();
  renderBrokerList();
  syncBrokerForm();
});

elements.brokerForm.addEventListener("submit", (event) => {
  saveBroker(event).catch((error) => showToast(error.message));
});

elements.brokerDelete.addEventListener("click", () => {
  deleteCurrentBroker().catch((error) => showToast(error.message));
});

elements.brokerImage.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  uploadBrokerImage(file).catch((error) => showToast(error.message));
  event.target.value = "";
});

elements.brokerMiniCodeGenerate.addEventListener("click", () => {
  generateBrokerMiniCode().catch((error) => showToast(error.message));
});

elements.userTableBody.addEventListener("change", (event) => {
  const target = event.target.closest("[data-action='change-user-status']");
  if (!target) {
    return;
  }

  updateUserFriendStatus(Number(target.dataset.id), target.value, {
    silent: false,
    refreshDetail: state.selectedUserId === Number(target.dataset.id),
  }).catch((error) => showToast(error.message));
});

elements.userTableBody.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action='open-user']");
  const deleteTarget = event.target.closest("[data-action='delete-user']");
  if (deleteTarget) {
    deleteCurrentUser(Number(deleteTarget.dataset.id)).catch((error) => showToast(error.message));
    return;
  }
  const rowTarget = event.target.closest("tr[data-user-id]");
  const userId = Number(actionTarget?.dataset.id || rowTarget?.dataset.userId || 0);
  const interactiveTarget = event.target.closest("select, button");

  if (!userId || (interactiveTarget && !actionTarget)) {
    return;
  }

  openUserDetail(userId).catch((error) => showToast(error.message));
});

elements.userPrevPage.addEventListener("click", () => {
  if (state.usersPage.page <= 1) {
    return;
  }

  loadUsersPage(state.usersPage.page - 1).catch((error) => showToast(error.message));
});

elements.userNextPage.addEventListener("click", () => {
  if (state.usersPage.page >= state.usersPage.totalPages) {
    return;
  }

  loadUsersPage(state.usersPage.page + 1).catch((error) => showToast(error.message));
});

elements.userForm.addEventListener("submit", (event) => {
  saveUser(event).catch((error) => showToast(error.message));
});

elements.userModalClose.addEventListener("click", () => {
  closeUserModal();
});

elements.userModal.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-user-modal") {
    closeUserModal();
  }
});

elements.adminForm.addEventListener("submit", (event) => {
  saveAdmin(event).catch((error) => showToast(error.message));
});

elements.configForm.addEventListener("submit", (event) => {
  saveConfig(event).catch((error) => showToast(error.message));
});

Promise.all([loadSession(), loadOverview(), loadUsersPage(1)])
  .then(() => {
    setActiveSection("papers");
    setPaperViewMode("list");
    if (!state.selectedPaperId) {
      setPaperEditor(createEmptyPaperTemplate(), "create");
    }
    syncBrokerForm();
  })
  .catch((error) => {
    showToast(error.message);
  });
