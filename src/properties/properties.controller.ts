/* eslint-disable prettier/prettier */
import { Body, Controller, Delete, Get, Param, Post, Put, HttpException, HttpStatus } from '@nestjs/common';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  async getAllProperties() {
    try {
      return await this.propertiesService.getAllProperties();
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':key(*)')
  async getProperty(@Param('key') key: string) {
    try {
      const value = await this.propertiesService.getProperty(key);
      return { key, value };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post()
  async addProperty(@Body('key') key: string, @Body('value') value: string) {
    try {
      await this.propertiesService.addProperty(key, value);
      return { message: 'Property added successfully' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':key(*)')
  async updateProperty(@Param('key') key: string, @Body('value') value: string) {
    try {
      await this.propertiesService.updateProperty(key, value);
      return { message: 'Property updated successfully' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Delete(':key(*)')
  async deleteProperty(@Param('key') key: string) {
    try {
      await this.propertiesService.deleteProperty(key);
      return { message: 'Property deleted successfully' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }
}
