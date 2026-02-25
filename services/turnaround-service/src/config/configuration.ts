// Application configuration loaded from environment variables.
// Defaults are set for local development (matching docker-compose values).
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/turnaround_db',
  rabbitmqUrl:
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/',
  dataIngestionUrl:
    process.env.DATA_INGESTION_URL || 'http://localhost:8002',
});
