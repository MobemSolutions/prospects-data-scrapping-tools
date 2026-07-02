import { NextResponse } from "next/server";
import { exportCampaignCsv } from "@/lib/csv/exportCampaign";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const result = await exportCampaignCsv(id);
  if (!result) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `campagne-${slugify(result.query)}-${date}.csv`;

  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
