import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { validate } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CityModule } from './modules/city/city.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { ClientModule } from './modules/client/client.module';
import { SaleModule } from './modules/sale/sale.module';
import { RentalModule } from './modules/rental/rental.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    CityModule,
    CategoryModule,
    ProductModule,
    ClientModule,
    SaleModule,
    RentalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
