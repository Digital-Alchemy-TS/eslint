import { CreateApplication } from "./da.mts";
import { UnusedLonelyService, UnusedOtherService } from "./unused.service.mts";

// "lonely" is in priorityInit but no sibling construction-reads it.
export const UNUSED_APP = CreateApplication({
  name: "unused_app",
  priorityInit: ["lonely"],
  services: {
    lonely: UnusedLonelyService,
    other: UnusedOtherService,
  },
});
