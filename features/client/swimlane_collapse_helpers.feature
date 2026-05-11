Feature: Swimlane collapse helpers
  Normalise modes, cycle states, parse INI sections, and apply updates for
  per-board swimlane collapse preferences stored in `tasks/localuser.ini`.

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

  Scenario: readSwimlaneCollapseStates parses [swimlanes.slug] sections
    When I read swimlane collapse states from sections JSON:
      """
      {
        "user": { "owner": "owner@example.com" },
        "swimlanes.demo": { "0": "scroll", "1": "collapsed" },
        "swimlanes.project": { "lane_0": "scroll" }
      }
      """
    Then the parsed swimlane collapse states should deeply equal JSON:
      """
      {
        "demo": { "0": "scroll", "1": "collapsed" },
        "project": { "0": "scroll" }
      }
      """

  Scenario: readSwimlaneCollapseStates ignores open values and invalid keys
    When I read swimlane collapse states from sections JSON:
      """
      {
        "swimlanes.demo": { "0": "open", "1": "scroll", "two": "scroll" }
      }
      """
    Then the parsed swimlane collapse states should deeply equal JSON:
      """
      { "demo": { "1": "scroll" } }
      """

  Scenario: applySwimlaneCollapseUpdate writes scroll for a lane
    When I apply swimlane collapse update JSON to empty sections:
      """
      { "boardSlug": "demo", "laneIndex": 1, "mode": "scroll" }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.demo": { "1": "scroll" } }
      """

  Scenario: applySwimlaneCollapseUpdate clears entry when set to open
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.demo": { "0": "scroll", "1": "collapsed" } },
        "update": { "boardSlug": "demo", "laneIndex": 1, "mode": "open" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.demo": { "0": "scroll" } }
      """

  Scenario: applySwimlaneCollapseUpdate removes empty section when last entry cleared
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.demo": { "0": "scroll" } },
        "update": { "boardSlug": "demo", "laneIndex": 0, "mode": "open" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      {}
      """

  Scenario: applySwimlaneCollapseUpdate normalises prior lane_N keys
    When I apply swimlane collapse update JSON to sections JSON:
      """
      {
        "sections": { "swimlanes.demo": { "lane_0": "scroll" } },
        "update": { "boardSlug": "demo", "laneIndex": 0, "mode": "collapsed" }
      }
      """
    Then the updated sections JSON should deeply equal:
      """
      { "swimlanes.demo": { "0": "collapsed" } }
      """
