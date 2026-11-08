"use strict";

/* ==========================================================================
   KanbanFlow
   Vanilla JavaScript, local-first Kanban board.
   ========================================================================== */

const STORAGE_KEY = "kanbanflow_tasks_v1";
const THEME_KEY = "kanbanflow_theme";
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;
const MAX_TAGS = 4;
const TOAST_DURATION = 4200;

const COLUMNS = [
  { id: "todo", title: "To do", dotClass: "", limit: null },
  { id: "in-progress", title: "In progress", dotClass: "dot-progress", limit: 4 },
  { id: "review", title: "Review", dotClass: "dot-review", limit: 3 },
  { id: "done", title: "Done", dotClass: "dot-done", limit: null }
];

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High"
};

const ICONS = {
  more: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="10" r="1.35"/><circle cx="10" cy="10" r="1.35"/><circle cx="15.5" cy="10" r="1.35"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M10 4.25v11.5M4.25 10h11.5"/></svg>',
  lock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="7.5" rx="1.8"/><path d="M7.25 8.5V6.25a2.75 2.75 0 0 1 5.5 0V8.5"/></svg>',
  calendar: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.75" width="13" height="11.75" rx="2"/><path d="M3.5 8.25h13M7 3.25v3M13 3.25v3"/></svg>',
  warning: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.25 17 16.25H3L10 3.25Z"/><path d="M10 7.5v3.75M10 13.65v.1"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 10.25 3.4 3.4 7.6-8"/></svg>',
  alert: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7.25"/><path d="M10 6.25v4.5M10 13.8v.1"/></svg>',
  close: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 9.5h8M8 13h5"/></svg>'
};

const board = document.getElementById("board");
const boardScroller = document.getElementById("board-scroller");
const boardRegion = document.getElementById("board-region");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarScrim = document.getElementById("sidebar-scrim");
const menuButton = document.getElementById("menu-button");
const mainElement = document.getElementById("main-content");
const boardLink = document.querySelector("[data-board-link]");
const themeToggle = document.getElementById("theme-toggle");
const searchInput = document.getElementById("search-input");
const priorityFilter = document.getElementById("priority-filter");
const clearFiltersButton = document.getElementById("clear-filters");
const newTaskButton = document.getElementById("new-task");
const sidebarTaskCount = document.getElementById("sidebar-task-count");
const viewSummary = document.getElementById("view-summary");
const statTotal = document.getElementById("stat-total");
const statCompleted = document.getElementById("stat-completed");
const statDueToday = document.getElementById("stat-due-today");
const statOverdue = document.getElementById("stat-overdue");
const cardMenu = document.getElementById("card-menu");
const taskDialog = document.getElementById("task-dialog");
const taskDialogTitle = document.getElementById("task-dialog-title");
const taskDialogDescription = document.getElementById("task-dialog-description");
const taskForm = document.getElementById("task-form");
const taskIdInput = document.getElementById("task-id");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const columnInput = document.getElementById("task-column");
const tagsInput = document.getElementById("task-tags");
const titleCount = document.getElementById("title-count");
const descriptionCount = document.getElementById("description-count");
const tagCount = document.getElementById("tag-count");
const titleError = document.getElementById("title-error");
const descriptionError = document.getElementById("description-error");
const dueDateError = document.getElementById("due-date-error");
const columnError = document.getElementById("column-error");
const tagsError = document.getElementById("tags-error");
const modalCloseButton = document.getElementById("modal-close");
const modalCancelButton = document.getElementById("modal-cancel");
const modalSubmitButton = document.getElementById("modal-submit");
const confirmDialog = document.getElementById("confirm-dialog");
const confirmMessage = document.getElementById("confirm-message");
const confirmCancelButton = document.getElementById("confirm-cancel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const toastStack = document.getElementById("toast-stack");
const liveRegion = document.getElementById("live-region");

const mobileQuery = window.matchMedia("(max-width: 980px)");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let tasks = [];
let searchQuery = "";
let activePriority = "all";
let initialPersistNeeded = false;
let loadFailed = false;
let storageFailed = false;
let storageWarningShown = false;

let menuState = { taskId: null, trigger: null };
let dialogState = { mode: null, taskId: null, lastFocused: null };
let suppressDialogFocusRestore = false;
let pendingDeleteId = null;
let confirmLastFocused = null;
let suppressConfirmFocusRestore = false;

let draggedTaskId = null;
let dropTarget = null;
let blockedNoticeShown = false;
let pointerStartedOnControl = false;

const dropIndicator = document.createElement("div");
dropIndicator.className = "drop-indicator";

/* ==========================================================================
   Storage
   ========================================================================== */

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    storageFailed = true;
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    storageFailed = true;
    return false;
  }
}

function persistTasks() {
  const saved = writeStorage(STORAGE_KEY, JSON.stringify(tasks));
  if (!saved) {
    showStorageWarning();
  }
}

function showStorageWarning() {
  if (storageWarningShown) return;
  storageWarningShown = true;
  showToast("Browser storage is unavailable, so changes will not survive a reload.", "error", 7000);
}

function loadTasks() {
  const raw = readStorage(STORAGE_KEY);

  if (raw === null) {
    initialPersistNeeded = true;
    return createSampleTasks();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid board data");
    }
    const normalized = normalizeTasks(parsed);
    COLUMNS.forEach((column) => {
      tasksForColumnFrom(normalized, column.id).forEach((task, index) => {
        task.order = index;
      });
    });
    return normalized;
  } catch (error) {
    initialPersistNeeded = true;
    loadFailed = true;
    return createSampleTasks();
  }
}

