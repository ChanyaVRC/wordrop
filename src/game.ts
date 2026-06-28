// Play controller. Renders the board, collects guesses, sends them to the server for
// scoring, and reveals the returned colors. The answer string is never present here.

import { submitGuess, ApiError, type Mark } from "./api";
import { createKeyboard, type KeyEvent } from "./keyboard";

const WORD_LENGTH = 5;
const EMOJI: Record<Mark, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

export interface ResultInfo {
  won: boolean;
  tries: number;
  maxAttempts: number;
  grid: string;
  shareText: string;
}

export interface GameUi {
  toast(msg: string): void;
  showResult(result: ResultInfo): void;
}

export interface GameOptions {
  id: string;
  token: string;
  maxAttempts: number;
  ui: GameUi;
}

export function initGame({ id, token, maxAttempts, ui }: GameOptions): void {
  const boardEl = document.getElementById("board") as HTMLElement;
  const keyboardEl = document.getElementById("keyboard") as HTMLElement;

  let sessionToken = token;
  let currentRow = 0;
  let currentCol = 0;
  let current = "";
  let finished = false;
  let busy = false;
  const history: Mark[][] = []; // marks per guess, for the share grid

  // Build the 6×5 grid.
  const tileEls: HTMLElement[][] = [];
  const rowEls: HTMLElement[] = [];
  for (let r = 0; r < maxAttempts; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    const tiles: HTMLElement[] = [];
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

  function handleKey(ev: KeyEvent): void {
    if (finished || busy) return;
    if (ev.type === "letter") addLetter(ev.value);
    else if (ev.type === "backspace") removeLetter();
    else if (ev.type === "enter") void submit();
  }

  function addLetter(ch: string): void {
    if (current.length >= WORD_LENGTH) return;
    const tile = tileEls[currentRow][currentCol];
    tile.textContent = ch;
    tile.classList.add("filled", "pop");
    setTimeout(() => tile.classList.remove("pop"), 100);
    current += ch;
    currentCol++;
  }

  function removeLetter(): void {
    if (current.length === 0) return;
    current = current.slice(0, -1);
    currentCol--;
    const tile = tileEls[currentRow][currentCol];
    tile.textContent = "";
    tile.classList.remove("filled");
  }

  function shakeRow(): void {
    const rowEl = rowEls[currentRow];
    rowEl.classList.add("shake");
    setTimeout(() => rowEl.classList.remove("shake"), 500);
  }

  async function submit(): Promise<void> {
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
      await reveal(currentRow, res.feedback);
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
      const e = err as ApiError;
      if (e.code === "not_in_dictionary" || e.code === "invalid_format") {
        shakeRow();
        ui.toast(e.message || "辞書にない単語です");
      } else if (e.code === "invalid_token") {
        ui.toast("セッションが切れました。再読み込みします。");
        setTimeout(() => location.reload(), 1200);
      } else {
        ui.toast(e.message || "通信エラーが発生しました");
      }
    } finally {
      busy = false;
    }
  }

  // Flip-reveal each tile with a stagger.
  function reveal(rowIndex: number, marks: Mark[]): Promise<void> {
    const tiles = tileEls[rowIndex];
    return new Promise((resolve) => {
      tiles.forEach((tile, i) => {
        setTimeout(() => {
          tile.classList.add("flip");
          setTimeout(() => {
            tile.classList.add(marks[i]);
          }, 250);
          if (i === WORD_LENGTH - 1) setTimeout(() => resolve(), 350);
        }, i * 300);
      });
    });
  }

  function buildGrid(): string {
    return history.map((marks) => marks.map((m) => EMOJI[m]).join("")).join("\n");
  }

  function endGame(won: boolean): void {
    const tries = history.length;
    const grid = buildGrid();
    const url = `${location.origin}/?g=${id}`;
    const shareText = `Wordrop ${won ? tries : "X"}/${maxAttempts} #${id}\n\n${grid}\n\n${url}`;
    setTimeout(() => {
      ui.showResult({ won, tries, maxAttempts, grid, shareText });
    }, 400);
  }
}
