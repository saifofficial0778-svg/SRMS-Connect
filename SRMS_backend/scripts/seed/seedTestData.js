/* eslint-disable no-console */
// =====================================================================================
// DEVELOPMENT / TEST ONLY: resets the database and fills it with synthetic test data.
//
//   npm run seed:test-data            reset + seed
//   npm run seed:test-data -- --dry-run   only show what would be preserved / deleted
//   npm run seed:test-data -- --analytics-only   keep everything, only rebuild the analytics history
//
// It refuses to run when NODE_ENV=production or when the database is not on this machine.
// See scripts/seed/README.md for what it does and what it never touches.
// =====================================================================================

const path = require("path");
const fs = require("fs");

const BACKEND_ROOT = path.join(__dirname, "..", "..");
process.chdir(BACKEND_ROOT); // so dotenv (loaded by src/config/db) finds the backend's .env

const db = require("../../src/config/db");
const AppError = require("../../src/utils/AppError");

// ---- no real e-mail leaves this script: the OTP "mail" is captured in memory instead.
// This must happen before the auth service is loaded, because it keeps its own reference.
const emailService = require("../../src/utils/email.service");
const otpInbox = new Map();
emailService.sendOtpEmail = async (toEmail, otp) => {
    otpInbox.set(toEmail, otp);
};

const AuthService = require("../../src/modules/auth/auth.service");
const UserService = require("../../src/modules/userManagement/userManagement.service");
const ProfileService = require("../../src/modules/profile/profile.service");
const ConnectionService = require("../../src/modules/connection/connection.service");
const PostService = require("../../src/modules/post/post.service");
const ChatService = require("../../src/modules/chat/chat.service");
const JobService = require("../../src/modules/job/job.service");
const CareerService = require("../../src/modules/career/career.service");
const MentorshipService = require("../../src/modules/mentorship/mentorship.service");
const IntroService = require("../../src/modules/intro/intro.service");
const NotificationService = require("../../src/modules/notification/notification.service");
const SearchService = require("../../src/modules/search/search.service");
const InsightService = require("../../src/modules/insight/insight.service");
const AnalyticsService = require("../../src/modules/analytics/analytics.service");
const SpotlightService = require("../../src/modules/spotlight/spotlight.service");
const { createSpotlightSchema } = require("../../src/modules/spotlight/spotlight.validation");

const { registerSchema, verifyRegisterOtpSchema } = require("../../src/modules/auth/auth.validation");
const { updateProfileSchema, updateOpenToSchema, addSkillSchema, addProjectSchema } = require("../../src/modules/profile/profile.validation");
const { createJobSchema, listJobsSchema } = require("../../src/modules/job/job.validation");
const careerValidation = require("../../src/modules/career/career.validation");
const mentorshipValidation = require("../../src/modules/mentorship/mentorship.validation");
const introValidation = require("../../src/modules/intro/intro.validation");
const { searchQuerySchema } = require("../../src/modules/search/search.validation");
const { TOPICS } = require("../../src/modules/mentorship/mentorship.constants");

const D = require("./data");

// ----------------------------------- settings -----------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const ANALYTICS_ONLY = process.argv.includes("--analytics-only");
const SPOTLIGHTS_ONLY = process.argv.includes("--spotlights-only");
const SAIF_ENROLLMENT = "2025107452";
// the third preserved account is found by name; set this to pin it to an exact enrollment
const SHAKSHI_ENROLLMENT = process.env.SEED_KEEP_ENROLLMENT || null;
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "SrmsSeed@2026"; // for generated accounts only
const RNG_SEED = 20261007;

const OUTPUT_DIR = path.join(BACKEND_ROOT, "seed-output");
const BACKUP_DIR = path.join(OUTPUT_DIR, "backups");
const REPORT_FILE = path.join(OUTPUT_DIR, "SEED_REPORT.md");
const BACKUPS_TO_KEEP = 5;

// Every table must be in exactly one of these lists. A table the script does not know
// (added by a later migration) stops the run before anything is deleted.
const WIPE_TABLES = [
    // children first, so no DELETE ever meets a row that still points at it
    "notifications",
    "campus_spotlights",
    "post_impressions", "profile_views", "search_appearances",
    "mentorship_events", "mentorship_goals", "mentorship_sessions", "mentorships",
    "mentor_tags", "mentor_profiles",
    "warm_intros",
    "career_request_events", "career_requests",
    "job_skills", "jobs",
    "messages", "conversations",
    "post_comments", "post_likes", "post_media", "posts",
    "connections",
    "otp_verifications", "password_resets",
];
const FILTERED_TABLES = ["user_sessions", "profile_open_to", "profile_skills", "profile_projects", "profiles", "users", "student_master", "alumni_master"];
const UNTOUCHED_TABLES = ["skills", "skill_aliases", "schema_migrations"]; // reference data, not test data

// ----------------------------------- small helpers -----------------------------------

// deterministic pseudo-random numbers, so every run produces the same people and activity
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(RNG_SEED);
const int = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (list) => list[Math.floor(rng() * list.length)];
const chance = (p) => rng() < p;
function sample(list, count) {
    const pool = [...list];
    const out = [];
    while (pool.length && out.length < count) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
}
const pad = (n, width) => String(n).padStart(width, "0");
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
const viewerOf = (person) => ({ userId: person.userId, role: person.role });
const localDate = (daysAgo) => {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
};
const log = (message) => console.log(message);
const section = (title) => console.log(`\n=== ${title} ===`);

// A business rule saying "no" (AppError 4xx) is not a crash: the item is skipped and counted,
// and reported at the end. Anything else (a bug, a DB error, invalid seed data) stops the run.
const skipped = {};
async function attempt(label, fn) {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
            skipped[label] = skipped[label] || { count: 0, example: error.message };
            skipped[label].count += 1;
            return null;
        }
        throw error;
    }
}

async function inTransaction(work) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const result = await work(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

const placeholders = (list) => list.map(() => "?").join(", ");

// ----------------------------------- 0. safety -----------------------------------

function assertSafeEnvironment() {
    if (String(process.env.NODE_ENV).toLowerCase() === "production") {
        throw new Error("Refusing to run: NODE_ENV is production.");
    }
    const host = String(process.env.DB_HOST || "").toLowerCase();
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
        throw new Error("Refusing to run: the database host is not this machine. This script is for a local dev/test database only.");
    }
}

async function assertKnownSchema() {
    const [rows] = await db.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    const known = new Set([...WIPE_TABLES, ...FILTERED_TABLES, ...UNTOUCHED_TABLES]);
    const unknown = rows.map((r) => r.name).filter((name) => !known.has(name));
    const missing = [...known].filter((name) => !rows.some((r) => r.name === name));
    if (unknown.length || missing.length) {
        throw new Error(
            `The schema does not match what this script knows. Unknown tables: [${unknown.join(", ")}], missing tables: [${missing.join(", ")}]. ` +
            "Update WIPE_TABLES / FILTERED_TABLES in scripts/seed/seedTestData.js (and run the migrations) before seeding."
        );
    }
    return rows.map((r) => r.name).sort();
}

// ----------------------------------- 1. who is preserved -----------------------------------

const PERSON_SQL = `
    SELECT u.id, u.enrollment, u.email, u.role, u.status, p.id AS profile_id,
           COALESCE(p.full_name, sm.full_name, am.full_name) AS full_name,
           sm.id AS student_master_id, am.id AS alumni_master_id
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN student_master sm ON sm.enrollment = u.enrollment
    LEFT JOIN alumni_master am ON am.enrollment = u.enrollment`;

async function exactlyOne(label, sql, params = []) {
    const [rows] = await db.query(sql, params);
    if (rows.length !== 1) {
        throw new Error(`Cannot resolve "${label}" safely: expected exactly 1 match, found ${rows.length}. Nothing was changed.`);
    }
    return rows[0];
}

async function resolvePreserved() {
    // 1. Saif: the student master record with this enrollment, and the account registered from it
    const saifMaster = await exactlyOne("Saif's student master record", "SELECT id, enrollment, full_name FROM student_master WHERE enrollment = ?", [SAIF_ENROLLMENT]);
    const saif = await exactlyOne("Saif's account", `${PERSON_SQL} WHERE u.enrollment = ?`, [SAIF_ENROLLMENT]);
    if (saif.student_master_id !== saifMaster.id) throw new Error("Saif's account and master record do not match. Nothing was changed.");

    // 2. the existing ADMIN account
    const admin = await exactlyOne("the existing ADMIN account", `${PERSON_SQL} WHERE u.role = 'ADMIN'`);

    // 3. Shakshi (stored as "Sakshi ..."): matched on the first name, or pinned by enrollment
    const shakshi = SHAKSHI_ENROLLMENT
        ? await exactlyOne("Shakshi's account", `${PERSON_SQL} WHERE u.enrollment = ?`, [SHAKSHI_ENROLLMENT])
        : await exactlyOne(
            "Shakshi's account (set SEED_KEEP_ENROLLMENT to pin it)",
            `${PERSON_SQL} WHERE COALESCE(p.full_name, sm.full_name, am.full_name) REGEXP '^(Shakshi|Sakshi)( |$)'`
        );

    const people = [
        { label: "Saif", ...saif },
        { label: "ADMIN", ...admin },
        { label: "Shakshi", ...shakshi },
    ];
    if (new Set(people.map((p) => p.id)).size !== 3) throw new Error("The three preserved identities are not three different accounts. Nothing was changed.");
    return people;
}

// exact copies of the rows that must come out of this script unchanged (compared in memory, never printed)
async function snapshotPreserved(preserved) {
    const ids = preserved.map((p) => p.id);
    const enrollments = preserved.map((p) => p.enrollment);
    const [users] = await db.query(`SELECT * FROM users WHERE id IN (${placeholders(ids)}) ORDER BY id`, ids);
    const [students] = await db.query(`SELECT * FROM student_master WHERE enrollment IN (${placeholders(enrollments)}) ORDER BY id`, enrollments);
    const [alumni] = await db.query(`SELECT * FROM alumni_master WHERE enrollment IN (${placeholders(enrollments)}) ORDER BY id`, enrollments);
    const [profiles] = await db.query(`SELECT * FROM profiles WHERE user_id IN (${placeholders(ids)}) ORDER BY id`, ids);
    return JSON.stringify({ users, students, alumni, profiles });
}

function printPreserved(preserved) {
    section("Preservation list (these are never deleted or modified)");
    for (const p of preserved) {
        const master = p.student_master_id ? `student_master #${p.student_master_id}` : p.alumni_master_id ? `alumni_master #${p.alumni_master_id}` : "no master record";
        log(`  ${p.label.padEnd(8)} user #${p.id}  ${p.role.padEnd(7)} ${p.status.padEnd(7)} enrollment ${p.enrollment}  ${p.full_name || "(no profile name)"}  | profile #${p.profile_id ?? "-"} | ${master}`);
    }
}

// ----------------------------------- 2. backup -----------------------------------

