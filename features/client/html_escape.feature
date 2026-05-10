Feature: escapeHtml
  The escapeHtml helper escapes characters that are unsafe in HTML text or
  double-quoted attributes, and stringifies inputs like String().

  Examples use macros so cells do not contain raw angle brackets (which would
  clash with Scenario Outline placeholders): {AMP} &, {LT} <, {GT} >, {QUOT} ".
  Expected strings use the same macros; HTML entities are spelled with {AMP}
  first, e.g. {AMP}lt; for &lt;. Sentinels __undefined__ and __null__ mean those
  JavaScript values.

  Scenario Outline: escapeHtml maps macro-encoded inputs to escaped output
    Given the macro-encoded raw is "<raw>" and expected is "<expected>"
    When I escape the prepared input for HTML
    Then the result should match the prepared expected output

    Examples:
      | case             | raw                                                                                  | expected                                                                                                                  |
      | plain text       | Millrace board                                                                       | Millrace board                                                                                                            |
      | ampersand        | Tom {AMP} Jerry                                                                      | Tom {AMP}amp; Jerry                                                                                                       |
      | angle brackets   | {LT}script{GT}alert(1){LT}/script{GT}                                                | {AMP}lt;script{AMP}gt;alert(1){AMP}lt;/script{AMP}gt;                                                                     |
      | double quotes    | He said {QUOT}hello{QUOT}                                                            | He said {AMP}quot;hello{AMP}quot;                                                                                         |
      | mixed characters | {LT}a href={QUOT}x?y=1{AMP}z=2{QUOT}{GT}{QUOT}Fish{QUOT} {AMP} 'Chips'{LT}/a{GT}      | {AMP}lt;a href={AMP}quot;x?y=1{AMP}amp;z=2{AMP}quot;{AMP}gt;{AMP}quot;Fish{AMP}quot; {AMP}amp; 'Chips'{AMP}lt;/a{AMP}gt; |
      | undefined        | __undefined__                                                                        | undefined                                                                                                                 |
      | null             | __null__                                                                             | null                                                                                                                      |