function normalizeTasks(input) {
  const validColumns = new Set(COLUMNS.map((column) => column.id));
  const seenIds = new Set();
  const normalized = [];

  input.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const title = typeof item.title === "string" ? item.title.trim().slice(0, MAX_TITLE) : "";
    if (!title) return;

    let id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : createId();
    if (seenIds.has(id)) id = createId();
    seenIds.add(id);

    const description = typeof item.description === "string"
      ? item.description.trim().slice(0, MAX_DESCRIPTION)
      : "";
    const priority = ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium";
    const dueDate = typeof item.dueDate === "string" && isValidISODate(item.dueDate) ? item.dueDate : "";
    const columnId = validColumns.has(item.columnId) ? item.columnId : "todo";
    const tags = normalizeTags(Array.isArray(item.tags) ? item.tags : []);
    const order = Number.isFinite(Number(item.order)) ? Number(item.order) : index;
    const createdAt = Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now() - index;

    normalized.push({
      id,
      title,
      description,
      priority,
      dueDate,
      tags,
      columnId,
      order,
      createdAt
    });
  });

  return normalized;
}

function normalizeTags(tags) {
  const seen = new Set();
  const result = [];

  tags.forEach((tag) => {
    if (typeof tag !== "string") return;
    const cleanTag = tag.trim().replace(/\s+/g, " ");
    const key = cleanTag.toLowerCase();
    if (!cleanTag || seen.has(key)) return;
    seen.add(key);
    result.push(cleanTag);
  });

  return result.slice(0, MAX_TAGS);
}

/* ==========================================================================
   Sample board
   ========================================================================== */

function createSampleTasks() {
  const firstColumnOrders = { todo: 0, "in-progress": 0, review: 0, done: 0 };
  const createdBase = Date.now() - 7 * 86400000;

  const samples = [
    {
      title: "Finalize launch checklist",
      description: "Close the remaining items from the go/no-go review and share the launch-day runbook.",
      priority: "high",
      dueDate: addDaysISO(3),
      tags: ["launch", "ops"],
      columnId: "todo"
    },
    {
      title: "Draft the release announcement",
      description: "Write the customer email and a short changelog entry for the v1 launch.",
      priority: "medium",
      dueDate: "",
      tags: ["content", "email"],
      columnId: "todo"
    },
    {
      title: "Prepare support handoff",
      description: "Add launch FAQs and escalation notes to the support workspace.",
      priority: "low",
      dueDate: todayISO(),
      tags: ["support"],
      columnId: "todo"
    },
    {
      title: "Polish onboarding empty states",
      description: "Tighten the copy and spacing on first-run screens across web and mobile.",
      priority: "high",
      dueDate: addDaysISO(-2),
      tags: ["design", "product"],
      columnId: "in-progress"
    },
    {
      title: "Set up launch analytics",
      description: "Track signup, activation, and the first key action in the launch dashboard.",
      priority: "medium",
      dueDate: addDaysISO(1),
      tags: ["data"],
      columnId: "in-progress"
    },
    {
      title: "Refresh homepage copy",
      description: "Review the updated hero and pricing section with the launch team before publishing.",
      priority: "medium",
      dueDate: addDaysISO(2),
      tags: ["content", "review"],
      columnId: "review"
    },
    {
      title: "Run the go/no-go review",
      description: "Align on scope, owners, and the cut line for launch week.",
      priority: "low",
      dueDate: addDaysISO(-4),
      tags: ["planning"],
      columnId: "done"
    }
  ];

  return samples.map((sample, index) => {
    const order = firstColumnOrders[sample.columnId];
    firstColumnOrders[sample.columnId] += 1;

    return {
      id: createId(),
      title: sample.title,
      description: sample.description,
      priority: sample.priority,
      dueDate: sample.dueDate,
      tags: sample.tags,
      columnId: sample.columnId,
      order,
      createdAt: createdBase + index * 3600000
    };
  });
}

/* ==========================================================================
   Data helpers
   ========================================================================== */

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getColumn(columnId) {
  return COLUMNS.find((column) => column.id === columnId) || null;
}

