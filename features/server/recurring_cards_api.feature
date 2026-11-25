Feature: Recurring cards
  A card with `recurrence = <n> weeks|months` is copied into the board's To do
  column (the first `type = to_do` column, whatever its title) when its next
  action date arrives. The recurring card's next action date then moves to
  today plus the interval.

  Background:
    Given the Millrace integration server has profile "flow-board"
    And I write integration tasks localuser.ini:
      """
      [user]
      mine = owner@example.com
      """
    And the integration board "test" is defined as:
      """
      [board]
      name = Integration Test Board
      slug = test

      [columns.1]
      title = Ideas
      type = options

      [columns.2]
      title = Up next
      type = to_do

      [columns.3]
      title = Doing
      type = in_progress

      [columns.4]
      title = Done
      type = done
      """

  Scenario: a due recurring card spawns a copy in To do and rolls forward
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due 3 days ago repeating "2 weeks"
    When I send a GET request to "/api/board?boardSlug=test"
    Then the response status should be 200
    And the integration board "test" should have 2 card files
    And the recurring card "FLOW-rec.ini" on board "test" should have next action date 14 days from today
    And the recurring card "FLOW-rec.ini" on board "test" should still have recurrence "2 weeks"
    And the spawned copy of "FLOW-rec.ini" on board "test" should be in column "Up next"
    And the spawned copy of "FLOW-rec.ini" on board "test" should have next action date 3 days ago
    And the spawned copy of "FLOW-rec.ini" on board "test" should not be recurring
    And the spawned copy of "FLOW-rec.ini" on board "test" should keep the title, owner and links
    And the spawned copy of "FLOW-rec.ini" on board "test" should link to its source card
    When I send a GET request to "/api/board?boardSlug=test"
    Then the integration board "test" should have 2 card files

  Scenario: monthly recurrence rolls forward by calendar months
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due 0 days ago repeating "1 months"
    When I send a GET request to "/api/board?boardSlug=test"
    Then the integration board "test" should have 2 card files
    And the recurring card "FLOW-rec.ini" on board "test" should have next action date 1 month from today

  Scenario: a recurring card that is not yet due is left alone
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due -1 days ago repeating "1 weeks"
    When I send a GET request to "/api/board?boardSlug=test"
    Then the integration board "test" should have 1 card files

  Scenario: recurring cards owned by someone else are not spawned
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due 3 days ago repeating "2 weeks"
    And I write integration tasks localuser.ini:
      """
      [user]
      mine = colleague@example.com
      """
    When I send a GET request to "/api/board?boardSlug=test"
    Then the integration board "test" should have 1 card files

  Scenario: no recurring cards are spawned when the local user is not set
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due 3 days ago repeating "2 weeks"
    And I write integration tasks localuser.ini:
      """
      [user]
      owner = owner@example.com
      """
    When I send a GET request to "/api/board?boardSlug=test"
    Then the integration board "test" should have 1 card files

  Scenario: PUT sets and clears the recurrence
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due -5 days ago repeating ""
    When I put card "FLOW-rec.ini" in column 1 on board "test" with owner "owner@example.com" and recurrence "3 weeks"
    Then the response status should be 200
    And the recurring card "FLOW-rec.ini" on board "test" should still have recurrence "3 weeks"
    When I put card "FLOW-rec.ini" in column 1 on board "test" with owner "owner@example.com" and recurrence ""
    Then the response status should be 200
    And the recurring card "FLOW-rec.ini" on board "test" should still have recurrence ""

  Scenario: PUT rejects a recurring card without an owner
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due -5 days ago repeating ""
    When I put card "FLOW-rec.ini" in column 1 on board "test" with owner "" and recurrence "3 weeks"
    Then the response status should be 400
    And the recurring card "FLOW-rec.ini" on board "test" should still have recurrence ""

  Scenario: PUT rejects removing the owner from a recurring card
    Given the integration board "test" has a recurring card "FLOW-rec.ini" in column "Ideas" due -5 days ago repeating "2 weeks"
    When I put card "FLOW-rec.ini" in column 1 on board "test" with owner "" and no recurrence change
    Then the response status should be 400
    And the recurring card "FLOW-rec.ini" on board "test" should still have recurrence "2 weeks"
