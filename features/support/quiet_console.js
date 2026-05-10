/**
 * Keeps Cucumber output readable by suppressing expected app logging (route handlers,
 * fixtures). Set MILLRACE_TEST_VERBOSE=1 to show console output again.
 */
const verbose =
  process.env.MILLRACE_TEST_VERBOSE === "1" ||
  process.env.MILLRACE_TEST_VERBOSE === "true";

if (!verbose) {
  const noop = () => {};
  console.debug = noop;
  console.error = noop;
  console.info = noop;
  console.log = noop;
  console.warn = noop;
}
