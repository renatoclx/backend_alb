import { Module, forwardRef } from '@nestjs/common';
import { ClientModule } from '../client/client.module';
import { ProductModule } from '../product/product.module';
import { RentalController } from './rental.controller';
import { RentalService } from './rental.service';

@Module({
  imports: [forwardRef(() => ClientModule), forwardRef(() => ProductModule)],
  controllers: [RentalController],
  providers: [RentalService],
  exports: [RentalService],
})
export class RentalModule {}
