// Play controller. Renders the board, collects guesses, sends them to the server for
// scoring, and reveals the returned colors. The answer string is never present here.

import { submitGuess } from "./api.js";
import { createKeyboard } from "./keyboard.js";

const WORD_LENGTH = 5;
const EMOJI = { correct: "🟩", present: "🟨", absent: "⬛" };

export function initGame({ token, maxAttempts, ui }) {
  const boardEl = document.getElementById("board");
  const messageEl = document.getElementById("message");
  const keyboardEl = document.getElementById("keyboard");

  let sessionToken = token;
  let currentRow = 0;
  let currentCol = 0;
  let current = "";
  let finished = false;
  let busy = false;
  const history = []; // array of marks arrays, for the share grid

  // Build the 6×5 grid.
  const rowEls = [];
  const tileEls = [];
  for (let r = 0; r < maxAttempts; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    const tiles = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      rowEl.appendChild(tile);
      tiles.push(tile);
    }
    boardEl.appendChild(rowEl);
    rowEls.push(rowEl);
    tileEls.push(tiles);
  }

  const keyboard = createKeyboard(keyboardEl, handleKey);

  function setMessage(text) {
    messageEl.textContent = text || "";
  }

  function handleKey(ev) {
    if (finished || busy) return;
    if (ev.type === "letter") addLetter(ev.value);
    else if (ev.type === "backspace") removeLetter();
    else if (ev.type === "enter") submit();
  }

  function addLetter(ch) {
    if (current.length >= WORD_LENGTH) return;
    const tile = tileEls[currentRow][currentCol];
    tile.textContent = ch;
    tile.classList.add("filled", "pop");
    setTimeout(() => tile.classList.remove("pop"), 100);
    current += ch;
    currentCol++;
  }

  function removeLetter() {
    if (current.length === 0) return;
    current = current.slice(0, -1);
    currentCol--;
    const tile = tileEls[currentRow][currentCol];
    tile.textContent = "";
    tile.classList.remove("filled");
  }

  function shakeRow() {
    const rowEl = rowEls[currentRow];
    rowEl.classList.add("shake");
    setTimeout(() => rowEl.classList.remove("shake"), 500);
  }

  async function submit() {
    if (current.length < WORD_LENGTH) {
      shakeRow();
      ui.toast("文字が足りません");
      return;
    }

    const guess = current;
    busy = true;
    try {
      const res = await submitGuess(sessionToken, guess);
      sessionToken = res.token;
      await reveal(currentRow, guess, res.feedback);
      history.push(res.feedback);
      keyboard.applyResult(guess, res.feedback);

      if (res.solved) {
        finished = true;
        endGame(true);
      } else if (res.attemptsLeft <= 0) {
        finished = true;
        endGame(false);
      } else {
        currentRow++;
        currentCol = 0;
        current = "";
      }
    } catch (err) {
      if (err.code === "not_in_dictionary" || err.code === "invalid_format") {
        shakeRow();
        ui.toast(err.message || "辞書にない単語です");
      } else if (err.code === "invalid_token") {
        ui.toast("セッションが切れました。再読み込みします。");
        setTimeout(() => location.reload(), 1200);
      } else {
        ui.toast(err.message || "通信エラーが発生しました");
      }
    } finally {
      busy = false;
    }
  }

  // Flip-reveal each tile with a stagger.
  function reveal(rowIndex, guess, marks) {
    const tiles = tileEls[rowIndex];
    return new Promise((resolve) => {
      tiles.forEach((tile, i) => {
        setTimeout(() => {
          tile.classList.add("flip");
          setTimeout(() => {
            tile.classList.add(marks[i]);
          }, 250);
          if (i === WORD_LENGTH - 1) setTimeout(resolve, 350);
        }, i * 300);
      });
    });
  }

  function buildGrid() {
    return history.map((marks) => marks.map((m) => EMOJI[m]).join("")).join("\n");
  }

  function endGame(won) {
    const tries = history.length;
    const grid = buildGrid();
    const shareText =
      `Wordrop ${won ? tries : "X"}/${maxAttempts}\n\n${grid}`;
    setTimeout(() => {
      ui.showResult({
        won,
        tries,
        maxAttempts,
        grid,
        shareText,
      });
    }, 400);
  }
}
