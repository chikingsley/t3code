import type { LiveActivity } from "expo-widgets";
import type { AgentActivityProps } from "./AgentActivity.types";

export type {
  AgentActivityPhase,
  AgentActivityProps,
  AgentActivityRowProps,
} from "./AgentActivity.types";

const AgentActivity = {
  getInstances: (): ReadonlyArray<LiveActivity<AgentActivityProps>> => [],
  start: (_props: AgentActivityProps): LiveActivity<AgentActivityProps> => {
    throw new Error("Live Activities require the iOS client");
  },
};

export default AgentActivity;