async function backupDatabase(tables) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const dump = {};
    for (const table of tables) {
        const [rows] = await db.query(`SELECT * FROM \`${table}\``);
        dump[table] = rows;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(BACKUP_DIR, `backup-run-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ created_at: new Date().toISOString(), database: process.env.DB_NAME, tables: dump }));

    // keep the newest few automatic backups; anything not named backup-run-* is never removed
    const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^backup-run-.*\.json$/.test(f)).sort().reverse().slice(BACKUPS_TO_KEEP);
    for (const f of old) fs.unlinkSync(path.join(BACKUP_DIR, f));
    return file;
}

// ----------------------------------- 3. cleanup -----------------------------------

async function countAll(tables, conn = db) {
    const counts = {};
    for (const table of tables) {
        const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
        counts[table] = Number(row.c);
    }
    return counts;
}

async function cleanDatabase(preserved, snapshotBefore) {
    const keepUsers = preserved.map((p) => p.id);
    const keepEnrollments = preserved.map((p) => p.enrollment);
    const keepProfiles = preserved.map((p) => p.profile_id).filter(Boolean);
    const profileFilter = keepProfiles.length ? `WHERE profile_id NOT IN (${placeholders(keepProfiles)})` : "";
    const deleted = {};

    await inTransaction(async (conn) => {
        const run = async (table, sql, params = []) => {
            const [result] = await conn.query(sql, params);
            deleted[table] = result.affectedRows;
        };

        // a preserved account must not depend on an account that is about to go
        const [dependent] = await conn.query(
            `SELECT id FROM users WHERE id IN (${placeholders(keepUsers)}) AND verified_by IS NOT NULL AND verified_by NOT IN (${placeholders(keepUsers)})`,
            [...keepUsers, ...keepUsers]
        );
        if (dependent.length) throw new Error("A preserved account was verified by an account that would be deleted. Nothing was changed.");

        for (const table of WIPE_TABLES) await run(table, `DELETE FROM \`${table}\``);

        await run("user_sessions", `DELETE FROM user_sessions WHERE user_id NOT IN (${placeholders(keepUsers)})`, keepUsers);
        for (const table of ["profile_open_to", "profile_skills", "profile_projects"]) {
            await run(table, `DELETE FROM \`${table}\` ${profileFilter}`, keepProfiles);
        }
        await run("profiles", `DELETE FROM profiles WHERE user_id NOT IN (${placeholders(keepUsers)})`, keepUsers);

        // users reference each other through verified_by: detach the rows being removed first
        await conn.query(`UPDATE users SET verified_by = NULL WHERE id NOT IN (${placeholders(keepUsers)})`, keepUsers);
        await run("users", `DELETE FROM users WHERE id NOT IN (${placeholders(keepUsers)})`, keepUsers);

        await run("student_master", `DELETE FROM student_master WHERE enrollment NOT IN (${placeholders(keepEnrollments)})`, keepEnrollments);
        await run("alumni_master", `DELETE FROM alumni_master WHERE enrollment NOT IN (${placeholders(keepEnrollments)})`, keepEnrollments);

        // verify INSIDE the transaction: if anything is off, everything rolls back
        const [[{ c: usersLeft }]] = await conn.query("SELECT COUNT(*) AS c FROM users");
        if (Number(usersLeft) !== preserved.length) throw new Error(`Cleanup check failed: ${usersLeft} users left, expected ${preserved.length}. Rolled back.`);
        const [stillThere] = await conn.query(`SELECT id FROM users WHERE id IN (${placeholders(keepUsers)})`, keepUsers);
        if (stillThere.length !== preserved.length) throw new Error("Cleanup check failed: a preserved account is missing. Rolled back.");
        for (const table of WIPE_TABLES) {
            const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
            if (Number(c) !== 0) throw new Error(`Cleanup check failed: ${table} is not empty. Rolled back.`);
        }
    });

    if ((await snapshotPreserved(preserved)) !== snapshotBefore) {
        throw new Error("A preserved identity record changed during cleanup. Restore from the backup taken at the start of this run.");
    }
    return deleted;
}

// ----------------------------------- 4. synthetic people -----------------------------------

