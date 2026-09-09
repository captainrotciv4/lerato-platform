/**
 * One-time import: 100 DEA/MWK players → Darajani Elite branch
 *
 * Data sources merged:
 *   - PLAYERS FROM MUREMA SCHOOL.pdf    (regNo, name, school, grade)
 *   - REGISTRATION STATUS CHECK LIST.pdf (regNo, name, guardian, regStatus)
 *   - PLAYERS LIST CATEGORY.pdf          (regNo, name, DOB, age category)
 *
 * Run: npx tsx prisma/import-players.ts
 */

import { PrismaClient, Gender } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency needed)
function loadDotEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const val = raw.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on environment variables already set
  }
}
loadDotEnv();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow = {
  regNo: string;
  name: string;
  guardian: string | null;
  regStatus: string;            // "Fully Registered" | "Incomplete"
  dob: Date;                    // 2000-01-01 placeholder where unknown
  dobEstimated: boolean;        // true when no DOB in source documents
  category: string | null;      // "U7-U9" | "U10-U12" | "U13-U15" | "U18"
  school: string | null;
  grade: string | null;
  gender: Gender;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseName(full: string): { firstName: string; middleName: string | null; lastName: string } {
  const words = full.trim().split(/\s+/);
  if (words.length === 1) return { firstName: words[0], middleName: null, lastName: words[0] };
  if (words.length === 2) return { firstName: words[0], middleName: null, lastName: words[1] };
  return {
    firstName: words[0],
    middleName: words.slice(1, -1).join(" "),
    lastName: words[words.length - 1],
  };
}

function d(iso: string): Date { return new Date(iso); }

// ─── Player Dataset ───────────────────────────────────────────────────────────

const MUREMA = "Murema Primary and Junior Secondary School";
const UNK_DOB = new Date("2000-01-01"); // placeholder — DOB absent in source docs

const players: PlayerRow[] = [
  // ── 001-010 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/001", name: "Irungu Mark Mwaura",        guardian: "Stephen Irungu Mwaura",    regStatus: "Fully Registered", dob: d("2011-06-02"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/002", name: "Mbugua Ryan Mwangi",        guardian: "Juliah Wanjiru Mwangi",    regStatus: "Fully Registered", dob: d("2011-04-05"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/003", name: "Kimani Joram Mwangi",       guardian: "John Mwangi Kimani",       regStatus: "Incomplete",       dob: d("2009-05-06"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/004", name: "Frank Kalif",               guardian: "Lenty Anyango Okoth",      regStatus: "Incomplete",       dob: d("2012-08-03"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/005", name: "Joseph Mwangi Njogu",       guardian: "Margaret Njoki",           regStatus: "Fully Registered", dob: d("2011-01-05"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/006", name: "Gabriel Mwangi Njuguna",    guardian: "Ruth Wamaitha",            regStatus: "Fully Registered", dob: d("2012-06-05"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/007", name: "Chege John Muiruri",        guardian: "Agata Wanjiku",            regStatus: "Fully Registered", dob: d("2012-11-24"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/008", name: "Mwangi Steven Wambui",      guardian: "Miriam Wambui",            regStatus: "Incomplete",       dob: d("2013-03-18"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/009", name: "Collins Mutie Mutinda",     guardian: "Eunice Kanini Muendo",     regStatus: "Fully Registered", dob: d("2010-09-17"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/010", name: "John Thiriku Wairimu",      guardian: "Nancy Esther Wanja",       regStatus: "Fully Registered", dob: d("2012-01-26"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  // ── 011-020 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/011", name: "Felix Maina",               guardian: "Beatrice Wanjiru",         regStatus: "Incomplete",       dob: d("2011-10-18"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/012", name: "Evans Mwangi",              guardian: "Hannah Wamaitha",          regStatus: "Fully Registered", dob: d("2010-03-26"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/013", name: "Mutuota John",              guardian: "Stephen Ngichiri Ngugi",   regStatus: "Fully Registered", dob: d("2009-10-15"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/014", name: "David Kuria Mwangi",        guardian: "Grace Wangui",             regStatus: "Fully Registered", dob: d("2010-07-15"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/015", name: "Emmanuel Kuria Njenga",     guardian: "Ann Njeri",                regStatus: "Incomplete",       dob: d("2013-09-26"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/016", name: "Timothy Fadhili Sakwa",     guardian: "Mercyline Ayoti",          regStatus: "Fully Registered", dob: d("2011-08-22"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/017", name: "Stephen Omollo",            guardian: null,                       regStatus: "Incomplete",       dob: d("2013-09-20"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/018", name: "Shadrach Adhiambo Ouma",    guardian: "Carolyne Atieno",          regStatus: "Fully Registered", dob: d("2011-01-22"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/019", name: "Don Evan Lucky",            guardian: "Ngendakumana Armond",      regStatus: "Fully Registered", dob: d("2013-05-29"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/020", name: "Hillary Omondi",            guardian: "Elizabeth Akinyi",         regStatus: "Incomplete",       dob: d("2010-07-12"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  // ── 021-030 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/021", name: "Godfrey Otieno Oloo",       guardian: "Evaline Akoth",            regStatus: "Fully Registered", dob: d("2009-06-16"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/022", name: "Samson Onyanga",            guardian: "David Nyangau",            regStatus: "Fully Registered", dob: d("2013-07-18"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/023", name: "Samuel Irungu",             guardian: "Lucy Wambui",              regStatus: "Fully Registered", dob: d("2008-11-01"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/024", name: "Muteti Ephraim Enock",      guardian: null,                       regStatus: "Incomplete",       dob: d("2012-03-16"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/025", name: "Raphael Blessing Oluoch",   guardian: null,                       regStatus: "Incomplete",       dob: d("2016-11-14"), dobEstimated: false, category: "U10-U12", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/026", name: "Edwardo Santos Otieno",     guardian: null,                       regStatus: "Incomplete",       dob: d("2012-12-12"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/027", name: "Asha Onyango Odhiambo",     guardian: null,                       regStatus: "Incomplete",       dob: d("2013-10-04"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/028", name: "Michael Kakanga Kiena",     guardian: null,                       regStatus: "Incomplete",       dob: d("2013-08-13"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/029", name: "Dennis Oliech Hassan",      guardian: "Joyce Hassan",             regStatus: "Incomplete",       dob: d("2011-08-13"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/030", name: "Ryan Kariuki Njuguna",      guardian: "Jackline Wangui",          regStatus: "Fully Registered", dob: d("2011-07-02"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  // ── 031-040 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/031", name: "Benson Kamau Mwangi",       guardian: "Samson Mwangi",            regStatus: "Incomplete",       dob: d("2013-10-15"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/032", name: "Ezra Blessing Ndungu",      guardian: null,                       regStatus: "Incomplete",       dob: d("2011-12-06"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/033", name: "Isaac Mbugua Karumbo",      guardian: "Phyllis Wambui",           regStatus: "Incomplete",       dob: d("2017-01-28"), dobEstimated: false, category: "U7-U9",   school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/034", name: "Levis Njoroge",             guardian: "Ruth Wanjiru",             regStatus: "Incomplete",       dob: d("2017-08-25"), dobEstimated: false, category: "U7-U9",   school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/035", name: "Emmanuel Mwendwa",          guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/036", name: "Charles Kariuki Karanu",    guardian: "Monica Sarah",             regStatus: "Incomplete",       dob: d("2017-10-01"), dobEstimated: false, category: "U7-U9",   school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/037", name: "Victor Amani",              guardian: "Daniel Gadambe",           regStatus: "Incomplete",       dob: d("2012-06-23"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "8",       gender: Gender.MALE },
  { regNo: "DEA/MWK/038", name: "Ramon Jason Irungu",        guardian: "Jemimah Njeri",            regStatus: "Incomplete",       dob: d("2016-07-20"), dobEstimated: false, category: "U10-U12", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/039", name: "Melvin Gitau Wairimu",      guardian: "Peris Wairimu",            regStatus: "Fully Registered", dob: d("2011-03-28"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/040", name: "Tiberius Ingalza Wairimu",  guardian: "Peris Wairimu",            regStatus: "Incomplete",       dob: d("2013-05-29"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  // ── 041-050 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/041", name: "Gatjuol Chatim Gatgong",    guardian: "Daniel Gawar",             regStatus: "Fully Registered", dob: d("2008-08-12"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/042", name: "Nickson Muthomi",           guardian: "Joy Kananu",               regStatus: "Fully Registered", dob: d("2010-10-20"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/043", name: "Alvin Adhiambo Ouma",       guardian: "Carolyne Atieno",          regStatus: "Fully Registered", dob: d("2013-05-31"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/044", name: "Ramadhan Said Hussein",     guardian: "Hellen Logedi",            regStatus: "Fully Registered", dob: d("2012-07-27"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/045", name: "Shishikara Karo",           guardian: "Nyagaju Chantal",          regStatus: "Fully Registered", dob: d("2010-07-01"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/046", name: "Jeimy Rotich Kipkorir",     guardian: "Sharon Cherop Kausel",     regStatus: "Fully Registered", dob: d("2013-09-17"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/047", name: "Nathan Dylan Owur",         guardian: "Grace Pamela Akinyi",      regStatus: "Fully Registered", dob: d("2013-11-06"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/048", name: "Bivon Achochi",             guardian: "Damacline Nyamari",        regStatus: "Fully Registered", dob: d("2009-06-23"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/049", name: "Francis Chama Musyoki",     guardian: "Ann Wanjiku Kamau",        regStatus: "Incomplete",       dob: d("2011-05-25"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/050", name: "John Mureithi",             guardian: "Ruth Muthui Mali",         regStatus: "Fully Registered", dob: d("2009-03-25"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  // ── 051-060 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/051", name: "Christian Lemayian",        guardian: "Zipporah Wanjiru",         regStatus: "Fully Registered", dob: d("2010-10-20"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/052", name: "Elias Mariga Kirika",       guardian: "John Kirika Mariga",       regStatus: "Fully Registered", dob: d("2012-01-28"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/053", name: "Ryan Sakwa",                guardian: "Charity Muhonja Sakwa",    regStatus: "Fully Registered", dob: d("2012-02-10"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/054", name: "Joshua Silas",              guardian: "Teresa Okoth",             regStatus: "Incomplete",       dob: d("2011-05-30"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/055", name: "Stephen Okoth",             guardian: "Samuel Otieno",            regStatus: "Fully Registered", dob: d("2009-12-26"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/056", name: "Daniel Waite",              guardian: "John Nganga",              regStatus: "Fully Registered", dob: d("2011-06-13"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/057", name: "Vincent Mwangi",            guardian: "Jacinta Nthambi",          regStatus: "Fully Registered", dob: d("2011-08-04"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/058", name: "Maxwell Mutura",            guardian: "Hannah Wanjiru",           regStatus: "Fully Registered", dob: d("2011-02-20"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/059", name: "Emmanuel Macharia",         guardian: "Caroline Kirigo",          regStatus: "Incomplete",       dob: d("2011-01-20"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/060", name: "Samuel Likomi",             guardian: "Julius Likami",            regStatus: "Incomplete",       dob: d("2010-02-21"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "7",       gender: Gender.MALE },
  // ── 061-070 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/061", name: "Kairo Allan Ojwang",        guardian: "Dorothy Kanana",           regStatus: "Fully Registered", dob: d("2009-08-28"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/062", name: "Eric Muiruri",              guardian: "Doreen Gasheri Njagi",     regStatus: "Fully Registered", dob: d("2010-11-16"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/063", name: "Jean Paul",                 guardian: "Nyabikari Charlotte",      regStatus: "Incomplete",       dob: d("2013-02-07"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/064", name: "Ngari John Thiriku",        guardian: "Hannah Mwihaki Karungo",   regStatus: "Incomplete",       dob: d("2015-01-27"), dobEstimated: false, category: "U10-U12", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/065", name: "Samuel Ndungu Kamau",       guardian: "Emily Njambi Wangui",      regStatus: "Fully Registered", dob: d("2011-03-15"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/066", name: "Samuel Mwendwa Musyoka",    guardian: "Victoria Ndunge Musyoka",  regStatus: "Fully Registered", dob: d("2012-07-31"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/067", name: "Halid Ambani",              guardian: "Lilian Akinyi Makokha",    regStatus: "Incomplete",       dob: d("2009-10-21"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/068", name: "Dennis Karanja",            guardian: "Mary Waigumo",             regStatus: "Fully Registered", dob: d("2009-08-28"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/069", name: "Daniel Victor",             guardian: "Serah Njeri",              regStatus: "Fully Registered", dob: d("2012-07-11"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/070", name: "Jeremy Muchoki",            guardian: "Ruth Nyambura",            regStatus: "Fully Registered", dob: d("2011-04-07"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  // ── 071-080 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/071", name: "Brian Irungu",              guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/072", name: "Justin Maraga",             guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/073", name: "Jasper Mariasi",            guardian: "Ann Bosire",               regStatus: "Fully Registered", dob: d("2011-08-08"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/074", name: "Emmanuel Xavier",           guardian: "Regina Muthoni Njoki",     regStatus: "Fully Registered", dob: d("2012-03-29"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/075", name: "Samuel Angode",             guardian: "Eunice Muhunzu",           regStatus: "Fully Registered", dob: d("2010-12-28"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/076", name: "Charles Macharia",          guardian: "Simon M. Muthee",          regStatus: "Fully Registered", dob: d("2011-12-18"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/077", name: "Mark Kiguthi",              guardian: "Mary Moche",               regStatus: "Fully Registered", dob: d("2012-01-14"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/078", name: "Ramon Mwangi",              guardian: "Rose Omondi",              regStatus: "Fully Registered", dob: d("2011-12-12"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "8",       gender: Gender.MALE },
  { regNo: "DEA/MWK/079", name: "Blessed Muchiri",           guardian: "Boniface Maina Muchiri",   regStatus: "Incomplete",       dob: d("2012-07-10"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/080", name: "Victor Kariuki",            guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.MALE },
  // ── 081-090 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/081", name: "Mathias Mulwa",             guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/082", name: "Jubilant Samuel",           guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/083", name: "Jayden Mwangi",             guardian: "Stella K. Mbaabu",         regStatus: "Fully Registered", dob: d("2013-10-21"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "7",       gender: Gender.MALE },
  { regNo: "DEA/MWK/084", name: "Maxine Maina",              guardian: null,                       regStatus: "Incomplete",       dob: UNK_DOB,         dobEstimated: true,  category: null,      school: MUREMA, grade: null,      gender: Gender.FEMALE },
  { regNo: "DEA/MWK/085", name: "Edwin Kariuki",             guardian: "Eunice Njambi Ngigi",      regStatus: "Incomplete",       dob: d("2010-12-30"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/086", name: "Aaron Nganga",              guardian: "Elizabeth Njeri",          regStatus: "Fully Registered", dob: d("2011-08-16"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/087", name: "Collins Nderitu",           guardian: "Elias Maina",              regStatus: "Fully Registered", dob: d("2012-06-29"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/088", name: "Alvin Kanyi",               guardian: "Anne Wanjiru",             regStatus: "Fully Registered", dob: d("2012-04-02"), dobEstimated: false, category: "U13-U15", school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/089", name: "Joseph Emanuel",            guardian: "Martha Rawakah",           regStatus: "Fully Registered", dob: d("2010-06-17"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  { regNo: "DEA/MWK/090", name: "Hillary Mutua",             guardian: "Josephine Mbithe",         regStatus: "Fully Registered", dob: d("2009-05-12"), dobEstimated: false, category: "U18",     school: null,   grade: null,      gender: Gender.MALE },
  // ── 091-100 ──────────────────────────────────────────────────────────────
  { regNo: "DEA/MWK/091", name: "Elvis Mbiu",                guardian: "Esther Njeri",             regStatus: "Fully Registered", dob: d("2012-03-08"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/092", name: "Berlin Odhiambo",           guardian: "Jane Ochieng",             regStatus: "Fully Registered", dob: d("2010-07-27"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "Form 3",  gender: Gender.MALE },
  { regNo: "DEA/MWK/093", name: "Paul Ramsey",               guardian: "Michael Otieno",           regStatus: "Fully Registered", dob: UNK_DOB,         dobEstimated: true,  category: "U18",     school: MUREMA, grade: "10",      gender: Gender.MALE },
  { regNo: "DEA/MWK/094", name: "James Mwema",               guardian: null,                       regStatus: "Incomplete",       dob: d("2008-05-04"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "10",      gender: Gender.MALE },
  { regNo: "DEA/MWK/095", name: "Wilson Nyaema",             guardian: "Bethsheba Mayaka",         regStatus: "Incomplete",       dob: d("2010-03-26"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "10",      gender: Gender.MALE },
  { regNo: "DEA/MWK/096", name: "Moses Wanza",               guardian: null,                       regStatus: "Incomplete",       dob: d("2008-10-18"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "Form 3",  gender: Gender.MALE },
  { regNo: "DEA/MWK/097", name: "Amos Wanza",                guardian: null,                       regStatus: "Incomplete",       dob: d("2008-10-20"), dobEstimated: false, category: "U18",     school: MUREMA, grade: "Form 3",  gender: Gender.MALE },
  { regNo: "DEA/MWK/098", name: "Telvin Kinyua",             guardian: "Mary Wangui Muya",         regStatus: "Incomplete",       dob: d("2011-10-20"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/099", name: "Nicholas Mwangi",           guardian: "Leah Wanjiku",             regStatus: "Fully Registered", dob: d("2011-10-20"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
  { regNo: "DEA/MWK/100", name: "Benson Kuria",              guardian: "Susan Wanjiru",            regStatus: "Fully Registered", dob: d("2011-08-18"), dobEstimated: false, category: "U13-U15", school: MUREMA, grade: "9",       gender: Gender.MALE },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Importing DEA/MWK players into Darajani Elite...\n");

  // 1. Look up Darajani org
  const darajani = await prisma.organization.findUniqueOrThrow({ where: { slug: "darajani" } });
  console.log(`  Org: ${darajani.name} (${darajani.id})`);

  // 2. Look up or create Darajani Elite branch
  let branch = await prisma.branch.findFirst({
    where: { organizationId: darajani.id, name: { contains: "Elite", mode: "insensitive" } },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        organizationId: darajani.id,
        name: "Darajani Elite",
        slug: "darajani-elite",
        description: "Elite team — DEA/MWK registered players",
        isMain: true,
        primaryColor: "#16A34A",
        accentColor: "#FACC15",
      },
    });
    console.log(`  Created branch: Darajani Elite (${branch.id})`);
  } else {
    console.log(`  Branch: ${branch.name} (${branch.id})`);
  }

  console.log("");

  let created = 0;
  let skipped = 0;
  const dobMissing: string[] = [];

  for (const p of players) {
    // Check for existing record by admissionNo
    const existing = await prisma.beneficiary.findFirst({
      where: { organizationId: darajani.id, admissionNo: p.regNo },
    });

    if (existing) {
      console.log(`  SKIP  ${p.regNo} — already exists`);
      skipped++;
      continue;
    }

    const { firstName, middleName, lastName } = parseName(p.name);

    // Create Beneficiary
    const ben = await prisma.beneficiary.create({
      data: {
        organizationId: darajani.id,
        branchId: branch.id,
        admissionNo: p.regNo,
        firstName,
        middleName,
        lastName,
        dateOfBirth: p.dob,
        gender: p.gender,
        guardianName: p.guardian,
      },
    });

    // Create AthleteProfile
    await prisma.athleteProfile.create({
      data: {
        beneficiaryId: ben.id,
        registrationStatus: p.regStatus,
        characterNotes: p.category ? `Age category: ${p.category}` : undefined,
      },
    });

    // Create StudentProfile (when school data is available)
    if (p.school) {
      await prisma.studentProfile.create({
        data: {
          beneficiaryId: ben.id,
          school: p.school,
          grade: p.grade,
        },
      });
    }

    const flag = p.dobEstimated ? " ⚠ DOB unknown" : "";
    console.log(`  ✓ ${p.regNo}  ${p.name}${flag}`);
    created++;
    if (p.dobEstimated) dobMissing.push(`${p.regNo} — ${p.name}`);
  }

  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`Created : ${created}`);
  console.log(`Skipped : ${skipped} (already in DB)`);
  console.log(`Total   : ${players.length}`);

  if (dobMissing.length) {
    console.log(`\n⚠  ${dobMissing.length} players have no DOB in source documents — date set to 2000-01-01 (update manually):`);
    dobMissing.forEach((r) => console.log(`   ${r}`));
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
