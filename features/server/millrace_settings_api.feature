Feature: Millrace admin detection
  Admin users are stored on `[users.N]` sections in `tasks/.millrace.ini` as `admin = true`.
  Legacy `[millrace] admin_email` is still honoured until users are saved without it.

  Scenario: local user matches Millrace admin when user has admin flag
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = owner@example.com
      name = Owner
      admin = true
      """
    And local user Mine is "owner@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should match Millrace admin

  Scenario: local user matches any Millrace admin when multiple admins exist
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = owner@example.com
      name = Owner
      admin = true

      [users.2]
      email = ops@example.com
      name = Ops
      admin = true
      """
    And local user Mine is "ops@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should match Millrace admin

  Scenario: local user matches Millrace admin from legacy admin_email
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini
      admin_email = owner@example.com

      [users.1]
      email = owner@example.com
      name = Owner
      """
    And local user Mine is "owner@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should match Millrace admin

  Scenario: local user does not match when Mine differs from admin users
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = owner@example.com
      name = Owner
      admin = true
      """
    And local user Mine is "other@example.com"
    When I check whether the local user matches Millrace admin
    Then the local user should not match Millrace admin

  Scenario: local user is a follower when Mine differs from admin users
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = owner@example.com
      name = Owner
      admin = true
      """
    And local user Mine is "other@example.com"
    When I check whether the local user is a non-owner Millrace follower
    Then the local user should be a non-owner Millrace follower

  Scenario: local user is a follower when Mine is unset
    Given the millrace catalog INI under the integration data root contains:
      """
      [millrace]
      boards = test.ini

      [users.1]
      email = owner@example.com
      name = Owner
      admin = true
      """
    When I check whether the local user is a non-owner Millrace follower
    Then the local user should be a non-owner Millrace follower