function buildPeople() {
    const people = [];
    for (let k = 0; k < 100; k++) {
        const isStudent = k < 50;
        const n = isStudent ? k + 1 : k - 49; // 1..50 within the role
        const first = D.FIRST_NAMES[k % D.FIRST_NAMES.length];
        const last = D.LAST_NAMES[(k * 7 + Math.floor(k / 50) * 3) % D.LAST_NAMES.length];
        const [course, branch] = D.PROGRAMMES[(k * 3 + 1) % D.PROGRAMMES.length];
        const yearsOfStudy = course === "B.Tech" ? 4 : course === "BCA" ? 3 : 2;
        const ageAtAdmission = course === "MCA" ? 21 : 18;

        const person = {
            index: n - 1,
            role: isStudent ? "STUDENT" : "ALUMNI",
            full_name: `${first} ${last}`,
            course,
            branch,
            email: `${first}.${last}.${isStudent ? "s" : "a"}${pad(n, 2)}@srms-seed.test`.toLowerCase(), // .test never resolves
            mobile: `${isStudent ? "70000" : "80000"}${pad(n, 5)}`,
        };

        if (isStudent) {
            // currently enrolled in October 2026: admitted within the last `yearsOfStudy` years
            person.admission_year = 2026 - (n % yearsOfStudy);
            person.enrollment = `${person.admission_year}90${pad(n, 3)}`;
            person.dob = `${person.admission_year - ageAtAdmission - int(0, 1)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
            person.interest = D.TRACK_KEYS[(n * 3) % D.TRACK_KEYS.length];
        } else {
            person.passout_year = 2016 + ((n * 3) % 10); // 2016..2025
            person.enrollment = `${person.passout_year - yearsOfStudy}91${pad(n, 3)}`;
            person.dob = `${person.passout_year - yearsOfStudy - ageAtAdmission - int(0, 1)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
            person.track = D.TRACK_KEYS[(n - 1) % D.TRACK_KEYS.length];
            person.companyInfo = D.COMPANIES[(n * 5) % D.COMPANIES.length];
            person.experience = Math.max(1, 2026 - person.passout_year);
        }
        people.push(person);
    }

    const unique = (key) => new Set(people.map((p) => p[key])).size === people.length;
    if (!unique("enrollment") || !unique("email") || !unique("full_name") || !unique("mobile")) throw new Error("Seed data bug: generated identities are not unique.");
    return { students: people.filter((p) => p.role === "STUDENT"), alumni: people.filter((p) => p.role === "ALUMNI") };
}

async function insertMasterData(students, alumni, preserved) {
    const taken = new Set(preserved.map((p) => p.enrollment));
    if ([...students, ...alumni].some((p) => taken.has(p.enrollment))) throw new Error("Seed data bug: a generated enrollment collides with a preserved one.");

    await inTransaction(async (conn) => {
        await conn.query(
            "INSERT INTO student_master (enrollment, full_name, dob, course, branch, admission_year, college_email, mobile) VALUES ?",
            [students.map((s) => [s.enrollment, s.full_name, s.dob, s.course, s.branch, s.admission_year, s.email, s.mobile])]
        );
        await conn.query(
            "INSERT INTO alumni_master (enrollment, full_name, dob, course, branch, passout_year, college_email, mobile) VALUES ?",
            [alumni.map((a) => [a.enrollment, a.full_name, a.dob, a.course, a.branch, a.passout_year, a.email, a.mobile])]
        );
    });
}

// ----------------------------------- 5. registration (the real flow) -----------------------------------

// register -> e-mail OTP -> verify -> admin approval, exactly as a person would, through the services
async function registerEveryone(people, adminId) {
    let done = 0;
    for (const person of people) {
        const form = registerSchema.parse({ enrollment: person.enrollment, dob: person.dob, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD });
        const { userId } = await AuthService.register(form);
        person.userId = userId;

        const otp = otpInbox.get(person.email);
        if (!otp) throw new Error(`No OTP was captured for ${person.enrollment}.`);
        const verify = verifyRegisterOtpSchema.parse({ enrollment: person.enrollment, otp });
        await AuthService.verifyRegisterOtp(verify.enrollment, verify.otp);

        await UserService.updateUserStatus(userId, "ACTIVE", adminId); // the existing admin approves
        await NotificationService.markAllRead(userId); // the "account approved" notice has been seen

        done += 1;
        if (done % 25 === 0) log(`  registered ${done}/${people.length}`);
    }

    const ids = people.map((p) => p.userId);
    const [rows] = await db.query(
        `SELECT u.id, u.role, u.status, u.email_verified, u.password_hash, p.id AS profile_id
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id IN (${placeholders(ids)})`,
        ids
    );
    for (const person of people) {
        const row = rows.find((r) => r.id === person.userId);
        const ok = row && row.status === "ACTIVE" && row.email_verified === 1 && row.role === person.role && row.profile_id && row.password_hash.startsWith("$2") && row.password_hash !== TEST_PASSWORD;
        if (!ok) throw new Error(`Registration check failed for ${person.enrollment}.`);
        person.profileId = row.profile_id;
    }
}

// ----------------------------------- 6. profiles -----------------------------------

function designationFor(person) {
    const ladder = D.TRACKS[person.track].ladder;
    const level = person.experience < 2 ? 0 : person.experience < 5 ? 1 : person.experience < 8 ? 2 : 3;
    return ladder[level];
}

async function fillProfiles(students, alumni) {
    for (const a of alumni) {
        const track = D.TRACKS[a.track];
        const handle = slug(a.full_name) + "-a" + pad(a.index + 1, 2);
        a.company = a.companyInfo.name;
        a.designation = designationFor(a);
        a.skills = sample(track.skills, Math.min(track.skills.length, int(5, 7)));
        if (chance(0.5)) {
            const extra = pick(D.TRACKS[D.TRACK_KEYS[(a.index + 3) % D.TRACK_KEYS.length]].skills);
            if (!a.skills.includes(extra)) a.skills.push(extra);
        }

        await ProfileService.updateProfile(a.userId, updateProfileSchema.parse({
            bio: `${a.designation} at ${a.company}. ${a.course} ${a.passout_year}, SRMS. I work on ${track.label}.`,
            location: a.companyInfo.city,
            linkedin_url: `https://example.com/linkedin/${handle}`,
            github_url: `https://example.com/github/${handle}`,
            company: a.company,
            designation: a.designation,
            experience_years: a.experience,
            interests: [track.label, "mentoring", pick(["open source", "system design", "public speaking", "technical writing"])].join(", "),
            career_goals: pick(D.ALUMNI_GOALS),
        }));

        const n = a.index + 1;
        a.openTo = [["MENTORSHIP", "REFERRALS"], ["MENTORSHIP", "RESUME_REVIEW", "MOCK_INTERVIEW"], ["REFERRALS", "HIRING"], ["MENTORSHIP", "HIRING", "REFERRALS", "RESUME_REVIEW"], []][n % 5];
        await ProfileService.updateOpenTo(a.userId, a.role, updateOpenToSchema.parse({ intents: a.openTo }).intents);

        if (n % 3 === 0) {
            const [title, description] = D.ALUMNI_PROJECTS[n % D.ALUMNI_PROJECTS.length];
            await ProfileService.addProject(a.userId, addProjectSchema.parse({ title, description, project_url: `https://example.com/projects/${handle}` }));
        }
    }

    for (const s of students) {
        const track = D.TRACKS[s.interest];
        const handle = slug(s.full_name) + "-s" + pad(s.index + 1, 2);
        s.skills = sample(D.STUDENT_BASE_SKILLS, int(3, 5));
        if (chance(0.6)) {
            const extra = pick(track.skills);
            if (!s.skills.includes(extra)) s.skills.push(extra);
        }
        s.resumeUrl = `https://example.com/resumes/${handle}.pdf`;

        await ProfileService.updateProfile(s.userId, updateProfileSchema.parse({
            bio: `${s.course} student (${s.branch}), admitted ${s.admission_year}. Interested in ${track.label}.`,
            location: pick(D.STUDENT_CITIES),
            github_url: `https://example.com/github/${handle}`,
            resume_url: s.resumeUrl,
            interests: [track.label, pick(["competitive programming", "hackathons", "open source", "UI design"])].join(", "),
            career_goals: pick(D.STUDENT_GOALS),
        }));

        const n = s.index + 1;
        s.openTo = n % 6 === 0 ? ["MOCK_INTERVIEW"] : n % 9 === 0 ? ["RESUME_REVIEW"] : [];
        if (s.openTo.length) await ProfileService.updateOpenTo(s.userId, s.role, updateOpenToSchema.parse({ intents: s.openTo }).intents);

        for (const [title, description] of sample(D.STUDENT_PROJECTS, int(1, 2))) {
            await ProfileService.addProject(s.userId, addProjectSchema.parse({ title, description, project_url: `https://example.com/projects/${handle}/${slug(title)}` }));
        }
    }

    for (const person of [...alumni, ...students]) {
        const kept = [];
        for (const skill of person.skills) {
            const added = await attempt("profile skill already listed under another spelling", () =>
                ProfileService.addSkill(person.userId, addSkillSchema.parse({ skill }).skill));
            if (added !== null) kept.push(skill);
        }
        person.skills = kept;
    }
}

// ----------------------------------- 7. connections -----------------------------------

const links = new Map(); // "lowId-highId" -> { id, status, a, b }
const linkKey = (x, y) => (x < y ? `${x}-${y}` : `${y}-${x}`);
const isConnected = (x, y) => links.get(linkKey(x.userId, y.userId))?.status === "ACCEPTED";

async function connect(sender, receiver, outcome) {
    const key = linkKey(sender.userId, receiver.userId);
    if (sender.userId === receiver.userId || links.has(key)) return;

    const id = await attempt("connection request", () => ConnectionService.sendRequest(sender.userId, receiver.userId));
    if (!id) return;
    if (outcome === "ACCEPTED") await ConnectionService.acceptRequest(receiver.userId, id);
    if (outcome === "REJECTED") await ConnectionService.rejectRequest(receiver.userId, id);
    if (outcome === "CANCELLED") await ConnectionService.cancelRequest(sender.userId, id);
    links.set(key, { id, status: outcome, sender, receiver });
}

async function seedConnections(students, alumni, preservedMembers) {
    const A = (i) => alumni[((i % 50) + 50) % 50];
    const S = (i) => students[((i % 50) + 50) % 50];

    // alumni know each other: this is what makes warm introductions possible
    for (let j = 0; j < 50; j++) {
        await connect(A(j), A(j + 1), "ACCEPTED");
        await connect(A(j), A(j + 3), "ACCEPTED");
    }

    for (let i = 0; i < 50; i++) {
        const s = S(i);
        await connect(s, A(i * 3), "ACCEPTED");
        await connect(s, A(i * 3 + 11), "ACCEPTED");
        await connect(s, A(i * 7 + 5), chance(0.7) ? "ACCEPTED" : "PENDING");
        if (i % 4 === 0) await connect(A(i + 20), s, "ACCEPTED"); // sometimes the alumnus reaches out
        else await connect(s, A(i + 20), pick(["REJECTED", "CANCELLED", "PENDING", "ACCEPTED"]));

        await connect(s, S(i + 1), "ACCEPTED");
        const r = rng();
        await connect(s, S(i + 7), r < 0.5 ? "ACCEPTED" : r < 0.8 ? "PENDING" : "REJECTED");
    }

    // the preserved student/alumni accounts get a small network too, so they are useful for testing:
    // five accepted connections and three requests still waiting for them
    for (let p = 0; p < preservedMembers.length; p++) {
        const me = preservedMembers[p];
        for (const other of [A(2 + 10 * p), A(5 + 10 * p), A(9 + 10 * p), S(1 + 10 * p), S(4 + 10 * p)]) await connect(other, me, "ACCEPTED");
        for (const other of [A(12 + 10 * p), S(7 + 10 * p), S(8 + 10 * p)]) await connect(other, me, "PENDING");
    }
}

const acceptedPartners = (person, candidates) => candidates.filter((c) => isConnected(person, c));

// ----------------------------------- 8. posts, likes, comments -----------------------------------

async function seedPosts(students, alumni) {
    const everyone = [...students, ...alumni];
    const posts = [];

    for (let n = 0; n < 92; n++) {
        const byAlumnus = n % 5 < 3;
        const author = byAlumnus ? alumni[(n * 7) % 50] : students[(n * 11) % 50];
        const trackKey = byAlumnus ? author.track : author.interest;
        const templates = byAlumnus ? D.ALUMNI_POSTS : D.STUDENT_POSTS;
        const content = fill(templates[n % templates.length], {
            company: author.company || "my company",
            skill: pick(author.skills.length ? author.skills : ["programming"]),
            track: D.TRACKS[trackKey].label,
        });
        const { postId } = await PostService.createPost(author.userId, content, []);
        posts.push({ id: postId, author });
    }

    for (const post of posts) {
        const others = everyone.filter((p) => p.userId !== post.author.userId);
        for (const liker of sample(others, int(1, 12))) await PostService.likePost(liker.userId, post.id);
        if (chance(0.65)) {
            for (const commenter of sample(others, int(1, 4))) await PostService.addComment(commenter.userId, post.id, pick(D.COMMENTS));
        }
    }

    // a few removed posts, so the "deleted" state exists too (they never show in the feed)
    for (const post of posts.splice(89, 3)) await PostService.deletePost(post.author.userId, post.id);
    return posts;
}

// ----------------------------------- 9. chat -----------------------------------

async function seedChats(preservedMembers, alumni) {
    const generatedPairs = [...links.values()].filter((l) => l.status === "ACCEPTED" && l.sender.generated && l.receiver.generated);
    let conversations = 0;

    for (let k = 0; k < generatedPairs.length; k += 6) {
        const { sender, receiver } = generatedPairs[k];
        // the scripted threads read naturally when a student speaks first
        const [first, second] = receiver.role === "STUDENT" && sender.role !== "STUDENT" ? [receiver, sender] : [sender, receiver];
        const conversationId = await ChatService.getOrCreateConversation(first.userId, second.userId);
        const thread = D.CHAT_THREADS[conversations % D.CHAT_THREADS.length];
        for (let m = 0; m < thread.length; m++) {
            await ChatService.sendMessage(conversationId, (m % 2 === 0 ? first : second).userId, thread[m]);
        }
        if (conversations % 2 === 0) {
            await ChatService.markConversationRead(first.userId, conversationId);
            await ChatService.markConversationRead(second.userId, conversationId);
        }
        conversations += 1;
    }

    // unread messages waiting for each preserved account, from one of its accepted connections
    for (const me of preservedMembers) {
        const from = acceptedPartners(me, alumni)[0];
        if (!from) continue;
        const conversationId = await ChatService.getOrCreateConversation(from.userId, me.userId);
        await ChatService.sendMessage(conversationId, from.userId, "Hi! Thanks for connecting. Let me know if you need any help with placements.");
        await ChatService.sendMessage(conversationId, from.userId, "We also have an opening in my team - have a look at the Jobs tab.");
        conversations += 1;
    }
    return conversations;
}

// ----------------------------------- 10. jobs -----------------------------------

function jobFor(alumnus, sequence, nth) {
    const ownTrack = chance(0.75);
    const trackKey = ownTrack ? alumnus.track : D.TRACK_KEYS[(alumnus.index + nth + 2) % D.TRACK_KEYS.length];
    const template = D.TRACKS[trackKey].jobs[(alumnus.index + nth) % D.TRACKS[trackKey].jobs.length];
    const { name: company, city } = alumnus.companyInfo;
    const jobType = template.type || (chance(0.9) ? "FULL_TIME" : "CONTRACT");
    const skills = sample(template.skills, int(2, Math.min(5, template.skills.length)));
    const location = chance(0.15) ? "Remote (India)" : chance(0.2) ? `${city} (Hybrid)` : city;

    return createJobSchema.parse({
        title: template.title,
        company,
        location,
        job_type: jobType,
        experience_min: template.exp[0],
        experience_max: template.exp[1],
        description:
            `${company} is looking for a ${template.title} to join the ${D.TRACKS[trackKey].label} team in ${city}. ` +
            `You will work with ${skills.join(", ")} on features used by real customers, review code with senior engineers and own what you ship. ` +
            `${jobType === "INTERNSHIP" ? "This is a paid six-month internship with a possible full-time offer." : "We offer structured mentoring, flexible hours and a clear growth path."} ` +
            "SRMS students and alumni can ask the poster for a referral through SRMS Connect.",
        skills,
        apply_url: `https://careers.example.com/${slug(company)}/${slug(template.title)}-${sequence}`,
    });
}

async function seedJobs(alumni) {
    // 1-3 open jobs each, exactly 100 in total (the application allows at most 10 open jobs per alumnus)
    const counts = alumni.map((_, j) => [2, 3, 1, 2][j % 4]);
    let total = counts.reduce((a, b) => a + b, 0);
    for (let j = 49; total > 100; j--) if (counts[j] > 1) { counts[j] -= 1; total -= 1; }
    for (let j = 0; total < 100; j++) { counts[j] += 1; total += 1; }

    let sequence = 1000;
    for (const alumnus of alumni) {
        alumnus.jobs = [];
        for (let nth = 0; nth < counts[alumnus.index]; nth++) {
            const data = jobFor(alumnus, ++sequence, nth);
            const { id } = await JobService.createJob(viewerOf(alumnus), data);
            alumnus.jobs.push({ id, title: data.title, company: data.company });
        }
    }

    // a handful of closed jobs for the "closed" state
    let closed = 0;
    for (const j of [2, 12, 22, 32, 42, 47]) {
        const alumnus = alumni[j];
        const { id } = await JobService.createJob(viewerOf(alumnus), jobFor(alumnus, ++sequence, 4));
        await JobService.setStatus(viewerOf(alumnus), id, "CLOSED");
        closed += 1;
    }
    return { open: total, closed };
}

// ----------------------------------- 11. career help -----------------------------------

async function careerOutcome(student, alumnus, id, outcome) {
    const respond = (action, response) =>
        CareerService.respond(viewerOf(alumnus), id, careerValidation.respondSchema.parse({ action, response }));

    if (outcome === "ACCEPTED" || outcome === "COMPLETED" || outcome === "CANCELLED_AFTER_ACCEPT") await respond("ACCEPT", pick(D.CAREER_ACCEPT_NOTES));
    if (outcome === "COMPLETED") await respond("COMPLETE", pick(D.CAREER_COMPLETE_NOTES));
    if (outcome === "REJECTED") await respond("REJECT", pick(D.CAREER_REJECT_NOTES));
    if (outcome === "ANSWERED") await respond("ANSWER", pick(D.ANSWERS));
    if (outcome === "CANCELLED" || outcome === "CANCELLED_AFTER_ACCEPT") await CareerService.cancel(viewerOf(student), id);
}

async function seedCareer(students, alumni) {
    const made = { REFERRAL: 0, RESUME_REVIEW: 0, QUESTION: 0 };
    const create = (student, data) => attempt(`career ${data.type.toLowerCase()} request`, () =>
        CareerService.createRequest(viewerOf(student), careerValidation.createRequestSchema.parse(data)));

    const referralOutcomes = ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "PENDING", "ACCEPTED", "CANCELLED", "COMPLETED", "PENDING", "REJECTED", "CANCELLED_AFTER_ACCEPT", "PENDING"];
    for (let i = 0; i < 50 && made.REFERRAL < 32; i++) {
        const student = students[i];
        const partners = acceptedPartners(student, alumni).filter((a) => a.jobs.length);
        if (!partners.length) continue;
        const alumnus = partners[i % partners.length];
        const job = alumnus.jobs[i % alumnus.jobs.length];
        const created = await create(student, { type: "REFERRAL", alumni_id: alumnus.userId, job_id: job.id, message: pick(D.REFERRAL_MESSAGES), resume_url: student.resumeUrl });
        if (!created) continue;
        await careerOutcome(student, alumnus, created.id, referralOutcomes[made.REFERRAL % referralOutcomes.length]);
        made.REFERRAL += 1;
    }

    const resumeOutcomes = ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "COMPLETED", "PENDING", "CANCELLED", "ACCEPTED"];
    for (let i = 49; i >= 0 && made.RESUME_REVIEW < 22; i--) {
        const student = students[i];
        const partners = acceptedPartners(student, alumni);
        if (!partners.length) continue;
        const alumnus = partners[(i + 1) % partners.length];
        const created = await create(student, { type: "RESUME_REVIEW", alumni_id: alumnus.userId, message: pick(D.RESUME_MESSAGES), resume_url: student.resumeUrl });
        if (!created) continue;
        await careerOutcome(student, alumnus, created.id, resumeOutcomes[made.RESUME_REVIEW % resumeOutcomes.length]);
        made.RESUME_REVIEW += 1;
    }

    // questions go to a connection, or to any alumnus who is open to mentorship (no connection needed)
    const questionOutcomes = ["ANSWERED", "PENDING", "ANSWERED", "REJECTED", "ANSWERED", "PENDING", "CANCELLED"];
    const openMentors = alumni.filter((a) => a.openTo.includes("MENTORSHIP"));
    for (let i = 0; i < 50 && made.QUESTION < 26; i += 1) {
        const student = students[(i * 3 + 1) % 50];
        const partners = acceptedPartners(student, alumni);
        const strangers = openMentors.filter((a) => !isConnected(student, a));
        const alumnus = i % 2 === 0 && partners.length ? partners[i % partners.length] : strangers[i % strangers.length];
        if (!alumnus) continue;
        const created = await create(student, { type: "QUESTION", alumni_id: alumnus.userId, message: pick(D.QUESTIONS) });
        if (!created) continue;
        await careerOutcome(student, alumnus, created.id, questionOutcomes[made.QUESTION % questionOutcomes.length]);
        made.QUESTION += 1;
    }
    return made;
}

