# RAG Service for AmarVote Documentation

This microservice provides Retrieval-Augmented Generation (RAG) capabilities for querying both ElectionGuard technical documentation and AmarVote platform user guides. It processes multiple document types and provides contextual information to enhance chatbot responses.

## Features

- **Multi-Document Support**: Processes both PDF and Markdown documents
- **PDF Processing**: Extracts and chunks text from the ElectionGuard specification PDF
- **Markdown Processing**: Processes AmarVote user guide in Markdown format
- **Vector Storage**: Uses ChromaDB for efficient similarity search
- **Semantic Search**: Provides relevant context based on user queries
- **Document Type Filtering**: Can filter responses by document type (ElectionGuard vs AmarVote)
- **REST API**: Simple HTTP endpoints for integration with the main application

## Supported Documents

### ElectionGuard Specification
- **Type**: `ElectionGuard_Specification`
- **Format**: PDF
- **Content**: Technical cryptographic voting specification
- **Topics**: Encryption, cryptography, ballot security, verification, guardians

### AmarVote User Guide  
- **Type**: `AmarVote_User_Guide`
- **Format**: Markdown
- **Content**: Platform usage instructions and user guidance
- **Topics**: Voting process, creating elections, verification, account management, platform features

## Architecture

```
RAG Service
├── PDF Processing (PyPDF2)
├── Markdown Processing (Native Python)
├── Text Chunking (LangChain)
├── Embedding Generation (HuggingFace Transformers)
├── Vector Store (ChromaDB)
└── REST API (Flask)
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns service health status

### Search Documents
- **POST** `/search`
- Body: `{"query": "your question", "k": 5}`
- Returns similar document chunks

### Get Context with Document Filter
- **POST** `/context`
- Body: `{"query": "your question", "max_length": 2000, "document_type": "ElectionGuard_Specification"}`
- Returns formatted context for LLM with optional document type filtering

### List Available Documents
- **GET** `/documents`
- Returns list of available document types and their descriptions

### Reindex Documents
- **POST** `/reindex`
- Reprocesses the PDF and rebuilds the vector store

## Environment Variables

- `FLASK_ENV`: Flask environment (production/development)
- `RAG_SERVICE_PORT`: Service port (default: 5001)
- `VECTORSTORE_PATH`: Path to persist vector store
- `PDF_PATH`: Path to the ElectionGuard PDF (deprecated - now auto-detected)

## Document Locations

The RAG service expects documents in the `/app/data/` directory:
- ElectionGuard PDF: `/app/data/EG_Spec_2_1.pdf`
- AmarVote User Guide: `/app/data/AmarVote_User_Guide.md`

## Setup and Usage

### Development Setup
1. Copy documents to RAG service directory:
   ```bash
   cp backend/src/main/resources/pdf/EG_Spec_2_1.pdf rag-service/
   cp backend/src/main/resources/pdf/AmarVote_User_Guide.md rag-service/
   ```

2. Install dependencies:
   ```bash
   cd rag-service
   pip install -r requirements.txt
   ```

3. Initialize the system:
   ```bash
   python setup_rag.py
   ```

4. Start the service:
   ```bash
   python app.py
   ```

5. Test the system:
   ```bash
   python test_amarvote_rag.py
   ```

## Docker Usage

The service is designed to run as a Docker container within the AmarVote ecosystem:

```bash
# Build the container
docker build -t rag-service .

# Run with docker-compose
docker-compose up rag-service
```

## Integration

The RAG service is integrated with the main Java backend through the `RAGService` class, which:

1. Detects ElectionGuard-related queries
2. Fetches relevant context from this service
3. Enhances prompts for the DeepSeek API
4. Returns contextually-aware responses

## Data Flow

1. User asks a question about ElectionGuard
2. Java backend determines if it's ElectionGuard-related
3. RAG service searches for relevant context
4. Enhanced prompt is sent to DeepSeek API
5. AI generates response based on official documentation
