// Wordle color scoring (standard two-pass algorithm with duplicate-letter handling).
//
// Returns an array of 5 marks, one per guess position:
//   "correct" — right letter, right position (green)
//   "present" — letter is in the answer but in another position (yellow)
//   "absent"  — letter is not in the answer (or all its instances are already accounted for)
//
// Both `answer` and `guess` are expected to be 5-letter uppercase strings.
export function score(answer, guess) {
  const result = new Array(5).fill("absent");
  const counts = {};

  // Pass 1: lock in greens and tally the remaining answer letters.
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    }
  }

  // Pass 2: assign yellows from the leftover pool, left to right.
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    const c = guess[i];
    if (counts[c] > 0) {
      result[i] = "present";
      counts[c]--;
    }
  }

  return result;
}

export function isSolved(marks) {
  return marks.every((m) => m === "correct");
}
