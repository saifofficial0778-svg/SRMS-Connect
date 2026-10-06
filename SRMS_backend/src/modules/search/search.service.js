const SearchRepository = require("./search.repository");
const SkillService = require("../skill/skill.service");

const QUICK_LIMIT = 5; // navbar dropdown
const LIST_LIMIT = 12; // directory page

// Explicit whitelist: whatever the repository returns, only these public fields leave the API.
// (Same data the public profile already shows, plus role/branch/batch - never contact or account data.)
function toPublicPerson(row, skills = [], openTo = []) {
    return {
        user_id: row.user_id,
        full_name: row.full_name,
        profile_photo: row.profile_photo,
        bio: row.bio,
        location: row.location,
        company: row.company,
        designation: row.designation,
        experience_years: row.experience_years,
        branch: row.branch,
        batch_year: row.batch_year,
        role: row.role,
        // searchable accounts are all ACTIVE (admin-approved), so an alumni result is a verified alumni
        is_verified_alumni: row.role === "ALUMNI",
        skills: skills.slice(0, 6),
        open_to: openTo,
    };
}

function toPublicPost(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        content: row.content,
        created_at: row.created_at,
        full_name: row.full_name,
        profile_photo: row.profile_photo,
    };
}

const pagination = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
});

const SearchService = {

    async search(viewerId, query) {
        const { type, page } = query;
        const limit = query.limit ?? (type === "all" ? QUICK_LIMIT : LIST_LIMIT);
        const offset = (page - 1) * limit;

        const peopleFilters = {
            viewerId,
            q: query.q,
            role: query.role,
            company: query.company,
            designation: query.designation,
            branch: query.branch,
            batch: query.batch,
            skills: query.skills,
            // every spelling that means the same skill, so "React" also finds "React.js"
            skillKeyGroups: query.skills && query.skills.length
                ? await Promise.all(query.skills.map((skill) => SkillService.equivalentKeys(skill)))
                : undefined,
            openTo: query.openTo,
        };

        let people = [];
        let posts = [];
        let pageInfo;

        if (type === "all" || type === "people") {
            const [rows, total] = await Promise.all([
                SearchRepository.searchPeople(peopleFilters, limit, offset),
                SearchRepository.countPeople(peopleFilters),
            ]);
            const profileIds = rows.map((r) => r.profile_id);
            const [skillsByProfile, openToByProfile] = await Promise.all([
                SearchRepository.findSkillsForProfiles(profileIds),
                SearchRepository.findOpenToForProfiles(profileIds),
            ]);
            people = rows.map((r) => toPublicPerson(r, skillsByProfile[r.profile_id], openToByProfile[r.profile_id]));
            pageInfo = pagination(page, limit, total);
        }

        if (type === "all") {
            const rows = await SearchRepository.searchPosts(query.q, QUICK_LIMIT, 0);
            posts = rows.map(toPublicPost);
        } else if (type === "posts") {
            const [rows, total] = await Promise.all([
                SearchRepository.searchPosts(query.q, limit, offset),
                SearchRepository.countPosts(query.q),
            ]);
            posts = rows.map(toPublicPost);
            pageInfo = pagination(page, limit, total);
        }

        return { people, posts, pagination: pageInfo };
    },

    async getFilterOptions() {
        return await SearchRepository.getFilterOptions();
    },
};

module.exports = SearchService;
module.exports.toPublicPerson = toPublicPerson;
