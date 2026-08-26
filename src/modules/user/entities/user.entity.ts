export class UserEntity {
  id!: string;
  name!: string;
  email!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date | null;
  deletedAt!: Date | null;
}
