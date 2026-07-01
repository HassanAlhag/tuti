#!/bin/sh
# Temporary local preview helper (Data Phase 2).
#
# The project's .env MONGO_URI points to a remote MongoDB Atlas cluster,
# not localhost -- not safe to write to or replace collections in from
# this machine. This script previews the corrected marketplace.seed.js
# catalogue without touching that database or the .env file at all: it
# clears MONGO_URI for this one process only, which makes the backend
# fall back to its existing in-memory seed-mode path (see
# backend/src/repositories/seedRepository.js / env.js's
# assertProductionSeedModeDisabled, which explicitly allows this in
# development).
#
# Safe to delete once a real local/dev Mongo connection exists.

cd "$(dirname "$0")/.."
MONGO_URI= npm run dev:backend
