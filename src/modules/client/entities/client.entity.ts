export class ClientEntity {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  birthDate: Date | null;
  document: string;
  address: string;
  cityId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
