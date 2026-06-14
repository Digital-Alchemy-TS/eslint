import { CreateApplication } from "./da.mts";
import { GoodApiService, GoodDbService } from "./good.service.mts";

// db is construction-read by api, listed in priorityInit, and wires first.
export const GOOD_APP = CreateApplication({
  name: "good_app",
  priorityInit: ["db"],
  services: {
    api: GoodApiService,
    db: GoodDbService,
  },
});
