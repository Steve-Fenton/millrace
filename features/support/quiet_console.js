/**
 * Keeps Cucumber output readable by suppressing expected app logging (route handlers,
 * fixtures). Set MILLRACE_TEST_VERBOSE=1 to show console.error / console.warn again.
 */
const verbose =
  process.env.MILLRACE_TEST_VERBOSE === "1" ||
  process.env.MILLRACE_TEST_VERBOSE === "true";

if (!verbose) {
  const noop = () => {};
  console.error = noop;
  console.warn = noop;
}
