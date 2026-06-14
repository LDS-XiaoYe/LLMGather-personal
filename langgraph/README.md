# LLMGather LangGraph Memory Server

This directory is the LangGraph API project mounted by the `langgraph-memory`
service in Docker Compose.

It exposes the `memory` graph from `src/memory-graph.js`. The graph is not a
placeholder: it normalizes memory requests, routes them to `put`, `search`,
`get`, or `delete` nodes, uses the LangGraph persistent Store, and returns
structured `status`, `result`, `results`, and `audit` fields for the backend.

The backend talks to this graph through `LANGGRAPH_MEMORY_URL` and assistant id
`memory` by default. Override the id with `LANGGRAPH_MEMORY_ASSISTANT_ID` only
if `langgraph.json` changes.