// ----------------------------------- 12. mentorship -----------------------------------

async function seedMentorProfiles(alumni) {
    const mentors = [];
    for (const a of alumni) {
        const n = a.index + 1;
        // open to mentorship but no mentor profile yet: n divisible by 15
        if (!a.openTo.includes("MENTORSHIP") || n % 15 === 0) continue;

        const topics = [...new Set([pick(["INTERVIEW_PREP", "CAREER_GUIDANCE"]), ...sample(TOPICS, int(1, 3))])];
        const profile = mentorshipValidation.mentorProfileSchema.parse({
            bio: fill(pick(D.MENTOR_BIOS), { track: D.TRACKS[a.track].label, company: a.company }),
            availability: pick(D.MENTOR_AVAILABILITY),
            max_active_mentees: int(2, 4),
            is_accepting: n !== 41, // one mentor who is listed but not taking requests
            topics,
            areas: sample(D.MENTOR_AREAS, int(1, 2)),
        });
        await MentorshipService.saveMentorProfile(viewerOf(a), profile);
        mentors.push({ person: a, topics, max: profile.max_active_mentees, accepting: profile.is_accepting, active: 0, mentees: new Set() });
    }
    return mentors;
}

async function seedMentorships(students, mentors) {
    const outcomes = ["ACTIVE", "PENDING", "COMPLETED", "ACTIVE", "REJECTED", "PENDING", "ACTIVE", "CANCELLED", "COMPLETED", "ACTIVE", "PENDING", "COMPLETED"];
    const made = { PENDING: 0, ACTIVE: 0, REJECTED: 0, CANCELLED: 0, COMPLETED: 0 };
    const available = mentors.filter((m) => m.accepting);

    for (let q = 0; q < 48; q++) {
        const student = students[q % 50];
        const outcome = outcomes[q % outcomes.length];

        // a mentor with a free spot who this student has not asked yet
        let mentor = null;
        for (let step = 0; step < available.length && !mentor; step++) {
            const candidate = available[(q * 5 + step) % available.length];
            if (candidate.active < candidate.max && !candidate.mentees.has(student.userId)) mentor = candidate;
        }
        if (!mentor) continue;

        const initialGoals = sample(D.MENTORSHIP_GOALS, int(0, 2));
        const created = await attempt("mentorship request", () => MentorshipService.createMentorship(
            viewerOf(student),
            mentorshipValidation.createMentorshipSchema.parse({ mentor_id: mentor.person.userId, topic: pick(mentor.topics), message: pick(D.MENTORSHIP_MESSAGES), goals: initialGoals })
        ));
        if (!created) continue;
        mentor.mentees.add(student.userId);
        const id = created.id;
        const asMentor = viewerOf(mentor.person);
        const asMentee = viewerOf(student);

        if (outcome === "REJECTED") {
            await MentorshipService.respond(asMentor, id, mentorshipValidation.respondSchema.parse({ action: "REJECT", response: pick(D.MENTOR_REJECT_NOTES) }));
        } else if (outcome === "CANCELLED") {
            await MentorshipService.cancel(asMentee, id);
        } else if (outcome === "ACTIVE" || outcome === "COMPLETED") {
            await MentorshipService.respond(asMentor, id, mentorshipValidation.respondSchema.parse({ action: "ACCEPT", response: pick(D.MENTOR_ACCEPT_NOTES) }));
            mentor.active += 1;

            // goals from both sides, some already done
            const extraGoals = sample(D.MENTORSHIP_GOALS.filter((g) => !initialGoals.includes(g)), int(1, 2));
            for (let g = 0; g < extraGoals.length; g++) {
                await MentorshipService.addGoal(g % 2 === 0 ? asMentor : asMentee, id, mentorshipValidation.goalSchema.parse({ title: extraGoals[g] }));
            }
            const { goals } = await MentorshipService.getMentorship(asMentee, id);
            const doneCount = outcome === "COMPLETED" ? goals.length : int(0, Math.max(0, goals.length - 1));
            for (const goal of goals.slice(0, doneCount)) {
                await MentorshipService.setGoalStatus(asMentee, id, goal.id, mentorshipValidation.goalStatusSchema.parse({ status: "DONE" }));
            }

            // a log of sessions that already happened, oldest first
            const days = sample([2, 5, 9, 13, 18, 24], int(1, 3)).sort((x, y) => y - x);
            for (let s = 0; s < days.length; s++) {
                await MentorshipService.addSession(s % 2 === 0 ? asMentor : asMentee, id, mentorshipValidation.sessionSchema.parse({
                    session_date: localDate(days[s]),
                    duration_minutes: pick([30, 45, 60, null]),
                    notes: pick(D.SESSION_NOTES),
                }));
            }

            if (outcome === "COMPLETED") {
                await MentorshipService.complete(q % 2 === 0 ? asMentor : asMentee, id, mentorshipValidation.completeSchema.parse({ note: pick(D.MENTOR_CLOSING_NOTES) }));
                mentor.active -= 1;
            }
        }
        made[outcome] += 1;
    }
    return made;
}

// ----------------------------------- 13. warm introductions -----------------------------------

async function seedIntros(students, alumni) {
    const outcomes = ["PENDING", "INTRODUCED", "DECLINED", "INTRODUCED", "PENDING", "CANCELLED"];
    const made = { PENDING: 0, INTRODUCED: 0, DECLINED: 0, CANCELLED: 0 };
    let total = 0;

    for (let i = 0; i < 50 && total < 18; i += 2) {
        const student = students[i];
        // someone the student knows (introducer) who knows an alumnus the student does not (target)
        let path = null;
        for (const introducer of acceptedPartners(student, alumni)) {
            const target = acceptedPartners(introducer, alumni).find((t) => !links.has(linkKey(student.userId, t.userId)));
            if (target) { path = { introducer, target }; break; }
        }
        if (!path) continue;

        const created = await attempt("warm introduction request", () => IntroService.createIntro(
            viewerOf(student),
            introValidation.createIntroSchema.parse({ target_id: path.target.userId, introducer_id: path.introducer.userId, message: pick(D.INTRO_MESSAGES) })
        ));
        if (!created) continue;

        const outcome = outcomes[total % outcomes.length];
        if (outcome === "INTRODUCED") {
            await IntroService.respond(viewerOf(path.introducer), created.id, introValidation.respondIntroSchema.parse({ action: "INTRODUCE", note: pick(D.INTRO_NOTES) }));
        } else if (outcome === "DECLINED") {
            await IntroService.respond(viewerOf(path.introducer), created.id, introValidation.respondIntroSchema.parse({ action: "DECLINE", note: pick(D.INTRO_DECLINE_NOTES) }));
        } else if (outcome === "CANCELLED") {
            await IntroService.cancel(viewerOf(student), created.id);
        }
        made[outcome] += 1;
        total += 1;
    }
    return made;
}

// ----------------------------------- 14. spread activity over time -----------------------------------

// Everything above happened "now". These updates only move timestamps of the rows this script just
// created back over the last weeks, so feeds, trends and "2 days ago" labels look like a living
// platform. No preserved identity row is touched.
async function spreadTimestamps() {
    await inTransaction(async (conn) => {
        await conn.query(`UPDATE connections SET created_at = NOW() - INTERVAL (8 + (id * 7919) % 45) DAY - INTERVAL ((id * 131) % 1440) MINUTE,
                          updated_at = IF(status = 'PENDING', created_at, created_at + INTERVAL ((id * 17) % 72) HOUR)`);

        await conn.query(`UPDATE posts SET created_at = NOW() - INTERVAL ((id * 7919) % 35) DAY - INTERVAL (30 + (id * 131) % 1400) MINUTE,
                          updated_at = IF(status = 'DELETED', NOW(), created_at)`);
        await conn.query(`UPDATE post_likes pl JOIN posts p ON p.id = pl.post_id
                          SET pl.created_at = LEAST(NOW(), p.created_at + INTERVAL (1 + (pl.id * 37) % 4000) MINUTE)`);
        await conn.query(`UPDATE post_comments pc JOIN posts p ON p.id = pc.post_id
                          SET pc.created_at = LEAST(NOW(), p.created_at + INTERVAL (2 + (pc.id * 53) % 3000) MINUTE), pc.updated_at = pc.created_at`);

        // spread over two months, so Industry Pulse can compare the last 30 days with the 30 before
        await conn.query(`UPDATE jobs SET created_at = NOW() - INTERVAL ((id * 7919) % 58) DAY - INTERVAL ((id * 131) % 1440) MINUTE, updated_at = created_at`);

        await conn.query(`UPDATE messages m JOIN (SELECT conversation_id, MIN(id) AS first_id, COUNT(*) AS total FROM messages GROUP BY conversation_id) x
                              ON x.conversation_id = m.conversation_id
                          SET m.created_at = NOW() - INTERVAL ((m.conversation_id * 13) % 9) DAY - INTERVAL (x.total * 7 + 5) MINUTE + INTERVAL ((m.id - x.first_id) * 7) MINUTE,
                              m.read_at = IF(m.is_read = 1, NOW() - INTERVAL ((m.conversation_id * 13) % 9) DAY, NULL)`);
        await conn.query(`UPDATE conversations c JOIN (SELECT conversation_id, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM messages GROUP BY conversation_id) x
                              ON x.conversation_id = c.id
                          SET c.created_at = x.first_at, c.updated_at = x.last_at`);

        // each notification gets the time of the thing it is about
        await conn.query(`UPDATE notifications n JOIN connections c ON c.id = n.reference_id SET n.created_at = c.created_at WHERE n.type = 'CONNECTION_REQUEST'`);
        await conn.query(`UPDATE notifications n JOIN connections c ON c.id = n.reference_id SET n.created_at = c.updated_at WHERE n.type = 'CONNECTION_ACCEPTED'`);
        await conn.query(`UPDATE notifications n JOIN post_likes pl ON pl.post_id = n.reference_id AND pl.user_id = n.actor_id SET n.created_at = pl.created_at WHERE n.type = 'POST_LIKE'`);
        await conn.query(`UPDATE notifications n JOIN post_comments pc ON pc.id = CAST(SUBSTRING_INDEX(n.dedupe_key, ':', -1) AS UNSIGNED)
                          SET n.created_at = pc.created_at WHERE n.type = 'POST_COMMENT'`);
        await conn.query(`UPDATE notifications n JOIN conversations c ON c.id = n.reference_id SET n.created_at = c.updated_at WHERE n.type = 'NEW_MESSAGE'`);
        await conn.query(`UPDATE notifications n JOIN jobs j ON j.id = n.reference_id SET n.created_at = j.created_at WHERE n.type = 'JOB_POSTED'`);
        await conn.query(`UPDATE notifications SET read_at = GREATEST(read_at, created_at) WHERE read_at IS NOT NULL`);
    });
}

// ----------------------------------- 14a. campus spotlight -----------------------------------

