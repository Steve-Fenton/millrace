# Does not contact registry.npmjs.org: steps always pass opts.fetchLatest into runNpmUpdateCheck.
# npm test sets MILLRACE_TESTS_DISABLE_REGISTRY_FETCH so accidental default registry fetch throws.

Feature: NPM update check and project cycle helpers
  Registry cooldown, detecting a `cycle` script in package.json, semver comparisons,
  lockfile drift, and running install/cycle (pnpm mocked in tests).

  Scenario: runNpmUpdateCheck skips registry fetch within cooldown
    Given the npm cycle fixture data root is prepared
    And localuser.ini records last npm update check one hour before fixed test time
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0",
        "dataRootHasGit": true
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm update result checkedRegistry should be false
    And npm update result latestVersion should be null

  Scenario: runNpmUpdateCheck calls registry when cooldown elapsed
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "0.0.100"
      }
      """
    Then npm update fetchLatest call count should be at least 1
    And npm update result checkedRegistry should be true
    And npm update result latestVersion should be "0.0.100"

  Scenario: runNpmUpdateCheck sets updateAvailable from semver vs installed meta
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "0.0.1"
      }
      """
    Then npm update result updateAvailable should match semver "0.0.1" vs installed

  Scenario: runNpmUpdateCheck exposes projectHasCycleScript from data root package.json
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    And package.json includes a cycle script for the npm cycle fixture
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "1.0.0"
      }
      """
    Then npm update result projectHasCycleScript should be true

  Scenario: readProjectHasCycleScript is false without package.json
    Given the npm cycle fixture data root is prepared
    When I read project has cycle script flag
    Then project has cycle script should be false

  Scenario: readProjectHasCycleScript is false when cycle script is missing
    Given the npm cycle fixture data root is prepared
    And package.json has empty scripts for the npm cycle fixture
    When I read project has cycle script flag
    Then project has cycle script should be false

  Scenario: runProjectCycleAfterUserConfirm returns no_package_json
    Given the npm cycle fixture data root is prepared
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "no_package_json"

  Scenario: runProjectCycleAfterUserConfirm returns no_cycle_script
    Given the npm cycle fixture data root is prepared
    And package.json has empty scripts for the npm cycle fixture
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "no_cycle_script"

  Scenario: runProjectCycleAfterUserConfirm returns invalid_package_json
    Given the npm cycle fixture data root is prepared
    And package.json is invalid JSON for the npm cycle fixture
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "invalid_package_json"

  Scenario: runProjectCycleAfterUserConfirm succeeds with mocked pnpm and writes ini
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to succeed
    When I run project cycle after confirm for version "2.3.4"
    Then project cycle result ok should be true
    And localuser.ini should record npm_auto_cycle_for as "2.3.4"
    And mocked pnpm should have run update-latest then cycle

  Scenario: runProjectCycleAfterUserConfirm commits package.json + pnpm-lock.yaml after pnpm update
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to succeed
    And project cycle git artifact committer is mocked
    When I run project cycle after confirm for version "2.3.4"
    Then project cycle result ok should be true
    And the pnpm artifact committer should have been called once with message "Millrace: pnpm update --latest (registry v2.3.4)"

  Scenario: runProjectCycleAfterUserConfirm skips the artifact commit when pnpm update fails
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to fail on first call
    And project cycle git artifact committer is mocked
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And the pnpm artifact committer should not have been called

  Scenario: runProjectCycleAfterUserConfirm returns pnpm_failed when mock rejects
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to fail on first call
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "pnpm_failed"

  Scenario: runNpmUpdateCheck reports lockfileOutOfSync when millrace specifier differs
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    And package.json depends on millrace "^1.0.1" with a cycle script
    And pnpm-lock.yaml pins millrace specifier "^1.0.0" at version "1.0.0"
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "1.0.0"
      }
      """
    Then npm update result lockfileOutOfSync should be true

  Scenario: runNpmUpdateCheck reports lockfileOutOfSync false when millrace matches lock
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    And package.json depends on millrace "^1.0.0" with a cycle script
    And pnpm-lock.yaml pins millrace specifier "^1.0.0" at version "1.0.0"
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "1.0.0"
      }
      """
    Then npm update result lockfileOutOfSync should be false

  Scenario: runNpmUpdateCheck still evaluates lock drift within registry cooldown
    Given the npm cycle fixture data root is prepared
    And localuser.ini records last npm update check one hour before fixed test time
    And package.json depends on millrace "^1.0.1" with a cycle script
    And pnpm-lock.yaml pins millrace specifier "^1.0.0" at version "1.0.0"
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0",
        "dataRootHasGit": true
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm update result lockfileOutOfSync should be true

  Scenario: runNpmUpdateCheck pulls and installs before the registry check
    Given the npm cycle fixture data root is prepared
    And localuser.ini is absent for the npm cycle fixture
    And package.json includes a cycle script for the npm cycle fixture
    And npm update prepare git pull is mocked
    And npm update prepare pnpm is mocked
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "0.0.100",
        "runPrepare": true,
        "dataRootHasGit": true
      }
      """
    Then npm update prepare git pull call count should be 1
    And npm update prepare pnpm call count should be 1
    And localuser.ini should record last_auto_git_pull at fixed test time
    And npm update fetchLatest call count should be at least 1

  Scenario: runNpmUpdateCheck skips prepare within git pull cooldown
    Given the npm cycle fixture data root is prepared
    And localuser.ini records last automatic git pull one hour before fixed test time
    And package.json includes a cycle script for the npm cycle fixture
    And npm update prepare git pull is mocked
    And npm update prepare pnpm is mocked
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "0.0.100",
        "runPrepare": true,
        "dataRootHasGit": true
      }
      """
    Then npm update prepare git pull call count should be 0
    And npm update prepare pnpm call count should be 0

  Scenario: runNpmUpdateCheck follower pulls and runs install cycle when behind owner
    Given the npm cycle fixture data root is prepared
    And local user Mine does not match Millrace admin for the npm cycle fixture
    And package.json depends on millrace "^1.0.0" with a cycle script
    And pnpm-lock.yaml pins millrace specifier "^1.0.0" at version "1.0.1"
    And data root node_modules millrace version is "1.0.0"
    And npm update prepare git pull is mocked
    And npm follower install cycle is mocked
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0",
        "dataRootHasGit": true
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm update prepare git pull call count should be 1
    And npm follower install cycle call count should be 1
    And npm update result followerSyncRan should be true
    And npm update result checkedRegistry should be false

  Scenario: runNpmUpdateCheck follower skips install when already synced
    Given the npm cycle fixture data root is prepared
    And local user Mine does not match Millrace admin for the npm cycle fixture
    And package.json depends on millrace "^1.0.0" with a cycle script
    And pnpm-lock.yaml pins millrace specifier "^1.0.0" at version "1.0.1"
    And data root node_modules millrace version is "1.0.1"
    And npm update prepare git pull is mocked
    And npm follower install cycle is mocked
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0",
        "dataRootHasGit": true
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm follower install cycle call count should be 0
    And npm update result followerSyncRan should be false

  Scenario: runProjectInstallThenCycle succeeds with mocked pnpm
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to succeed
    When I run project install cycle after confirm
    Then project cycle result ok should be true
    And mocked pnpm should have run install then cycle

  Scenario: runProjectInstallThenCycle commits package.json + pnpm-lock.yaml after pnpm install
    Given the npm cycle fixture data root is prepared
    And package.json includes a cycle script for the npm cycle fixture
    And project cycle pnpm is mocked to succeed
    And project cycle git artifact committer is mocked
    When I run project install cycle after confirm
    Then project cycle result ok should be true
    And the pnpm artifact committer should have been called once with message "Millrace: pnpm install (sync lockfile)"
