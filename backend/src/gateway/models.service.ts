import { Injectable } from '@nestjs/common';
import { ProviderRegistryService } from '../providers/provider-registry.service';

@Injectable()
export class ModelsService {
  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  list() {
    const models = this.providerRegistry.listModels();
    return {
      object: 'list',
      data: [
        { id: 'auto', object: 'model', owned_by: 'router' },
        ...models,
      ],
    };
  }
}
