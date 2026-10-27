
# Agent log

One entry per agent session, newest at the bottom. Be honest: what went wrong is the useful part.

<!-- Copy this block for each session:

## YYYY-MM-DD · <short title>
- Goal:
- Delegated:
- Checkpoints:
- Went wrong:
- Changed by hand:

-->

## 2026-10-27 · MCP server testing

- Goal: Connect my MCP server to Gemini CLI and test the lecture tools.
- Delegated: Asked Gemini to find information about lecture 7 using my MCP server.
- Checkpoints: The MCP server passed all 12 checks. Gemini connected successfully and used the find_lecture tool to return the correct lecture information.
- Went wrong: At first, Gemini could not connect because the protocol version 2025-11-25 was not supported. After fixing that, the default Auto model stayed on Thinking and did not answer my questions.
- Changed by hand: Updated the protocol version to 2025-06-18 and switched from Auto to Gemini Flash-Lite. After these changes, Gemini responded correctly and the MCP tools worked.

## 2026-10-27 · Tool description experiment

- Goal: Test whether changing the description of an MCP tool affects how Gemini chooses which tool to use.
- Delegated: Asked Gemini what lecture 7 covers, first with the original tool description and then with a modified description.
- Checkpoints: Gemini selected find_lecture in both tests and returned the correct information about lecture 7. The server also passed all 12 checks.
- Went wrong: No major problems occurred during the experiment. Changing the tool description did not change Gemini's tool selection.
- Changed by hand: Changed the find_lecture description from "Find a course lecture by its number and return its title and topics" to "Find information about a numbered item stored in the course data". After testing, I restored the original description and checked that the server still passed all 12 tests.
