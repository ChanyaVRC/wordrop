// Entry point: routes between the "create" and "play" views and wires up shared UI
// (toast, result modal). A `?g=<id>` query param means play mode; otherwise create mode.

import "./styles.css";
import { createPuzzle, createRandom, startGame, ApiError } from "./api";
import { initGame, type GameUi, type ResultInfo } from "./game";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const views = {
  create: el("create-view"),
  play: el("play-view"),
  status: el("status-view"),
};

function showView(name: keyof typeof views): void {
  for (const [key, node] of Object.entries(views)) {
    node.hidden = key !== name;
  }
}

// ===== Toast =====
const toastEl = el("toast");
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 1600);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ===== Result modal =====
const modal = el("modal");
const modalTitle = el("modal-title");
const modalSub = el("modal-sub");
const modalGrid = el("modal-grid");
const modalShare = el<HTMLButtonElement>("modal-share");
const modalClose = el<HTMLButtonElement>("modal-close");
const reopenBtn = el<HTMLButtonElement>("result-reopen");

// Once a game ends we keep the result available so the modal can be dismissed (to look at
// your own board) and reopened via the "結果を見る" button.
let hasResult = false;

function openModal(): void {
  modal.hidden = false;
  reopenBtn.hidden = true;
}

function closeModal(): void {
  modal.hidden = true;
  reopenBtn.hidden = !hasResult;
}

function showResult({ won, tries, maxAttempts, grid, shareText }: ResultInfo): void {
  modalTitle.textContent = won ? "クリア！🎉" : "ざんねん…";
  modalSub.textContent = won
    ? `${tries}/${maxAttempts} で正解！`
    : "答えは出題者に聞いてみよう。";
  modalGrid.textContent = grid;
  modalShare.onclick = async () => {
    await copyText(shareText);
    toast("結果をコピーしました");
  };
  hasResult = true;
  openModal();
}

modalClose.addEventListener("click", closeModal);
reopenBtn.addEventListener("click", openModal);
// Dismiss on backdrop click and Esc.
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

const ui: GameUi = { toast, showResult };

// ===== Create view =====
function setupCreateView(): void {
  showView("create");
  const form = el<HTMLFormElement>("create-form");
  const input = el<HTMLInputElement>("create-input");
  const randomBtn = el<HTMLButtonElement>("random-word");
  const errorEl = el("create-error");
  const shareBox = el("share-box");
  const shareUrlEl = el<HTMLInputElement>("share-url");
  const copyBtn = el<HTMLButtonElement>("copy-url");
  const shareNativeBtn = el<HTMLButtonElement>("share-native");
  const playSelf = el<HTMLAnchorElement>("play-self");

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5);
    errorEl.hidden = true;
  });

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function showShare(id: string): void {
    const url = `${location.origin}/?g=${id}`;
    shareUrlEl.value = url;
    playSelf.href = url;
    shareBox.hidden = false;
    shareNativeBtn.hidden = !navigator.share;
    shareUrlEl.focus();
    shareUrlEl.select();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const word = input.value.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(word)) {
      showError("5文字のアルファベットで入力してください。");
      return;
    }
    try {
      const { id } = await createPuzzle(word);
      showShare(id);
    } catch (err) {
      showError((err as ApiError).message || "作成に失敗しました。");
    }
  });

  randomBtn.addEventListener("click", async () => {
    try {
      const { id } = await createRandom();
      input.value = "";
      showShare(id);
    } catch (err) {
      showError((err as ApiError).message || "作成に失敗しました。");
    }
  });

  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(shareUrlEl.value);
    toast(ok ? "URLをコピーしました" : "コピーできませんでした");
  });

  shareNativeBtn.addEventListener("click", async () => {
    try {
      await navigator.share({ title: "Wordrop に挑戦！", url: shareUrlEl.value });
    } catch {
      /* ユーザーがキャンセル */
    }
  });
}

// ===== Play view =====
async function setupPlayView(id: string): Promise<void> {
  showView("status");
  const statusText = el("status-text");
  const statusHome = el("status-home");
  try {
    const { token, maxAttempts } = await startGame(id);
    showView("play");
    initGame({ id, token, maxAttempts, ui });
  } catch (err) {
    const e = err as ApiError;
    statusText.textContent =
      e.status === 404
        ? "このパズルは存在しないか、期限切れです。"
        : e.message || "読み込みに失敗しました。";
    statusHome.hidden = false;
  }
}

// ===== Boot =====
function boot(): void {
  const id = new URLSearchParams(location.search).get("g");
  if (id) void setupPlayView(id);
  else setupCreateView();
}

boot();
