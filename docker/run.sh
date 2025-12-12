#!/bin/bash
# Run Docker container for Solace Queue Browser Web
# Run this script from the project root directory

cd "$(dirname "$0")/.." || exit 1

docker-compose -f docker/docker-compose.yml down
sleep 2
echo "---- BUILDING ----"
docker build -f docker/Dockerfile -t solace-queue-browser .
sleep 2
echo "--- RUNNING ----"
docker-compose -f docker/docker-compose.yml up -d
