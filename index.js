import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { config } from 'dotenv';

config();

/**
 * Initialize the LLM
 */
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
});

/**
 * Define the tools
 */
const add = tool(
    async ({ a, b }) => {
      return a + b;
    },
    {
      name: "add",
      description: "Add two numbers together",
      schema: z.object({
        a: z.number().describe("first number"),
        b: z.number().describe("second number"),
      }),
    }
);
  
    
const multiply = tool(
    async ({ a, b }) => {
      return a * b;
    },
    {
      name: "multiply",
      description: "multiplies two numbers together",
      schema: z.object({
        a: z.number("the first number"),
        b: z.number("the second number"),
      }),
    }
);

const divide = tool(
    async ({ a, b }) => {
      return a / b;
    },
    {
      name: "divide",
      description: "Divide two numbers",
      schema: z.object({
        a: z.number().describe("first number"),
        b: z.number().describe("second number"),
      }),
    }
);

// Augment the LLM with tools
const tools = [add, multiply, divide];
const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
const llmWithTools = llm.bindTools(tools);

/**
 * Define the graph
 */

// LLM decides whether to call a tool or not
async function llmCall(state) {
    // LLM decides whether to call a tool or not
    const result = await llmWithTools.invoke([
      {
        role: "system",
        content: "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
      },
      ...state.messages
    ]);
  
    return {
      messages: [result]
    };
}

const toolNode = new ToolNode(tools);

// Conditional edge function to route to the tool node or end
function shouldContinue(state) {
    const messages = state.messages;
    const lastMessage = messages.at(-1);
  
    // If the LLM makes a tool call, then perform an action
    if (lastMessage?.tool_calls?.length) {
      return "Action";
    }
    // Otherwise, we stop (reply to the user)
    return "__end__";
  }
  
  // Build workflow (state graph)
  const agentBuilder = new StateGraph(MessagesAnnotation)
    .addNode("llmCall", llmCall)
    .addNode("tools", toolNode)
    // Add edges to connect nodes
    .addEdge("__start__", "llmCall")
    .addConditionalEdges(
      "llmCall",
      shouldContinue,
      {
        // Name returned by shouldContinue : Name of next node to visit
        "Action": "tools",
        "__end__": "__end__",
      }
    )
    .addEdge("tools", "llmCall")
    .compile();
  
  // Invoke
  const messages = [{
    role: "user",
    content: "First add 3 and 4. Second, divide 10 by 2. And finally multiply both the results."
  }];
  const result = await agentBuilder.invoke({ messages });
  console.log(result.messages);
  