function compareTasks(a, b) {
  return a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function tasksForColumnFrom(collection, columnId) {
  return collection
    .filter((task) => task.columnId === columnId)
    .sort(compareTasks);
}

function tasksForColumn(columnId) {
  return tasksForColumnFrom(tasks, columnId);
}

function findTask(taskId) {
  return tasks.find((task) => task.id === taskId) || null;
}

function reindexColumn(columnId) {
  tasksForColumn(columnId).forEach((task, index) => {
    task.order = index;
  });
}

function isColumnFull(columnId, excludingTaskId = null) {
  const column = getColumn(columnId);
  if (!column || column.limit === null) return false;

  const count = tasks.filter((task) => {
    return task.columnId === columnId && task.id !== excludingTaskId;
  }).length;

  return count >= column.limit;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function todayISO() {
  return toISODate(new Date());
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const includeYear = year !== new Date().getFullYear();

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(date);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function hasActiveFilters() {
  return searchQuery.trim() !== "" || activePriority !== "all";
}

function taskMatchesFilters(task) {
  if (activePriority !== "all" && task.priority !== activePriority) {
    return false;
  }

  const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = [
    task.title,
    task.description,
    ...task.tags
  ].join(" ").toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function parseTags(value) {
  const seen = new Set();
  const tags = [];

  value.split(",").forEach((part) => {
    const tag = part.trim().replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });

  return tags;
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function render() {
  const scrollLeft = boardScroller.scrollLeft;
  closeCardMenu(false);
  board.replaceChildren();

  const filtersActive = hasActiveFilters();
  let visibleTotal = 0;

  COLUMNS.forEach((column) => {
    const allTasks = tasksForColumn(column.id);
    const visibleTasks = allTasks.filter(taskMatchesFilters);
    visibleTotal += visibleTasks.length;
    board.appendChild(createColumnElement(column, allTasks, visibleTasks, filtersActive));
  });

  updateHeader(visibleTotal);
  boardScroller.scrollLeft = scrollLeft;
}

function createColumnElement(column, allTasks, visibleTasks, filtersActive) {
  const section = document.createElement("section");
  section.className = `column column-${column.id}`;
  section.dataset.columnId = column.id;
  section.setAttribute("aria-labelledby", `column-title-${column.id}`);

  const isFull = column.limit !== null && allTasks.length >= column.limit;
  if (isFull) section.classList.add("is-full");

  const head = document.createElement("div");
  head.className = "column-head";

  const dot = document.createElement("span");
  dot.className = `column-dot ${column.dotClass}`.trim();
  dot.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.className = "column-title";
  title.id = `column-title-${column.id}`;
  title.textContent = column.title;

  const count = document.createElement("span");
  count.className = "column-count";
  count.textContent = String(visibleTasks.length);
  count.setAttribute(
    "aria-label",
    filtersActive
      ? `${visibleTasks.length} of ${allTasks.length} ${pluralize(allTasks.length, "task")} shown`
      : `${allTasks.length} ${pluralize(allTasks.length, "task")}`
  );

  head.append(dot, title, count);

  if (column.limit !== null) {
    const wipStatus = document.createElement("span");
    wipStatus.className = "wip-status";
    if (isFull) wipStatus.classList.add("is-full");
    wipStatus.textContent = `${allTasks.length} / ${column.limit}`;
    wipStatus.setAttribute(
      "aria-label",
      `Work in progress: ${allTasks.length} of ${column.limit} tasks${isFull ? ", limit reached" : ""}`
    );
    head.append(wipStatus);
  }

  section.appendChild(head);

  if (isFull) {
    const warning = document.createElement("div");
    warning.className = "wip-warning";
    warning.id = `wip-warning-${column.id}`;
    warning.append(
      createIcon("warning"),
      createTextSpan(`${column.title} is at its WIP limit (${column.limit}). Move a task out before adding another.`)
    );
    section.appendChild(warning);
  }

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  if (visibleTasks.length === 0) {
    taskList.appendChild(createEmptyState(filtersActive));
  } else {
    visibleTasks.forEach((task) => {
      taskList.appendChild(createTaskCard(task));
    });
  }

  section.appendChild(taskList);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "column-add-button";
  addButton.dataset.addTask = column.id;

  if (isFull) {
    addButton.disabled = true;
    addButton.setAttribute("aria-describedby", `wip-warning-${column.id}`);
    addButton.title = "This column has reached its work-in-progress limit.";
    addButton.append(createIcon("lock"), createTextSpan("Column is full"));
  } else {
    addButton.setAttribute("aria-label", `Add a task to ${column.title}`);
    addButton.append(createIcon("plus"), createTextSpan("Add task"));
  }

  section.appendChild(addButton);
  return section;
}

function createEmptyState(filtersActive) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";

  const heading = document.createElement("strong");
  const copy = document.createElement("p");

  if (filtersActive) {
    heading.textContent = "No matching tasks";
    copy.textContent = "Try another search or clear your filters.";
  } else {
    heading.textContent = "No tasks here";
    copy.textContent = "Add a task to start moving work through this column.";
  }

  wrapper.append(createIcon("empty"), heading, copy);
  return wrapper;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.taskId = task.id;

  const top = document.createElement("div");
  top.className = "card-top";

  const priority = document.createElement("span");
  priority.className = `priority-badge priority-${task.priority}`;
  priority.textContent = PRIORITY_LABELS[task.priority];

  const menuButtonForTask = document.createElement("button");
  menuButtonForTask.type = "button";
  menuButtonForTask.className = "card-menu-button";
  menuButtonForTask.dataset.taskId = task.id;
  menuButtonForTask.setAttribute("aria-haspopup", "menu");
  menuButtonForTask.setAttribute("aria-expanded", "false");
  menuButtonForTask.setAttribute("aria-label", `Task options for ${task.title}`);
  menuButtonForTask.append(createIcon("more"));

  top.append(priority, menuButtonForTask);
  card.appendChild(top);

  const cardTitle = document.createElement("h4");
  cardTitle.className = "card-title";
  cardTitle.textContent = task.title;
  card.appendChild(cardTitle);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "card-description";
    description.textContent = task.description;
    card.appendChild(description);
  }

  if (task.tags.length > 0) {
    const tags = document.createElement("ul");
    tags.className = "tag-list";
    tags.setAttribute("aria-label", "Tags");

    task.tags.forEach((tag) => {
      const item = document.createElement("li");
      item.className = "tag";
      item.textContent = tag;
      item.title = tag;
      tags.appendChild(item);
    });

    card.appendChild(tags);
  }

  if (task.dueDate) {
    const due = getDueDateState(task);
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const dueDate = document.createElement("span");
    dueDate.className = `due-date${due.className ? ` ${due.className}` : ""}`;

    const time = document.createElement("time");
    time.dateTime = task.dueDate;
    time.textContent = due.label;

    dueDate.append(createIcon("calendar"), time);
    footer.appendChild(dueDate);
    card.appendChild(footer);
  }

  return card;
}

function getDueDateState(task) {
  const today = todayISO();
  const isDone = task.columnId === "done";
  const formatted = formatDate(task.dueDate);

  if (!isDone && task.dueDate < today) {
    return { label: `Overdue · ${formatted}`, className: "is-overdue" };
  }

  if (!isDone && task.dueDate === today) {
    return { label: `Due today · ${formatted}`, className: "is-today" };
  }

  return { label: formatted, className: "" };
}

function updateHeader(visibleTotal) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.columnId === "done").length;
  const today = todayISO();
  const dueToday = tasks.filter((task) => {
    return task.columnId !== "done" && task.dueDate === today;
  }).length;
  const overdue = tasks.filter((task) => {
    return task.columnId !== "done" && task.dueDate && task.dueDate < today;
  }).length;

  sidebarTaskCount.textContent = String(total);
  sidebarTaskCount.setAttribute("aria-label", `${total} ${pluralize(total, "task")}`);

  statTotal.textContent = String(total);
  statCompleted.textContent = String(completed);
  statDueToday.textContent = String(dueToday);
  statOverdue.textContent = String(overdue);

  statCompleted.classList.toggle("is-positive", completed > 0);
  statDueToday.classList.toggle("is-attention", dueToday > 0);
  statOverdue.classList.toggle("is-danger", overdue > 0);

  if (total === 0) {
    viewSummary.textContent = "No tasks yet";
  } else {
    viewSummary.textContent = `Showing ${visibleTotal} of ${total} ${pluralize(total, "task")}`;
  }

  clearFiltersButton.disabled = !hasActiveFilters();
  clearFiltersButton.setAttribute("aria-disabled", String(!hasActiveFilters()));
}

function createIcon(name) {
  const template = document.createElement("template");
  template.innerHTML = ICONS[name] || "";
  return template.content.firstElementChild;
}

function createTextSpan(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

/* ==========================================================================
   Card menu
   ========================================================================== */

function openCardMenu(trigger, taskId) {
  if (!findTask(taskId)) return;

  if (!cardMenu.hidden && menuState.taskId === taskId) {
    closeCardMenu(true);
    return;
  }

  closeCardMenu(false);
  menuState = { taskId, trigger };
  trigger.setAttribute("aria-expanded", "true");
  cardMenu.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = cardMenu.getBoundingClientRect();
  let left = triggerRect.right - menuRect.width;
  let top = triggerRect.bottom + 6;

  left = Math.min(Math.max(8, left), window.innerWidth - menuRect.width - 8);
  if (top + menuRect.height > window.innerHeight - 8) {
    top = triggerRect.top - menuRect.height - 6;
  }
  top = Math.max(8, top);

  cardMenu.style.left = `${Math.round(left)}px`;
  cardMenu.style.top = `${Math.round(top)}px`;

  const firstItem = cardMenu.querySelector(".menu-item");
  if (firstItem) firstItem.focus();
}

function closeCardMenu(restoreFocus = true) {
  if (cardMenu.hidden) return;

  const trigger = menuState.trigger;
  cardMenu.hidden = true;
  cardMenu.style.left = "";
  cardMenu.style.top = "";

  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
  }

  menuState = { taskId: null, trigger: null };

  if (restoreFocus && trigger && trigger.isConnected) {
    trigger.focus();
  }
}

function handleMenuKeyboard(event) {
  const items = Array.from(cardMenu.querySelectorAll(".menu-item"));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement);

  if (event.key === "Escape") {
    event.preventDefault();
    closeCardMenu(true);
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (Math.max(currentIndex, 0) + direction + items.length) % items.length;
    items[nextIndex].focus();
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    items[event.key === "Home" ? 0 : items.length - 1].focus();
    return;
  }

  if (event.key === "Tab") {
    const trigger = menuState.trigger;
    closeCardMenu(false);
    if (trigger && trigger.isConnected) trigger.focus();
  }
}

