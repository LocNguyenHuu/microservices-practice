#!/bin/bash
set -e

echo "Initializing SkyTurn databases..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE flight_db;
    CREATE DATABASE crew_db;
    CREATE DATABASE ops_db;
EOSQL

echo "Databases created: flight_db, crew_db, ops_db"
