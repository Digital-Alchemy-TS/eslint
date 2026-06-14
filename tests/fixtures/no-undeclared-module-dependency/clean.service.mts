import type { TServiceParams } from "./da.mts";

// Only references good_lib (declared) and framework injects — nothing to flag.
export function CleanService({ my_app, good_lib, config, logger }: TServiceParams) {
  void my_app;
  void good_lib;
  void logger;
  void config.good_lib.setting;
}
