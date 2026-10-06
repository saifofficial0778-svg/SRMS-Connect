const JobRepository = require("./job.repository");
const NotificationService = require("../notification/notification.service");
const CareerService = require("../career/career.service");
const SkillService = require("../skill/skill.service");
const AppError = require("../../utils/AppError");

const MAX_OPEN_JOBS_PER_POSTER = 10; // simple anti-spam cap

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new AppError("Invalid job id", 400);
    }
    return id;
};

// What a client may see. Poster details are what their public profile already shows; the poster's
// email / enrollment / phone never leave the database. `detail` adds the full description and the
// application link (only while the job is open, or to its owner).
function toPublicJob(row, skills, viewerId, { detail = false } = {}) {
    const isOwner = row.poster_id === viewerId;
    const job = {
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        job_type: row.job_type,
        experience_min: row.experience_min,
        experience_max: row.experience_max,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        skills: skills || [],
        poster: {
            user_id: row.poster_id,
            full_name: row.poster_name || "SRMS Alumni",
            profile_photo: row.poster_photo,
            designation: row.poster_designation,
            company: row.poster_company,
            // only ACTIVE alumni can be listed, so a job's poster is a verified alumnus
            is_verified_alumni: row.poster_role === "ALUMNI",
        },
        is_owner: isOwner,
    };

    if (detail) {
        job.description = row.description;
        job.apply_url = row.status === "OPEN" || isOwner ? row.apply_url : null;
    } else {
        job.description_preview = row.description_preview;
    }
    return job;
}

// DELETED jobs don't exist for anyone. Otherwise the poster always sees their own job; everyone else
// only sees jobs of a poster who is still an ACTIVE alumnus (open jobs are listed, closed ones are
// reachable by link and shown as closed).
function canView(job, viewerId) {
    if (job.status === "DELETED") return false;
    if (job.poster_id === viewerId) return true;
    return job.poster_status === "ACTIVE" && job.poster_role === "ALUMNI";
}

async function loadOwnedJob(viewer, rawId) {
    const id = parseId(rawId);
    const job = await JobRepository.findJobById(id);

    if (!job || job.status === "DELETED") {
        throw new AppError("Job not found", 404);
    }
    if (job.poster_id !== viewer.userId) {
        throw new AppError("You can only modify your own jobs", 403);
    }
    return job;
}

async function assertUnderOpenJobLimit(posterId) {
    const open = await JobRepository.countOpenByPoster(posterId);
    if (open >= MAX_OPEN_JOBS_PER_POSTER) {
        throw new AppError(
            `You can have at most ${MAX_OPEN_JOBS_PER_POSTER} open jobs. Close or delete one first.`,
            400
        );
    }
}

const JobService = {

    // viewer = { userId, role } from the verified session
    async listJobs(viewer, query) {
        const { page, limit } = query;
        const offset = (page - 1) * limit;

        const filters = {
            viewerId: viewer.userId,
            mine: query.mine,
            status: query.status,
            q: query.q,
            company: query.company,
            location: query.location,
            jobType: query.job_type,
            experience: query.experience,
            skills: query.skills,
            // every spelling that means the same skill, so "Node" also finds jobs asking for "Node.js"
            skillKeyGroups: query.skills && query.skills.length
                ? await Promise.all(query.skills.map((skill) => SkillService.equivalentKeys(skill)))
                : undefined,
        };

        const [rows, total] = await Promise.all([
            JobRepository.findJobs(filters, limit, offset),
            JobRepository.countJobs(filters),
        ]);
        const skillsByJob = await JobRepository.findSkillsForJobs(rows.map((r) => r.id));

        return {
            jobs: rows.map((r) => toPublicJob(r, skillsByJob[r.id], viewer.userId)),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            // lets the UI show "Post a job" only to people the server would accept it from
            can_post: viewer.role === "ALUMNI",
        };
    },

    async getJob(viewer, rawId) {
        const id = parseId(rawId);
        const row = await JobRepository.findJobById(id);

        if (!row || !canView(row, viewer.userId)) {
            throw new AppError("Job not found", 404);
        }
        const skillsByJob = await JobRepository.findSkillsForJobs([id]);
        return toPublicJob(row, skillsByJob[id], viewer.userId, { detail: true });
    },

    async createJob(viewer, data) {
        // checked again here (the route also restricts it) so no other caller can bypass the rule
        if (viewer.role !== "ALUMNI") {
            throw new AppError("Only verified alumni can post jobs", 403);
        }
        await assertUnderOpenJobLimit(viewer.userId);

        // "React" and "React.js" are one requirement, not two
        const id = await JobRepository.createJob(viewer.userId, { ...data, skills: await SkillService.dedupe(data.skills) });

        await NotificationService.notifyJobPosted({
            posterId: viewer.userId,
            jobId: id,
            title: data.title,
            company: data.company,
        });

        return { id };
    },

    async updateJob(viewer, rawId, data) {
        const job = await loadOwnedJob(viewer, rawId);

        // the range must still make sense after merging with what is already stored
        const min = data.experience_min ?? job.experience_min;
        const max = data.experience_max !== undefined ? data.experience_max : job.experience_max;
        if (max !== null && max !== undefined && max < min) {
            throw new AppError("Maximum experience can't be lower than minimum", 400);
        }

        const changes = data.skills === undefined ? data : { ...data, skills: await SkillService.dedupe(data.skills) };
        await JobRepository.updateJob(job.id, changes);
        return { id: job.id };
    },

    async setStatus(viewer, rawId, status) {
        const job = await loadOwnedJob(viewer, rawId);

        if (job.status === status) {
            throw new AppError(`Job is already ${status.toLowerCase()}`, 400);
        }
        if (status === "OPEN") {
            await assertUnderOpenJobLimit(viewer.userId); // reopening counts against the cap too
        }

        await JobRepository.setStatus(job.id, status);
        return { id: job.id, status };
    },

    async deleteJob(viewer, rawId) {
        const job = await loadOwnedJob(viewer, rawId);

        await JobRepository.softDelete(job.id);
        await NotificationService.removeJobNotifications(job.id);
        await CareerService.closeRequestsForDeletedJob(job.id, job);

        return true;
    },
};

module.exports = JobService;
module.exports.toPublicJob = toPublicJob;
module.exports.MAX_OPEN_JOBS_PER_POSTER = MAX_OPEN_JOBS_PER_POSTER;
