import { Global, Module } from '@nestjs/common';
import { FileStorage, LocalFileStorage } from './file-storage.js';

@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: LocalFileStorage }],
  exports: [FileStorage],
})
export class StorageModule {}
