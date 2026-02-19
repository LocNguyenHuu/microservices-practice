// Package main is the entrypoint for the Flight Service.
// It wires together configuration, database, event publishing, and HTTP routing,
// then starts the server with graceful shutdown support.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/stephen/flight-service/config"
	"github.com/stephen/flight-service/internal/db"
	"github.com/stephen/flight-service/internal/event"
	"github.com/stephen/flight-service/internal/handler"
	"github.com/stephen/flight-service/internal/repository"
	"github.com/stephen/flight-service/internal/service"
)

func main() {
	// Structured JSON logging for production observability
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	// Connect to PostgreSQL
	database, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	slog.Info("connected to database")

	// Run pending migrations
	if err := db.RunMigrations(database, "./migrations"); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")

	// Initialize event publisher — uses RabbitMQ when RABBITMQ_URL is set,
	// falls back to stub logging for local development without a broker.
	var publisher event.Publisher
	if cfg.RabbitMQURL != "" {
		rmqPublisher, err := event.NewRabbitMQPublisher(cfg.RabbitMQURL)
		if err != nil {
			slog.Error("failed to connect to rabbitmq", "error", err)
			os.Exit(1)
		}
		publisher = rmqPublisher
	} else {
		publisher = event.NewStubPublisher()
		slog.Warn("no RABBITMQ_URL configured, using stub publisher")
	}
	defer publisher.Close()

	// Wire up layers: repository → service → handler
	flightRepo := repository.NewFlightRepository(database)
	flightSvc := service.NewFlightService(flightRepo, publisher)
	flightHandler := handler.NewFlightHandler(flightSvc)

	// Configure HTTP router with middleware
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	r.Get("/health", handler.HealthCheck)
	r.Mount("/api/flights", flightHandler.Routes())

	// Start HTTP server
	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		slog.Info("starting flight service", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("received shutdown signal", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "error", err)
		os.Exit(1)
	}
	slog.Info("flight service stopped gracefully")
}
