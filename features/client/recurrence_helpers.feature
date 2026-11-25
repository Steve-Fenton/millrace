@recurrence_helpers
Feature: Recurrence helpers
  Recurring cards store `recurrence = <n> weeks|months` in the card INI. The
  helpers parse that value and step dates forward by the interval.

  Scenario Outline: parse recurrence text
    When I parse the recurrence "<raw>"
    Then the recurrence INI value should be "<ini>"
    And the recurrence label should be "<label>"

    Examples:
      | raw        | ini       | label          |
      | 2 weeks    | 2 weeks   | Every 2 weeks  |
      | 1 week     | 1 weeks   | Every week     |
      | 1 month    | 1 months  | Every month    |
      | 3 Months   | 3 months  | Every 3 months |
      | 0 weeks    |           |                |
      | fortnight  |           |                |
      |            |           |                |

  Scenario Outline: add the interval to a date
    Then adding "<recurrence>" to "<from>" should give "<to>"

    Examples:
      | recurrence | from       | to         |
      | 2 weeks    | 2026-11-25 | 2026-12-09 |
      | 1 weeks    | 2026-12-28 | 2027-01-04 |
      | 1 months   | 2026-01-31 | 2026-02-28 |
      | 1 months   | 2028-01-31 | 2028-02-29 |
      | 3 months   | 2026-11-25 | 2027-02-25 |
      | 12 months  | 2026-03-15 | 2027-03-15 |

  Scenario: the copy goes to the first To do column whatever it is called
    Then the recurring target column for columns "options:Ideas,to_do:Up next,in_progress:Doing,done:Done" should be 2
    And the recurring target column for columns "options:Ideas,in_progress:Doing,done:Done" should be 1

  Scenario: only open recurring cards on or past their date are due
    Then a recurring item with next action "2026-11-25" and recurrence "2 weeks" should be due on "2026-11-25"
    And a recurring item with next action "2026-11-20" and recurrence "2 weeks" should be due on "2026-11-25"
    And a recurring item with next action "2026-11-26" and recurrence "2 weeks" should not be due on "2026-11-25"
    And a recurring item with next action "2026-11-20" and recurrence "" should not be due on "2026-11-25"
    And a closed recurring item with next action "2026-11-20" and recurrence "2 weeks" should not be due on "2026-11-25"

  Scenario: only cards owned by the local user are due
    Then a recurring item owned by "me@example.com" due "2026-11-20" should be due on "2026-11-25"
    And a recurring item owned by "ME@Example.com" due "2026-11-20" should be due on "2026-11-25"
    And a recurring item owned by "colleague@example.com" due "2026-11-20" should not be due on "2026-11-25"
    And a recurring item owned by "" due "2026-11-20" should not be due on "2026-11-25"
