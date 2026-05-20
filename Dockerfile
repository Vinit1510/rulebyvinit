# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx on port 7860 (Hugging Face default)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Adjust Nginx default configuration to listen on port 7860 instead of 80
RUN sed -i 's/listen       80;/listen       7860;/g' /etc/nginx/conf.d/default.conf

EXPOSE 7860
CMD ["nginx", "-g", "daemon off;"]
