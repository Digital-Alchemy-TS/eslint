import type { TServiceParams } from "./da.mts";

// good_lib is declared (libraries); bad_lib is NOT. logger is a framework inject.
export function ApiService({ my_app, good_lib, bad_lib, config, logger }: TServiceParams) {
  void my_app;
  void good_lib;
  void bad_lib;
  void logger;
  void config.good_lib.setting;
  void config.bad_lib.setting;
}
