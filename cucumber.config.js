export default {
  default: {
    paths: ["features/**/*.feature"],
    import: [
      "features/support/quiet_console.js",
      "features/step_definitions/**/*.js",
    ],
  },
};
