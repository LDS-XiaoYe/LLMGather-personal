import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { ModelsService } from './models.service';

@Controller('models')
@UseGuards(ApiKeyOrJwtGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  listModels() {
    return this.modelsService.list();
  }
}