function handleMenuAction(action) {
  const taskId = menuState.taskId;
  const trigger = menuState.trigger;
  const task = findTask(taskId);
  if (!task) {
    closeCardMenu(false);
    return;
  }

  closeCardMenu(false);

  if (action === "edit") {
    openTaskDialog(task, task.columnId, trigger);
  } else if (action === "delete") {
    openConfirmDialog(task, trigger);
  }
}

/* ==========================================================================
   Task dialog
   ========================================================================== */

function openTaskDialog(task = null, presetColumn = "todo", opener = null) {
  if (confirmDialog.open) confirmDialog.close();
  closeCardMenu(false);

  const isEditing = Boolean(task);
  const startingColumn = task
    ? task.columnId
    : (getColumn(presetColumn) && !isColumnFull(presetColumn) ? presetColumn : "todo");

  dialogState = {
    mode: isEditing ? "edit" : "create",
    taskId: task ? task.id : null,
    lastFocused: opener instanceof HTMLElement ? opener : document.activeElement
  };
  suppressDialogFocusRestore = false;

  taskForm.reset();
  clearAllFormErrors();

  taskDialogTitle.textContent = isEditing ? "Edit task" : "New task";
  taskDialogDescription.textContent = isEditing
    ? "Update the details or move this task somewhere new."
    : "Add the details your future self will need.";
  modalSubmitButton.textContent = isEditing ? "Save changes" : "Create task";

  renderColumnOptions(startingColumn, task ? task.id : null);

  if (task) {
    taskIdInput.value = task.id;
    titleInput.value = task.title;
    descriptionInput.value = task.description;
    priorityInput.value = task.priority;
    dueDateInput.value = task.dueDate;
    tagsInput.value = task.tags.join(", ");
  } else {
    taskIdInput.value = "";
    priorityInput.value = "medium";
    dueDateInput.value = "";
    tagsInput.value = "";
  }

  updateCharacterCounts();
  document.body.classList.add("modal-open");
  taskDialog.showModal();
  titleInput.focus();

  const titleLength = titleInput.value.length;
  if (typeof titleInput.setSelectionRange === "function") {
    titleInput.setSelectionRange(titleLength, titleLength);
  }
}

