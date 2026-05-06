Feature: taskCardModel
  Section extraction, [item] body parsing, and full task card INI parsing.

  Scenario: extractSectionLines returns empty array when the section is missing
    Given the task card INI text is:
      """
      hello = world

      """
    When I extract section lines for "item"
    Then the extracted section lines JSON should be:
      """
      []
      """

  Scenario: extractSectionLines captures lines until the next bracket section
    Given the task card INI text is:
      """
      [item]
      id = a
      title = hello

      [link.1]
      text = L
      url = http://x

      """
    When I extract section lines for "item"
    Then the extracted section lines JSON should be:
      """
      ["id = a","title = hello",""]
      """

  Scenario: extractSectionLines splits on CRLF and still finds the section
    Given the task card INI text with CRLF newlines is:
      """
      [item]
      x = 1
      [link.1]
      text=a

      """
    When I extract section lines for "item"
    Then the extracted section lines JSON should be:
      """
      ["x = 1"]
      """

  Scenario: parseItemSectionLines reads simple keys and skips lines without equals
    Given the item section lines array JSON is:
      """
      ["id = 1","not a valid line","title = t"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"id":"1","title":"t"}
      """

  Scenario: parseItemSectionLines joins indented continuation lines onto the value
    Given the item section lines array JSON is:
      """
      ["description = line1","    line2","owner = o"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"description":"line1\nline2","owner":"o"}
      """

  Scenario: parseItemSectionLines stops a field when the next line starts a new key
    Given the item section lines array JSON is:
      """
      ["a = 1","  cont","b = 2"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"a":"1\ncont","b":"2"}
      """

  Scenario: parseItemSectionLines skips leading blank lines in the outer loop
    Given the item section lines array JSON is:
      """
      ["","  ","id = 1"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"id":"1"}
      """

  Scenario: parseItemSectionLines ends a multiline value when a blank is followed by the next key
    Given the item section lines array JSON is:
      """
      ["description = hello","","id = 2"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"description":"hello","id":"2"}
      """

  Scenario: parseItemSectionLines skips multiple blank lines before an indented continuation
    Given the item section lines array JSON is:
      """
      ["description = a","","","  more"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"description":"a\n\n\nmore"}
      """

  Scenario: parseItemSectionLines stops at a bracket section line when collecting a value
    Given the item section lines array JSON is:
      """
      ["body = text","[other]","after = ignored"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"body":"text","after":"ignored"}
      """

  Scenario: parseItemSectionLines stops continuation when a non-indented non-key line appears
    Given the item section lines array JSON is:
      """
      ["a = 1","orphan line","b = 2"]
      """
    When I parse the item section lines with parseItemSectionLines
    Then the parsed item fields JSON should be:
      """
      {"a":"1","b":"2"}
      """

  Scenario: parseTaskCardIniFull fills missing link text or url with empty strings
    Given the task card INI text is:
      """
      [item]
      id=x

      [link.1]
      url=http://u

      [link.2]
      text=hi

      """
    When I parse with parseTaskCardIniFull
    Then the parseTaskCardIniFull result JSON should be:
      """
      {"item":{"id":"x\n"},"links":[{"text":"","url":"http://u"},{"text":"hi","url":""}]}
      """

  Scenario: parseTaskCardIniFull merges item fields links and sorts link sections by index
    Given the task card INI text is:
      """
      [item]
      id = card1
      title = Hello

      [link.2]
      text = second
      url = http://b

      [link.1]
      text = first
      url = http://a

      """
    When I parse with parseTaskCardIniFull
    Then the parseTaskCardIniFull result JSON should be:
      """
      {"item":{"id":"card1","title":"Hello\n"},"links":[{"text":"first","url":"http://a"},{"text":"second","url":"http://b"}]}
      """

  Scenario: parseTaskCardIniFull yields empty item when there is no bracket item section
    Given the task card INI text is:
      """
      orphan = only_in_root

      """
    When I parse with parseTaskCardIniFull
    Then the parseTaskCardIniFull result JSON should be:
      """
      {"item":{},"links":[]}
      """

  Scenario: parseTaskCardIni trims scalar fields and preserves link order from indexes
    Given the task card INI text is:
      """
      [item]
      id =  card9  
      title =  Title  
      description =  Body  
      owner =  o@o.o  
      swimlane =  Lane1  
      column =  Col2  
      sort_order =  3  
      created =  2020-01-01  
      closed =  

      [link.1]
      text = T
      url = http://z

      """
    When I parse with parseTaskCardIni
    Then the parseTaskCardIni result JSON should be:
      """
      {"id":"card9","title":"Title","description":"Body","owner":"o@o.o","swimlane":"Lane1","column":"Col2","sort_order":"3","created":"2020-01-01","closed":"","links":[{"text":"T","url":"http://z"}]}
      """

  Scenario: parseTaskCardIni defaults missing fields to undefined and empty links
    Given the task card INI text is:
      """
      root_only = 1

      """
    When I parse with parseTaskCardIni
    Then the parseTaskCardIni result JSON should be:
      """
      {}
      """