// Announcements created by the existing admin through the real service: live ones, a scheduled
// one, a draft and an archived one, so every state of the admin console has something in it.
async function seedSpotlights(adminId) {
    const admin = { userId: adminId, role: "ADMIN" };
    const at = (daysFromNow, time) => `${localDate(-daysFromNow)}T${time}`;
    const items = [
        { title: "Campus Placement Drive 2026", category: "PLACEMENT", status: "PUBLISHED", starts_at: at(6, "09:30"), ends_at: at(7, "17:00"), location: "Placement Cell, Block A",
          description: "Twelve companies are visiting for final-year MCA and B.Tech students. Register with the placement cell and keep your resume updated on your profile.", cta_label: "Register", cta_url: "https://example.com/srms/placement-drive-2026" },
        { title: "Alumni Guest Lecture: Designing Systems That Scale", category: "GUEST_LECTURE", status: "PUBLISHED", starts_at: at(3, "15:00"), ends_at: at(3, "16:30"), location: "Seminar Hall 2",
          description: "A senior alumnus walks through how a payments platform grew from one server to millions of users, and what students should learn first.", cta_label: "Reserve a seat", cta_url: "https://example.com/srms/guest-lecture-systems" },
        { title: "Hack SRMS: 24-hour Hackathon", category: "HACKATHON", status: "PUBLISHED", starts_at: at(12, "10:00"), ends_at: at(13, "10:00"), location: "Innovation Lab",
          description: "Build something useful for the campus in 24 hours. Teams of up to four. Mentors from the alumni network will be around all night.", cta_label: "Form a team", cta_url: "https://example.com/srms/hack-srms" },
        { title: "Resume and LinkedIn Workshop", category: "WORKSHOP", status: "PUBLISHED", starts_at: at(9, "18:00"), ends_at: at(9, "19:30"), is_online: true,
          description: "A hands-on online session on writing a one-page resume that gets shortlisted. Bring your current resume.", cta_label: "Join online", cta_url: "https://example.com/srms/resume-workshop" },
        { title: "Mentorship Programme: Winter Cohort", category: "PROGRAM", status: "PUBLISHED",
          description: "Applications are open for the winter mentorship cohort. Students are matched with alumni mentors for eight weeks of guided career preparation." },
        { title: "Annual Alumni Meet 2027", category: "EVENT", status: "PUBLISHED", publish_at: at(5, "09:00"), starts_at: at(60, "11:00"), location: "Main Auditorium",
          description: "Save the date for the annual alumni meet. Registration opens soon.", cta_label: "Know more", cta_url: "https://example.com/srms/alumni-meet-2027" },
        { title: "Seminar on Cloud Careers", category: "SEMINAR", status: "DRAFT", starts_at: at(20, "14:00"), location: "Seminar Hall 1",
          description: "Draft: speakers still being confirmed for a seminar on careers in cloud and DevOps." },
        { title: "Semester Registration Reminder", category: "ANNOUNCEMENT", status: "ARCHIVED",
          description: "Semester registration closed last month. This notice is kept for reference only." },
    ];
    for (const item of items) await SpotlightService.create(admin, createSpotlightSchema.parse(item));
    return items.length;
}

// ----------------------------------- 14b. analytics history -----------------------------------

// Post impressions, profile views and search appearances for the last two months. The recording
// services only ever write "today", so history is inserted directly (INSERT IGNORE, bound values)
// with the same rules the services enforce: never your own post/profile, ACTIVE members only,
// no admins. Works from what is in the database, so it can also run on its own (--analytics-only).
async function seedAnalytics(preservedIds) {
    const random = mulberry32(RNG_SEED + 17); // its own stream: identical in a full run and on its own
    const rint = (min, max) => min + Math.floor(random() * (max - min + 1));
    const rsample = (list, count) => {
        const pool = [...list];
        const out = [];
        while (pool.length && out.length < count) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
        return out;
    };
    const recentDay = (maxDaysAgo) => localDate(Math.floor(random() * random() * (maxDaysAgo + 1))); // skewed towards recent days
    const two = (n) => String(n).padStart(2, "0");

    const [members] = await db.query("SELECT id, role FROM users WHERE status = 'ACTIVE' AND role <> 'ADMIN' ORDER BY id");
    const [posts] = await db.query("SELECT id, user_id, DATEDIFF(CURDATE(), DATE(created_at)) AS age FROM posts WHERE status = 'ACTIVE' ORDER BY id");
    const [engaged] = await db.query(
        `SELECT pl.post_id, pl.user_id, DATEDIFF(CURDATE(), DATE(pl.created_at)) AS age FROM post_likes pl
         UNION SELECT pc.post_id, pc.user_id, DATEDIFF(CURDATE(), DATE(pc.created_at)) FROM post_comments pc`
    );
    const ids = members.map((m) => m.id);
    const memberSet = new Set(ids);
    const students = members.filter((m) => m.role === "STUDENT").map((m) => m.id);

    // ---- post impressions: a burst in the first days after posting, then a long tail
    const impressions = new Map();
    const addImpression = (postId, viewerId, age, views) => {
        const key = `${postId}|${viewerId}|${age}`;
        if (!impressions.has(key)) impressions.set(key, [postId, viewerId, localDate(Math.max(0, age)), views]);
    };
    for (const post of posts) {
        const age = Math.max(0, Number(post.age));
        for (const viewer of rsample(ids.filter((id) => id !== post.user_id), rint(10, 45))) {
            addImpression(post.id, viewer, age - Math.min(age, Math.floor(random() * random() * 12)), rint(1, 2));
            if (random() < 0.25 && age > 2) addImpression(post.id, viewer, rint(0, age - 1), 1); // came back to it later
        }
    }
    // nobody likes or comments on a post they never saw
    const authorOf = new Map(posts.map((p) => [p.id, p.user_id]));
    for (const row of engaged) {
        if (authorOf.has(row.post_id) && authorOf.get(row.post_id) !== row.user_id && memberSet.has(row.user_id)) {
            addImpression(row.post_id, row.user_id, Math.max(0, Number(row.age)), 1);
        }
    }

    // ---- profile views and search appearances: alumni are looked at more than students
    const profileViews = [];
    const searches = [];
    for (const member of members) {
        const isAlumni = member.role === "ALUMNI";
        const kept = preservedIds.includes(member.id);
        const others = ids.filter((id) => id !== member.id);

        const seenDays = new Set();
        for (const viewer of rsample(others, kept ? 16 : isAlumni ? rint(8, 28) : rint(2, 12))) {
            const visits = random() < 0.3 ? 2 : 1;
            for (let visit = 0; visit < visits; visit++) {
                const day = recentDay(58);
                if (seenDays.has(`${viewer}|${day}`)) continue;
                seenDays.add(`${viewer}|${day}`);
                profileViews.push([member.id, viewer, day, rint(1, 2), `${day} ${two(rint(8, 22))}:${two(rint(0, 59))}:00`]);
            }
        }

        // alumni are mostly found by students; students by a mix of everyone
        const searcherPool = isAlumni ? [...students.filter((id) => id !== member.id), ...rsample(others, 15)] : others;
        const foundDays = new Set();
        for (const viewer of rsample([...new Set(searcherPool)], kept ? 20 : isAlumni ? rint(10, 36) : rint(3, 14))) {
            const hits = random() < 0.4 ? 2 : 1;
            for (let hit = 0; hit < hits; hit++) {
                const day = recentDay(58);
                if (foundDays.has(`${viewer}|${day}`)) continue;
                foundDays.add(`${viewer}|${day}`);
                searches.push([member.id, viewer, day, rint(1, 3)]);
            }
        }
    }

    await inTransaction(async (conn) => {
        // a clean slate for these three tables only (and the notifications they produced)
        await conn.query("DELETE FROM post_impressions");
        await conn.query("DELETE FROM profile_views");
        await conn.query("DELETE FROM search_appearances");
        await conn.query("DELETE FROM notifications WHERE type = 'PROFILE_VIEW'");

        const bulk = async (sql, rows) => {
            for (let i = 0; i < rows.length; i += 1000) await conn.query(sql, [rows.slice(i, i + 1000)]);
        };
        await bulk("INSERT IGNORE INTO post_impressions (post_id, viewer_id, view_date, views) VALUES ?", [...impressions.values()]);
        await bulk("INSERT IGNORE INTO profile_views (profile_user_id, viewer_id, view_date, views, last_viewed_at) VALUES ?", profileViews);
        await bulk("INSERT IGNORE INTO search_appearances (user_id, viewer_id, appeared_date, appearances) VALUES ?", searches);
        await conn.query("UPDATE post_impressions SET created_at = view_date");
        await conn.query("UPDATE profile_views SET created_at = last_viewed_at");
        await conn.query("UPDATE search_appearances SET created_at = appeared_date");
    });

    // today's visits go through the real service, so "X viewed your profile" notifications exist too
    const roleOf = new Map(members.map((m) => [m.id, m.role]));
    let notified = 0;
    for (const owner of [...preservedIds.filter((id) => roleOf.has(id)), ...rsample(ids.filter((id) => !preservedIds.includes(id)), 30)]) {
        for (const viewer of rsample(ids.filter((id) => id !== owner), preservedIds.includes(owner) ? 3 : 1)) {
            const first = await AnalyticsService.trackProfileView({ userId: viewer, role: roleOf.get(viewer) }, owner);
            if (first) notified += 1;
        }
    }

    return { impressions: impressions.size, profileViews: profileViews.length, searches: searches.length, notified };
}

