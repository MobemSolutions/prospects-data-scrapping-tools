import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          website: true,
          rating: true,
          reviewCount: true,
          status: true,
          errorMessage: true,
          opportunityScore: true,
          priorityFlag: true,
          gmbData: { select: { hasPhotos: true, photoCount: true } },
          companyData: { select: { matchStatus: true } },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}
