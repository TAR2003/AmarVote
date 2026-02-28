# 🤖 RAG AI Assistant Service

**Status:** Infrastructure complete — **commented out by default** in docker-compose files  
**Technology:** Python · Flask · LangChain · ChromaDB · sentence-transformers  
**Port:** `5001`

---

## Overview

The RAG (Retrieval-Augmented Generation) service provides intelligent, document-grounded answers to user questions about AmarVote. Instead of relying purely on an LLM's training data, it retrieves relevant passages from authoritative documents before answering.

**Knowledge base:**
1. **AmarVote User Guide** (`AmarVote_User_Guide.md`) — Step-by-step instructions for all platform features
2. **ElectionGuard Specification 2.1** (`EG_Spec_2_1.pdf`) — Microsoft's technical ElectionGuard specification

---

## How RAG Works

```
User question
    │
    ▼
Embedding model encodes question → query vector
    │
    ▼
ChromaDB vector similarity search on indexed documents
    │
    ▼
Top-K most relevant passages retrieved
    │
    ▼
Context + question sent to LLM (DeepSeek via OpenRouter)
    │
    ▼
Grounded answer returned
```

This prevents hallucination: the LLM cites actual document content rather than guessing.

---

## Project Structure

```
rag-service/
├── app.py                     ← Flask application (port 5001)
├── rag_processor.py           ← RAGProcessor class (vectorization, search, context)
├── setup_rag.py               ← Document indexing setup
├── start.sh                   ← Container startup script
├── AmarVote_User_Guide.md     ← Primary user-facing knowledge base document
├── requirements.txt
├── Dockerfile
├── test_rag.py                ← Integration tests
└── test_amarvote_rag.py       ← AmarVote-specific RAG tests
```

---

## API Endpoints

### `GET /health`

```json
{
  "status": "healthy",
  "service": "rag-service"
}
```

### `POST /search`

Direct similarity search — returns raw matching passages.

**Request:**
```json
{
  "query": "How do guardians decrypt the tally?",
  "k": 5
}
```

**Response:**
```json
{
  "query": "How do guardians decrypt the tally?",
  "results": [
    {
      "content": "...relevant passage...",
      "metadata": { "source": "AmarVote_User_Guide", "page": 12 },
      "score": 0.87
    }
  ],
  "count": 5
}
```

### `POST /context`

Returns assembled context string ready for LLM injection.

**Request:**
```json
{
  "query": "What is the Benaloh challenge?",
  "max_length": 2000,
  "document_type": "ElectionGuard_Specification"
}
```

**Response:**
```json
{
  "query": "What is the Benaloh challenge?",
  "context": "The Benaloh challenge is a method by which a voter can demand...\n[continued relevant passages, up to 2000 chars]",
  "max_length": 2000,
  "document_type": "ElectionGuard_Specification"
}
```

`document_type` filter — values:
- `"AmarVote_User_Guide"` — How-to content for platform use
- `"ElectionGuard_Specification"` — Technical cryptographic details
- `null` — Search across all documents

### `POST /reindex`

Forces re-processing and re-indexing of all documents. Useful after updating knowledge base files.

### `GET /documents`

Returns available document types and their topic coverage.

---

## Integration with Backend Chatbot

`RAGService.java` in the backend calls this service to retrieve context before sending to DeepSeek:

```java
// In ChatbotController, when query intent is AMARVOTE_USER_GUIDE:
String context = ragService.getAmarVotePlatformContext(userMessage);

// When intent is ELECTIONGUARD_TECHNICAL:
String context = ragService.getElectionGuardContext(userMessage, "ElectionGuard_Specification");

// Context is prepended to the LLM system prompt:
// "Using the following official documentation, answer the user's question:
//  {context}
//  
//  User: {userMessage}"
```

---

## Technology Stack

| Package | Version | Purpose |
|---|---|---|
| Flask | 3.0.0 | HTTP framework |
| flask-cors | 4.0.0 | CORS headers |
| LangChain | 0.1.20 | RAG pipeline orchestration |
| langchain-community | 0.0.38 | Document loaders, vector stores |
| ChromaDB | 0.5.0 | Local vector database |
| sentence-transformers | 3.0.1 | Text embedding model (open-source, runs locally) |
| pypdf | 4.3.1 | PDF parsing (`EG_Spec_2_1.pdf`) |
| faiss-cpu | 1.8.0 | Alternative similarity search index |
| openai | 1.40.0 | API client (used for OpenRouter compatibility) |
| tiktoken | 0.7.0 | Token counting for context length management |
| numpy | 1.26.4 | Vector math |

---

## Enabling the RAG Service

Uncomment in `docker-compose.yml`:

```yaml
# rag-service:
#   build:
#     context: ./rag-service
#     dockerfile: Dockerfile
#   environment:
#     - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
#   volumes:
#     - ./rag-service/data:/app/data
#   ports:
#     - "5001:5001"
```

Also uncomment `RAG_SERVICE_URL=http://rag-service:5001` in backend environment.

Requires `DEEPSEEK_API_KEY` (OpenRouter API key with `deepseek/deepseek-chat-v3-0324:free` model access).
