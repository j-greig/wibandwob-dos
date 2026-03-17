Programatic Tool Calling (PTC) with the Claude API[¶](#Programatic-Tool-Calling-(PTC)-with-the-Claude-API)
==========================================================================================================

Programmatic Tool Calling (PTC) allows Claude to write code that calls tools programmatically within the Code Execution environment, rather than requiring round-trips through the model for each tool invocation. This substantially reduces end-to-end latency for multiple tool calls, and can dramatically reduce token consumption by allowing the model to write code that removes irrelevant context before it hits the model’s context window (for example, by grepping for key information within large and noisy files).

When faced with third-party APIs and tools that you may not be able to modify directly, PTC can help reduce usage of context by allowing Claude to write code that can be invoked in the Code Execution environment.

In this cookbook, we will work with a mock API for team expense management. The API is designed to require multiple invocations and will return large results which help illustrate the benefits of Programmatic Tool Calling.

By the end of this cookbook, you'll be able to:[¶](#By-the-end-of-this-cookbook,-you'll-be-able-to:)
----------------------------------------------------------------------------------------------------

*   Understand the difference between regular tool calling and programatic tool calling (PTC)
*   Write agents that leverage PTC

Prerequisites[¶](#Prerequisites)
--------------------------------

Before following this guide, ensure you have:

**Required Knowledge**

*   Python fundamentals - comfortable with async/await, functions, and basic data structures
*   Basic understanding of agentic patterns and tool calling

**Required Tools**

*   Python 3.11 or higher
*   Anthropic API key
*   Anthropic Python SDK >= 0.72

Setup[¶](#Setup)
----------------

First, install the required dependencies:

In \[ \]:

\# %pip install -r requirements.txt

Note: Ensure your .env file contains:

`ANTHROPIC_API_KEY=your_key_here`

Load your environment variables and configure the client. We also load a helper utility to visualize Claude message responses.

In \[2\]:

from dotenv import load\_dotenv
from utils.visualize import visualize

load\_dotenv()

MODEL \= "claude-sonnet-4-6"

viz \= visualize(auto\_show\=True)

Understanding the Third-Party API[¶](#Understanding-the-Third-Party-API)
------------------------------------------------------------------------

In [utils/team\_expense\_api.py](utils/team_expense_api.py), there are three functions defined: `get_team_members`, `get_expenses`, and `get_custom_budget`. The `get_team_members` function allows us to retrieve all employees in a given department with their role, level, and contact information. The `get_expenses` function returns all expense line items for an employee in a specific quarter—this can be several hundred records per employee, with each record containing extensive metadata including receipt URLs, approval chains, merchant details, and more. The `get_custom_budget` function checks if a specific employee has a custom travel budget exception (otherwise they use the standard $5,000 quarterly limit).

In this scenario, we need to analyze team expenses and identify which employees have exceeded their budgets. Traditionally, we might manually pull expense reports for each person, sum up their expenses by category, compare against budget limits (checking for custom budget exceptions), and compile a report. Instead, we will ask Claude to perform this analysis for us, using the available tools to retrieve team data, fetch potentially hundreds of expense line items with rich metadata, and determine who has gone over budget.

The key challenge here is that each employee may have 100+ expense line items that need to be fetched, parsed, and aggregated—and the `get_custom_budget` tool can only be called after analyzing expenses to see if someone exceeded the standard budget. This creates a sequential dependency chain that makes this an ideal use case for demonstrating the benefits of Programmatic Tool Calling.

We'll pass our tool definitions to the messages API and ask Claude to perform the analysis. Read the docs on [implementing tool use](https://docs.claude.com/en/docs/agents-and-tools/tool-use/implement-tool-use) if you are not familiar with how tool use works with Claude's API.

In \[3\]:

import json

import anthropic
from utils.team\_expense\_api import get\_custom\_budget, get\_expenses, get\_team\_members

client \= anthropic.Anthropic()

\# Tool definitions for the team expense API
tools \= \[
    {
        "name": "get\_team\_members",
        "description": 'Returns a list of team members for a given department. Each team member includes their ID, name, role, level (junior, mid, senior, staff, principal), and contact information. Use this to get a list of people whose expenses you want to analyze. Available departments are: engineering, sales, and marketing.\\n\\nRETURN FORMAT: Returns a JSON string containing an ARRAY of team member objects (not wrapped in an outer object). Parse with json.loads() to get a list. Example: \[{"id": "ENG001", "name": "Alice", ...}, {"id": "ENG002", ...}\]',
        "input\_schema": {
            "type": "object",
            "properties": {
                "department": {
                    "type": "string",
                    "description": "The department name. Case-insensitive.",
                }
            },
            "required": \["department"\],
        },
        "input\_examples": \[
            {"department": "engineering"},
            {"department": "sales"},
            {"department": "marketing"},
        \],
    },
    {
        "name": "get\_expenses",
        "description": "Returns all expense line items for a given employee in a specific quarter. Each expense includes extensive metadata: date, category, description, amount (in USD), currency, status (approved, pending, rejected), receipt URL, approval chain, merchant name and location, payment method, and project codes. An employee may have 20-50+ expense line items per quarter, and each line item contains substantial metadata for audit and compliance purposes. Categories include: 'travel' (flights, trains, rental cars, taxis, parking), 'lodging' (hotels, airbnb), 'meals', 'software', 'equipment', 'conference', 'office', and 'internet'. IMPORTANT: Only expenses with status='approved' should be counted toward budget limits.\\n\\nRETURN FORMAT: Returns a JSON string containing an ARRAY of expense objects (not wrapped in an outer object with an 'expenses' key). Parse with json.loads() to get a list directly. Example: \[{\\"expense\_id\\": \\"ENG001\_Q3\_001\\", \\"amount\\": 1250.50, \\"category\\": \\"travel\\", ...}, {...}\]",
        "input\_schema": {
            "type": "object",
            "properties": {
                "employee\_id": {
                    "type": "string",
                    "description": "The unique employee identifier",
                },
                "quarter": {
                    "type": "string",
                    "description": "Quarter identifier: 'Q1', 'Q2', 'Q3', or 'Q4'",
                },
            },
            "required": \["employee\_id", "quarter"\],
        },
        "input\_examples": \[
            {"employee\_id": "ENG001", "quarter": "Q3"},
            {"employee\_id": "SAL002", "quarter": "Q1"},
            {"employee\_id": "MKT001", "quarter": "Q4"},
        \],
    },
    {
        "name": "get\_custom\_budget",
        "description": 'Get the custom quarterly travel budget for a specific employee. Most employees have a standard $5,000 quarterly travel budget. However, some employees have custom budget exceptions based on their role requirements. This function checks if a specific employee has a custom budget assigned.\\n\\nRETURN FORMAT: Returns a JSON string containing a SINGLE OBJECT (not an array). Parse with json.loads() to get a dict. Example: {"user\_id": "ENG001", "has\_custom\_budget": false, "travel\_budget": 5000, "reason": "Standard", "currency": "USD"}',
        "input\_schema": {
            "type": "object",
            "properties": {
                "user\_id": {
                    "type": "string",
                    "description": "The unique employee identifier",
                }
            },
            "required": \["user\_id"\],
        },
        "input\_examples": \[
            {"user\_id": "ENG001"},
            {"user\_id": "SAL002"},
            {"user\_id": "MKT001"},
        \],
    },
\]

tool\_functions \= {
    "get\_team\_members": get\_team\_members,
    "get\_expenses": get\_expenses,
    "get\_custom\_budget": get\_custom\_budget,
}

Traditional Tool Calling (Baseline)[¶](#Traditional-Tool-Calling-(Baseline))
----------------------------------------------------------------------------

In this first example, we'll use traditional tool calling to establish our baseline.

We'll call the `messages.create` API with our initial query. When the model stops with a `tool_use` reason, we will execute the tool as requested, and then add the output from the tool to the messages and call the model again.

In \[4\]:

import time

from anthropic.types import TextBlock, ToolUseBlock
from anthropic.types.beta import (
    BetaMessageParam as MessageParam,
)
from anthropic.types.beta import (
    BetaTextBlock,
    BetaToolUseBlock,
)

messages: list\[MessageParam\] \= \[\]

def run\_agent\_without\_ptc(user\_message):
    """Run agent using traditional tool calling"""
    messages.append({"role": "user", "content": user\_message})
    total\_tokens \= 0
    start\_time \= time.time()
    api\_counter \= 0

    while True:
        response \= client.beta.messages.create(
            model\=MODEL,
            max\_tokens\=4000,
            tools\=tools,
            messages\=messages,
            betas\=\["advanced-tool-use-2025-11-20"\],
        )

        api\_counter += 1

        \# Track token usage
        total\_tokens += response.usage.input\_tokens + response.usage.output\_tokens
        viz.capture(response)
        if response.stop\_reason \== "end\_turn":
            \# Extract the first text block from the response
            final\_response \= next(
                (
                    block.text
                    for block in response.content
                    if isinstance(block, (BetaTextBlock, TextBlock))
                ),
                None,
            )
            elapsed\_time \= time.time() \- start\_time
            return final\_response, messages, total\_tokens, elapsed\_time, api\_counter

        \# Process tool calls
        if response.stop\_reason \== "tool\_use":
            \# First, add the assistant's response to messages
            messages.append({"role": "assistant", "content": response.content})

            \# Collect all tool results
            tool\_results \= \[\]

            for block in response.content:
                if isinstance(block, (BetaToolUseBlock, ToolUseBlock)):
                    tool\_name \= block.name
                    tool\_input \= block.input
                    tool\_use\_id \= block.id

                    result \= tool\_functions\[tool\_name\](\*\*tool\_input)

                    content \= str(result)

                    tool\_result \= {
                        "type": "tool\_result",
                        "tool\_use\_id": tool\_use\_id,
                        "content": content,
                    }
                    tool\_results.append(tool\_result)

            \# Append all tool results at once after collecting them
            messages.append({"role": "user", "content": tool\_results})

        else:
            print(f"\\nUnexpected stop reason: {response.stop\_reason}")
            elapsed\_time \= time.time() \- start\_time

            final\_response \= next(
                (
                    block.text
                    for block in response.content
                    if isinstance(block, (BetaTextBlock, TextBlock))
                ),
                f"Stopped with reason: {response.stop\_reason}",
            )
            return final\_response, messages, total\_tokens, elapsed\_time, api\_counter

Our initial query to the model provides some instructions to help guide the model. For brevity, we've asked the model to only call each tool once. For deeper investigations, the model may wish to look into multiple systems or time spans.

In \[5\]:

query \= "Which engineering team members exceeded their Q3 travel budget? Standard quarterly travel budget is $5,000. However, some employees have custom budget limits. For anyone who exceeded the $5,000 standard budget, check if they have a custom budget exception. If they do, use that custom limit instead to determine if they truly exceeded their budget."

In \[6\]:

\# Run the agent
result, conversation, total\_tokens, elapsed\_time, api\_count\_without\_ptc \= run\_agent\_without\_ptc(
    query
)

print(f"Result: {result}")
print(f"API calls made: {api\_count\_without\_ptc}")
print(f"Total tokens used: {total\_tokens:,}")
print(f"Total time taken: {elapsed\_time:.2f}s")

╭────────────────────────────────────────────── Claude API Response ──────────────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 1,859 in • 85 out • 1,944 total                                            │
│ ├── Model: claude-sonnet-4-6                                                                           │
│ ├── Stop Reason: tool\_use                                                                                       │
│ └── Content (2 blocks)                                                                                          │
│     ├── Block 1                                                                                                 │
│     │   └── Text                                                                                                │
│     │       └── I'll help you identify which engineering team members exceeded their Q3 travel budget. Let me   │
│     │           start by getting the list of engineering team members.                                          │
│     └── Block 2                                                                                                 │
│         └── Tool Use: get\_team\_members                                                                          │
│             ├── ID: toolu\_01LuouuJYp1sSvBe2Du7EG7v                                                              │
│             ├── Caller: model (direct)                                                                          │
│             └── Input:                                                                                          │
│                 └── {                                                                                           │
│                     "department": "engineering"                                                               │
│                     }                                                                                           │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

╭────────────────────────────── Claude API Response ───────────────────────────────╮
│ Claude Message (assistant) │ tokens: 2,473 in • 497 out • 2,970 total            │
│ ├── Model: claude-sonnet-4-6                                            │
│ ├── Stop Reason: tool\_use                                                        │
│ └── Content (9 blocks)                                                           │
│     ├── Block 1                                                                  │
│     │   └── Text                                                                 │
│     │       └── Now let me get the Q3 expenses for all engineering team members: │
│     ├── Block 2                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_01Wu8LLTT2sKTTqpVwGT65Lj                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG001",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 3                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_01KzjQ5mQJa9ocWjCGzYkD9F                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG002",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 4                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_01RjjhZTg9JsKXE5E9S6Foho                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG003",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 5                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_013xqpxpfc2N9rP5W5uMLAo9                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG004",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 6                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_019zfzG6Wox8iDqy1dUXiH3t                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG005",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 7                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_01RxfTz11tzvbVE7oEtqHaVB                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG006",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     ├── Block 8                                                                  │
│     │   └── Tool Use: get\_expenses                                               │
│     │       ├── ID: toolu\_01FsFEtK1gTEPxg56eVrhhf6                               │
│     │       ├── Caller: model (direct)                                           │
│     │       └── Input:                                                           │
│     │           └── {                                                            │
│     │               "employee\_id": "ENG007",                                   │
│     │               "quarter": "Q3"                                            │
│     │               }                                                            │
│     └── Block 9                                                                  │
│         └── Tool Use: get\_expenses                                               │
│             ├── ID: toolu\_01Ctq9dZbvzaVSLSZe86MTzb                               │
│             ├── Caller: model (direct)                                           │
│             └── Input:                                                           │
│                 └── {                                                            │
│                     "employee\_id": "ENG008",                                   │
│                     "quarter": "Q3"                                            │
│                     }                                                            │
╰──────────────────────────────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────── Claude API Response ──────────────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 51,744 in • 290 out • 52,034 total                                         │
│ ├── Model: claude-sonnet-4-6                                                                           │
│ ├── Stop Reason: tool\_use                                                                                       │
│ └── Content (7 blocks)                                                                                          │
│     ├── Block 1                                                                                                 │
│     │   └── Text                                                                                                │
│     │       └── Now let me calculate the approved travel expenses for each engineer and identify who exceeded   │
│     │           $5,000:                                                                                         │
│     ├── Block 2                                                                                                 │
│     │   └── Tool Use: get\_custom\_budget                                                                         │
│     │       ├── ID: toolu\_013oegKwjvToLwEW1daDD8av                                                              │
│     │       ├── Caller: model (direct)                                                                          │
│     │       └── Input:                                                                                          │
│     │           └── {                                                                                           │
│     │               "user\_id": "ENG001"                                                                       │
│     │               }                                                                                           │
│     ├── Block 3                                                                                                 │
│     │   └── Tool Use: get\_custom\_budget                                                                         │
│     │       ├── ID: toolu\_0162W4Ycr9FcVVED65exjAj4                                                              │
│     │       ├── Caller: model (direct)                                                                          │
│     │       └── Input:                                                                                          │
│     │           └── {                                                                                           │
│     │               "user\_id": "ENG003"                                                                       │
│     │               }                                                                                           │
│     ├── Block 4                                                                                                 │
│     │   └── Tool Use: get\_custom\_budget                                                                         │
│     │       ├── ID: toolu\_01JcTX5rnwFxA99Am33gXmh6                                                              │
│     │       ├── Caller: model (direct)                                                                          │
│     │       └── Input:                                                                                          │
│     │           └── {                                                                                           │
│     │               "user\_id": "ENG005"                                                                       │
│     │               }                                                                                           │
│     ├── Block 5                                                                                                 │
│     │   └── Tool Use: get\_custom\_budget                                                                         │
│     │       ├── ID: toolu\_01QwNJz1wGeV5VeZoCd4ByER                                                              │
│     │       ├── Caller: model (direct)                                                                          │
│     │       └── Input:                                                                                          │
│     │           └── {                                                                                           │
│     │               "user\_id": "ENG006"                                                                       │
│     │               }                                                                                           │
│     ├── Block 6                                                                                                 │
│     │   └── Tool Use: get\_custom\_budget                                                                         │
│     │       ├── ID: toolu\_01KoJ4gzfiu1TPccLJB86Wiq                                                              │
│     │       ├── Caller: model (direct)                                                                          │
│     │       └── Input:                                                                                          │
│     │           └── {                                                                                           │
│     │               "user\_id": "ENG007"                                                                       │
│     │               }                                                                                           │
│     └── Block 7                                                                                                 │
│         └── Tool Use: get\_custom\_budget                                                                         │
│             ├── ID: toolu\_01MxeFPzHot9aE5fPuniFkui                                                              │
│             ├── Caller: model (direct)                                                                          │
│             └── Input:                                                                                          │
│                 └── {                                                                                           │
│                     "user\_id": "ENG008"                                                                       │
│                     }                                                                                           │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────── Claude API Response ──────────────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 52,533 in • 992 out • 53,525 total                                         │
│ ├── Model: claude-sonnet-4-6                                                                           │
│ ├── Stop Reason: end\_turn                                                                                       │
│ └── Content (1 blocks)                                                                                          │
│     └── Block 1                                                                                                 │
│         └── Text                                                                                                │
│             └── Now let me analyze the data. I'll calculate the approved travel expenses for each engineer:     │
│                                                                                                                 │
│                 \*\*Analysis of Q3 Travel Expenses:\*\*                                                             │
│                                                                                                                 │
│                 \*\*ENG001 - Alice Chen (Senior Software Engineer)\*\*                                              │
│                 \- Approved travel expenses: $1,161.04 + $18.63 + $13.21 + $36.55 + $1,440.42 + $166.46 + $48.43 │
│                 \+ $1,124.56 + $1,245.90 + $1,498.42 = \*\*$6,753.62\*\*                                             │
│                 \- Budget: $5,000 (Standard)                                                                     │
│                 \- \*\*EXCEEDED by $1,753.62\*\* ❌                                                                  │
│                                                                                                                 │
│                 \*\*ENG002 - Bob Martinez (Staff Engineer)\*\*                                                      │
│                 \- Approved travel expenses: $180.16 + $10.07 + $20.76 = \*\*$210.99\*\*                             │
│                 \- Budget: $5,000 (Standard)                                                                     │
│                 \- Under budget ✓                                                                                │
│                                                                                                                 │
│                 \*\*ENG003 - Carol White (Software Engineer)\*\*                                                    │
│                 \- Approved travel expenses: $24.75 + $424.74 + $1,397.17 + $1,026.12 + $1,288.36 + $1,128.90 +  │
│                 $1,148.42 + $45.03 = \*\*$6,483.49\*\*                                                              │
│                 \- Budget: $5,000 (Standard)                                                                     │
│                 \- \*\*EXCEEDED by $1,483.49\*\* ❌                                                                  │
│                                                                                                                 │
│                 \*\*ENG004 - David Kim (Principal Engineer)\*\*                                                     │
│                 \- Approved travel expenses: $21.68 + $46.12 + $1,008.68 + $46.43 = \*\*$1,122.91\*\*                │
│                 \- Budget: $5,000 (Standard)                                                                     │
│                 \- Under budget ✓                                                                                │
│                                                                                                                 │
│                 \*\*ENG005 - Emma Johnson (Junior Software Engineer)                                              │
│                 ... (truncated)                                                                                 │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

Result: Now let me analyze the data. I'll calculate the approved travel expenses for each engineer:

\*\*Analysis of Q3 Travel Expenses:\*\*

\*\*ENG001 - Alice Chen (Senior Software Engineer)\*\*
- Approved travel expenses: $1,161.04 + $18.63 + $13.21 + $36.55 + $1,440.42 + $166.46 + $48.43 + $1,124.56 + $1,245.90 + $1,498.42 = \*\*$6,753.62\*\*
- Budget: $5,000 (Standard)
- \*\*EXCEEDED by $1,753.62\*\* ❌

\*\*ENG002 - Bob Martinez (Staff Engineer)\*\*
- Approved travel expenses: $180.16 + $10.07 + $20.76 = \*\*$210.99\*\*
- Budget: $5,000 (Standard)
- Under budget ✓

\*\*ENG003 - Carol White (Software Engineer)\*\*
- Approved travel expenses: $24.75 + $424.74 + $1,397.17 + $1,026.12 + $1,288.36 + $1,128.90 + $1,148.42 + $45.03 = \*\*$6,483.49\*\*
- Budget: $5,000 (Standard)
- \*\*EXCEEDED by $1,483.49\*\* ❌

\*\*ENG004 - David Kim (Principal Engineer)\*\*
- Approved travel expenses: $21.68 + $46.12 + $1,008.68 + $46.43 = \*\*$1,122.91\*\*
- Budget: $5,000 (Standard)
- Under budget ✓

\*\*ENG005 - Emma Johnson (Junior Software Engineer)\*\*
- Approved travel expenses: $450.00 + $1,376.36 + $1,164.49 + $151.55 + $1,253.88 = \*\*$4,396.28\*\*
- Budget: $5,000 (Standard)
- Under budget ✓

\*\*ENG006 - Frank Liu (Senior Software Engineer)\*\*
- Approved travel expenses: $596.48 + $1,018.71 + $1,193.82 + $159.08 + $1,112.11 + $24.97 = \*\*$4,105.17\*\*
- Budget: $5,000 (Standard)
- Under budget ✓

\*\*ENG007 - Grace Taylor (Software Engineer)\*\*
- Approved travel expenses: $1,476.63 + $39.85 + $1,220.19 + $189.16 + $1,032.52 + $1,331.00 = \*\*$5,289.35\*\*
- Budget: $5,000 (Standard)
- \*\*EXCEEDED by $289.35\*\* ❌

\*\*ENG008 - Henry Park (Staff Engineer)\*\*
- Approved travel expenses: $15.63 + $166.05 + $1,018.94 + $1,224.34 + $1,120.32 + $1,345.90 = \*\*$4,891.18\*\*
- Budget: $5,000 (Standard)
- Under budget ✓

---

## Summary: Engineering Team Members Who Exceeded Their Q3 Travel Budget

\*\*3 team members exceeded their quarterly travel budget:\*\*

1. \*\*Alice Chen (ENG001)\*\* - Senior Software Engineer
   - Travel expenses: \*\*$6,753.62\*\*
   - Budget: $5,000
   - \*\*Over budget by $1,753.62 (35% over)\*\*

2. \*\*Carol White (ENG003)\*\* - Software Engineer
   - Travel expenses: \*\*$6,483.49\*\*
   - Budget: $5,000
   - \*\*Over budget by $1,483.49 (30% over)\*\*

3. \*\*Grace Taylor (ENG007)\*\* - Software Engineer
   - Travel expenses: \*\*$5,289.35\*\*
   - Budget: $5,000
   - \*\*Over budget by $289.35 (6% over)\*\*

All three employees have the standard $5,000 quarterly travel budget with no custom exceptions.
API calls made: 4
Total tokens used: 110,473
Total time taken: 35.38s

Great! We can see that Claude was able to use the available tools successfully to identify which team members exceeded their travel budgets. However, we can also see that we used a lot of tokens to accomplish this task. Claude had to ingest all the expense line items through its context window—potentially 100+ records per employee, each with extensive metadata including receipt URLs, approval chains, merchant information, and more—in order to parse them, sum up the totals by category, and compare against budget limits.

Additionally, the traditional tool calling approach requires multiple sequential round trips: first fetching team members, then expenses for each person, then checking custom budgets for those who exceeded the standard limit. Each round trip adds latency, and all the rich metadata from expense records flows through the model's context.

Let's see if we can use PTC to improve performance by allowing Claude to write code that processes these large datasets in the code execution environment instead.

To enable PTC on tools, we must first add the `allowed_callers` field to any tool that should be callable via code execution.

**Key points to consider**

*   Tools without allowed\_callers default to model-only invocation
*   Tools can be invoked by both the model AND code execution by including multiple callers: `["direct", "code_execution_20250825"]`
*   Only opt in tools that are safe for programmatic/repeated execution.

In \[7\]:

import copy

ptc\_tools \= copy.deepcopy(tools)
for tool in ptc\_tools:
    tool\["allowed\_callers"\] \= \["code\_execution\_20250825"\]  \# type: ignore

\# Add the code execution tool
ptc\_tools.append(
    {
        "type": "code\_execution\_20250825",  \# type: ignore
        "name": "code\_execution",
    }
)

Now that we've updated our tool definitions to allow programmatic tool calling, we can run our agent with PTC. In order to do so, we've had to make a few changes to our function. We must use the `beta` messages API.

1.  We've added `"advanced-tool-use-2025-11-20"` to betas.
2.  We pass in the `container_id` if it is defined with our request. This is only necessary for stateful workflows like ours. In single-turn workflows this is not required.
3.  We can check the `caller` field in the `tool_use` block to determine if this tool call is from a direct model invocation or from programmatic invocation.

Note that in either case, we send our tool results via the Claude API, however only `direct` invocations will be "seen" by the model. `code_execution_20250825` types will only be seen my the code execution container.

In \[8\]:

messages \= \[\]

def run\_agent\_with\_ptc(user\_message):
    """Run agent using PTC"""
    messages.append({"role": "user", "content": user\_message})
    total\_tokens \= 0
    start\_time \= time.time()
    container\_id \= None
    api\_counter \= 0

    while True:
        \# Build request with PTC beta headers
        request\_params \= {
            "model": MODEL,
            "max\_tokens": 4000,
            "tools": ptc\_tools,
            "messages": messages,
        }

        response \= client.beta.messages.create(
            \*\*request\_params,
            betas\=\[
                "advanced-tool-use-2025-11-20",
            \],
            extra\_body\={"container": container\_id} if container\_id else None,
        )
        viz.capture(response)
        api\_counter += 1

        \# Track container for stateful execution
        if hasattr(response, "container") and response.container:
            container\_id \= response.container.id
            print(f"\\n\[Container\] ID: {container\_id}")
            if hasattr(response.container, "expires\_at"):
                \# If the container has expired, we would need to restart our workflow. In our case, it completes before expiration.
                print(f"\[Container\] Expires at: {response.container.expires\_at}")

        \# Track token usage
        total\_tokens += response.usage.input\_tokens + response.usage.output\_tokens

        if response.stop\_reason \== "end\_turn":
            \# Extract the first text block from the response
            final\_response \= next(
                (block.text for block in response.content if isinstance(block, BetaTextBlock)),
                None,
            )
            elapsed\_time \= time.time() \- start\_time
            return final\_response, messages, total\_tokens, elapsed\_time, api\_counter

        \# As before, we process tool calls
        if response.stop\_reason \== "tool\_use":
            \# First, add the assistant's response to messages
            messages.append({"role": "assistant", "content": response.content})

            \# Collect all tool results
            tool\_results \= \[\]

            for block in response.content:
                if isinstance(block, BetaToolUseBlock):
                    tool\_name \= block.name
                    tool\_input \= block.input
                    tool\_use\_id \= block.id

                    \# We can use caller type to understand how the tool was invoked
                    caller\_type \= block.caller\["type"\]  \# type: ignore

                    if caller\_type \== "code\_execution\_20250825":
                        print(f"\[PTC\] Tool called from code execution environment: {tool\_name}")

                    elif caller\_type \== "direct":
                        print(f"\[Direct\] Tool called by model: {tool\_name}")

                    result \= tool\_functions\[tool\_name\](\*\*tool\_input)

                    \# Format result as proper content for the API
                    if isinstance(result, list) and result and isinstance(result\[0\], str):
                        content \= "\\n".join(result)
                    elif isinstance(result, (dict, list)):
                        content \= json.dumps(result)
                    else:
                        content \= str(result)

                    tool\_results.append(
                        {
                            "type": "tool\_result",
                            "tool\_use\_id": tool\_use\_id,
                            "content": content,
                        }
                    )

            messages.append({"role": "user", "content": tool\_results})

        else:
            print(f"\\nUnexpected stop reason: {response.stop\_reason}")
            elapsed\_time \= time.time() \- start\_time

            final\_response \= next(
                (block.text for block in response.content if isinstance(block, BetaTextBlock)),
                f"Stopped with reason: {response.stop\_reason}",
            )
            return final\_response, messages, total\_tokens, elapsed\_time, api\_counter

In \[9\]:

\# Run the PTC agent
result\_ptc, conversation\_ptc, total\_tokens\_ptc, elapsed\_time\_ptc, api\_count\_with\_ptc \= (
    run\_agent\_with\_ptc(query)
)

╭────────────────────────────────────────────── Claude API Response ──────────────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 4,134 in • 539 out • 4,673 total                                           │
│ ├── Model: claude-sonnet-4-6                                                                           │
│ ├── Stop Reason: tool\_use                                                                                       │
│ └── Content (3 blocks)                                                                                          │
│     ├── Block 1                                                                                                 │
│     │   └── Text                                                                                                │
│     │       └── I'll help you identify which engineering team members exceeded their Q3 travel budget. Let me   │
│     │           start by getting the engineering team members and their expenses.                               │
│     ├── Block 2                                                                                                 │
│     │   └── Server Tool Use                                                                                     │
│     │       ├── ID: srvtoolu\_015mWPqaFni4B313UieCxbny                                                           │
│     │       ├── Caller: direct                                                                                  │
│     │       └── Code:                                                                                           │
│     │           └──  1  │
│     │               2 import asyncio                                                                         │
│     │               3 import json                                                                            │
│     │                4  │
│     │               5 async def main():                                                                      │
│     │                6 \# First, get all engineering team members                                          │
│     │                7 team\_members\_json \= await get\_team\_members({'department': 'engineering'})          │
│     │                8 team\_members \= json.loads(team\_members\_json)                                       │
│     │                9  │
│     │               10     print(f"Found {len(team\_members)} engineering team members")                       │
│     │               11  │
│     │               12 \# Get Q3 expenses for all team members in parallel                                 │
│     │               13 expense\_tasks \= \[                                                                  │
│     │               14         get\_expenses({'employee\_id': member\['id'\], 'quarter': 'Q3'})                   │
│     │               15 for member in team\_members                                                     │
│     │               16     \]                                                                                  │
│     │               17  │
│     │               18 expenses\_results \= await asyncio.gather(\*expense\_tasks)                            │
│     │               19  │
│     │               20 \# Calculate travel expenses for each member                                        │
│     │               21 travel\_spending \= {}                                                               │
│     │               22 for i, member in enumerate(team\_members):                                          │
│     │               23 expenses \= json.loads(expenses\_results\[i\])                                     │
│     │               24 \# Only count approved expenses in travel category                              │
│     │               25 travel\_total \= sum(                                                            │
│     │               26             expense\['amount'\]  │
│     │               27 for expense in expenses │
│     │               28 if expense\['category'\] \== 'travel' and expense\['status'\] \== 'approved'     │
│     │               29         )                                                                              │
│     │               30         travel\_spending\[member\[                                                        │
│     │               31 ... (truncated)                                                                        │
│     └── Block 3                                                                                                 │
│         └── Tool Use: get\_team\_members                                                                          │
│             ├── ID: toolu\_016EtCE7G5rH645G3gvjzrP6                                                              │
│             ├── Caller: code execution environment                                                              │
│             └── Input:                                                                                          │
│                 └── {                                                                                           │
│                     "department": "engineering"                                                               │
│                     }                                                                                           │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

\[Container\] ID: container\_011CVSAwq5J4vNPi3A4P2Rwh
\[Container\] Expires at: 2025-11-24 05:41:17.467494+00:00
\[PTC\] Tool called from code execution environment: get\_team\_members

╭──────────────────── Claude API Response ────────────────────╮
│ Claude Message (assistant) │ tokens: 0 in • 0 out • 0 total │
│ ├── Model: claude-sonnet-4-6                       │
│ ├── Stop Reason: tool\_use                                   │
│ └── Content (8 blocks)                                      │
│     ├── Block 1                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01Nq2au3W69RmDFZaSdqe6u1          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG007",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 2                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01YYw9cuTSXk7bu7P38qBz6P          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG005",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 3                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01Fyxxe2KmVpVmw4jJL2CXSz          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG008",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 4                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01J4ovDu2UJa9Se19vxKTa6y          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG006",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 5                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01T24CrvQYA3LqGfZftCmueC          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG003",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 6                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01HotYZN6sk3gMLkpdWXbdz4          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG004",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     ├── Block 7                                             │
│     │   └── Tool Use: get\_expenses                          │
│     │       ├── ID: toolu\_01AxvEqi3AKqdnH44kGH1U6E          │
│     │       ├── Caller: code execution environment          │
│     │       └── Input:                                      │
│     │           └── {                                       │
│     │               "employee\_id": "ENG002",              │
│     │               "quarter": "Q3"                       │
│     │               }                                       │
│     └── Block 8                                             │
│         └── Tool Use: get\_expenses                          │
│             ├── ID: toolu\_01A4agznkK1jA4AyJo3H2jpg          │
│             ├── Caller: code execution environment          │
│             └── Input:                                      │
│                 └── {                                       │
│                     "employee\_id": "ENG001",              │
│                     "quarter": "Q3"                       │
│                     }                                       │
╰─────────────────────────────────────────────────────────────╯

\[Container\] ID: container\_011CVSAwq5J4vNPi3A4P2Rwh
\[Container\] Expires at: 2025-11-24 05:41:19.266670+00:00
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses
\[PTC\] Tool called from code execution environment: get\_expenses

╭─────────────────────────────────────── Claude API Response ───────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 4,751 in • 679 out • 5,430 total                             │
│ ├── Model: claude-sonnet-4-6                                                             │
│ ├── Stop Reason: tool\_use                                                                         │
│ └── Content (6 blocks)                                                                            │
│     ├── Block 1                                                                                   │
│     │   └── Code Execution Result: Success (exit 0)                                               │
│     │       └── stdout:                                                                           │
│     │           └── Found 8 engineering team members                                              │
│     │                                                                                             │
│     │               Employees who exceeded $5,000 standard budget: 3                              │
│     │               ENG001: Alice Chen - $9177.88                                                 │
│     │               ENG003: Carol White - $6483.49                                                │
│     │               ENG007: Grace Taylor - $5289.35                                               │
│     │                                                                                             │
│     ├── Block 2                                                                                   │
│     │   └── Text                                                                                  │
│     │       └── Now let me check if any of these three employees have custom budget exceptions:   │
│     ├── Block 3                                                                                   │
│     │   └── Server Tool Use                                                                       │
│     │       ├── ID: srvtoolu\_015GTpFmCbd2JPAQLAioB4Qb                                             │
│     │       ├── Caller: direct                                                                    │
│     │       └── Code:                                                                             │
│     │           └──  1  │
│     │               2 import asyncio                                                           │
│     │               3 import json                                                              │
│     │                4  │
│     │               5 async def main():                                                        │
│     │                6 \# Check custom budgets for the three employees who exceeded standard │
│     │                7 exceeded\_ids \= \['ENG001', 'ENG003', 'ENG007'\]                        │
│     │                8 exceeded\_amounts \= {                                                 │
│     │                9 'ENG001': {'name': 'Alice Chen', 'travel\_total': 9177.88},       │
│     │               10 'ENG003': {'name': 'Carol White', 'travel\_total': 6483.49},      │
│     │               11 'ENG007': {'name': 'Grace Taylor', 'travel\_total': 5289.35}      │
│     │               12     }                                                                    │
│     │               13  │
│     │               14 \# Get custom budgets in parallel                                     │
│     │               15 budget\_tasks \= \[                                                     │
│     │               16         get\_custom\_budget({'user\_id': emp\_id})                           │
│     │               17 for emp\_id in exceeded\_ids                                       │
│     │               18     \]                                                                    │
│     │               19  │
│     │               20 budget\_results \= await asyncio.gather(\*budget\_tasks)                 │
│     │               21  │
│     │               22 \# Analyze who truly exceeded their budget                            │
│     │               23 truly\_exceeded \= \[\]                                                  │
│     │               24  │
│     │               25 for i, emp\_id in enumerate(exceeded\_ids):                            │
│     │               26 budget\_info \= json.loads(budget\_results\[i\])                      │
│     │               27 actual\_budget \= budget\_info\['travel\_budget'\]                     │
│     │               28 travel\_total \= exceeded\_amounts\[emp\_id\]\['travel\_total'\]          │
│     │               29 name \= exceeded\_amounts\[emp\_id\]\['name'\]                          │
│     │               30  │
│     │               31 if travel\_total \> actua                                          │
│     │               32 ... (truncated)                                                          │
│     ├── Block 4                                                                                   │
│     │   └── Tool Use: get\_custom\_budget                                                           │
│     │       ├── ID: toolu\_01EaaJ3SikeniibPsEdAqXo8                                                │
│     │       ├── Caller: code execution environment                                                │
│     │       └── Input:                                                                            │
│     │           └── {                                                                             │
│     │               "user\_id": "ENG003"                                                         │
│     │               }                                                                             │
│     ├── Block 5                                                                                   │
│     │   └── Tool Use: get\_custom\_budget                                                           │
│     │       ├── ID: toolu\_01E5bqQ4xKX7FTdhh6xLkw4E                                                │
│     │       ├── Caller: code execution environment                                                │
│     │       └── Input:                                                                            │
│     │           └── {                                                                             │
│     │               "user\_id": "ENG001"                                                         │
│     │               }                                                                             │
│     └── Block 6                                                                                   │
│         └── Tool Use: get\_custom\_budget                                                           │
│             ├── ID: toolu\_01PLF38q7ndVQB4mqdqaFt7u                                                │
│             ├── Caller: code execution environment                                                │
│             └── Input:                                                                            │
│                 └── {                                                                             │
│                     "user\_id": "ENG007"                                                         │
│                     }                                                                             │
╰───────────────────────────────────────────────────────────────────────────────────────────────────╯

\[Container\] ID: container\_011CVSAwq5J4vNPi3A4P2Rwh
\[Container\] Expires at: 2025-11-24 05:41:33.430636+00:00
\[PTC\] Tool called from code execution environment: get\_custom\_budget
\[PTC\] Tool called from code execution environment: get\_custom\_budget
\[PTC\] Tool called from code execution environment: get\_custom\_budget

╭────────────────────────────────────────────── Claude API Response ──────────────────────────────────────────────╮
│ Claude Message (assistant) │ tokens: 5,611 in • 205 out • 5,816 total                                           │
│ ├── Model: claude-sonnet-4-6                                                                           │
│ ├── Stop Reason: end\_turn                                                                                       │
│ └── Content (2 blocks)                                                                                          │
│     ├── Block 1                                                                                                 │
│     │   └── Code Execution Result: Success (exit 0)                                                             │
│     │       └── stdout:                                                                                         │
│     │           └── ENGINEERING TEAM MEMBERS WHO EXCEEDED THEIR Q3 TRAVEL BUDGET:                               │
│     │               \================================================================================            │
│     │                                                                                                           │
│     │               Alice Chen (ENG001)                                                                         │
│     │                 Budget Limit: $5,000.00 (Standard)                                                        │
│     │                 Travel Spending: $9,177.88                                                                │
│     │                 Exceeded By: $4,177.88                                                                    │
│     │                                                                                                           │
│     │               Carol White (ENG003)                                                                        │
│     │                 Budget Limit: $5,000.00 (Standard)                                                        │
│     │                 Travel Spending: $6,483.49                                                                │
│     │                 Exceeded By: $1,483.49                                                                    │
│     │                                                                                                           │
│     │               Grace Taylor (ENG007)                                                                       │
│     │                 Budget Limit: $5,000.00 (Standard)                                                        │
│     │                 Travel Spending: $5,289.35                                                                │
│     │                 Exceeded By: $289.35                                                                      │
│     │                                                                                                           │
│     └── Block 2                                                                                                 │
│         └── Text                                                                                                │
│             └── \## Summary                                                                                      │
│                                                                                                                 │
│                 \*\*Three engineering team members exceeded their Q3 travel budget:\*\*                             │
│                                                                                                                 │
│                 1\. \*\*Alice Chen (ENG001)\*\*                                                                      │
│                    - Budget: $5,000 (Standard)                                                                  │
│                    - Spent: $9,177.88                                                                           │
│                    - Over budget by: \*\*$4,177.88\*\*                                                              │
│                                                                                                                 │
│                 2\. \*\*Carol White (ENG003)\*\*                                                                     │
│                    - Budget: $5,000 (Standard)                                                                  │
│                    - Spent: $6,483.49                                                                           │
│                    - Over budget by: \*\*$1,483.49\*\*                                                              │
│                                                                                                                 │
│                 3\. \*\*Grace Taylor (ENG007)\*\*                                                                    │
│                    - Budget: $5,000 (Standard)                                                                  │
│                    - Spent: $5,289.35                                                                           │
│                    - Over budget by: \*\*$289.35\*\*                                                                │
│                                                                                                                 │
│                 All three employees are on the standard $5,000 quarterly travel budget with no custom           │
│                 exceptions, so they all genuinely exceeded their allocated travel budget for Q3.                │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

In \[10\]:

print(f"\\n{'=' \* 60}")
print(f"Result: {result\_ptc}")
print(f"\\n{'=' \* 60}")
print("Performance Metrics:")
print(
    f"  Total API calls to Claude: {len(\[m for m in conversation\_ptc if m\['role'\] == 'assistant'\])}"
)
print(f"  Total tokens used: {total\_tokens\_ptc:,}")
print(f"  Total time taken: {elapsed\_time\_ptc:.2f}s")

\============================================================
Result: ## Summary

\*\*Three engineering team members exceeded their Q3 travel budget:\*\*

1. \*\*Alice Chen (ENG001)\*\*
   - Budget: $5,000 (Standard)
   - Spent: $9,177.88
   - Over budget by: \*\*$4,177.88\*\*

2. \*\*Carol White (ENG003)\*\*
   - Budget: $5,000 (Standard)
   - Spent: $6,483.49
   - Over budget by: \*\*$1,483.49\*\*

3. \*\*Grace Taylor (ENG007)\*\*
   - Budget: $5,000 (Standard)
   - Spent: $5,289.35
   - Over budget by: \*\*$289.35\*\*

All three employees are on the standard $5,000 quarterly travel budget with no custom exceptions, so they all genuinely exceeded their allocated travel budget for Q3.

============================================================
Performance Metrics:
  Total API calls to Claude: 3
  Total tokens used: 15,919
  Total time taken: 34.88s

Performance Comparison[¶](#Performance-Comparison)
--------------------------------------------------

Let's compare the performance between traditional tool calling and PTC:

**Note on API Call Count:** You may notice that PTC requires more API calls in this example. This is because PTC writes more structured, sequential code that follows best practices—for instance, separating the expense fetching step from the budget checking step. Traditional tool calling can sometimes batch operations together in a single turn, but at the cost of sending all raw data through the model's context. The token efficiency gains from PTC far outweigh the minimal increase in round trips, especially when working with large, metadata-rich datasets.

In \[11\]:

import pandas as pd

\# Create comparison dataframe
comparison\_data \= {
    "Metric": \[
        "API Calls",
        "Total Tokens",
        "Elapsed Time (s)",
        "Token Reduction",
        "Time Reduction",
    \],
    "Traditional": \[
        api\_count\_without\_ptc,
        f"{total\_tokens:,}",
        f"{elapsed\_time:.2f}",
        "-",
        "-",
    \],
    "PTC": \[
        api\_count\_with\_ptc,
        f"{total\_tokens\_ptc:,}",
        f"{elapsed\_time\_ptc:.2f}",
        f"{((total\_tokens - total\_tokens\_ptc) / total\_tokens \* 100):.1f}%",
        f"{((elapsed\_time - elapsed\_time\_ptc) / elapsed\_time \* 100):.1f}%",
    \],
}

df \= pd.DataFrame(comparison\_data)
print(df.to\_string(index\=False))

          Metric Traditional    PTC
       API Calls           4      4
    Total Tokens     110,473 15,919
Elapsed Time (s)       35.38  34.88
 Token Reduction           -  85.6%
  Time Reduction           -   1.4%

Key Takeaways[¶](#Key-Takeaways)
--------------------------------

In this example, PTC demonstrated significant performance improvements through three core capabilities:

### 1\. Context Preservation Through Large Data Parsing[¶](#1.-Context-Preservation-Through-Large-Data-Parsing)

This was the primary benefit demonstrated in our workflow. Claude wrote code to fetch and process hundreds of expense line items within the code execution environment. By processing this data programmatically, Claude parsed JSON, filtered by status, summed amounts by category, and compared against budget limits—all without sending the raw expense data and metadata through the model's context window. This resulted in a **significant reduction in token usage**.

### 2\. Sequential Dependency Optimization[¶](#2.-Sequential-Dependency-Optimization)

The API has a sequential dependency: `get_custom_budget(user_id)` which can only be called after analyzing expenses to identify who exceeded the standard $5,000 budget. In traditional tool calling, this requires multiple round trips—fetch team members, fetch expenses for each person, identify those over budget, then check their custom budgets one by one. With PTC, Claude writes code that orchestrates this entire workflow in the code execution environment, making programmatic tool calls in a loop and maintaining state across calls. This transforms what would be many sequential API round trips into fewer calls with smarter orchestration.

### 3\. Computational Logic in Code Execution[¶](#3.-Computational-Logic-in-Code-Execution)

Rather than requiring the model to mentally track and sum dozens of expenses with complex metadata, Claude delegated the arithmetic and aggregation logic to Python code. This reduced cognitive load on the model, ensured precise calculations, and kept irrelevant metadata (like receipt URLs and merchant locations) out of the model's context entirely.

* * *

When to Use PTC[¶](#When-to-Use-PTC)
------------------------------------

PTC is most beneficial when:

*   **Working with large, metadata-rich datasets** that need filtering, parsing, or aggregation (like our expense analysis with receipt URLs, approval chains, merchant details, etc.)
*   **Sequential dependencies exist** where one tool call depends on the results of previous calls (like checking custom budgets only for employees who exceeded standard limits)
*   **Multiple tool calls are needed** in sequence or in loops across similar entities (checking expenses and budgets for each team member)
*   **Computational logic** can reduce what needs to flow through the model's context
*   **Tools are safe** for programmatic/repeated execution without human oversight

Conclusion[¶](#Conclusion)
--------------------------

Our team expense analysis demonstrated PTC's strengths: **dramatically reducing context consumption when working with large, metadata-rich datasets** and **optimizing workflows with sequential dependencies**. By allowing Claude to write code that orchestrates tool calls and processes results programmatically, we achieved substantial token savings while maintaining accuracy and insight quality.

PTC is particularly valuable for workflows involving bulk data processing with rich metadata, repeated tool invocations with dependencies, or scenarios where raw tool outputs would otherwise pollute the model's context.

Next Steps[¶](#Next-Steps)
--------------------------

Try adapting this pattern to your own use cases:

*   Financial data analysis and reporting with sequential lookups
*   Multi-entity health checks that depend on initial scan results
*   Large file processing with metadata (CSV, JSON, XML parsing)
*   Database query result aggregation with follow-up queries
*   Batch API operations with conditional logic based on initial results
