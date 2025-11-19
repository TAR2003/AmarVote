FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy chaincode source
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Expose chaincode port
EXPOSE 9999

# Start chaincode
CMD ["./start.sh"]
