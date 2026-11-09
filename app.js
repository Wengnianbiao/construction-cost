import { calculateEstimate, readProjects, saveProject } from "./estimates.js";

const form = document.querySelector("#estimate-form");
const fields = form.elements;
const areaFields = document.querySelector("#area-fields");
const itemFields = document.querySelector("#item-fields");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const lineItems = document.querySelector("#line-items");
const lineTemplate = document.querySelector("#line-template");
const addLineButton = document.querySelector("#add-line");
const formError = document.querySelector("#form-error");
const breakdown = document.querySelector("#breakdown");
const resultPanel = document.querySelector(".result-panel");
const totalAmount = document.querySelector("#total-amount");
const saveButton = document.querySelector("#save");
const saveStatus = document.querySelector("#save-status");
const exampleButton = document.querySelector("#example");
const resetButton = document.querySelector("#reset");
const projectList = document.querySelector("#project-list");
const historyStatus = document.querySelector("#history-status");
const dateFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" });
const modeLabels = { area: "面积速算", items: "工程量清单" };
const maxLines = 100;

let mode = "area";
let projectId = null;
let result = null;
let dirty = false;

const examples = {
  area: {
    mode: "area",
    name: "办公楼改造工程（示例）",
    area: "1200",
    unit_price: "2800",
    reserve_rate: "5",
  },
  items: {
    mode: "items",
    name: "室内装修工程（示例）",
    reserve_rate: "5",
    items: [
      { name: "地砖铺贴", unit: "㎡", quantity: "180", unit_price: "145" },
      { name: "墙面涂饰", unit: "㎡", quantity: "420", unit_price: "48" },
      { name: "电气安装", unit: "项", quantity: "1", unit_price: "12500" },
    ],
  },
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function money(decimal) {
  const [whole, fraction] = decimal.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `¥${grouped}.${(fraction ?? "").padEnd(2, "0")}`;
}

function setError(message = "") {
  formError.textContent = message;
  formError.hidden = !message;
}

function updateActions() {
  saveButton.disabled = !result || !dirty;
  saveButton.textContent = projectId === null ? "保存项目" : "更新项目";
}

function renderResult(value) {
  result = value;
  totalAmount.textContent = value ? money(value.total_amount) : "—";
  document.querySelector("#subtotal").textContent = value ? money(value.subtotal) : "—";
  document.querySelector("#reserve-amount").textContent = value ? money(value.reserve_amount) : "—";
  document.querySelector("#result-name").textContent = value
    ? value.estimate.name
    : "填写参数后开始估算";
  breakdown.replaceChildren();
  breakdown.hidden = !value;
  for (const line of value?.lines ?? []) {
    const row = document.createElement("li");
    const details = element("span", "", "line-details");
    details.append(
      element("span", line.name),
      element("small", `${line.quantity} ${line.unit} × ${money(line.unit_price)}`),
    );
    row.append(details, element("span", money(line.amount), "amount"));
    breakdown.append(row);
  }
  updateActions();
}

function markEdited() {
  dirty = true;
  setError();
  saveStatus.textContent = "";
  if (result) renderResult(null);
}

function setMode(value) {
  mode = value;
  areaFields.hidden = areaFields.disabled = mode !== "area";
  itemFields.hidden = itemFields.disabled = mode !== "items";
  for (const button of modeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }
}

function syncLineButtons() {
  const count = lineItems.children.length;
  addLineButton.disabled = count >= maxLines;
  for (const button of lineItems.querySelectorAll(".remove-line")) button.disabled = count === 1;
}

function addLine(data) {
  const row = lineTemplate.content.firstElementChild.cloneNode(true);
  if (data) {
    row.querySelector("[name=line_name]").value = data.name;
    row.querySelector("[name=line_unit]").value = data.unit;
    row.querySelector("[name=line_quantity]").value = data.quantity;
    row.querySelector("[name=line_price]").value = data.unit_price;
  }
  lineItems.append(row);
  return row;
}

function fillForm(data = { mode: "area" }) {
  setMode(data.mode);
  fields.name.value = data.name ?? "";
  fields.reserve_rate.value = data.reserve_rate ?? "0";
  fields.area.value = data.area ?? "";
  fields.unit_price.value = data.unit_price ?? "";
  lineItems.replaceChildren();
  for (const line of data.items ?? [undefined]) addLine(line);
  syncLineButtons();
  setError();
  saveStatus.textContent = "";
}

function readForm() {
  const data = {
    name: fields.name.value.trim(),
    mode,
    reserve_rate: fields.reserve_rate.value || "0",
  };
  if (mode === "area") {
    data.area = fields.area.value;
    data.unit_price = fields.unit_price.value;
  } else {
    data.items = [...lineItems.children].map(row => ({
      name: row.querySelector("[name=line_name]").value.trim(),
      unit: row.querySelector("[name=line_unit]").value.trim(),
      quantity: row.querySelector("[name=line_quantity]").value,
      unit_price: row.querySelector("[name=line_price]").value,
    }));
  }
  return data;
}

function calculate() {
  setError();
  saveStatus.textContent = "";
  try {
    renderResult(calculateEstimate(readForm()));
    if (totalAmount.getBoundingClientRect().bottom > window.innerHeight) {
      resultPanel.scrollIntoView({ block: "start" });
    }
  } catch (error) {
    setError(error.message);
  }
}

function loadProjects() {
  try {
    const projects = readProjects();
    projectList.replaceChildren();
    for (const project of projects) {
      const row = document.createElement("li");
      const info = element("div", "", "project-info");
      const updated = dateFormat.format(new Date(project.updated_at));
      info.append(
        element("strong", project.estimate.name),
        element("small", `${modeLabels[project.estimate.mode]} · ${updated}`),
      );
      const open = element("button", "打开", "button secondary");
      open.type = "button";
      open.dataset.id = project.id;
      open.setAttribute("aria-label", `打开项目：${project.estimate.name}`);
      row.append(info, element("span", money(project.total_amount), "amount"), open);
      projectList.append(row);
    }
    projectList.hidden = projects.length === 0;
    historyStatus.textContent = projects.length ? "" : "保存估算后，项目会显示在这里。";
    updateActions();
  } catch (error) {
    historyStatus.textContent = error.message;
  }
}

form.addEventListener("input", markEdited);
form.addEventListener("submit", event => {
  event.preventDefault();
  calculate();
});

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (mode === button.dataset.mode) return;
    setMode(button.dataset.mode);
    if (dirty || projectId !== null) markEdited();
  });
}

