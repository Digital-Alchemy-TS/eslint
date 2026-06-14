import { CreateApplication } from "./da.mts";
import { GOOD_LIB } from "./good-lib.module.mts";
import { ApiService } from "./api.service.mts";
import { CleanService } from "./clean.service.mts";

// Declares good_lib but NOT bad_lib.
export const MY_APP = CreateApplication({
  name: "my_app",
  libraries: [GOOD_LIB],
  services: {
    api: ApiService,
    clean: CleanService,
  },
});
