-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "birthDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);