addLineButton.addEventListener("click", () => {
  const row = addLine();
  syncLineButtons();
  markEdited();
  row.querySelector("input").focus();
});

lineItems.addEventListener("click", event => {
  const button = event.target.closest(".remove-line");
  if (!button) return;
  const row = button.closest(".line-item");
  const nextRow = row.nextElementSibling ?? row.previousElementSibling;
  row.remove();
  syncLineButtons();
  markEdited();
  nextRow.querySelector("input").focus();
});

function discardEdits() {
  return !dirty || window.confirm("放弃当前未保存的估算？");
}

resetButton.addEventListener("click", () => {
  if (!discardEdits()) return;
  projectId = null;
  dirty = false;
  fillForm();
  renderResult(null);
  fields.name.focus();
});

exampleButton.addEventListener("click", () => {
  if (!discardEdits()) return;
  projectId = null;
  fillForm(examples[mode]);
  markEdited();
  calculate();
});

saveButton.addEventListener("click", () => {
  try {
    const saved = saveProject(result, projectId);
    projectId = saved.id;
    dirty = false;
    renderResult(saved);
    saveStatus.textContent = "已保存到当前浏览器。";
    loadProjects();
  } catch (error) {
    saveStatus.textContent = error.message;
  }
});

projectList.addEventListener("click", event => {
  const button = event.target.closest("button[data-id]");
  if (!button || !discardEdits()) return;
  try {
    const saved = readProjects().find(project => project.id === button.dataset.id);
    if (!saved) {
      loadProjects();
      historyStatus.textContent = "未找到该项目。";
      return;
    }
    projectId = saved.id;
    dirty = false;
    fillForm(saved.estimate);
    renderResult(saved);
    historyStatus.textContent = "";
    document.querySelector("#input-title").scrollIntoView({ block: "center" });
    fields.name.focus({ preventScroll: true });
  } catch (error) {
    historyStatus.textContent = error.message;
  }
});

fillForm();
loadProjects();
