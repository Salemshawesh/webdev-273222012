const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

// ─── Load lectures data ───────────────────────────────────────────────────────
const lectures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "lectures.json"), "utf8")
);

// ─── Helper functions ─────────────────────────────────────────────────────────
function findLecture(number) {
  return lectures.find((lecture) => lecture.number === number);
}

function listLectures() {
  return lectures
    .map((lecture) => `${lecture.number}. ${lecture.title}`)
    .join("\n");
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const tools = [
  {
    name: "find_lecture",
    description:
  "Find a course lecture by its number and return its title and topics.",
    inputSchema: {
      type: "object",
      properties: {
        number: {
          type: "integer",
          description: "Lecture number from 1 to 10",
        },
      },
      required: ["number"],
    },
  },
  {
    name: "list_lectures",
    description:
      "List all available course lectures with their numbers and titles.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────
function sendResponse(id, result) {
  const response = {
    jsonrpc: "2.0",
    id,
    result,
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendError(id, code, message) {
  const response = {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

// ─── Main request handler ─────────────────────────────────────────────────────
const input = readline.createInterface({
  input: process.stdin,
});

input.on("line", (line) => {
  // Required by Lab 1: log every incoming message to stderr
  console.error("got: " + line);

  let request;

  // 1. Convert the input line from JSON to an object
  try {
    request = JSON.parse(line);
  } catch (err) {
    return;
  }

  const { id, method, params } = request;

  // 2. Check which method the client requested
  switch (method) {
    // ── tools/list ──────────────────────────────────────────────────────────
    case "tools/list": {
      sendResponse(id, { tools });
      break;
    }

    // ── tools/call ──────────────────────────────────────────────────────────
    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments ?? {};

      if (toolName === "find_lecture") {
        const lecture = findLecture(args.number);

        // Invalid lecture → return MCP tool result with isError: true
        if (!lecture) {
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: `Lecture ${args.number} not found`,
              },
            ],
            isError: true,
          });
          return;
        }

        // topics is a string
        const text = `${lecture.title}\nTopics: ${lecture.topics}`;

        sendResponse(id, {
          content: [
            {
              type: "text",
              text,
            },
          ],
        });
      } else if (toolName === "list_lectures") {
        const text = listLectures();

        sendResponse(id, {
          content: [
            {
              type: "text",
              text,
            },
          ],
        });
      } else {
        // Unknown tool → -32602
        sendError(id, -32602, `Unknown tool: ${toolName}`);
      }
      break;
    }

    // ── initialize ──────────────────────────────────────────────────────────
    case "initialize": {
      sendResponse(id, {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "lectures-server",
          version: "1.0.0",
        },
      });
      break;
    }

    case "notifications/initialized":
    case "notifications/cancelled": {
      // No response needed for notifications
      break;
    }

    // ── Unknown method ──────────────────────────────────────────────────────
    default: {
      sendError(id, -32601, `Method not found: ${method}`);
    }
  }
});