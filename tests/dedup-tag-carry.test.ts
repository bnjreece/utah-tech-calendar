import assert from "node:assert/strict";
import { test } from "node:test";
import { planTagCarries } from "../src/lib/dedup-tag-carry";

const HTW = "hard-tech-week";

test("an exact-title cluster hands a hidden row's week tag to the row it keeps", () => {
  /* Astra round 2: an older untagged Luma row and the official calendar's
     tagged calev- listing, same source, title and minute. The exact-title
     cluster keeps the older row and hides the tagged one. */
  const carries = planTagCarries(
    [["old-luma", "calev"]],
    new Set(["calev"]),
    new Map([
      ["old-luma", ["ai"]],
      ["calev", [HTW]],
    ]),
  );
  assert.deepEqual([...carries], [["old-luma", [HTW]]]);
});

test("overlapping clusters pass the tag to the final survivor", () => {
  /* Exact cluster keeps A, hides tagged B; the twin pass then hides A in
     favor of C. C ends up with the tag. */
  const carries = planTagCarries(
    [
      ["A", "B"],
      ["C", "A"],
    ],
    new Set(["A", "B"]),
    new Map([
      ["A", null],
      ["B", [HTW, "ai"]],
      ["C", []],
    ]),
  );
  assert.deepEqual([...carries], [["C", [HTW]]]);
});

test("a row dropped by two clusters reaches both survivors; only week tags move", () => {
  const carries = planTagCarries(
    [
      ["K1", "D"],
      ["K2", "D"],
      ["K3", "E"],
    ],
    new Set(["D", "E"]),
    new Map([
      ["K1", []],
      ["K2", [HTW]],
      ["K3", []],
      ["D", [HTW, "founders"]],
      ["E", ["ai"]],
    ]),
  );
  assert.deepEqual([...carries], [["K1", [HTW]]]);
});

test("nothing hidden, nothing carried", () => {
  assert.equal(planTagCarries([["a", "b"]], new Set(), new Map([["b", [HTW]]])).size, 0);
});
