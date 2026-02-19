import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// Request body for creating a turnaround. Typically populated from
// a flight.arrived event payload, but can also be used for manual creation.
export class CreateTurnaroundDto {
  @IsString()
  @IsNotEmpty()
  flightId!: string;

  @IsString()
  @IsNotEmpty()
  flightNumber!: string;

  @IsString()
  @IsNotEmpty()
  aircraftType!: string;

  @IsString()
  @IsOptional()
  aircraftReg?: string;

  @IsString()
  @IsOptional()
  gateId?: string;
}
