// A live run: the unchanged live agent (js/agent.js) on the visitor's key, on the case's tip, loaded only
// when Start agent asks for it. Its events reach the page on the bus, as the simulation's do.
//
// The page's security policy lets it connect to api.anthropic.com alone, so GLEIF, Wikidata and the
// ECB rates, which the agent's open-data tools would fetch from the browser, are marked as unavailable
// before the run: the tools then say so at once, and the agent confirms what it finds with Claude's own
// web search, which runs on Anthropic's side.

import { createLiveAgent } from "./agent.js";
import { forgetKey } from "./keystore.js";
import { remember } from "./source_health.js";
import { DEFAULT_MODEL } from "./config.js";

export function startLive({ scenario, onEnd, onWebSearchOff }) {
  for (const id of ["gleif", "wikidata", "frankfurter"]) remember(id, "fail", "this page connects only to the model API", "tool");
  let web = "unknown";
  const agent = createLiveAgent({
    getWebSearchState: () => web,
    onKeyRejected: () => forgetKey(),
    onWebSearchUnavailable: () => { web = "unavailable"; onWebSearchOff?.(); }
  });
  agent.run({ entry: "scenario", scenario, modelId: DEFAULT_MODEL }).finally(() => onEnd?.());
  return { abort: (reason) => agent.abort(reason), isActive: () => agent.isActive() };
}
