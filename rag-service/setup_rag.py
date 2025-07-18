#!/usr/bin/env python3
"""
Setup script to initialize AmarVote RAG system with both documents
"""

import os
import sys
import logging
from rag_processor import RAGProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_rag_system():
    """Initialize RAG system with both ElectionGuard and AmarVote documents"""
    print("🚀 Initializing AmarVote RAG System")
    print("=" * 50)
    
    try:
        # Initialize RAG processor
        rag_processor = RAGProcessor(persist_directory="./vectorstore")
        
        # Documents to process
        documents = [
            {
                "path": "./EG_Spec_2_1.pdf",  # Local path for development
                "name": "ElectionGuard_Specification_v2.1",
                "type": "ElectionGuard_Specification",
                "description": "ElectionGuard cryptographic voting specification"
            },
            {
                "path": "./AmarVote_User_Guide.md",  # Local path for development
                "name": "AmarVote_User_Guide", 
                "type": "AmarVote_User_Guide",
                "description": "AmarVote platform user guide and documentation"
            }
        ]
        
        processed_count = 0
        total_chunks = 0
        
        for doc in documents:
            print(f"\n📄 Processing {doc['description']}...")
            
            if os.path.exists(doc["path"]):
                print(f"   ✅ Found: {doc['path']}")
                success = rag_processor.process_document(
                    doc["path"], 
                    doc["name"], 
                    doc["type"]
                )
                
                if success:
                    print(f"   ✅ Successfully processed {doc['name']}")
                    processed_count += 1
                else:
                    print(f"   ❌ Failed to process {doc['name']}")
            else:
                print(f"   ❌ Document not found: {doc['path']}")
                print(f"      You may need to copy this file to the RAG service directory")
        
        print(f"\n📊 Processing Summary:")
        print(f"   Documents processed: {processed_count}/{len(documents)}")
        
        if processed_count > 0:
            print(f"\n🎉 RAG system initialized successfully!")
            print(f"   Vector store saved to: ./vectorstore")
            print(f"   You can now run queries against both document types")
            
            # Test basic functionality
            print(f"\n🧪 Testing basic functionality...")
            test_queries = [
                ("How does ElectionGuard encryption work?", "ElectionGuard_Specification"),
                ("How do I create an election?", "AmarVote_User_Guide")
            ]
            
            for query, doc_type in test_queries:
                print(f"\n   Testing: '{query}'")
                context = rag_processor.get_relevant_context(query, 200, doc_type)
                if context and len(context) > 50:
                    print(f"   ✅ Retrieved {len(context)} characters of context")
                else:
                    print(f"   ⚠️  Limited context retrieved: {len(context) if context else 0} characters")
            
        else:
            print(f"\n❌ No documents were processed successfully")
            print(f"   Please check that the document files are available")
            return False
            
        return True
        
    except Exception as e:
        print(f"\n❌ Error during RAG initialization: {e}")
        logger.error(f"RAG initialization failed: {e}")
        return False

def check_dependencies():
    """Check that required dependencies are available"""
    try:
        import pypdf
        import chromadb
        import langchain
        print("✅ All required dependencies are available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please install required packages: pip install -r requirements.txt")
        return False

if __name__ == "__main__":
    print("AmarVote RAG System Setup")
    print("=" * 30)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup RAG system
    success = setup_rag_system()
    
    if success:
        print(f"\n🎉 Setup completed successfully!")
        print(f"You can now start the RAG service with: python app.py")
        print(f"Or run tests with: python test_amarvote_rag.py")
    else:
        print(f"\n❌ Setup failed. Please check the errors above.")
        sys.exit(1)
