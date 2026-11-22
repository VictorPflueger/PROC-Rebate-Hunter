// The session-cost estimate, out of the page's way: a module worker has a run-event bus of its own, so
// it can play every case's script at once (js/headless.js) while the page plays the one on screen. It
// gets the data from the page, plays the cases in the order given and posts each estimate back.

import { playHeadless } from "./headless.js";
import { estimateCost } from "./estimate.js";
import { getModel } from "./world.js";

self.onmessage = async ({ data }) => {
  globalThis.WORLD = data.world;
  globalThis.REFERENCE_CASES = data.referenceCases;
  for (const scenario of data.scenarios) {
    try {
      const events = await playHeadless(data.scripts[scenario.id], scenario.id);
      const e = estimateCost({ events, model: getModel(), scenario, today: data.today });
      self.postMessage({ id: scenario.id, eur: e.eur, calls: e.calls });
    } catch (err) {
      self.postMessage({ id: scenario.id, error: String(err?.message || err) });
    }
  }
};
