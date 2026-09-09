@checklist_progress
Feature: Markdown checklist progress detection
  Detect GitHub style checklist items (`- [ ]` / `- [x]`) in markdown text and compute completion progress.

  Scenario: detect checklist progress with completed and remaining tasks
    Given markdown text for checklist progress is:
      """
      # Project Plan
      - [ ] Still todo
      - [x] This is done
      * [X] Upper case checked
      * [ ] Bullet star todo
      """
    When I parse checklist progress
    Then checklist progress total should be 4
    And checklist progress completed should be 2
    And checklist progress percent should be 50

  Scenario: ignore checklist items inside code blocks
    Given markdown text for checklist progress is:
      """
      - [x] Real task done
      ```markdown
      - [ ] Fake task in code block
      ```
      - [ ] Real task pending
      """
    When I parse checklist progress
    Then checklist progress total should be 2
    And checklist progress completed should be 1
    And checklist progress percent should be 50

  Scenario: return null when no checklist items exist
    Given markdown text for checklist progress is:
      """
      # Just description
      No checklist items here.
      - bullet without checkbox
      """
    When I parse checklist progress
    Then checklist progress should be null
