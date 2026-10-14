# Historical LangGraph Memory Server

This directory preserves the former CRUD graph for data export and historical inspection. It is no longer started by the default Compose files or called by the NestJS memory module. Do not use this development server as the current memory storage backend.

Long-term memories now live in MySQL; optional Qdrant indexes are rebuilt from MySQL. Existing MySQL mirrors, external IDs and provider payloads are retained. See [memory architecture](../docs/MEMORY-ARCHITECTURE.md) for migration and rollback.
