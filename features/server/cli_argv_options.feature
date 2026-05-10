Feature: CLI options from argv
  Parses `--data-root` and an optional positional port from `process.argv`-style arrays.

  Scenario: empty argv yields nulls
    When I parse argv as JSON:
      """
      ["node", "server.js"]
      """
    Then the parsed CLI options should be:
      """
      { "port": null, "dataRoot": null }
      """

  Scenario: positional port number is captured
    When I parse argv as JSON:
      """
      ["node", "server.js", "9999"]
      """
    Then the CLI port should be 9999
    And the CLI dataRoot should be null

  Scenario: out-of-range positional port is ignored
    When I parse argv as JSON:
      """
      ["node", "server.js", "70000"]
      """
    Then the CLI port should be null

  Scenario: --data-root with following value
    When I parse argv as JSON:
      """
      ["node", "server.js", "--data-root", "/tmp/millrace-test"]
      """
    Then the CLI dataRoot should be the resolved path "/tmp/millrace-test"
    And the CLI port should be null

  Scenario: --data-root=value and a port
    When I parse argv as JSON:
      """
      ["node", "server.js", "--data-root=/tmp/millrace-x", "8080"]
      """
    Then the CLI dataRoot should be the resolved path "/tmp/millrace-x"
    And the CLI port should be 8080

  Scenario: --data-root with no value is skipped
    When I parse argv as JSON:
      """
      ["node", "server.js", "--data-root"]
      """
    Then the parsed CLI options should be:
      """
      { "port": null, "dataRoot": null }
      """

  Scenario: --data-root followed by another flag is skipped
    When I parse argv as JSON:
      """
      ["node", "server.js", "--data-root", "--other"]
      """
    Then the parsed CLI options should be:
      """
      { "port": null, "dataRoot": null }
      """

  Scenario: portFromArgv extracts only the port
    When I take the port via portFromArgv from argv as JSON:
      """
      ["node", "server.js", "--data-root", "/tmp/x", "5050"]
      """
    Then the CLI port should be 5050

  Scenario: non-array argv produces nulls
    When I parse argv that is not an array
    Then the parsed CLI options should be:
      """
      { "port": null, "dataRoot": null }
      """
