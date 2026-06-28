// On-screen keyboard + physical keyboard input. Emits "letter", "enter", "backspace"
// events via the callback passed to create().

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

// Color priority so a key never downgrades (correct > present > absent).
const RANK = { absent: 0, present: 1, correct: 2 };

export function createKeyboard(container, onKey) {
  container.innerHTML = "";
  const keyEls = new Map();

  for (const row of ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    for (const key of row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = key;
      if (key === "ENTER" || key === "BACK") btn.classList.add("wide");
      btn.textContent = key === "BACK" ? "⌫" : key;
      btn.addEventListener("click", () => dispatch(key));
      rowEl.appendChild(btn);
      keyEls.set(key, btn);
    }
    container.appendChild(rowEl);
  }

  function dispatch(key) {
    if (key === "ENTER") onKey({ type: "enter" });
    else if (key === "BACK") onKey({ type: "backspace" });
    else onKey({ type: "letter", value: key });
  }

  function onPhysical(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") dispatch("ENTER");
    else if (e.key === "Backspace") dispatch("BACK");
    else if (/^[a-zA-Z]$/.test(e.key)) dispatch(e.key.toUpperCase());
  }
  document.addEventListener("keydown", onPhysical);

  return {
    // Apply per-key colors from a guess result.
    applyResult(guess, marks) {
      for (let i = 0; i < guess.length; i++) {
        const el = keyEls.get(guess[i]);
        if (!el) continue;
        const current = el.dataset.state;
        if (!current || RANK[marks[i]] > RANK[current]) {
          el.dataset.state = marks[i];
          el.classList.remove("correct", "present", "absent");
          el.classList.add(marks[i]);
        }
      }
    },
    destroy() {
      document.removeEventListener("keydown", onPhysical);
    },
  };
}
