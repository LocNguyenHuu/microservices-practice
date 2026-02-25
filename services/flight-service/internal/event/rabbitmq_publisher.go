// Package event — RabbitMQ implementation of the Publisher interface.
// Publishes flight domain events to the flight.events topic exchange
// with persistent delivery, connection retry, and automatic reconnection.
package event

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	exchangeName = "flight.events"
	exchangeType = "topic"
	maxRetries   = 5
)

// RabbitMQPublisher sends flight events to a RabbitMQ topic exchange.
// It handles connection retries on startup and automatic reconnection
// if the broker connection drops during operation.
type RabbitMQPublisher struct {
	url     string
	conn    *amqp.Connection
	channel *amqp.Channel
	mu      sync.Mutex
	done    chan struct{}
}

// NewRabbitMQPublisher connects to RabbitMQ, declares the flight.events
// topic exchange, and starts a background goroutine for reconnection.
func NewRabbitMQPublisher(url string) (*RabbitMQPublisher, error) {
	p := &RabbitMQPublisher{
		url:  url,
		done: make(chan struct{}),
	}
	if err := p.connect(); err != nil {
		return nil, fmt.Errorf("rabbitmq initial connect: %w", err)
	}
	go p.handleReconnect()
	return p, nil
}

// connect establishes a connection and channel, then declares the exchange.
// Uses exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts).
func (p *RabbitMQPublisher) connect() error {
	var conn *amqp.Connection
	var err error

	for attempt := 0; attempt < maxRetries; attempt++ {
		conn, err = amqp.Dial(p.url)
		if err == nil {
			break
		}
		wait := time.Duration(1<<uint(attempt)) * time.Second
		slog.Warn("rabbitmq connection failed, retrying",
			"attempt", attempt+1,
			"max_attempts", maxRetries,
			"wait", wait,
			"error", err,
		)
		time.Sleep(wait)
	}
	if err != nil {
		return fmt.Errorf("failed after %d attempts: %w", maxRetries, err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("open channel: %w", err)
	}

	// Declare a durable topic exchange (idempotent — safe to call on every connect)
	if err := ch.ExchangeDeclare(
		exchangeName,
		exchangeType,
		true,  // durable — survives broker restart
		false, // auto-delete
		false, // internal
		false, // no-wait
		nil,
	); err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("declare exchange %s: %w", exchangeName, err)
	}

	p.mu.Lock()
	p.conn = conn
	p.channel = ch
	p.mu.Unlock()

	slog.Info("rabbitmq connected", "exchange", exchangeName)
	return nil
}

// handleReconnect listens for connection close events and attempts to
// re-establish the connection. Runs until Close() is called.
func (p *RabbitMQPublisher) handleReconnect() {
	for {
		p.mu.Lock()
		conn := p.conn
		p.mu.Unlock()

		if conn == nil {
			return
		}

		// Block until the connection is closed or we're shutting down
		connErr := conn.NotifyClose(make(chan *amqp.Error, 1))
		select {
		case err := <-connErr:
			if err == nil {
				// Graceful close (we called Close()) — stop reconnecting
				return
			}
			slog.Warn("rabbitmq connection lost, reconnecting", "error", err)
			if reconnErr := p.connect(); reconnErr != nil {
				slog.Error("rabbitmq reconnection failed", "error", reconnErr)
			}
		case <-p.done:
			return
		}
	}
}

// Publish sends a flight event to the flight.events exchange using the
// event type as the routing key. Messages are persistent (survive broker restart).
func (p *RabbitMQPublisher) Publish(eventType EventType, flightID uuid.UUID, data any) error {
	correlationID := uuid.New().String()
	evt := FlightEvent{
		ID:            uuid.New().String(),
		Type:          eventType,
		FlightID:      flightID.String(),
		CorrelationID: correlationID,
		Timestamp:     time.Now().UTC(),
		Data:          data,
	}

	body, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	p.mu.Lock()
	ch := p.channel
	p.mu.Unlock()

	if ch == nil {
		return fmt.Errorf("rabbitmq channel not available")
	}

	err = ch.Publish(
		exchangeName,        // exchange
		string(eventType),   // routing key
		false,               // mandatory
		false,               // immediate
		amqp.Publishing{
			ContentType:   "application/json",
			DeliveryMode:  amqp.Persistent,
			MessageId:     evt.ID,
			CorrelationId: correlationID,
			Timestamp:     evt.Timestamp,
			Body:          body,
		},
	)
	if err != nil {
		return fmt.Errorf("publish %s: %w", eventType, err)
	}

	slog.Info("event published",
		"type", string(eventType),
		"flight_id", flightID.String(),
		"event_id", evt.ID,
		"correlation_id", correlationID,
	)
	return nil
}

// Close shuts down the channel and connection gracefully.
func (p *RabbitMQPublisher) Close() error {
	close(p.done)

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
	slog.Info("rabbitmq publisher closed")
	return nil
}
