# State

## T53 scanner-browser teardown flake

CI run 41901001884 attempt 1 failed `scanner-browser` at stage 8, detail 2, reason 0 (`Deadline`, not a `FixedFailure`). The scan race had already succeeded. `stopped(browsers[0])` returned, then `stopped(browsers[1])` threw.

`stopped()` stores any `Browser.close` miss, including the 5s close-event deadline, and rethrows it after the process group is already gone. A late close on the second Chrome is an expected CDP race. That deadline is now ignored only after the group is confirmed dead and the close event has been observed. A real CDP rejection, a non-zero exit, a process that survives `SIGKILL`, or a handler that never joins still fails the proof. The post-close handler join also outlasts the 5s CDP send bound so the last in-flight request cannot lose that race by a few milliseconds.
