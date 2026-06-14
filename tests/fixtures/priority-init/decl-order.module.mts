import { CreateApplication } from "./da.mts";
import { DeclOrderApiService, DeclOrderDbService } from "./decl-order.service.mts";

// db is construction-read by api, but declared first -> declaration order wires
// it first, so an empty priorityInit is correct (no require-priority-init fault).
export const DECLORDER_APP = CreateApplication({
  name: "declorder_app",
  priorityInit: [],
  services: {
    db: DeclOrderDbService,
    api: DeclOrderApiService,
  },
});