function openConfirmDialog(task, opener = null) {
  if (taskDialog.open) taskDialog.close();

  pendingDeleteId = task.id;
  confirmLastFocused = opener instanceof HTMLElement ? opener : document.activeElement;
  suppressConfirmFocusRestore = false;
  confirmMessage.textContent = `“${task.title}” will be permanently removed from this board.`;

  document.body.classList.add("modal-open");
  confirmDialog.showModal();
  confirmCancelButton.focus();
}

function renderColumnOptions(selectedColumnId, editingTaskId) {
  columnInput.replaceChildren();

  COLUMNS.forEach((column) => {
    const option = document.createElement("option");
    const full = isColumnFull(column.id, editingTaskId);
    option.value = column.id;
    option.textContent = full ? `${column.title} (limit reached)` : column.title;
    option.disabled = full;
    option.selected = column.id === selectedColumnId;
    columnInput.appendChild(option);
  });

  const selectedOption = columnInput.selectedOptions[0];
  if (!selectedOption || selectedOption.disabled) {
    const firstAvailable = Array.from(columnInput.options).find((option) => !option.disabled);
    if (firstAvailable) firstAvailable.selected = true;
  }
}

function updateCharacterCounts() {
  titleCount.textContent = `${titleInput.value.length} / ${MAX_TITLE}`;
  descriptionCount.textContent = `${descriptionInput.value.length} / ${MAX_DESCRIPTION}`;

  const tags = parseTags(tagsInput.value);
  tagCount.textContent = `${tags.length} / ${MAX_TAGS} tags`;
  tagCount.classList.toggle("is-over", tags.length > MAX_TAGS);
}

function setFieldError(field, errorElement, message) {
  errorElement.textContent = message;
  errorElement.setAttribute("role", "alert");
  errorElement.hidden = false;
  field.setAttribute("aria-invalid", "true");

  const selectWrapper = field.closest(".select-field");
  if (selectWrapper) selectWrapper.classList.add("has-error");
}

function clearFieldError(field, errorElement) {
  errorElement.textContent = "";
  errorElement.hidden = true;
  field.removeAttribute("aria-invalid");

  const selectWrapper = field.closest(".select-field");
  if (selectWrapper) selectWrapper.classList.remove("has-error");
}

function clearAllFormErrors() {
  clearFieldError(titleInput, titleError);
  clearFieldError(descriptionInput, descriptionError);
  clearFieldError(dueDateInput, dueDateError);
  clearFieldError(columnInput, columnError);
  clearFieldError(tagsInput, tagsError);
}

function validateTaskForm() {
  clearAllFormErrors();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const tags = parseTags(tagsInput.value);
  const dueDate = dueDateInput.value.trim();
  const columnId = columnInput.value;
  const column = getColumn(columnId);
  const editingTaskId = dialogState.mode === "edit" ? dialogState.taskId : null;

  if (!title) {
    setFieldError(titleInput, titleError, "Enter a title for this task.");
    titleInput.focus();
    return null;
  }

  if (title.length > MAX_TITLE) {
    setFieldError(titleInput, titleError, `Keep the title to ${MAX_TITLE} characters or fewer.`);
    titleInput.focus();
    return null;
  }

  if (description.length > MAX_DESCRIPTION) {
    setFieldError(descriptionInput, descriptionError, `Keep the description to ${MAX_DESCRIPTION} characters or fewer.`);
    descriptionInput.focus();
    return null;
  }

  if (tags.length > MAX_TAGS) {
    setFieldError(tagsInput, tagsError, `Use no more than ${MAX_TAGS} tags.`);
    tagsInput.focus();
    return null;
  }

  if (dueDate && !isValidISODate(dueDate)) {
    setFieldError(dueDateInput, dueDateError, "Enter a valid due date.");
    dueDateInput.focus();
    return null;
  }

  if (!column) {
    setFieldError(columnInput, columnError, "Choose a valid column.");
    columnInput.focus();
    return null;
  }

  if (isColumnFull(columnId, editingTaskId)) {
    setFieldError(
      columnInput,
      columnError,
      `${column.title} is at its WIP limit (${column.limit}). Move a task out before adding another.`
    );
    columnInput.focus();
    return null;
  }

  return {
    title,
    description,
    priority: priorityInput.value,
    dueDate,
    tags,
    columnId
  };
}

