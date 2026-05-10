Feature: Git subprocess and repo-path helpers
  Child env for non-interactive Git, formatted exec errors, safe relative paths, and
  serialized Git work on a data root.

  Scenario: gitChildEnv carries through GIT_EDITOR=true and disables prompts
    When I read the millrace gitChildEnv
    Then the gitChildEnv should set "GIT_EDITOR" to "true"
    And the gitChildEnv should set "GIT_TERMINAL_PROMPT" to "0"

  Scenario: formatGitExecError uses stderr when present
    When I format the git error with step "git pull" and JSON:
      """
      { "stderr": "fatal: not a git repository", "message": "spawn fail" }
      """
    Then the formatted git error should contain "git pull:"
    And the formatted git error should contain "fatal: not a git repository"

  Scenario: formatGitExecError falls back to "<step> failed." for empty error parts
    When I format the git error with step "git push" and JSON:
      """
      { "message": "" }
      """
    Then the formatted git error should equal "git push failed."

  Scenario: safeRepoRelativePath rejects empty input
    Given the integration data root is set
    When I call safeRepoRelativePath with "  "
    Then the safe repo path should be null

  Scenario: safeRepoRelativePath rejects parent-directory traversal
    Given the integration data root is set
    When I call safeRepoRelativePath with "../etc/passwd"
    Then the safe repo path should be null

  Scenario: safeRepoRelativePath rejects .git
    Given the integration data root is set
    When I call safeRepoRelativePath with ".git/config"
    Then the safe repo path should be null

  Scenario: safeRepoRelativePath normalises a tasks path
    Given the integration data root is set
    When I call safeRepoRelativePath with "tasks/test/FLOW-1.ini"
    Then the safe repo path should be "tasks/test/FLOW-1.ini"

  Scenario: safeRepoRelativePath converts backslashes to forward slashes
    Given the integration data root is set
    When I call safeRepoRelativePath with "tasks\\test\\FLOW-1.ini"
    Then the safe repo path should be "tasks/test/FLOW-1.ini"

  Scenario: runGitSerialized awaits chained tasks one at a time
    When I run two runGitSerialized tasks concurrently
    Then the runGitSerialized order should be "A1,A2,B1,B2"
