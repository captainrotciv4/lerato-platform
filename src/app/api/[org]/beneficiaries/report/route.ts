import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";

const AGE_BRACKETS: Record<string, [number, number]> = {
  U10: [0, 10], U12: [10, 12], U14: [12, 14],
  U16: [14, 16], U18: [16, 18], Senior: [18, 120],
};

function ageGroup(dob: Date): string {
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  return "Senior";
}

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org } = await params;

  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await dbRetry(() =>
    prisma.membership.findFirst({
      where: { userId, organization: { slug: org } },
      select: {
        role: true,
        permissions: true,
        organization: { select: { id: true, name: true } },
      },
    })
  );
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!can(membership.role, membership.permissions as string[], PERMISSIONS.BENEFICIARY_READ ?? PERMISSIONS.BENEFICIARY_WRITE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp           = request.nextUrl.searchParams;
  const position     = sp.get("position") ?? "";
  const ageBracket   = sp.get("ageBracket") ?? "";
  const county       = sp.get("county") ?? "";
  const recommendation = sp.get("recommendation") ?? "";

  const where: Record<string, unknown> = {
    organizationId: membership.organization.id,
    deletedAt: null,
  };
  if (position) where.athleteProfile = { position };
  if (county)   where.county = { contains: county, mode: "insensitive" };
  if (ageBracket && AGE_BRACKETS[ageBracket]) {
    const [min, max] = AGE_BRACKETS[ageBracket];
    const today = new Date();
    where.dateOfBirth = {
      gte: new Date(today.getFullYear() - max, today.getMonth(), today.getDate()),
      lt:  new Date(today.getFullYear() - min, today.getMonth(), today.getDate()),
    };
  }

  const all = await dbRetry(() =>
    prisma.beneficiary.findMany({
      where: where as any,
      include: {
        athleteProfile: true,
        studentProfile: true,
        scoutReports: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })
  );

  let players = all;
  if (recommendation === "NOT_ASSESSED") players = all.filter(p => p.scoutReports.length === 0);
  else if (recommendation)              players = all.filter(p => p.scoutReports[0]?.recommendation === recommendation);

  const REC_LABELS: Record<string, string> = {
    SIGN: "Sign", MONITOR: "Monitor", DECLINE: "Decline", REVIEW_LATER: "Review Later",
  };

  const headers = [
    "Reg No.", "Last Name", "First Name", "Middle Name",
    "Date of Birth", "Age", "Age Group", "Gender",
    "Position", "Preferred Foot", "Current Club",
    "School", "Grade",
    "County", "Address",
    "Phone", "Email",
    "Guardian Name", "Guardian Phone", "Guardian Email", "Guardian Relationship",
    "Birth Cert No.", "National ID",
    "Development Status", "Scout Report Date",
    "Registered On",
  ];

  const rows = players.map(p => {
    const dob    = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
    const age    = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "";
    const bracket = dob ? ageGroup(dob) : "";
    const rec    = p.scoutReports[0]?.recommendation;
    const recDate = p.scoutReports[0]?.reportDate;
    return [
      p.admissionNo,
      p.lastName, p.firstName, p.middleName,
      dob ? dob.toISOString().slice(0, 10) : "", age, bracket,
      p.gender,
      p.athleteProfile?.position, p.athleteProfile?.preferredFoot, p.athleteProfile?.currentClub,
      p.studentProfile?.school, p.studentProfile?.grade,
      p.county, p.address,
      p.phone, p.email,
      p.guardianName, p.guardianPhone, p.guardianEmail, p.guardianRelationship,
      p.birthCertNo, p.nationalId,
      rec ? (REC_LABELS[rec] ?? rec) : "Not assessed",
      recDate ? new Date(recDate).toISOString().slice(0, 10) : "",
      new Date(p.createdAt).toISOString().slice(0, 10),
    ].map(esc).join(",");
  });

  const orgName  = membership.organization.name.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr  = new Date().toISOString().slice(0, 10);
  const filename = `${orgName}_players_${dateStr}.csv`;

  const csv = [headers.map(esc).join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