async function analyticsChecks(preservedIds) {
    const scalar = async (sql, params = []) => Number(Object.values((await db.query(sql, params))[0][0])[0]);
    const must = (condition, message) => { if (!condition) throw new Error(message); };

    must((await scalar("SELECT COUNT(*) FROM post_impressions v JOIN posts p ON p.id = v.post_id WHERE p.user_id = v.viewer_id")) === 0, "an author was counted as a viewer of their own post");
    must((await scalar("SELECT COUNT(*) FROM profile_views WHERE profile_user_id = viewer_id")) === 0, "someone was counted as a viewer of their own profile");
    must((await scalar("SELECT COUNT(*) FROM search_appearances WHERE user_id = viewer_id")) === 0, "someone appeared in their own search");
    must((await scalar(`SELECT COUNT(*) FROM (SELECT viewer_id FROM post_impressions UNION ALL SELECT viewer_id FROM profile_views UNION ALL SELECT viewer_id FROM search_appearances) v
                        JOIN users u ON u.id = v.viewer_id WHERE u.role = 'ADMIN' OR u.status <> 'ACTIVE'`)) === 0, "an admin or inactive account was counted as an audience");
    must((await scalar(`SELECT COUNT(*) FROM post_likes pl JOIN posts p ON p.id = pl.post_id AND p.status = 'ACTIVE' AND p.user_id <> pl.user_id
                        WHERE NOT EXISTS (SELECT 1 FROM post_impressions v WHERE v.post_id = pl.post_id AND v.viewer_id = pl.user_id)`)) === 0, "a like without an impression");
    must((await scalar(`SELECT COUNT(*) FROM notifications n WHERE n.type = 'PROFILE_VIEW' AND NOT EXISTS
                        (SELECT 1 FROM profile_views v WHERE v.profile_user_id = n.recipient_id AND v.viewer_id = n.actor_id)`)) === 0, "a profile-view notification without a matching view");

    const [[author]] = await db.query("SELECT p.user_id, u.role FROM posts p JOIN users u ON u.id = p.user_id WHERE p.status = 'ACTIVE' GROUP BY p.user_id, u.role ORDER BY COUNT(*) DESC, p.user_id LIMIT 1");
    const viewer = { userId: author.user_id, role: author.role };
    const overview = await AnalyticsService.getOverview(viewer, { days: 30 });
    must(overview.series.length === 30, "the daily series does not cover the period");
    must(overview.totals.post_impressions.value > 0 && overview.totals.profile_views.value > 0 && overview.totals.search_appearances.value > 0, "an author's overview has an empty metric");
    must(overview.totals.post_reach.value <= overview.totals.post_impressions.value, "reach is larger than impressions");
    must(overview.series.reduce((sum, d) => sum + d.post_impressions, 0) === overview.totals.post_impressions.value, "the daily series does not add up to the total");
    must(overview.searchers.roles.length > 0, "no searcher groups");
    must(!JSON.stringify([overview.searchers, overview.profile_audience]).match(/user_id|full_name|@/), "the audience breakdown names people");

    const posts = await AnalyticsService.getPostStats(viewer, { days: 30, sort: "impressions", page: 1, limit: 10 });
    must(posts.posts.length > 0 && posts.posts[0].impressions >= posts.posts[posts.posts.length - 1].impressions, "posts are not sorted by impressions");
    const viewers = await AnalyticsService.getProfileViewers(viewer, { days: 30, page: 1, limit: 10 });
    must(viewers.viewers.length > 0 && !JSON.stringify(viewers).match(/@srms-seed\.test|enrollment|password/), "profile viewers are missing or leak private fields");

    const mine = await PostService.getMyPosts(author.user_id, 1, 5);
    must(mine.posts.length > 0 && mine.posts.every((p) => p.user_id === author.user_id && p.analytics), "my posts are missing, not mine, or without numbers");

    const kept = [];
    for (const id of preservedIds) {
        const [[user]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
        if (user.role === "ADMIN") continue;
        const own = await AnalyticsService.getOverview({ userId: id, role: user.role }, { days: 30 });
        must(own.totals.profile_views.value > 0 && own.totals.search_appearances.value > 0, `preserved user ${id} has no profile views or search appearances`);
        kept.push(`user #${id}: ${own.totals.profile_views.value} profile views, ${own.totals.search_appearances.value} search appearances`);
    }
    return `author #${author.user_id}: ${overview.totals.post_impressions.value} impressions, ${overview.totals.post_reach.value} reached, ${overview.totals.engagement_rate}% engagement; ${kept.join("; ")}`;
}

// ----------------------------------- 15. smoke checks -----------------------------------

async function smokeChecks({ students, alumni, preserved, preservedMembers, expected }) {
    const results = [];
    const check = async (module, description, fn) => {
        try {
            const detail = await fn();
            results.push({ module, description, ok: true, detail: detail || "" });
        } catch (error) {
            results.push({ module, description, ok: false, detail: error.message });
        }
    };
    const must = (condition, message) => { if (!condition) throw new Error(message); };
    const scalar = async (sql, params = []) => Number(Object.values((await db.query(sql, params))[0][0])[0]);

    const student = students[0];
    const alumnus = alumni[0];
    const admin = preserved.find((p) => p.label === "ADMIN");

    await check("auth", "generated student and alumnus can log in with the test password; the session works and logout ends it", async () => {
        for (const person of [student, alumnus]) {
            const session = await AuthService.login(person.enrollment, TEST_PASSWORD, { deviceInfo: "seed smoke check", ipAddress: "127.0.0.1" });
            const who = await AuthService.authenticateToken(session.token);
            must(who.userId === person.userId && who.role === person.role, "session resolved to the wrong user");
            await AuthService.logout(person.userId, session.token);
            let rejected = false;
            try { await AuthService.authenticateToken(session.token); } catch { rejected = true; }
            must(rejected, "token still valid after logout");
        }
        let wrongRejected = false;
        try { await AuthService.login("0000000000", "not-the-password", { deviceInfo: "seed smoke check", ipAddress: "127.0.0.1" }); } catch { wrongRejected = true; }
        must(wrongRejected, "unknown enrollment was not rejected");
        must((await scalar("SELECT COUNT(*) FROM users WHERE password_hash NOT LIKE '$2%'")) === 0, "a password is not stored as a bcrypt hash");
        return "2 logins, token check, logout";
    });

    await check("auth", "all 100 generated accounts are ACTIVE with a verified e-mail and a profile; the admin account is intact", async () => {
        const ok = await scalar("SELECT COUNT(*) FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.status = 'ACTIVE' AND u.email_verified = 1 AND u.email LIKE '%@srms-seed.test'");
        must(ok === 100, `${ok} of 100 are usable`);
        must((await scalar("SELECT COUNT(*) FROM users WHERE id = ? AND role = 'ADMIN' AND status = 'ACTIVE'", [admin.id])) === 1, "admin account is not ACTIVE");
        return "100 usable accounts";
    });

    await check("search", "global search finds people and posts", async () => {
        const result = await SearchService.search(student.userId, searchQuerySchema.parse({ q: alumnus.full_name.split(" ")[0] }));
        must(result.people.length > 0, "no people found");
        const posts = await SearchService.search(student.userId, searchQuerySchema.parse({ q: "placement", type: "posts" }));
        must(posts.posts.length > 0, "no posts found");
        must(!JSON.stringify(result).match(/password|@srms-seed\.test|enrollment/i), "search leaked private fields");
        return `${result.people.length} people, ${posts.pagination.total} posts`;
    });

    await check("directory", "alumni directory lists the 50 alumni and filters by skill / Open-to / company", async () => {
        const all = await SearchService.search(student.userId, searchQuerySchema.parse({ type: "people", role: "ALUMNI" }));
        must(all.pagination.total === 50, `directory shows ${all.pagination.total} alumni`);
        const bySkill = await SearchService.search(student.userId, searchQuerySchema.parse({ type: "people", role: "ALUMNI", skills: "React" }));
        const byIntent = await SearchService.search(student.userId, searchQuerySchema.parse({ type: "people", role: "ALUMNI", openTo: "MENTORSHIP" }));
        const byCompany = await SearchService.search(student.userId, searchQuerySchema.parse({ type: "people", company: alumnus.company }));
        must(bySkill.pagination.total > 0 && byIntent.pagination.total > 0 && byCompany.pagination.total > 0, "a filter returned nothing");
        return `React: ${bySkill.pagination.total}, open to mentorship: ${byIntent.pagination.total}, ${alumnus.company}: ${byCompany.pagination.total}`;
    });

    await check("notifications", "every notification belongs to someone who is part of the thing it is about", async () => {
        const violations = {
            "sent to its own actor": "SELECT COUNT(*) FROM notifications WHERE recipient_id = actor_id",
            "recipient is not an ACTIVE user": "SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.recipient_id WHERE u.status <> 'ACTIVE'",
            "connection request not to its receiver": "SELECT COUNT(*) FROM notifications n LEFT JOIN connections c ON c.id = n.reference_id WHERE n.type = 'CONNECTION_REQUEST' AND (c.id IS NULL OR n.recipient_id <> c.receiver_id)",
            "connection accepted not to its sender": "SELECT COUNT(*) FROM notifications n LEFT JOIN connections c ON c.id = n.reference_id WHERE n.type = 'CONNECTION_ACCEPTED' AND (c.id IS NULL OR n.recipient_id <> c.sender_id)",
            "post activity not to the post owner": "SELECT COUNT(*) FROM notifications n LEFT JOIN posts p ON p.id = n.reference_id WHERE n.type IN ('POST_LIKE','POST_COMMENT') AND (p.id IS NULL OR n.recipient_id <> p.user_id)",
            "message notice to a non-participant": "SELECT COUNT(*) FROM notifications n LEFT JOIN conversations c ON c.id = n.reference_id WHERE n.type = 'NEW_MESSAGE' AND (c.id IS NULL OR n.recipient_id NOT IN (c.user_one_id, c.user_two_id))",
            "job notice to someone not connected with the poster": "SELECT COUNT(*) FROM notifications n WHERE n.type = 'JOB_POSTED' AND NOT EXISTS (SELECT 1 FROM connections c WHERE c.status = 'ACCEPTED' AND ((c.sender_id = n.actor_id AND c.receiver_id = n.recipient_id) OR (c.receiver_id = n.actor_id AND c.sender_id = n.recipient_id)))",
            "career request not to the alumnus asked": "SELECT COUNT(*) FROM notifications n LEFT JOIN career_requests r ON r.id = n.reference_id WHERE n.type = 'CAREER_REQUEST' AND (r.id IS NULL OR n.recipient_id <> r.alumni_id)",
            "career update to a non-participant": "SELECT COUNT(*) FROM notifications n LEFT JOIN career_requests r ON r.id = n.reference_id WHERE n.type = 'CAREER_UPDATE' AND (r.id IS NULL OR n.recipient_id NOT IN (r.requester_id, r.alumni_id))",
            "mentorship notice to a non-participant": "SELECT COUNT(*) FROM notifications n LEFT JOIN mentorships m ON m.id = n.reference_id WHERE n.type IN ('MENTORSHIP_REQUEST','MENTORSHIP_UPDATE') AND (m.id IS NULL OR n.recipient_id NOT IN (m.mentor_id, m.mentee_id))",
            "introduction notice to a non-participant": "SELECT COUNT(*) FROM notifications n LEFT JOIN warm_intros w ON w.id = n.reference_id WHERE n.type IN ('INTRO_REQUEST','INTRO_UPDATE') AND (w.id IS NULL OR n.recipient_id NOT IN (w.requester_id, w.target_id, w.introducer_id))",
            "profile-view notice without that view": "SELECT COUNT(*) FROM notifications n WHERE n.type = 'PROFILE_VIEW' AND NOT EXISTS (SELECT 1 FROM profile_views v WHERE v.profile_user_id = n.recipient_id AND v.viewer_id = n.actor_id)",
            "introduction target told before the introduction was made": "SELECT COUNT(*) FROM notifications n JOIN warm_intros w ON w.id = n.reference_id WHERE n.type IN ('INTRO_REQUEST','INTRO_UPDATE') AND n.recipient_id = w.target_id AND w.status <> 'INTRODUCED'",
        };
        for (const [label, sql] of Object.entries(violations)) {
            const count = await scalar(sql);
            must(count === 0, `${count} notification(s): ${label}`);
        }
        return `${Object.keys(violations).length} privacy rules, 0 violations`;
    });

    await check("notifications", "unread counts from the service match the database, and a user only lists their own", async () => {
        const details = [];
        for (const person of [student, alumnus, students[3], ...preservedMembers]) {
            const { count } = await NotificationService.getUnreadCount(person.userId);
            const inDb = await scalar("SELECT COUNT(*) FROM notifications n LEFT JOIN users a ON a.id = n.actor_id WHERE n.recipient_id = ? AND n.is_read = 0 AND (n.actor_id IS NULL OR a.status = 'ACTIVE')", [person.userId]);
            must(count === inDb, `unread mismatch for user ${person.userId}: service ${count}, database ${inDb}`);
            const page = await NotificationService.list(person.userId, { page: 1, limit: 20 });
            must(page.unreadCount === count, "list() and getUnreadCount() disagree");
            const foreign = await scalar(`SELECT COUNT(*) FROM notifications WHERE id IN (${placeholders(page.notifications.map((n) => n.id).concat(0))}) AND recipient_id <> ?`, [...page.notifications.map((n) => n.id), 0, person.userId]);
            must(foreign === 0, "list() returned another user's notification");
            details.push(`${person.full_name}: ${count} unread`);
        }
        const types = await scalar("SELECT COUNT(DISTINCT type) FROM notifications");
        must(types >= 13, `only ${types} notification types present`);
        return details.join("; ");
    });

    await check("jobs", "about 100 open jobs, 2-5 skills each, nobody above the open-job limit, https apply links", async () => {
        const open = await scalar("SELECT COUNT(*) FROM jobs WHERE status = 'OPEN'");
        must(open === expected.jobs.open, `${open} open jobs, expected ${expected.jobs.open}`);
        must((await scalar("SELECT COUNT(*) FROM jobs j WHERE (SELECT COUNT(*) FROM job_skills s WHERE s.job_id = j.id) NOT BETWEEN 2 AND 5")) === 0, "a job does not have 2-5 skills");
        const most = await scalar("SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM jobs WHERE status = 'OPEN' GROUP BY poster_id) x");
        must(most <= JobService.MAX_OPEN_JOBS_PER_POSTER, `an alumnus has ${most} open jobs`);
        must((await scalar("SELECT COUNT(*) FROM jobs WHERE apply_url NOT LIKE 'https://%'")) === 0, "a job has a non-https link");
        must((await scalar("SELECT COUNT(DISTINCT poster_id) FROM jobs WHERE status = 'OPEN'")) === 50, "not every alumnus has an open job");
        const list = await JobService.listJobs(viewerOf(student), listJobsSchema.parse({ limit: "50" }));
        must(list.pagination.total === open && list.can_post === false, "job listing for a student is wrong");
        const filtered = await JobService.listJobs(viewerOf(student), listJobsSchema.parse({ skills: "React", job_type: "FULL_TIME" }));
        const detail = await JobService.getJob(viewerOf(student), list.jobs[0].id);
        must(detail.apply_url && detail.description, "job detail is incomplete");
        return `${open} open, ${expected.jobs.closed} closed, max ${most} per alumnus, React full-time: ${filtered.pagination.total}`;
    });

    const careerCheck = (type, label) => check(label, `${type.toLowerCase().replace("_", " ")} requests exist in several statuses and are visible only to their two participants`, async () => {
        const [rows] = await db.query("SELECT status, COUNT(*) AS c FROM career_requests WHERE type = ? GROUP BY status", [type]);
        must(rows.length >= 3, `only ${rows.length} different statuses`);
        const [[one]] = await db.query("SELECT id, requester_id, alumni_id FROM career_requests WHERE type = ? LIMIT 1", [type]);
        const asRequester = await CareerService.getRequest({ userId: one.requester_id, role: "STUDENT" }, one.id);
        must(asRequester.history.length > 0, "no history");
        const sent = await CareerService.listRequests({ userId: one.requester_id, role: "STUDENT" }, careerValidation.listRequestsSchema.parse({ box: "sent", type }));
        const received = await CareerService.listRequests({ userId: one.alumni_id, role: "ALUMNI" }, careerValidation.listRequestsSchema.parse({ box: "received", type }));
        must(sent.requests.length > 0 && received.requests.length > 0, "request missing from a participant's list");
        const outsider = students.find((s) => s.userId !== one.requester_id);
        let hidden = false;
        try { await CareerService.getRequest(viewerOf(outsider), one.id); } catch (error) { hidden = error.statusCode === 404; }
        must(hidden, "an outsider could open the request");
        return rows.map((r) => `${r.status} ${r.c}`).join(", ");
    });
    await careerCheck("REFERRAL", "referrals");
    await careerCheck("RESUME_REVIEW", "resume review");
    await careerCheck("QUESTION", "questions");

    await check("mentorship", "mentor directory, matching with reasons, and mentorships in every status with goals and sessions", async () => {
        const mentors = await MentorshipService.listMentors(viewerOf(student), mentorshipValidation.listMentorsSchema.parse({}));
        must(mentors.pagination.total >= 20, `only ${mentors.pagination.total} mentors listed`);
        const matches = await MentorshipService.getMatches(viewerOf(student), mentorshipValidation.matchQuerySchema.parse({ topic: "INTERVIEW_PREP" }));
        must(matches.matches.length > 0 && matches.matches[0].match.reasons.length > 0, "matching returned no explained result");
        const [rows] = await db.query("SELECT status, COUNT(*) AS c FROM mentorships GROUP BY status");
        must(rows.length === 5, `only ${rows.length} of 5 statuses present`);
        const [[active]] = await db.query("SELECT id, mentor_id, mentee_id FROM mentorships WHERE status = 'ACTIVE' LIMIT 1");
        const detail = await MentorshipService.getMentorship({ userId: active.mentee_id, role: "STUDENT" }, active.id);
        must(detail.goals.length > 0 && detail.sessions.length > 0 && detail.history.length >= 2, "active mentorship has no goals/sessions/history");
        const outsider = students.find((s) => s.userId !== active.mentee_id);
        let hidden = false;
        try { await MentorshipService.getMentorship(viewerOf(outsider), active.id); } catch (error) { hidden = error.statusCode === 404; }
        must(hidden, "an outsider could open the mentorship");
        must((await scalar("SELECT COUNT(*) FROM mentor_profiles mp WHERE (SELECT COUNT(*) FROM mentorships m WHERE m.mentor_id = mp.user_id AND m.status = 'ACTIVE') > mp.max_active_mentees")) === 0, "a mentor is over capacity");
        return `${mentors.pagination.total} mentors; best match ${matches.matches[0].match.score}/${matches.matches[0].match.max_score}; ${rows.map((r) => `${r.status} ${r.c}`).join(", ")}`;
    });

    await check("warm introductions", "introductions in every status; only an introducer connected to both sides; the target sees it only once introduced", async () => {
        const [rows] = await db.query("SELECT status, COUNT(*) AS c FROM warm_intros GROUP BY status");
        must(rows.length === 4, `only ${rows.length} of 4 statuses present`);
        const invalid = await scalar(`SELECT COUNT(*) FROM warm_intros w WHERE w.status IN ('PENDING','INTRODUCED') AND (
            NOT EXISTS (SELECT 1 FROM connections c WHERE c.status = 'ACCEPTED' AND LEAST(c.sender_id, c.receiver_id) = LEAST(w.requester_id, w.introducer_id) AND GREATEST(c.sender_id, c.receiver_id) = GREATEST(w.requester_id, w.introducer_id))
            OR NOT EXISTS (SELECT 1 FROM connections c WHERE c.status = 'ACCEPTED' AND LEAST(c.sender_id, c.receiver_id) = LEAST(w.target_id, w.introducer_id) AND GREATEST(c.sender_id, c.receiver_id) = GREATEST(w.target_id, w.introducer_id)))`);
        must(invalid === 0, `${invalid} introduction(s) through someone who is not connected to both people`);
        const [[pending]] = await db.query("SELECT id, target_id, introducer_id FROM warm_intros WHERE status = 'PENDING' LIMIT 1");
        let hidden = false;
        try { await IntroService.getIntro({ userId: pending.target_id, role: "ALUMNI" }, pending.id); } catch (error) { hidden = error.statusCode === 404; }
        must(hidden, "the target could see a pending introduction");
        const inbox = await IntroService.listIntros({ userId: pending.introducer_id, role: "ALUMNI" }, introValidation.listIntrosSchema.parse({ box: "to_introduce" }));
        must(inbox.intros.some((i) => i.id === pending.id), "the introducer does not see the request");
        const [[made]] = await db.query("SELECT id, target_id FROM warm_intros WHERE status = 'INTRODUCED' LIMIT 1");
        await IntroService.getIntro({ userId: made.target_id, role: "ALUMNI" }, made.id);
        return rows.map((r) => `${r.status} ${r.c}`).join(", ");
    });

    await check("skill gap", "a student gets missing skills, matched skills and job matches", async () => {
        const gap = await InsightService.getSkillGap(viewerOf(student), {});
        must(gap.missing.length > 0 && gap.job_matches.length > 0 && gap.summary.jobs_considered > 0, "skill gap is empty");
        const withMatches = await scalar("SELECT COUNT(DISTINCT ps.profile_id) FROM profile_skills ps JOIN profiles p ON p.id = ps.profile_id JOIN users u ON u.id = p.user_id AND u.role = 'STUDENT' JOIN job_skills js ON js.skill_key = ps.skill_key");
        must(withMatches >= 30, `only ${withMatches} students share a skill with any job`);
        return `${student.full_name}: ${gap.summary.missing_skills} missing, ${gap.summary.matched_skills} matched, coverage ${gap.summary.coverage_percent}%; ${withMatches} students overlap with job skills`;
    });

    await check("industry pulse", "alumni skills, demanded skills, companies, roles and trends are all populated", async () => {
        const pulse = await InsightService.getIndustryPulse();
        must(pulse.alumni_skills.length >= 5 && pulse.demanded_skills.length >= 5 && pulse.top_companies.length >= 5 && pulse.top_roles.length >= 5, "a section is nearly empty");
        must(pulse.trending_skills.skills.length > 0 && pulse.job_types.length >= 3, "no trends or job types");
        return `top alumni skill: ${pulse.alumni_skills[0].skill}; most asked for: ${pulse.demanded_skills[0].skill}; ${pulse.top_companies.length} companies; ${pulse.trending_skills.skills.length} trending`;
    });

    await check("posts", "at most 100 active posts, with likes and comments, and a working feed", async () => {
        const active = await scalar("SELECT COUNT(*) FROM posts WHERE status = 'ACTIVE'");
        must(active > 50 && active <= 100, `${active} active posts`);
        must((await scalar("SELECT COUNT(*) FROM post_likes")) > 100 && (await scalar("SELECT COUNT(*) FROM post_comments")) > 50, "too few likes or comments");
        const feed = await PostService.getFeed(student.userId, 1, 10);
        must(feed.posts.length === 10, `feed returned ${feed.posts.length} posts`);
        return `${active} active, ${await scalar("SELECT COUNT(*) FROM posts WHERE status = 'DELETED'")} deleted`;
    });

    await check("connections", "accepted, pending, rejected and cancelled connections exist and lists work", async () => {
        const [rows] = await db.query("SELECT status, COUNT(*) AS c FROM connections GROUP BY status");
        must(rows.length >= 4, `only ${rows.length} statuses present`);
        const mine = await ConnectionService.getMyConnections(student.userId);
        must(mine.length > 0, "the sample student has no connections");
        for (const me of preservedMembers) {
            must((await ConnectionService.getReceivedRequests(me.userId)).length === 3, `${me.full_name} should have 3 requests waiting`);
            must((await ConnectionService.getMyConnections(me.userId)).length === 5, `${me.full_name} should have 5 connections`);
        }
        return rows.map((r) => `${r.status} ${r.c}`).join(", ");
    });

    await check("chat", "conversations only between connected people, with messages and unread counts", async () => {
        const invalid = await scalar(`SELECT COUNT(*) FROM conversations cv WHERE NOT EXISTS (SELECT 1 FROM connections c WHERE c.status = 'ACCEPTED'
            AND LEAST(c.sender_id, c.receiver_id) = LEAST(cv.user_one_id, cv.user_two_id) AND GREATEST(c.sender_id, c.receiver_id) = GREATEST(cv.user_one_id, cv.user_two_id))`);
        must(invalid === 0, `${invalid} conversation(s) between people who are not connected`);
        const [[one]] = await db.query("SELECT id, user_one_id FROM conversations ORDER BY id LIMIT 1");
        const list = await ChatService.getConversations(one.user_one_id);
        const messages = await ChatService.getMessages(one.user_one_id, one.id, 1, 20);
        must(list.length > 0 && messages.length > 0, "conversation list or messages are empty");
        const outsider = students.find((s) => !list.some((c) => c.otherUser.id === s.userId) && s.userId !== one.user_one_id);
        let blocked = false;
        try { await ChatService.getMessages(outsider.userId, one.id, 1, 20); } catch (error) { blocked = error.statusCode === 403; }
        must(blocked, "an outsider could read a conversation");
        for (const me of preservedMembers) {
            const inbox = await ChatService.getConversations(me.userId);
            must(inbox.length === 1 && inbox[0].unreadCount === 2, `${me.full_name} should have 1 conversation with 2 unread messages`);
        }
        return `${await scalar("SELECT COUNT(*) FROM conversations")} conversations, ${await scalar("SELECT COUNT(*) FROM messages")} messages`;
    });

    await check("campus spotlight", "members only get live cards; drafts, scheduled, archived and finished ones stay hidden; only an admin can manage", async () => {
        const { spotlights } = await SpotlightService.listVisible();
        must(spotlights.length >= 4, `only ${spotlights.length} live spotlights`);
        must(spotlights.every((s) => !("status" in s) && !("created_by" in s)), "a member card exposes publishing details");
        const hidden = await scalar("SELECT COUNT(*) FROM campus_spotlights WHERE status <> 'PUBLISHED' OR publish_at > NOW()");
        const total = await scalar("SELECT COUNT(*) FROM campus_spotlights");
        must(hidden >= 3 && spotlights.length === total - hidden, "a hidden spotlight is visible to members (or a live one is missing)");
        must((await scalar("SELECT COUNT(*) FROM campus_spotlights WHERE (image_url IS NOT NULL AND image_url NOT LIKE 'https://%') OR (cta_url IS NOT NULL AND cta_url NOT LIKE 'https://%')")) === 0, "a spotlight has a non-https link");
        let refused = false;
        try { await SpotlightService.listAll(viewerOf(student), { page: 1, limit: 10 }); } catch (error) { refused = error.statusCode === 403; }
        must(refused, "a student could open the admin list");
        const all = await SpotlightService.listAll({ userId: admin.id, role: "ADMIN" }, { page: 1, limit: 20 });
        return `${spotlights.length} live for members; admin sees ${all.pagination.total} (${Object.entries(all.counts).map(([s, c]) => `${s} ${c}`).join(", ")})`;
    });

    await check("analytics", "post impressions, profile views and search appearances: own data only, never self-views, admins or names of searchers", () =>
        analyticsChecks(preserved.map((p) => p.id)));

    return results;
}

// ----------------------------------- 16. report -----------------------------------

function writeReport({ preserved, deleted, counts, people, sample: samples, checks, backupFile, adjustments }) {
    const lines = [];
    const table = (header, rows) => {
        lines.push(`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`), "");
    };

    lines.push("# SRMS Connect - test data seed report", "", `Generated: ${new Date().toISOString()}  `, "Development / test database only. All generated people, companies and links are synthetic.", "");

    lines.push("## Preserved (not deleted, identity records unchanged)", "");
    table(["Who", "User id", "Role", "Enrollment", "Name"], preserved.map((p) => [p.label, p.id, p.role, p.enrollment, p.full_name || "-"]));

    lines.push("## Test logins", "", `Every generated account uses the password \`${TEST_PASSWORD}\` (log in with the enrollment number).`, "The three preserved accounts keep their own passwords, which this script never reads or changes.", "");
    lines.push("### Useful sample accounts", "");
    table(["What", "Enrollment", "Name", "Notes"], samples);
    lines.push("### All generated accounts", "");
    table(["Role", "Enrollment", "Name", "E-mail", "Programme", "Year"], people.map((p) => [p.role, p.enrollment, p.full_name, p.email, `${p.course}, ${p.branch}`, p.admission_year ? `admitted ${p.admission_year}` : `passed out ${p.passout_year}`]));

    lines.push("## Rows per table after seeding", "");
    table(["Table", "Rows now", "Rows removed by the reset"], Object.keys(counts).map((t) => [t, counts[t], deleted[t] ?? "untouched"]));

    lines.push("## Smoke checks", "");
    table(["Module", "Check", "Result", "Detail"], checks.map((c) => [c.module, c.description, c.ok ? "PASS" : "FAIL", String(c.detail).replace(/\|/g, "/")]));

    lines.push("## Adjustments and notes", "", ...adjustments.map((a) => `- ${a}`), "");
    lines.push("## Backup", "", `Before anything was deleted, every table was copied to \`${path.relative(BACKEND_ROOT, backupFile).replace(/\\/g, "/")}\`.`, "That file contains password hashes and is ignored by git; delete it when you no longer need it.", "");

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, lines.join("\n"));
}

