import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { powerOffBattlefield } from "./apply.ts";
import { loadRules, rule } from "./corpus.ts";

describe("comprehensive rules", () => {
  it("indexes the ingested September 2026 rules", () => {
    const loaded = loadRules();
    assert.match(loaded.effective, /September 25, 2026/);
    assert.ok(loaded.rules.size > 2500);
    assert.match(rule("113.6") ?? "", /only while that object is on the battlefield/);
    assert.match(rule("604.3") ?? "", /function in all zones/);
    assert.match(rule("604.3a") ?? "", /characteristic-defining ability if it meets the following criteria/);
    assert.match(rule("613.4c") ?? "", /modify power and\/or toughness/);
    assert.match(rule("707.2") ?? "", /copiable values/);
  });

  it("uses 113.6 for a gets ability and 604.3 when power is defined", () => {
    const shadow = powerOffBattlefield("Death's Shadow gets -X/-X, where X is your life total.", "13");
    assert.equal(shadow.usePrinted, true);
    assert.ok(shadow.rules.includes("113.6"));
    const goyf = powerOffBattlefield(
      "Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.",
      "*",
    );
    assert.equal(goyf.usePrinted, false);
    assert.ok(goyf.rules.includes("604.3"));
  });
});
