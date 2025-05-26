# AmarVote Frontend

This is the React frontend application for the AmarVote project. It interacts with the backend API to provide a user interface for the voting system.

## Development

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

This will start the application in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Docker

To build and run the frontend using Docker:

```bash
docker build -t amarvote-frontend .
docker run -p 3000:80 amarvote-frontend
```

## Environment Variables

The following environment variables can be configured:

- `REACT_APP_API_URL`: URL of the backend API (default: http://localhost:8081)
