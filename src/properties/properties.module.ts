/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  providers: [PropertiesService], 
  controllers: [PropertiesController],
})
export class PropertiesModule {}
