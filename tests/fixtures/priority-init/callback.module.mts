import { CreateApplication } from "./da.mts";
import { CallbackAService, CallbackBService } from "./callback.service.mts";

// svc_b is read only inside a lifecycle callback -> empty priorityInit is correct.
export const CALLBACK_APP = CreateApplication({
  name: "callback_app",
  priorityInit: [],
  services: {
    svc_a: CallbackAService,
    svc_b: CallbackBService,
  },
});
