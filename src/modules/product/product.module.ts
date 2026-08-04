import { Module, forwardRef } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { SaleModule } from '../sale/sale.module';
import { RentalModule } from '../rental/rental.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    CategoryModule,
    forwardRef(() => SaleModule),
    forwardRef(() => RentalModule),
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
