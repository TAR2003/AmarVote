# 🗳️ AmarVote

This repository contains three main sections:

## 📁 Project Structure

- **`frontend/`**  
  Contains all the **React code** responsible for the frontend user interface.

- **`backend/`**  
  Contains all the **Java Spring Boot code** for core backend functionalities.

- **`microservice/`**  
  Contains all the **Python microservices** supporting the backend infrastructure.

---

## 🚀 Build and Run Microservices

To **build and run the microservices**, use the following Docker Compose commands:

```bash
# Build the Docker images
docker-compose build

# Run the services in detached mode
docker-compose up -d

# Check the status of all services
docker-compose ps

# View live logs for a specific service (e.g., electionguard_service)
docker logs -f electionguard_service

# View recent logs for a specific service
docker logs electionguard_service

# Stop and remove all running containers
docker-compose down
```

## 📚 Documentation

- [Setup Instructions](docs/setup.md)
- [API Reference](docs/api.md)
- [Usage Examples](docs/usage.md)
- [ElectionGuard Configuration](docs/electionguard_config.md)
