import test from "node:test";
import assert from "node:assert/strict";
import { facing, sampleAnimation } from "../src/animation";
test("world movement maps to the four isometric camera facings", () => {
  assert.equal(facing(1, -2), "NE");
  assert.equal(facing(2, 1), "SE");
  assert.equal(facing(-1, 2), "SW");
  assert.equal(facing(-2, -1), "NW");
});
test("animation samples elapsed game time, wraps movement and holds final attack pose", () => {
  const frames = {
    NE: ["a", "b", "c", "d"],
    NW: ["mirrored-a", "mirrored-b", "mirrored-c", "mirrored-d"],
  };
  assert.equal(
    sampleAnimation({ frames, fps: 8, loop: true }, "NE", 0.51),
    "a",
  );
  assert.equal(
    sampleAnimation({ frames, fps: 8, loop: false }, "NW", 0.51),
    "mirrored-d",
  );
  assert.equal(sampleAnimation({ frames, fps: 8, loop: true }, "NE", -5), "a");
});
test("missing animations safely fall back; supplied facings use their own frames", () => {
  assert.equal(sampleAnimation(undefined, "SE", 1), undefined);
  assert.equal(
    sampleAnimation(
      { frames: { NE: [1, 2] }, directions: ["NE"], loop: true, fps: 2 },
      "SE",
      0.5,
    ),
    2,
  );
  assert.equal(sampleAnimation({ frames: { SE: [] } }, "SE", 0), undefined);
});
