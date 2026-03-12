function createEmptyPaperTemplate() {
  return {
    id: `paper-${Date.now()}`,
    title: "新题库",
    sourceFile: "manual.json",
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
    enabled: true,
    isDefault: false,
  };
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
};

const elements = {
  menuItems: Array.from(document.querySelectorAll(".menu__item")),
  sectionTitle: document.getElementById("section-title"),
  sections: {
    papers: document.getElementById("section-papers"),
    brokers: document.getElementById("section-brokers"),
    admin: document.getElementById("section-admin"),
  },
  adminIdentity: document.getElementById("admin-identity"),
  logoutButton: document.getElementById("logout-button"),
  paperCount: document.getElementById("paper-count"),
  brokerCount: document.getElementById("broker-count"),
  paperList: document.getElementById("paper-list"),
  paperEditorMode: document.getElementById("paper-editor-mode"),
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
  brokerNew: document.getElementById("broker-new"),
  brokerDelete: document.getElementById("broker-delete"),
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
    brokers: "经纪人管理",
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

  if (state.brokerForm.qrImageUrl) {
    elements.brokerPreview.className = "image-preview";
    elements.brokerPreview.innerHTML = `<img src="${state.brokerForm.qrImageUrl}" alt="二维码" />`;
  } else {
    elements.brokerPreview.className = "image-preview image-preview--empty";
    elements.brokerPreview.textContent = "暂未上传二维码";
  }
}

function setPaperEditor(paper, mode = "edit") {
  state.paperMode = mode;
  state.selectedPaperId = mode === "edit" ? paper.id : "";
  state.paperJson = JSON.stringify(paper, null, 2);
  elements.paperJson.value = state.paperJson;
  elements.paperEditorMode.textContent = mode === "edit" ? `编辑题库: ${paper.title}` : "新增题库";
}

function renderPaperList() {
  const papers = state.overview?.papers || [];
  elements.paperList.innerHTML = papers.map((paper) => `
    <article class="list-card ${state.selectedPaperId === paper.id ? "list-card--active" : ""}" data-action="select-paper" data-id="${paper.id}">
      <div class="list-card__title">${paper.title}</div>
      <div class="list-card__meta">${paper.questionCount} 题</div>
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
      <div class="tag-row">
        ${broker.isDefault ? '<span class="tag tag--primary">默认</span>' : ""}
        <span class="tag ${broker.enabled ? "tag--success" : "tag--danger"}">${broker.enabled ? "启用" : "停用"}</span>
      </div>
    </article>
  `).join("") || '<article class="list-card"><div class="list-card__title">暂无经纪人</div></article>';
}

function renderOverview() {
  const overview = state.overview || { papers: [], brokers: [] };
  elements.paperCount.textContent = overview.papers.length;
  elements.brokerCount.textContent = overview.brokers.length;
  renderPaperList();
  renderBrokerList();
  syncBrokerForm();
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

function parsePaperJson() {
  try {
    return JSON.parse(elements.paperJson.value);
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
    enabled: elements.brokerEnabled.checked,
    isDefault: elements.brokerDefault.checked,
  };

  if (!payload.brokerId) {
    showToast("请填写经纪人 ID");
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
  showToast("经纪人已保存");
}

async function deleteCurrentBroker() {
  if (!state.selectedBrokerId) {
    showToast("请先选择要删除的经纪人");
    return;
  }

  await requestJson(`/admin/api/brokers/${state.selectedBrokerId}`, {
    method: "DELETE",
  });
  state.selectedBrokerId = 0;
  state.brokerForm = createEmptyBrokerForm();
  await loadOverview();
  showToast("经纪人已删除");
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

elements.adminForm.addEventListener("submit", (event) => {
  saveAdmin(event).catch((error) => showToast(error.message));
});

Promise.all([loadSession(), loadOverview()])
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
