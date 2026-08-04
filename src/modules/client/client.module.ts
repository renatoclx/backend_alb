import { Module, forwardRef } from '@nestjs/common';
import { CityModule } from '../city/city.module';
import { SaleModule } from '../sale/sale.module';
import { RentalModule } from '../rental/rental.module';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';

@Module({
  imports: [
    CityModule,
    forwardRef(() => SaleModule),
    forwardRef(() => RentalModule),
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
