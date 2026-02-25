import { IsOptional, IsDateString } from 'class-validator';

export class UpdateMilestonesDto {
  @IsOptional()
  @IsDateString()
  eibt?: string;

  @IsOptional()
  @IsDateString()
  aibt?: string;

  @IsOptional()
  @IsDateString()
  tobt?: string;

  @IsOptional()
  @IsDateString()
  tsat?: string;

  @IsOptional()
  @IsDateString()
  ardt?: string;

  @IsOptional()
  @IsDateString()
  aobt?: string;

  @IsOptional()
  @IsDateString()
  atot?: string;
}