function saveTask(event) {
  event.preventDefault();

  const values = validateTaskForm();
  if (!values) return;

  let savedTask;
  let toastMessage;
  let moved = false;

  if (dialogState.mode === "edit") {
    const task = findTask(dialogState.taskId);
    if (!task) {
      taskDialog.close();
      return;
    }

    const previousColumnId = task.columnId;
    moved = previousColumnId !== values.columnId;

    task.title = values.title;
    task.description = values.description;
    task.priority = values.priority;
    task.dueDate = values.dueDate;
    task.tags = values.tags;
    task.columnId = values.columnId;

    if (moved) {
      task.order = -1;
      reindexColumn(values.columnId);
      reindexColumn(previousColumnId);
    }

    savedTask = task;
    toastMessage = moved
      ? `Task updated and moved to ${getColumn(values.columnId).title}.`
      : "Task updated.";
  } else {
    savedTask = {
      id: createId(),
      title: values.title,
      description: values.description,
      priority: values.priority,
      dueDate: values.dueDate,
      tags: values.tags,
      columnId: values.columnId,
      order: -1,
      createdAt: Date.now()
    };
    tasks.push(savedTask);
    reindexColumn(values.columnId);
    toastMessage = `Task created in ${getColumn(values.columnId).title}.`;
  }

  persistTasks();
  render();

  suppressDialogFocusRestore = true;
  taskDialog.close();
  showToast(toastMessage);
  focusTaskOptions(savedTask.id);
}

function closeTaskDialog() {
  if (taskDialog.open) taskDialog.close();
}

function focusTaskOptions(taskId) {
  requestAnimationFrame(() => {
    const button = Array.from(board.querySelectorAll(".card-menu-button"))
      .find((candidate) => candidate.dataset.taskId === taskId);

    if (button) {
      button.focus();
    } else {
      newTaskButton.focus();
    }
  });
}

/* ==========================================================================
   Delete flow
   ========================================================================== */

function deleteConfirmedTask() {
  if (!pendingDeleteId) return;

  const task = findTask(pendingDeleteId);
  if (!task) {
    pendingDeleteId = null;
    confirmDialog.close();
    return;
  }

  const columnId = task.columnId;
  tasks = tasks.filter((candidate) => candidate.id !== task.id);
  reindexColumn(columnId);
  pendingDeleteId = null;

  persistTasks();
  suppressConfirmFocusRestore = true;
  confirmDialog.close();
  render();
  showToast("Task deleted.");

  requestAnimationFrame(() => {
    const addButton = Array.from(board.querySelectorAll(".column-add-button"))
      .find((button) => button.dataset.addTask === columnId);
    if (addButton && !addButton.disabled) {
      addButton.focus();
    } else {
      newTaskButton.focus();
    }
  });
}

/* ==========================================================================
   Drag and drop
   ========================================================================== */

function handleDragStart(event) {
  const card = event.target.closest(".task-card");
  if (!card) return;

  if (pointerStartedOnControl) {
    event.preventDefault();
    pointerStartedOnControl = false;
    return;
  }

  const task = findTask(card.dataset.taskId);
  if (!task) return;

  closeCardMenu(false);
  draggedTaskId = task.id;
  dropTarget = null;
  blockedNoticeShown = false;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }

  requestAnimationFrame(() => {
    const currentCard = findTaskCard(task.id);
    if (currentCard) currentCard.classList.add("is-dragging");
    board.classList.add("is-dragging");
  });

  announce(`Moving ${task.title}.`);
}

function handleDragOver(event) {
  if (!draggedTaskId) return;

  const column = event.target.closest(".column");
  if (!column) return;

  event.preventDefault();

  const task = findTask(draggedTaskId);
  if (!task) return;

  const columnId = column.dataset.columnId;
  const columnData = getColumn(columnId);
  if (!columnData) return;

  const blocked = columnData.limit !== null
    && task.columnId !== columnId
    && isColumnFull(columnId);

  document.querySelectorAll(".column").forEach((element) => {
    element.classList.remove("is-drop-target", "is-drop-blocked");
  });

  autoScrollBoard(event.clientX);

  if (blocked) {
    column.classList.add("is-drop-blocked");
    dropIndicator.remove();
    dropTarget = null;

    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";

    if (!blockedNoticeShown) {
      blockedNoticeShown = true;
      showToast(`${columnData.title} is at its WIP limit (${columnData.limit}). Move a task out first.`, "error");
    }
    return;
  }

  column.classList.add("is-drop-target");
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

  const taskList = column.querySelector(".task-list");
  if (!taskList) return;

  const otherCards = Array.from(taskList.querySelectorAll(".task-card"))
    .filter((card) => card.dataset.taskId !== draggedTaskId);

  const beforeCard = otherCards.find((card) => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  }) || null;

  const emptyState = taskList.querySelector(".empty-state");

  if (beforeCard) {
    taskList.insertBefore(dropIndicator, beforeCard);
  } else if (otherCards.length === 0 && emptyState) {
    taskList.insertBefore(dropIndicator, emptyState);
  } else {
    taskList.appendChild(dropIndicator);
  }

  dropTarget = {
    columnId,
    beforeTaskId: beforeCard ? beforeCard.dataset.taskId : null
  };
}

