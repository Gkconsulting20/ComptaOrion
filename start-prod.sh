#!/bin/bash

echo "Building ComptaOrion Frontend..."
cd frontend && npm run build

echo "Starting ComptaOrion Backend (Production)..."
cd ../backend && NODE_ENV=production npm start
