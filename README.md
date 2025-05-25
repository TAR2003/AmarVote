### AmarVote

In this repository, there are three main sections and folder for that
The first one the frontend folder, which contains all the react codes responsible for the frontend
The second the backend folder, which contains all the backend java springboot codes for the backend
The third one is the microservice folder, which contains all the microservices codes for the backend

## Build and run
To run the microservice, open the terminal and run the following commands:
docker-compose build (to build the docker images)
docker-compose up -d (to run the docker images)
docker-compose ps (to check the status of the docker images)
docker logs -f electionguard_service (to check the live log of the docker images)
docker logs electionguard_service (to check the recent logs of the docker images)
docker-compose down (to stop the docker images)

## 📚 Documentation

- [Setup Instructions](docs/setup.md)
- [API Reference](docs/api.md)
- [Usage Examples](docs/usage.md)
- [ElectionGuard Configuration](docs/electionguard_config.md)
