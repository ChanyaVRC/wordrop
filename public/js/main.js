// Entry point: routes between the "create" and "play" views and wires up shared UI
// (toast, result modal). A `?g=<id>` query param means play mode; otherwise create mode.

import { createPuzzle, createRandom, startGame } from "./api.js";
import { initGame } from "./game.js";

const views = {
  create: document.getElementById("create-view"),
  play: document.getElementById("play-view"),
  status: document.getElementById("status-view"),
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

// ===== Toast =====
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 1600);
}

// ===== Result modal =====
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalSub = document.getElementById("modal-sub");
const modalGrid = document.getElementById("modal-grid");
const modalShare = document.getElementById("modal-share");

function showResult({ won, tries, maxAttempts, grid, shareText }) {
  modalTitle.textContent = won ? "クリア！🎉" : "ざんねん…";
  modalSub.textContent = won
    ? `${tries}/${maxAttempts} で正解！`
    : "答えは出題者に聞いてみよう。";
  modalGrid.textContent = grid;
  modalShare.onclick = async () => {
    await copyText(shareText);
    toast("結果をコピーしました");
  };
  modal.hidden = false;
}

const ui = { toast, showResult };

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ===== Create view =====
function setupCreateView() {
  showView("create");
  const form = document.getElementById("create-form");
  const input = document.getElementById("create-input");
  const randomBtn = document.getElementById("random-word");
  const errorEl = document.getElementById("create-error");
  const shareBox = document.getElementById("share-box");
  const shareUrlEl = document.getElementById("share-url");
  const copyBtn = document.getElementById("copy-url");
  const shareNativeBtn = document.getElementById("share-native");
  const playSelf = document.getElementById("play-self");

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5);
    errorEl.hidden = true;
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function showShare(id) {
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
      showError(err.message || "作成に失敗しました。");
    }
  });

  randomBtn.addEventListener("click", async () => {
    try {
      const { id } = await createRandom();
      input.value = "";
      showShare(id);
    } catch (err) {
      showError(err.message || "作成に失敗しました。");
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
async function setupPlayView(id) {
  showView("status");
  const statusText = document.getElementById("status-text");
  const statusHome = document.getElementById("status-home");
  try {
    const { token, maxAttempts } = await startGame(id);
    showView("play");
    initGame({ id, token, maxAttempts, ui });
  } catch (err) {
    statusText.textContent =
      err.status === 404
        ? "このパズルは存在しないか、期限切れです。"
        : err.message || "読み込みに失敗しました。";
    statusHome.hidden = false;
  }
}

// ===== Boot =====
function boot() {
  const id = new URLSearchParams(location.search).get("g");
  if (id) setupPlayView(id);
  else setupCreateView();
}

boot();
