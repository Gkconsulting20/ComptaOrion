# ComptaOrion

## Overview
ComptaOrion is a full-stack accounting application skeleton with a React frontend and Express.js backend. This project provides a solid foundation for building accounting and bookkeeping features.

## Project Structure
```
├── backend/              # Express.js backend API
│   ├── src/
│   │   ├── app.js       # Express app configuration
│   │   └── main.js      # Server entry point
│   └── package.json     # Backend dependencies
│
├── frontend/             # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx      # Main React component
│   │   ├── main.jsx     # React entry point
│   │   └── app.css      # Application styles
│   ├── index.html       # HTML entry point
│   ├── vite.config.js   # Vite configuration
│   └── package.json     # Frontend dependencies
│
└── start.sh             # Startup script for both services
```

## Technology Stack
- **Frontend**: React 18, Vite 5
- **Backend**: Express.js 4, Node.js 20
- **Styling**: Custom CSS with gradient design

## Architecture
- **Backend Port**: 3000 (localhost/127.0.0.1)
- **Frontend Port**: 5000 (0.0.0.0)
- **Proxy**: Vite dev server proxies `/api` requests to backend

## Development
The application runs both frontend and backend services together:
- Backend serves REST API endpoints on port 3000
- Frontend React app runs on port 5000 with Vite dev server
- Vite proxy forwards `/api/*` requests to the backend
- Frontend configured with `allowedHosts: true` for Replit proxy support

## API Endpoints
- `GET /api/health` - Health check endpoint
- `GET /api` - API information

## Recent Changes
- **2025-11-20**: Initial setup
  - Configured full-stack Node.js application with React + Express
  - Set up Vite dev server with proxy configuration
  - Configured backend to listen on 127.0.0.1:3000 for IPv4 compatibility
  - Set up workflow to run both services together
  - Configured deployment for autoscale deployment target

## Running the Project
The project automatically starts via the configured workflow. Both frontend and backend services run together through `start.sh`.

## Deployment
Configured for Replit autoscale deployment running the start script.
