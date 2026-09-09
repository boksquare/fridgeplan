-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('imperial', 'metric');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "defaultUnitImperial" "Unit",
ADD COLUMN     "defaultUnitMetric" "Unit",
ADD COLUMN     "defaultUnitSource" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "unitSystem" "UnitSystem" NOT NULL DEFAULT 'imperial';
