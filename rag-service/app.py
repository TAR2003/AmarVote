from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from rag_processor import RAGProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize RAG processor
rag_processor = None

def initialize_rag():
    """Initialize the RAG processor and process available documents."""
    global rag_processor
    try:
        rag_processor = RAGProcessor()
        
        # List of documents to process
        documents = [
            {
                "path": "/app/data/EG_Spec_2_1.pdf",
                "name": "ElectionGuard_Specification_v2.1",
                "type": "ElectionGuard_Specification"
            },
            {
                "path": "/app/data/AmarVote_User_Guide.md",
                "name": "AmarVote_User_Guide",
                "type": "AmarVote_User_Guide"
            }
        ]
        
        # For local development, check local paths if Docker paths don't exist
        for doc in documents:
            if not os.path.exists(doc["path"]):
                # Try local path alternatives
                if "EG_Spec_2_1.pdf" in doc["path"]:
                    local_path = "./EG_Spec_2_1.pdf"
                    if os.path.exists(local_path):
                        doc["path"] = local_path
                elif "AmarVote_User_Guide.md" in doc["path"]:
                    local_path = "./AmarVote_User_Guide.md"
                    if os.path.exists(local_path):
                        doc["path"] = local_path
        
        processed_count = 0
        for doc in documents:
            if os.path.exists(doc["path"]):
                logger.info(f"Processing {doc['name']}...")
                success = rag_processor.process_document(
                    doc["path"], 
                    doc["name"], 
                    doc["type"]
                )
                if success:
                    logger.info(f"{doc['name']} processed successfully")
                    processed_count += 1
                else:
                    logger.error(f"Failed to process {doc['name']}")
            else:
                logger.warning(f"Document not found at {doc['path']}")
        
        logger.info(f"RAG initialization complete. Processed {processed_count}/{len(documents)} documents.")
            
    except Exception as e:
        logger.error(f"Error initializing RAG: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "rag-service"})

@app.route('/search', methods=['POST'])
def search():
    """Search for relevant information based on query."""
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query is required"}), 400
        
        query = data['query']
        k = data.get('k', 5)  # Number of results to return
        
        if not rag_processor:
            return jsonify({"error": "RAG processor not initialized"}), 500
        
        # Perform similarity search
        results = rag_processor.similarity_search(query, k=k)
        
        return jsonify({
            "query": query,
            "results": results,
            "count": len(results)
        })
        
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/context', methods=['POST'])
def get_context():
    """Get relevant context for a query, formatted for LLM."""
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query is required"}), 400
        
        query = data['query']
        max_length = data.get('max_length', 2000)
        document_type = data.get('document_type', None)  # Filter by document type if specified
        
        if not rag_processor:
            return jsonify({"error": "RAG processor not initialized"}), 500
        
        # Get relevant context
        context = rag_processor.get_relevant_context(query, max_length, document_type)
        
        return jsonify({
            "query": query,
            "context": context,
            "max_length": max_length,
            "document_type": document_type
        })
        
    except Exception as e:
        logger.error(f"Error in context endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/reindex', methods=['POST'])
def reindex():
    """Reprocess documents and rebuild the vector store."""
    try:
        if not rag_processor:
            return jsonify({"error": "RAG processor not initialized"}), 500
        
        # Re-initialize to reprocess all documents
        initialize_rag()
        
        return jsonify({"message": "Documents reprocessed successfully"})
            
    except Exception as e:
        logger.error(f"Error in reindex endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/documents', methods=['GET'])
def list_documents():
    """List available document types in the vector store."""
    try:
        if not rag_processor:
            return jsonify({"error": "RAG processor not initialized"}), 500
        
        # This is a simple implementation - in a real scenario, you might want to 
        # query the vector store for available document types
        available_docs = [
            {
                "type": "ElectionGuard_Specification",
                "description": "ElectionGuard cryptographic voting specification",
                "topics": ["encryption", "cryptography", "ballot security", "verification", "guardians"]
            },
            {
                "type": "AmarVote_User_Guide", 
                "description": "AmarVote platform user guide and documentation",
                "topics": ["voting process", "creating elections", "verification", "account management", "platform features"]
            }
        ]
        
        return jsonify({
            "available_documents": available_docs,
            "total_count": len(available_docs)
        })
        
    except Exception as e:
        logger.error(f"Error in documents endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # Initialize RAG on startup
    initialize_rag()
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5001, debug=False)
