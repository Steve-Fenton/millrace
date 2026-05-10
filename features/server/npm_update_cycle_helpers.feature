# Does not contact registry.npmjs.org: steps always pass opts.fetchLatest into runNpmUpdateCheck.
# npm test sets MILLRACE_TESTS_DISABLE_REGISTRY_FETCH so accidental default registry fetch throws.

Feature: npmUpdateCheck and projectCycleAfterUpdate
  Registry cooldown logic, package.json cycle detection,
  and project-cycle results (pnpm mocked in tests).

  Scenario: runNpmUpdateCheck skips registry fetch within cooldown
    Given npm unit data root is prepared
    And npm unit localuser.ini contains last_npm_update_check 1 hour before fixed now
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0"
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm update result checkedRegistry should be false
    And npm update result latestVersion should be null

  Scenario: runNpmUpdateCheck calls registry when cooldown elapsed
    Given npm unit data root is prepared
    And npm unit tasks localuser.ini is absent
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
    Given npm unit data root is prepared
    And npm unit tasks localuser.ini is absent
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
    Given npm unit data root is prepared
    And npm unit tasks localuser.ini is absent
    And npm unit package.json contains cycle script
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
    Given npm unit data root is prepared
    When I read project has cycle script flag
    Then project has cycle script should be false

  Scenario: readProjectHasCycleScript is false when cycle script is missing
    Given npm unit data root is prepared
    And npm unit package.json has empty scripts
    When I read project has cycle script flag
    Then project has cycle script should be false

  Scenario: runProjectCycleAfterUserConfirm returns no_package_json
    Given npm unit data root is prepared
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "no_package_json"

  Scenario: runProjectCycleAfterUserConfirm returns no_cycle_script
    Given npm unit data root is prepared
    And npm unit package.json has empty scripts
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "no_cycle_script"

  Scenario: runProjectCycleAfterUserConfirm returns invalid_package_json
    Given npm unit data root is prepared
    And npm unit package.json is invalid JSON
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "invalid_package_json"

  Scenario: runProjectCycleAfterUserConfirm succeeds with mocked pnpm and writes ini
    Given npm unit data root is prepared
    And npm unit package.json contains cycle script
    And project cycle pnpm is mocked to succeed
    When I run project cycle after confirm for version "2.3.4"
    Then project cycle result ok should be true
    And npm unit flow npm_auto_cycle_for should be "2.3.4"
    And mocked pnpm should have run update-latest then cycle

  Scenario: runProjectCycleAfterUserConfirm returns pnpm_failed when mock rejects
    Given npm unit data root is prepared
    And npm unit package.json contains cycle script
    And project cycle pnpm is mocked to fail on first call
    When I run project cycle after confirm for version "1.0.0"
    Then project cycle result ok should be false
    And project cycle result reason should be "pnpm_failed"

  Scenario: runNpmUpdateCheck reports lockfileOutOfSync when millrace specifier differs
    Given npm unit data root is prepared
    And npm unit tasks localuser.ini is absent
    And npm unit package.json has millrace "^1.0.1" and cycle script
    And npm unit pnpm-lock.yaml locks millrace specifier "^1.0.0" version "1.0.0"
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
    Given npm unit data root is prepared
    And npm unit tasks localuser.ini is absent
    And npm unit package.json has millrace "^1.0.0" and cycle script
    And npm unit pnpm-lock.yaml locks millrace specifier "^1.0.0" version "1.0.0"
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
    Given npm unit data root is prepared
    And npm unit localuser.ini contains last_npm_update_check 1 hour before fixed now
    And npm unit package.json has millrace "^1.0.1" and cycle script
    And npm unit pnpm-lock.yaml locks millrace specifier "^1.0.0" version "1.0.0"
    When I run npm update check with JSON:
      """
      {
        "nowMs": 1704193200000,
        "intervalMs": 86400000,
        "registryLatest": "99.0.0"
      }
      """
    Then npm update fetchLatest call count should be 0
    And npm update result lockfileOutOfSync should be true

  Scenario: runProjectInstallThenCycle succeeds with mocked pnpm
    Given npm unit data root is prepared
    And npm unit package.json contains cycle script
    And project cycle pnpm is mocked to succeed
    When I run project install cycle after confirm
    Then project cycle result ok should be true
    And mocked pnpm should have run install then cycle
