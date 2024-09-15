/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { PropertiesService } from './properties/properties.service';
import { PropertiesModule } from './properties/properties.module';

@Module({
  controllers: [],
  providers: [PropertiesService],
  imports: [PropertiesModule],
})
export class AppModule {}
