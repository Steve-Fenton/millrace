Feature: html element helper
  The el() helper parses a string of HTML into a single root Element using a
  template element. Table cells use macros so we need not put raw angle brackets
  in Gherkin: {LT} <, {GT} >, {QUOT} ", {NL} newline.

  Scenario Outline: el returns the first element child of the template
    Given macro-encoded html for el is "<html>"
    When I parse the html with el
    Then the el result tag name should be "<tag>"
    And the el result text content should be "<text>"

    Examples:
      | case        | html                                              | tag | text |
      | simple div  | {LT}div{GT}Hello{LT}/div{GT}                      | DIV | Hello |
      | simple span | {LT}span{GT}x{LT}/span{GT}                        | SPAN | x     |
      | paragraph   | {LT}p{GT}one{LT}/p{GT}                            | P   | one   |

  Scenario: el preserves id and class on the root element
    Given macro-encoded html for el is "{LT}div id={QUOT}shell{QUOT} class={QUOT}a b{QUOT}{GT}{LT}/div{GT}"
    When I parse the html with el
    Then the el result tag name should be "DIV"
    And the el result attribute "id" should be "shell"
    And the el result attribute "class" should be "a b"

  Scenario: el preserves a lone id on the root element
    Given macro-encoded html for el is "{LT}section id={QUOT}main{QUOT}{GT}{LT}/section{GT}"
    When I parse the html with el
    Then the el result tag name should be "SECTION"
    And the el result attribute "id" should be "main"

  Scenario Outline: el trims surrounding whitespace before parsing
    Given macro-encoded html for el is "<html>"
    When I parse the html with el
    Then the el result tag name should be "<tag>"
    And the el result text content should be "<text>"

    Examples:
      | case              | html                                                          | tag | text |
      | leading spaces    | {SP4}{LT}div{GT}z{LT}/div{GT}                                | DIV | z |
      | trailing spaces   | {LT}div{GT}z{LT}/div{GT}{SP4}                                | DIV | z |

  Scenario Outline: el yields null when there is no element
    Given macro-encoded html for el is "<html>"
    When I parse the html with el
    Then el should return null

    Examples:
      | case              | html |
      | empty string      |      |
      | whitespace only   | {SP4} |

  Scenario: el returns only the first root when markup has several roots
    Given macro-encoded html for el is "{LT}span{GT}first{LT}/span{GT}{LT}span{GT}second{LT}/span{GT}"
    When I parse the html with el
    Then the el result tag name should be "SPAN"
    And the el result text content should be "first"
