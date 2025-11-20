#!/bin/bash

echo "Starting ComptaOrion Backend..."
cd backend && npm start &

BACKEND_PID=$!

echo "Waiting for backend to start..."
sleep 3

echo "Starting ComptaOrion Frontend..."
cd frontend && npm run dev