function handleDrop(event) {
  if (!draggedTaskId) return;
  event.preventDefault();

  const draggedTask = findTask(draggedTaskId);
  const target = dropTarget;
  const targetColumn = target ? getColumn(target.columnId) : null;

  if (!draggedTask || !target || !targetColumn) {
    clearDragState();
    return;
  }

  const movingColumns = draggedTask.columnId !== target.columnId;
  if (movingColumns && targetColumn.limit !== null && isColumnFull(target.columnId)) {
    if (!blockedNoticeShown) {
      showToast(`${targetColumn.title} is at its WIP limit (${targetColumn.limit}). Move a task out first.`, "error");
    }
    clearDragState();
    return;
  }

  const previousColumnId = draggedTask.columnId;
  const previousList = tasksForColumn(previousColumnId);
  const previousIndex = previousList.findIndex((task) => task.id === draggedTask.id);

  const targetTasks = tasksForColumn(target.columnId)
    .filter((task) => task.id !== draggedTask.id);

  let insertIndex = target.beforeTaskId
    ? targetTasks.findIndex((task) => task.id === target.beforeTaskId)
    : targetTasks.length;

  if (insertIndex < 0) insertIndex = targetTasks.length;

  targetTasks.splice(insertIndex, 0, draggedTask);
  draggedTask.columnId = target.columnId;
  targetTasks.forEach((task, index) => {
    task.order = index;
  });

  if (previousColumnId !== target.columnId) {
    reindexColumn(previousColumnId);
  }

  const newIndex = targetTasks.findIndex((task) => task.id === draggedTask.id);
  const orderChanged = previousColumnId !== target.columnId || previousIndex !== newIndex;

  persistTasks();
  clearDragState();
  render();

  if (movingColumns) {
    showToast(`Task moved to ${targetColumn.title}.`);
  } else if (orderChanged) {
    showToast("Task reordered.");
  }
}

function clearDragState() {
  document.querySelectorAll(".task-card.is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });
  board.classList.remove("is-dragging");
  document.querySelectorAll(".column").forEach((column) => {
    column.classList.remove("is-drop-target", "is-drop-blocked");
  });
  dropIndicator.remove();
  draggedTaskId = null;
  dropTarget = null;
  blockedNoticeShown = false;
}

function autoScrollBoard(clientX) {
  const rect = boardScroller.getBoundingClientRect();
  const edgeSize = 52;

  if (clientX < rect.left + edgeSize) {
    boardScroller.scrollLeft -= 14;
  } else if (clientX > rect.right - edgeSize) {
    boardScroller.scrollLeft += 14;
  }
}

function findTaskCard(taskId) {
  return Array.from(board.querySelectorAll(".task-card"))
    .find((card) => card.dataset.taskId === taskId) || null;
}

/* ==========================================================================
   Toasts and announcements
   ========================================================================== */

function showToast(message, type = "success", duration = TOAST_DURATION) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.type = type;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.append(createIcon(type === "error" ? "alert" : "check"));

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.append(createIcon("close"));

  toast.append(icon, text, close);
  toastStack.appendChild(toast);

  while (toastStack.children.length > 3) {
    toastStack.firstElementChild.remove();
  }

  let remaining = duration;
  let startedAt = Date.now();
  let timer = window.setTimeout(dismissToast, remaining);

  function pauseTimer() {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = null;
    remaining = Math.max(1200, remaining - (Date.now() - startedAt));
  }

  function resumeTimer() {
    if (timer) return;
    startedAt = Date.now();
    timer = window.setTimeout(dismissToast, remaining);
  }

  function dismissToast() {
    if (!toast.isConnected) return;
    if (timer) window.clearTimeout(timer);
    timer = null;
    toast.remove();
  }

  close.addEventListener("click", dismissToast);
  toast.addEventListener("mouseenter", pauseTimer);
  toast.addEventListener("mouseleave", resumeTimer);
  toast.addEventListener("focusin", pauseTimer);
  toast.addEventListener("focusout", resumeTimer);
}

function announce(message) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => {
    liveRegion.textContent = message;
  });
}

/* ==========================================================================
   Theme and navigation
   ========================================================================== */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  themeToggle.setAttribute("aria-checked", String(theme === "dark"));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.content = theme === "dark" ? "#111715" : "#f4f7f5";
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);

  if (!writeStorage(THEME_KEY, next)) {
    showStorageWarning();
  }
}

function isMobileNavigation() {
  return mobileQuery.matches;
}

function openSidebar() {
  closeCardMenu(false);
  sidebar.inert = false;
  sidebar.classList.add("is-open");
  sidebarScrim.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  mainElement.inert = true;
  document.body.classList.add("drawer-open");
  sidebarClose.focus();

  requestAnimationFrame(() => {
    if (sidebar.classList.contains("is-open")) {
      sidebarClose.focus({ preventScroll: true });
    }
  });
}

function closeSidebar(restoreFocus = false) {
  sidebar.classList.remove("is-open");
  sidebarScrim.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  mainElement.inert = false;
  document.body.classList.remove("drawer-open");

  if (isMobileNavigation()) {
    sidebar.inert = true;
  }

  if (restoreFocus) {
    menuButton.focus();
  }
}

function resetSidebarForViewport() {
  const focusWasInSidebar = sidebar.contains(document.activeElement);
  sidebar.classList.remove("is-open");
  sidebarScrim.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  mainElement.inert = false;
  document.body.classList.remove("drawer-open");
  sidebar.inert = isMobileNavigation();

  if (isMobileNavigation() && focusWasInSidebar) {
    menuButton.focus();
  }
}

function clearFilters({ focusSearch = true } = {}) {
  searchQuery = "";
  activePriority = "all";
  searchInput.value = "";
  priorityFilter.value = "all";
  render();
  announce("Filters cleared.");

  if (focusSearch) {
    requestAnimationFrame(() => searchInput.focus());
  }
}

/* ==========================================================================
   Events
   ========================================================================== */

