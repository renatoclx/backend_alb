import { IsString, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;

  @IsString()
  @Match('newPassword', {
    message: 'newPasswordConfirmation must match newPassword',
  })
  newPasswordConfirmation!: string;
}
