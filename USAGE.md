
# Usage

One row per agent session. In Gemini CLI, type `/stats` before you quit and copy the input and output tokens. Copilot shows credits instead of tokens: write those in the credits column. The free tier charges nothing, so record what the session **would cost at the provider's published list price**, and note once below the table which price list you used. Leave the cost empty for rows that only show credits.

| Date | Tool | Input tokens | Output tokens | Credits (if no tokens) | List-price cost |
|---|---|---|---|---|---|
| 2026-10-27 | Gemini CLI (Flash-Lite) | 67449 | 193 | | ~$0.0092 |
| 2026-10-27 | Gemini CLI (description experiment) | Not recorded | Not recorded | | |

## Pricing information

Pricing source: https://ai.google.dev/gemini-api/docs/pricing

I used Google's published Gemini 3.5 Flash-Lite paid standard prices:
- Input: $0.30 per 1 million tokens.
- Output: $2.50 per 1 million tokens.
- Cached input: $0.03 per 1 million tokens.

The estimated list-price cost for my recorded session is approximately $0.0092, assuming the 42,576 cached tokens were included in the reported input total. This is an approximate calculation using Flash-Lite pricing for the session totals, which may also include earlier model attempts.

## Actual cost

I checked my project in Google AI Studio, and it was on the Free Tier. My Gemini API usage under this tier was free of charge ($0). The price shown in the table is only an estimate of what the recorded usage would cost using Google's published paid prices, as required for the lab.

## Model change

At first, I used Gemini CLI with the default Auto model selection, but it stayed on "Thinking" and did not respond to my questions. I changed the model to Gemini 3.5 Flash-Lite using the `/model` command, and it started responding successfully. After that, I tested my MCP server and Gemini correctly used the `find_lecture` tool to return lecture information.

The token counts for the separate description experiment were not recorded.
