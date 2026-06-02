import { Module } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderApiKeyStore } from './provider-api-key.store';

@Module({
  providers: [ProviderApiKeyStore, ProviderRegistryService],
  exports: [ProviderRegistryService, ProviderApiKeyStore],
})
export class ProvidersModule {}
