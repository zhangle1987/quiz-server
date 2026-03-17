function createEmptyPaperTemplate() {
  return {
    id: `paper-${Date.now()}`,
    title: "新题库",
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
    brokerId: "",
    name: "",
    linkedOpenId: "",
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
  return payload;
}

const state = {
  activeSection: "papers",
  overview: null,
  currentAdmin: null,
  selectedPaperId: "",
  paperMode: "create",
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
  paperSortOrder: document.getElementById("paper-sort-order"),
  paperDurationMinutes: document.getElementById("paper-duration-minutes"),
  paperQuestionCount: document.getElementById("paper-question-count"),
  paperPassThreshold: document.getElementById("paper-pass-threshold"),
  paperJson: document.getElementById("paper-json"),
  paperNew: document.getElementById("paper-new"),
  paperSave: document.getElementById("paper-save"),
  paperDelete: document.getElementById("paper-delete"),
  paperUpload: document.getElementById("paper-upload"),
  paperImportDemos: document.getElementById("paper-import-demos"),
  brokerList: document.getElementById("broker-list"),
  brokerForm: document.getElementById("broker-form"),
  brokerId: document.getElementById("broker-id"),
  brokerName: document.getElementById("broker-name"),
  brokerOpenId: document.getElementById("broker-openid"),
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
  elements.brokerId.value = state.brokerForm.brokerId;
  elements.brokerName.value = state.brokerForm.name;
  elements.brokerOpenId.value = state.brokerForm.linkedOpenId;
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

  elements.brokerMiniCodeGenerate.disabled = !state.selectedBrokerId || !String(state.brokerForm.linkedOpenId || "").trim();
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

function setPaperEditor(paper, mode = "edit") {
  state.paperMode = mode;
  state.selectedPaperId = mode === "edit" ? paper.id : "";
  state.paperJson = JSON.stringify(createPaperEditorPayload(paper), null, 2);
  elements.paperSortOrder.value = String(paper.sortOrder ?? 0);
  elements.paperDurationMinutes.value = String(paper.quizConfig?.durationMinutes || "");
  elements.paperQuestionCount.value = String(paper.quizConfig?.questionCount || paper.questionCount || "");
  elements.paperPassThreshold.value = String(paper.quizConfig?.passThreshold || "");
  elements.paperJson.value = state.paperJson;
  elements.paperEditorMode.textContent = mode === "edit" ? `编辑题库: ${paper.title}` : "新增题库";
}

function renderPaperList() {
  const papers = state.overview?.papers || [];
  elements.paperList.innerHTML = papers.map((paper) => `
    <article class="list-card ${state.selectedPaperId === paper.id ? "list-card--active" : ""}" data-action="select-paper" data-id="${paper.id}">
      <div class="list-card__title">${paper.title}</div>
      <div class="list-card__meta">排序值：${paper.sortOrder ?? 0}</div>
      <div class="list-card__meta">题库共 ${paper.questionCount} 题，考试抽取 ${paper.quizConfig?.questionCount || paper.questionCount} 题</div>
      <div class="list-card__meta">限时 ${paper.quizConfig?.durationMinutes || 0} 分钟，合格线 ${paper.quizConfig?.passThreshold || 70}%</div>
      <div class="list-card__meta">来源：${paper.sourceFile || "手动编辑"}</div>
    </article>
  `).join("") || '<article class="list-card"><div class="list-card__title">暂无题库</div></article>';
}

function renderBrokerList() {
  const brokers = state.overview?.brokers || [];
  elements.brokerList.innerHTML = brokers.map((broker) => `
    <article class="list-card ${state.selectedBrokerId === broker.id ? "list-card--active" : ""}" data-action="select-broker" data-id="${broker.id}">
      <div class="list-card__title">${broker.name || broker.brokerId}</div>
      <div class="list-card__meta">ID: ${broker.brokerId}</div>
      <div class="list-card__meta">OpenID: ${broker.linkedOpenId || "未绑定"}</div>
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
      <div class="attempt-card__meta">中介人：${attempt.broker?.name || attempt.broker?.brokerId || "未关联"}</div>
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

async function loadUsersPage(page = state.usersPage.page) {
  const payload = await requestJson(`/admin/api/users?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(state.usersPage.pageSize)}`);
  state.usersPage = {
    items: payload.users || [],
    ...(payload.pagination || createEmptyUsersPage()),
  };
  renderUserTable();
}

async function loadPaperDetail(paperId) {
  const payload = await requestJson(`/admin/api/papers/${encodeURIComponent(paperId)}`);
  setPaperEditor(payload.paper, "edit");
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
    const sortOrder = Number(elements.paperSortOrder.value);
    const durationMinutes = Number(elements.paperDurationMinutes.value);
    const questionCount = Number(elements.paperQuestionCount.value);
    const passThreshold = Number(elements.paperPassThreshold.value);

    paper.sortOrder = Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0;
    paper.quizConfig = {
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : 60,
      questionCount: Number.isFinite(questionCount) && questionCount > 0 ? Math.round(questionCount) : 1,
      passThreshold: Number.isFinite(passThreshold)
        ? Math.max(0, Math.min(100, Math.round(passThreshold)))
        : 70,
    };
    return paper;
  } catch {
    throw new Error("题库 JSON 格式不合法");
  }
}

async function savePaper() {
  const paper = parsePaperJson();

  if (state.paperMode === "edit" && state.selectedPaperId && paper.id !== state.selectedPaperId) {
    await requestJson("/admin/api/papers", {
      method: "POST",
      body: JSON.stringify({ paper }),
    });
    await requestJson(`/admin/api/papers/${encodeURIComponent(state.selectedPaperId)}`, {
      method: "DELETE",
    });
    state.selectedPaperId = paper.id;
  } else if (state.paperMode === "edit" && state.selectedPaperId) {
    await requestJson(`/admin/api/papers/${encodeURIComponent(state.selectedPaperId)}`, {
      method: "PUT",
      body: JSON.stringify({ paper }),
    });
    state.selectedPaperId = paper.id;
  } else {
    await requestJson("/admin/api/papers", {
      method: "POST",
      body: JSON.stringify({ paper }),
    });
    state.selectedPaperId = paper.id;
  }

  state.paperMode = "edit";
  await loadOverview();
  await loadPaperDetail(state.selectedPaperId);
  showToast("题库已保存");
}

async function deleteCurrentPaper() {
  if (!state.selectedPaperId || state.paperMode !== "edit") {
    showToast("请先选择要删除的题库");
    return;
  }

  await requestJson(`/admin/api/papers/${encodeURIComponent(state.selectedPaperId)}`, {
    method: "DELETE",
  });
  state.selectedPaperId = "";
  setPaperEditor(createEmptyPaperTemplate(), "create");
  await loadOverview();
  showToast("题库已删除");
}

async function uploadPdf(file) {
  const formData = new FormData();
  formData.append("pdf", file);
  if (state.paperMode === "edit" && state.selectedPaperId) {
    formData.append("replacePaperId", state.selectedPaperId);
  }

  const payload = await requestJson("/admin/api/upload-pdf", {
    method: "POST",
    body: formData,
  });

  await loadOverview();
  await loadPaperDetail(payload.paper.id);
  showToast(payload.message || "PDF 上传成功");
}

async function saveBroker(event) {
  event.preventDefault();

  const payload = {
    brokerId: elements.brokerId.value.trim(),
    name: elements.brokerName.value.trim(),
    linkedOpenId: elements.brokerOpenId.value.trim(),
    qrImagePath: elements.brokerQrPath.value.trim(),
    miniProgramCodePath: elements.brokerMiniCodePath.value.trim(),
    enabled: elements.brokerEnabled.checked,
    isDefault: elements.brokerDefault.checked,
  };

  if (!payload.brokerId) {
    showToast("请填写中介人 ID");
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

  if (!String(state.brokerForm.linkedOpenId || "").trim()) {
    showToast("请先填写并保存绑定 OpenID");
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

elements.menuItems.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.section);
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

  loadPaperDetail(target.dataset.id).catch((error) => showToast(error.message));
});

elements.paperNew.addEventListener("click", () => {
  setPaperEditor(createEmptyPaperTemplate(), "create");
  renderPaperList();
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

Promise.all([loadSession(), loadOverview(), loadUsersPage(1)])
  .then(() => {
    setActiveSection("papers");
    if (!state.selectedPaperId) {
      setPaperEditor(createEmptyPaperTemplate(), "create");
    }
    syncBrokerForm();
  })
  .catch((error) => {
    showToast(error.message);
  });
