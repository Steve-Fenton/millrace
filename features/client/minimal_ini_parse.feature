Feature: parseIni
  Minimal INI parsing: [sections], key = value lines, ; comments, implicit _root.

  Scenario: empty document yields only _root
    Given the INI text is:
      """
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{}}
      """

  Scenario: whitespace-only lines are ignored
    Given the INI text is:
      """

        
      	
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{}}
      """

  Scenario: semicolon comments are skipped
    Given the INI text is:
      """
      ; leading comment
      ; another
      alpha = 1
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"alpha":"1"}}
      """

  Scenario: keys at root before any section
    Given the INI text is:
      """
      one = first
      two = second
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"one":"first","two":"second"}}
      """

  Scenario: section headers create buckets
    Given the INI text is:
      """
      [item]
      title = Hello
      owner = a@b.c
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{},"item":{"title":"Hello","owner":"a@b.c"}}
      """

  Scenario: multiple sections and root keys together
    Given the INI text is:
      """
      board = demo
      [columns.1]
      title = To Do
      [columns.2]
      title = Done
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"board":"demo"},"columns.1":{"title":"To Do"},"columns.2":{"title":"Done"}}
      """

  Scenario: lines without equals sign are ignored
    Given the INI text is:
      """
      not a key line
      real = value
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"real":"value"}}
      """

  Scenario: value may contain equals signs
    Given the INI text is:
      """
      url = https://example.com?q=1&r=2
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"url":"https://example.com?q=1&r=2"}}
      """

  Scenario: keys and values are trimmed
    Given the INI text is:
      """
        spaced  =  out
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"spaced":"out"}}
      """

  Scenario: later duplicate key overwrites in the same section
    Given the INI text is:
      """
      x = one
      x = two
      """
    When I parse with parseIni
    Then the parsed JSON should be:
      """
      {"_root":{"x":"two"}}
      """
