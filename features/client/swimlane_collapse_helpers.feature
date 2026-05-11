Feature: Swimlane collapse helpers
  Normalise modes, cycle states, parse INI sections, and apply updates for
  per-board swimlane collapse preferences stored in `tasks/localuser.ini`.
  Storage is keyed by swimlane title; a legacy numeric-index form is still
  recognised when reading.

  Scenario: normalize unknown mode defaults to open
    When I normalize swimlane collapse mode "weird"
    Then the swimlane collapse mode should be "open"

  Scenario: normalize accepts scroll and collapsed
    When I normalize swimlane collapse mode "scroll"
    Then the swimlane collapse mode should be "scroll"
    When I normalize swimlane collapse mode "COLLAPSED"
    Then the swimlane collapse mode should be "collapsed"

  Scenario: nextSwimlaneCollapseMode cycles open then scroll then collapsed
    When I cycle the swimlane collapse mode starting at "open"
    Then the cycled modes should be "scroll,collapsed,open"

  Scenario: isSwimlaneTitleStorable accepts normal titles
    Then the swimlane title "Bugs / UX" should be storable
    And the swimlane title "Default" should be storable

  Scenario: isSwimlaneTitleStorable rejects unsafe titles
    Then the swimlane title "" should not be storable
    And the swimlane title "with = equals" should not be storable
    And the swimlane title "with [brackets]" should not be storable
    And the swimlane title "; comment" should not be storable

  Scenario: readSwimlaneCollapseStates preserves title keys
    When I read swimlane collapse states from sections JSON:
      """
      {
        "user": { "owner": "owner@example.com" },
        "swimlanes.demo": { "Default": "scroll", "Desserts": "collapsed" },
        "swimlanes.project": { "Bugs / UX": "scroll" }
      }
      """
    Then the parsed swimlane collapse states should deeply equal JSON:
      """
      {
        "demo": { "Default": "scroll", "Desserts": "collapsed" },
        "project": { "Bugs / UX": "scroll" }
      }
      """

  Scenario: readSwimlaneCollapseStates preserves legacy numeric keys
    When I read swimlane collapse states from sections JSON:
      """
      {
        "swimlanes.demo": { "0": "scroll", "Desserts": "collapsed" }
      }
      """
    Then the parsed swimlane collapse states should deeply equal JSON:
      """
      { "demo": { "0": "scroll", "Desserts": "collapsed" } }
      """

  Scenario: readSwimlaneCollapseStates ignores open values
    When I read swimlane collapse states from sections JSON:
      """
      {
        "swimlanes.demo": { "Default": "open", "Bugs": "scroll" }
      }
      """
    Then the parsed swimlane collapse states should deeply equal JSON:
      """
      { "demo": { "Bugs": "scroll" } }
      """

  Scenario: swimlaneCollapseModeForLane matches title first
    When I look up swimlane mode JSON:
      """
      {
        "laneMap": { "Bugs / UX": "scroll", "0": "collapsed" },
        "lane": { "index": 0, "title": "Bugs / UX" }
      }
      """
    Then the looked-up swimlane mode should be "scroll"

  Scenario: swimlaneCollapseModeForLane matches case-insensitively
    When I look up swimlane mode JSON:
      """
      {
        "laneMap": { "DESSERTS": "collapsed" },
        "lane": { "index": 1, "title": "Desserts" }
      }
      """
    Then the looked-up swimlane mode should be "collapsed"

  Scenario: swimlaneCollapseModeForLane falls back to legacy numeric index
    When I look up swimlane mode JSON:
      """
      {
        "laneMap": { "1": "scroll" },
        "lane": { "index": 1, "title": "Bugs / UX" }
      }
      """
    Then the looked-up swimlane mode should be "scroll"

  Scenario: swimlaneCollapseModeForLane returns open when nothing matches
    When I look up swimlane mode JSON:
      """
      {
        "laneMap": { "Other": "scroll" },
        "lane": { "index": 2, "title": "Bugs / UX" }
      }
      """
    Then the looked-up swimlane mode should be "open"

  Scenario: applySwimlaneCollapseUpdate writes scroll keyed by title
    When I apply swimlane collapse update JSON to empty sections:
      """
      { "boardSlug": "project", "laneTitle": "Bugs / UX", "mode": "scroll" }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.project": { "Bugs / UX": "scroll" } }
      """

  Scenario: applySwimlaneCollapseUpdate clears entry when set to open
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.demo": { "Default": "scroll", "Desserts": "collapsed" } },
        "update": { "boardSlug": "demo", "laneTitle": "Desserts", "mode": "open" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.demo": { "Default": "scroll" } }
      """

  Scenario: applySwimlaneCollapseUpdate removes empty section when last entry cleared
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.demo": { "Default": "scroll" } },
        "update": { "boardSlug": "demo", "laneTitle": "Default", "mode": "open" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      {}
      """

  Scenario: applySwimlaneCollapseUpdate replaces legacy numeric key with title
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.project": { "1": "scroll" } },
        "update": { "boardSlug": "project", "laneTitle": "Bugs / UX", "laneIndex": 1, "mode": "collapsed" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.project": { "Bugs / UX": "collapsed" } }
      """

  Scenario: applySwimlaneCollapseUpdate ignores unsafe titles
    When I apply swimlane collapse update JSON to empty sections:
      """
      { "boardSlug": "demo", "laneTitle": "with = equals", "mode": "scroll" }
      """
    Then the updated sections JSON should deeply equal:
      """
      {}
      """