function bindEvents() {
  themeToggle.addEventListener("click", toggleTheme);

  menuButton.addEventListener("click", () => {
    if (isMobileNavigation()) openSidebar();
  });

  sidebarClose.addEventListener("click", () => closeSidebar(true));
  sidebarScrim.addEventListener("click", () => closeSidebar(true));

  boardLink.addEventListener("click", (event) => {
    if (!isMobileNavigation()) return;
    event.preventDefault();
    closeSidebar(false);
    requestAnimationFrame(() => {
      boardRegion.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      boardScroller.focus({ preventScroll: true });
    });
  });

  mobileQuery.addEventListener("change", resetSidebarForViewport);

  newTaskButton.addEventListener("click", () => {
    openTaskDialog(null, "todo", newTaskButton);
  });

  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    render();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchInput.value) {
      searchInput.value = "";
      searchQuery = "";
      render();
    }
  });

  priorityFilter.addEventListener("change", (event) => {
    activePriority = event.target.value;
    render();
  });

  clearFiltersButton.addEventListener("click", () => clearFilters());

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement
      && (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.key === "Escape" && !cardMenu.hidden) {
      closeCardMenu(true);
      return;
    }

    if (event.key === "Escape" && isMobileNavigation() && sidebar.classList.contains("is-open")) {
      closeSidebar(true);
      return;
    }

    if (
      event.key === "/"
      && !isTyping
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && !document.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      closeCardMenu(false);
      searchInput.focus();
    }
  });

  board.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest(".card-menu-button");
    if (menuTrigger) {
      openCardMenu(menuTrigger, menuTrigger.dataset.taskId);
      return;
    }

    const addButton = event.target.closest(".column-add-button");
    if (addButton && !addButton.disabled) {
      const columnId = addButton.dataset.addTask;
      const column = getColumn(columnId);
      if (!column) return;
      if (isColumnFull(columnId)) {
        showToast(`${column.title} is at its WIP limit (${column.limit}).`, "error");
        return;
      }
      openTaskDialog(null, columnId, addButton);
    }
  });

  board.addEventListener("pointerdown", (event) => {
    pointerStartedOnControl = Boolean(event.target.closest("button, a, input, select, textarea"));
  });

  document.addEventListener("pointerup", () => {
    pointerStartedOnControl = false;
  });

  board.addEventListener("dragstart", handleDragStart);
  board.addEventListener("dragover", handleDragOver);
  board.addEventListener("drop", handleDrop);
  board.addEventListener("dragend", clearDragState);

  board.addEventListener("dragleave", (event) => {
    const column = event.target.closest(".column");
    if (!column) return;
    if (event.relatedTarget && column.contains(event.relatedTarget)) return;

    column.classList.remove("is-drop-target", "is-drop-blocked");
    if (dropIndicator.parentElement && dropIndicator.closest(".column") === column) {
      dropIndicator.remove();
      dropTarget = null;
    }
  });

  cardMenu.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-menu-action]");
    if (!actionButton) return;
    handleMenuAction(actionButton.dataset.menuAction);
  });
  cardMenu.addEventListener("keydown", handleMenuKeyboard);

  document.addEventListener("pointerdown", (event) => {
    if (cardMenu.hidden) return;
    if (cardMenu.contains(event.target)) return;
    if (menuState.trigger && menuState.trigger.contains(event.target)) return;
    closeCardMenu(false);
  });

  window.addEventListener("scroll", () => closeCardMenu(false), true);
  window.addEventListener("resize", () => closeCardMenu(false));

  modalCloseButton.addEventListener("click", closeTaskDialog);
  modalCancelButton.addEventListener("click", closeTaskDialog);

  taskDialog.addEventListener("click", (event) => {
    if (event.target === taskDialog) closeTaskDialog();
  });

  taskDialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    const focusTarget = dialogState.lastFocused;
    const shouldRestore = !suppressDialogFocusRestore;
    dialogState = { mode: null, taskId: null, lastFocused: null };

    if (shouldRestore) {
      requestAnimationFrame(() => {
        if (focusTarget && focusTarget.isConnected) focusTarget.focus();
      });
    }
  });

  taskForm.addEventListener("submit", saveTask);

  titleInput.addEventListener("input", () => {
    updateCharacterCounts();
    if (titleInput.value.trim()) clearFieldError(titleInput, titleError);
  });

  descriptionInput.addEventListener("input", () => {
    updateCharacterCounts();
    clearFieldError(descriptionInput, descriptionError);
  });

  tagsInput.addEventListener("input", () => {
    updateCharacterCounts();
    if (parseTags(tagsInput.value).length <= MAX_TAGS) {
      clearFieldError(tagsInput, tagsError);
    }
  });

  dueDateInput.addEventListener("change", () => {
    clearFieldError(dueDateInput, dueDateError);
  });

  columnInput.addEventListener("change", () => {
    clearFieldError(columnInput, columnError);
  });

  confirmCancelButton.addEventListener("click", () => confirmDialog.close());
  confirmDeleteButton.addEventListener("click", deleteConfirmedTask);

  confirmDialog.addEventListener("click", (event) => {
    if (event.target === confirmDialog) confirmDialog.close();
  });

  confirmDialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    const focusTarget = confirmLastFocused;
    const shouldRestore = !suppressConfirmFocusRestore;
    pendingDeleteId = null;
    confirmLastFocused = null;

    if (shouldRestore) {
      requestAnimationFrame(() => {
        if (focusTarget && focusTarget.isConnected) focusTarget.focus();
      });
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */

function init() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme);
  resetSidebarForViewport();

  tasks = loadTasks();
  bindEvents();
  render();

  if (initialPersistNeeded) {
    persistTasks();
  }

  if (storageFailed) {
    showStorageWarning();
  }

  if (loadFailed) {
    showToast("Your saved board could not be read, so the sample board was restored.", "error", 6500);
  }
}

init();
