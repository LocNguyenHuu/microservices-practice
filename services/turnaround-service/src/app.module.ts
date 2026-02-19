import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { TurnaroundModule } from './turnaround/turnaround.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // Global config — all modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // MongoDB connection — async so it reads from ConfigService
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodbUri'),
      }),
    }),

    HealthModule,
    EventsModule,
    TurnaroundModule,
  ],
})
export class AppModule {}
