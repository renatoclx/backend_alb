import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @Match('password', { message: 'passwordConfirmation must match password' })
  passwordConfirmation: string;
}
