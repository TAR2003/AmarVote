import os
import pypdf
import chromadb
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma
from langchain.schema import Document
from typing import List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RAGProcessor:
    def __init__(self, persist_directory: str = "./vectorstore"):
        """Initialize the RAG processor with embeddings and vector store."""
        self.persist_directory = persist_directory
        
        # Initialize embeddings model
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        
        # Initialize or load vector store
        self.vectorstore = None
        self._initialize_vectorstore()
    
    def _initialize_vectorstore(self):
        """Initialize the vector store."""
        try:
            # Try to load existing vectorstore
            if os.path.exists(self.persist_directory):
                self.vectorstore = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings
                )
                logger.info("Loaded existing vector store")
            else:
                # Create new vectorstore
                self.vectorstore = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings
                )
                logger.info("Created new vector store")
        except Exception as e:
            logger.error(f"Error initializing vector store: {e}")
            # Fallback: create new vectorstore
            self.vectorstore = Chroma(
                embedding_function=self.embeddings
            )
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file."""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return ""
    
    def extract_text_from_markdown(self, md_path: str) -> str:
        """Extract text from Markdown file."""
        try:
            with open(md_path, 'r', encoding='utf-8') as file:
                text = file.read()
                return text
        except Exception as e:
            logger.error(f"Error extracting text from Markdown: {e}")
            return ""
    
    def process_document(self, file_path: str, document_name: str = None, document_type: str = None):
        """Process a document (PDF or Markdown) and add it to the vector store."""
        try:
            # Determine file type and extract text
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                text = self.extract_text_from_pdf(file_path)
                doc_type = document_type or "ElectionGuard_Specification"
            elif file_extension == '.md':
                text = self.extract_text_from_markdown(file_path)
                doc_type = document_type or "AmarVote_User_Guide"
            else:
                logger.error(f"Unsupported file type: {file_extension}")
                return False
            
            if not text:
                logger.error(f"No text extracted from {file_path}")
                return False
            
            # Use filename as document name if not provided
            if not document_name:
                document_name = os.path.basename(file_path)
            
            # Split text into chunks
            chunks = self.text_splitter.split_text(text)
            
            # Create documents with metadata
            documents = [
                Document(
                    page_content=chunk,
                    metadata={
                        "source": document_name,
                        "chunk_id": i,
                        "document_type": doc_type,
                        "file_path": file_path
                    }
                )
                for i, chunk in enumerate(chunks)
            ]
            
            # Add documents to vector store
            self.vectorstore.add_documents(documents)
            
            # Persist the vector store
            if hasattr(self.vectorstore, 'persist'):
                self.vectorstore.persist()
            
            logger.info(f"Successfully processed {len(documents)} chunks from {document_name} ({doc_type})")
            return True
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return False
    
    def similarity_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Perform similarity search on the vector store."""
        try:
            if not self.vectorstore:
                logger.error("Vector store not initialized")
                return []
            
            # Perform similarity search
            docs = self.vectorstore.similarity_search(query, k=k)
            
            # Format results
            results = []
            for doc in docs:
                results.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "source": doc.metadata.get("source", "unknown")
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error performing similarity search: {e}")
            return []
    
    def get_relevant_context(self, query: str, max_length: int = 2000, filter_by_type: str = None) -> str:
        """Get relevant context for a query, formatted for LLM."""
        try:
            # Get similar documents
            docs = self.similarity_search(query, k=5)
            
            if not docs:
                return "No relevant information found in the documentation."
            
            # Filter by document type if specified
            if filter_by_type:
                docs = [doc for doc in docs if doc["metadata"].get("document_type") == filter_by_type]
            
            if not docs:
                return f"No relevant information found in {filter_by_type} documentation."
            
            # Determine source for context header
            primary_source = docs[0]["metadata"].get("document_type", "documentation")
            if primary_source == "ElectionGuard_Specification":
                context_header = "Based on the ElectionGuard specification:\n\n"
            elif primary_source == "AmarVote_User_Guide":
                context_header = "Based on the AmarVote User Guide:\n\n"
            else:
                context_header = "Based on the available documentation:\n\n"
            
            # Combine relevant content
            context = context_header
            current_length = len(context)
            
            for doc in docs:
                content = doc["content"]
                if current_length + len(content) > max_length:
                    # Truncate if too long
                    remaining_space = max_length - current_length - 3
                    if remaining_space > 0:
                        context += content[:remaining_space] + "..."
                    break
                else:
                    context += content + "\n\n"
                    current_length += len(content) + 2
            
            return context.strip()
            
        except Exception as e:
            logger.error(f"Error getting relevant context: {e}")
            return "Error retrieving information from documentation."
    
    def process_multiple_documents(self, file_paths: List[str]) -> bool:
        """Process multiple documents at once."""
        success_count = 0
        for file_path in file_paths:
            if self.process_document(file_path):
                success_count += 1
        
        logger.info(f"Successfully processed {success_count}/{len(file_paths)} documents")
        return success_count == len(file_paths)