// ----------------------------------- main -----------------------------------

async function main() {
    const startedAt = Date.now();
    assertSafeEnvironment();
    log(`SRMS Connect test-data seed (development/test only) - database "${process.env.DB_NAME}" on this machine${DRY_RUN ? " - DRY RUN" : ""}`);

    const tables = await assertKnownSchema();
    const preserved = await resolvePreserved();
    printPreserved(preserved);
    const snapshotBefore = await snapshotPreserved(preserved);
    const before = await countAll(tables);

    if (DRY_RUN) {
        section("Dry run: rows that a real run would remove");
        const keep = preserved.map((p) => p.id);
        for (const table of tables) {
            const note = WIPE_TABLES.includes(table) ? "all removed" : UNTOUCHED_TABLES.includes(table) ? "untouched" : "all except the preserved rows";
            log(`  ${table.padEnd(24)} ${String(before[table]).padStart(6)} rows  (${note})`);
        }
        log(`\nUsers that would be removed: ${await db.query(`SELECT COUNT(*) AS c FROM users WHERE id NOT IN (${placeholders(keep)})`, keep).then(([r]) => r[0].c)}. Nothing was changed.`);
        return 0;
    }

    if (ANALYTICS_ONLY) {
        section("Analytics history only (nothing else is touched)");
        const made = await seedAnalytics(preserved.map((p) => p.id));
        log(`  ${made.impressions} post impressions, ${made.profileViews} profile views, ${made.searches} search appearances, ${made.notified} profile-view notifications`);
        if ((await snapshotPreserved(preserved)) !== snapshotBefore) throw new Error("A preserved identity record changed.");
        log(`  PASS  analytics\n        -> ${await analyticsChecks(preserved.map((p) => p.id))}`);
        return 0;
    }

    if (SPOTLIGHTS_ONLY) {
        section("Campus Spotlight only (nothing else is touched)");
        await db.query("DELETE FROM campus_spotlights");
        const made = await seedSpotlights(preserved.find((p) => p.label === "ADMIN").id);
        log(`  ${made} spotlights created by the admin; ${(await SpotlightService.listVisible()).spotlights.length} are live for members`);
        return 0;
    }

    section("Backup");
    const backupFile = await backupDatabase(tables);
    log(`  every table copied to ${path.relative(BACKEND_ROOT, backupFile)}`);

    section("Cleanup (one transaction)");
    const deleted = await cleanDatabase(preserved, snapshotBefore);
    log(`  removed ${Object.values(deleted).reduce((a, b) => a + b, 0)} rows; the ${preserved.length} preserved accounts and their master/profile records are unchanged`);

    const { students, alumni } = buildPeople();
    const people = [...students, ...alumni];
    for (const person of people) person.generated = true;

    section("Master data (one transaction)");
    await insertMasterData(students, alumni, preserved);
    log("  50 students in student_master, 50 alumni in alumni_master");

    section("Registration through the application (register -> OTP -> verify -> admin approval)");
    const admin = preserved.find((p) => p.label === "ADMIN");
    await registerEveryone(people, admin.id);

    section("Profiles, skills, projects, Open-to");
    await fillProfiles(students, alumni);

    // the preserved student/alumni accounts take part in the social graph as ordinary members
    const preservedMembers = preserved
        .filter((p) => p.role !== "ADMIN" && p.status === "ACTIVE" && p.profile_id)
        .map((p) => ({ userId: p.id, role: p.role, full_name: p.full_name, generated: false }));

    section("Connections");
    await seedConnections(students, alumni, preservedMembers);
    section("Posts, likes, comments");
    await seedPosts(students, alumni);
    section("Conversations and messages");
    await seedChats(preservedMembers, alumni);
    section("Jobs");
    const jobs = await seedJobs(alumni);

    // two thirds of the generated users have caught up with their notifications; what follows stays unread
    for (const person of people) if (person.index % 3 !== 0) await NotificationService.markAllRead(person.userId);

    section("Career help: referrals, resume reviews, questions");
    const career = await seedCareer(students, alumni);
    section("Mentorship");
    const mentors = await seedMentorProfiles(alumni);
    const mentorships = await seedMentorships(students, mentors);
    section("Warm introductions");
    const intros = await seedIntros(students, alumni);

    section("Spreading activity over the last weeks");
    await spreadTimestamps();

    section("Campus Spotlight");
    const spotlightCount = await seedSpotlights(admin.id);

    section("Analytics history (post impressions, profile views, search appearances)");
    const analytics = await seedAnalytics(preserved.map((p) => p.id));

    section("Verification");
    if ((await snapshotPreserved(preserved)) !== snapshotBefore) throw new Error("A preserved identity record changed. Restore from the backup taken at the start of this run.");
    log("  preserved accounts, master records and profiles are byte-for-byte unchanged");
    const checks = await smokeChecks({ students, alumni, preserved, preservedMembers, expected: { jobs } });
    for (const c of checks) log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.module.padEnd(18)} ${c.description}${c.detail ? `\n        -> ${c.detail}` : ""}`);

    const counts = await countAll(tables);
    section("Rows per table");
    for (const table of tables) log(`  ${table.padEnd(24)} ${String(counts[table]).padStart(6)}   (removed by reset: ${deleted[table] ?? "untouched"})`);

    printPreserved(preserved);

    const samples = [
        ["Student", students[0].enrollment, students[0].full_name, `${students[0].course}; connections, referral and mentorship requests`],
        ["Student", students[2].enrollment, students[2].full_name, "has asked for a warm introduction"],
        ["Alumnus (mentor)", mentors[0].person.enrollment, mentors[0].person.full_name, `${mentors[0].person.designation} at ${mentors[0].person.company}; mentor profile and open jobs`],
        ["Alumnus (hiring)", alumni[1].enrollment, alumni[1].full_name, `${alumni[1].designation} at ${alumni[1].company}; open to ${alumni[1].openTo.join(", ") || "nothing"}`],
        ["Alumnus (not a mentor)", alumni[3].enrollment, alumni[3].full_name, `${alumni[3].designation} at ${alumni[3].company}`],
        ["Admin (preserved)", admin.enrollment, "existing admin", "keeps its own password"],
        ...preserved.filter((p) => p.label !== "ADMIN").map((p) => [`${p.label} (preserved)`, p.enrollment, p.full_name, "keeps its own password; has 5 connections, 3 requests waiting and 2 unread messages"]),
    ];

    section("Test logins");
    log(`  Password for every generated account: ${TEST_PASSWORD}   (log in with the enrollment number)`);
    log("  The preserved accounts keep their own passwords.\n");
    for (const row of samples) log(`  ${row[0].padEnd(24)} ${String(row[1]).padEnd(12)} ${String(row[2]).padEnd(22)} ${row[3]}`);
    log("\n  All generated accounts (enrollment | role | name):");
    for (const p of people) log(`    ${p.enrollment} | ${p.role.padEnd(7)} | ${p.full_name}`);

    const adjustments = [
        `Jobs: ${jobs.open} OPEN jobs spread over the 50 alumni (1-3 each; the application allows at most ${JobService.MAX_OPEN_JOBS_PER_POSTER} open jobs per alumnus), plus ${jobs.closed} CLOSED jobs.`,
        "Posts: 89 ACTIVE posts (the limit asked for was 100) and 3 DELETED ones.",
        `Career help created: ${career.REFERRAL} referral, ${career.RESUME_REVIEW} resume-review and ${career.QUESTION} question requests, moved through their real status transitions.`,
        `Mentorship: ${mentors.length} mentor profiles; requests ended as ${["PENDING", "ACTIVE", "REJECTED", "CANCELLED", "COMPLETED"].map((s) => `${s} ${mentorships[s]}`).join(", ")}; ${counts.mentorship_goals} goals and ${counts.mentorship_sessions} sessions.`,
        `Warm introductions: ${Object.entries(intros).map(([s, c]) => `${s} ${c}`).join(", ")}.`,
        "Registration used the real services (register -> OTP -> verify -> admin approval). The OTP e-mail was captured in memory instead of being sent; passwords are bcrypt-hashed by the auth service.",
        "Generated e-mail addresses end in @srms-seed.test, which can never receive mail. Use password login for these accounts; OTP login would try to e-mail that address.",
        "The preserved student accounts were given a small network (5 accepted connections, 3 incoming requests, 2 unread messages each) so they are useful for testing. They did not post, like, comment or send any request.",
        `Campus Spotlight: ${spotlightCount} announcements created by the existing admin through the service (live, scheduled, draft and archived).`,
        `Analytics: ${analytics.impressions} post impressions, ${analytics.profileViews} profile views and ${analytics.searches} search appearances over the last two months, inserted directly (the recording services only write "today"); ${analytics.notified} profile-view notifications came from the real service.`,
        "Timestamps of the seeded connections, posts, likes, comments, jobs, messages and their notifications were moved back over the last weeks with direct UPDATEs (the only data not written through a service, besides the master tables).",
        "Old profile photos and post media of deleted accounts were not removed from Cloudinary (the script never calls external services).",
        ...Object.entries(skipped).map(([label, s]) => `Skipped because a business rule said no - ${label}: ${s.count} time(s), e.g. "${s.example}".`),
    ];
    writeReport({ preserved, deleted, counts, people, sample: samples, checks, backupFile, adjustments });

    section("Notes");
    for (const a of adjustments) log(`  - ${a}`);
    const failed = checks.filter((c) => !c.ok).length;
    log(`\n${failed ? `${failed} smoke check(s) FAILED` : `All ${checks.length} smoke checks passed`}. Report: ${path.relative(BACKEND_ROOT, REPORT_FILE)}. Took ${Math.round((Date.now() - startedAt) / 1000)}s.`);
    return failed ? 1 : 0;
}

main()
    .then((code) => db.end().then(() => process.exit(code)))
    .catch((error) => {
        console.error(`\nSEED FAILED: ${error.message}`);
        if (!(error instanceof AppError)) console.error(error.stack);
        console.error("If the cleanup had already run, simply run the script again: it always starts from a clean state.");
        db.end().finally(() => process.exit(1));
    });
