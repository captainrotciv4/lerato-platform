-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'FINANCE_LEAD';
ALTER TYPE "Role" ADD VALUE 'BOARD_MEMBER';

-- CreateTable
CREATE TABLE "FundAllocation" (
    "id" TEXT NOT NULL,
    "sourceOrgId" TEXT NOT NULL,
    "destinationOrgId" TEXT NOT NULL,
    "sourceProgramId" TEXT,
    "destinationProgramId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "requiredApprovers" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "sourceTransactionId" TEXT,
    "destinationTransactionId" TEXT,

    CONSTRAINT "FundAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverRole" "Role" NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" "ApprovalDecision",
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "thresholdAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "requiredApprovers" INTEGER NOT NULL,
    "requiredRoles" "Role"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundAllocation_sourceOrgId_idx" ON "FundAllocation"("sourceOrgId");

-- CreateIndex
CREATE INDEX "FundAllocation_destinationOrgId_idx" ON "FundAllocation"("destinationOrgId");

-- CreateIndex
CREATE INDEX "FundAllocation_status_idx" ON "FundAllocation"("status");

-- CreateIndex
CREATE INDEX "FundAllocation_createdAt_idx" ON "FundAllocation"("createdAt");

-- CreateIndex
CREATE INDEX "Approval_allocationId_idx" ON "Approval"("allocationId");

-- CreateIndex
CREATE INDEX "Approval_approverId_idx" ON "Approval"("approverId");

-- CreateIndex
CREATE INDEX "Approval_decision_idx" ON "Approval"("decision");

-- CreateIndex
CREATE INDEX "ApprovalRule_organizationId_idx" ON "ApprovalRule"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalRule_thresholdAmount_idx" ON "ApprovalRule"("thresholdAmount");

-- AddForeignKey
ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_sourceOrgId_fkey" FOREIGN KEY ("sourceOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_destinationOrgId_fkey" FOREIGN KEY ("destinationOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_sourceProgramId_fkey" FOREIGN KEY ("sourceProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_destinationProgramId_fkey" FOREIGN KEY ("destinationProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "FundAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
