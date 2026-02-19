// Package config provides application configuration loaded from environment variables.
package config

import "os"

// Config holds all configuration values for the flight service.
type Config struct {
	ServerPort  string // HTTP server port (default: 8080)
	DatabaseURL string // PostgreSQL connection string for flight_db
	RabbitMQURL string // RabbitMQ connection string (used in Phase 2)
}

// Load reads configuration from environment variables with sensible defaults
// for local development.
func Load() *Config {
	return &Config{
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/flight_db?sslmode=disable"),
		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
	}
}

// getEnv returns the environment variable value or a fallback if unset.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
