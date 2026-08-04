import { Module, forwardRef } from '@nestjs/common';
import { ClientModule } from '../client/client.module';
import { ProductModule } from '../product/product.module';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  imports: [forwardRef(() => ClientModule), forwardRef(() => ProductModule)],
  controllers: [SaleController],
  providers: [SaleService],
  exports: [SaleService],
})
export class SaleModule {}
