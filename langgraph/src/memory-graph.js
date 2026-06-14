import { END, START, StateGraph, MessagesAnnotation } from "@langchain/langgraph";

async function passthrough() {
  return {};
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("passthrough", passthrough)
  .addEdge(START, "passthrough")
  .addEdge("passthrough", END)
  .compile();
