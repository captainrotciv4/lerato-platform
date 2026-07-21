import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await dbRetry(() =>
    prisma.membership.findFirst({
      where: {
        userId,
        organization: { slug: org },
      },
      select: {
        role: true,
        permissions: true,
        organization: { select: { id: true } },
      },
    })
  );

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this organisation" }, { status: 403 });
  }
  if (!can(membership.role, membership.permissions as string[], PERMISSIONS.BENEFICIARY_WRITE)) {
    return NextResponse.json({ error: "You don't have permission to import" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Could not parse request body" }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "File must be a .csv" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows (check the header row and at least one data row)" }, { status: 400 });
  }

  const orgId = membership.organization.id;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || `row ${i + 2}`;
    const label = `Row ${i + 2} (${name})`;

    // Required field validation
    if (!row.firstName?.trim()) { errors.push(`${label}: firstName is required`); skipped++; continue; }
    if (!row.lastName?.trim())  { errors.push(`${label}: lastName is required`);  skipped++; continue; }
    if (!row.dateOfBirth?.trim()) { errors.push(`${label}: dateOfBirth is required`); skipped++; continue; }
    if (!row.gender?.trim())    { errors.push(`${label}: gender is required`);    skipped++; continue; }

    const dob = new Date(row.dateOfBirth.trim());
    if (isNaN(dob.getTime())) {
      errors.push(`${label}: invalid dateOfBirth "${row.dateOfBirth}" — use YYYY-MM-DD`);
      skipped++;
      continue;
    }

    const gender = row.gender.trim().toUpperCase();
    if (!["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].includes(gender)) {
      errors.push(`${label}: invalid gender "${row.gender}" — use MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY`);
      skipped++;
      continue;
    }

    const isAthlete = ["true", "1", "yes", "y"].includes(row.isAthlete?.trim().toLowerCase() ?? "");
    const isStudent = ["true", "1", "yes", "y"].includes(row.isStudent?.trim().toLowerCase() ?? "");

    try {
      const beneficiary = await dbRetry(() =>
        prisma.beneficiary.create({
          data: {
            organizationId: orgId,
            firstName:            row.firstName.trim(),
            middleName:           row.middleName?.trim()           || null,
            lastName:             row.lastName.trim(),
            dateOfBirth:          dob,
            gender:               gender as any,
            phone:                row.phone?.trim()               || null,
            email:                row.email?.trim()               || null,
            county:               row.county?.trim()              || null,
            address:              row.address?.trim()             || null,
            guardianName:         row.guardianName?.trim()        || null,
            guardianPhone:        row.guardianPhone?.trim()       || null,
            guardianEmail:        row.guardianEmail?.trim()       || null,
            guardianRelationship: row.guardianRelationship?.trim() || null,
          },
        })
      );

      // NeonHttp: sequential inserts — no nested creates
      if (isAthlete) {
        const foot = row.preferredFoot?.trim().toUpperCase();
        await dbRetry(() =>
          prisma.athleteProfile.create({
            data: {
              beneficiaryId: beneficiary.id,
              position:      row.position?.trim()    || null,
              preferredFoot: (["RIGHT", "LEFT", "BOTH"].includes(foot ?? "") ? foot : null) as any,
              currentClub:   row.currentClub?.trim() || null,
            },
          })
        );
      }

      if (isStudent) {
        await dbRetry(() =>
          prisma.studentProfile.create({
            data: {
              beneficiaryId: beneficiary.id,
              school: row.school?.trim() || null,
              grade:  row.grade?.trim()  || null,
            },
          })
        );
      }

      created++;
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      errors.push(
        `${label}: ${msg.includes("Unique constraint") ? "duplicate record — phone or email already registered" : msg}`
      );
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, errors, total: rows.length });
}

// ── CSV parsing ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}
