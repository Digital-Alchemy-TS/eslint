import type { TServiceParams } from "./da.mts";

// Reads svc_b only INSIDE a lifecycle callback -> NOT a construction read,
// so svc_b does not need to be in priorityInit.
export function CallbackAService({ callback_app, lifecycle }: TServiceParams) {
  lifecycle.onBootstrap(() => {
    callback_app.svc_b.run();
  });
}

export function CallbackBService({ callback_app }: TServiceParams) {
  void callback_app;
}
