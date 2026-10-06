const SkillRepository = require("./skill.repository");
const { normalizeSkillKey } = require("./skill.normalize");

// The alias table is small and changes rarely, so it is kept in memory and refreshed every few
// minutes instead of being queried for every skill comparison.
const CACHE_MS = 5 * 60 * 1000;
let cache = null; // { loadedAt, byAlias: Map(alias_key -> { slug, name }), bySlug: Map(slug -> [alias_key]) }

async function loadIndex() {
    if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache;

    const rows = await SkillRepository.findAllAliases();
    const byAlias = new Map();
    const bySlug = new Map();
    for (const { alias_key: aliasKey, slug, name } of rows) {
        byAlias.set(aliasKey, { slug, name });
        if (!bySlug.has(slug)) bySlug.set(slug, []);
        bySlug.get(slug).push(aliasKey);
    }
    cache = { loadedAt: Date.now(), byAlias, bySlug };
    return cache;
}

const SkillService = {

    // "React.js" -> { key: "react", name: "React" }. A skill with no mapping stands for itself:
    // "Solidity" -> { key: "solidity", name: "Solidity" }.
    async canonicalize(text) {
        const { byAlias } = await loadIndex();
        const key = normalizeSkillKey(text);
        const known = byAlias.get(key);
        return known ? { key: known.slug, name: known.name } : { key, name: String(text ?? "").trim() };
    },

    // Every spelling key that means the same skill as `text` - used to filter by skill so that
    // searching "React" also finds people/jobs that wrote "React.js".
    async equivalentKeys(text) {
        const { byAlias, bySlug } = await loadIndex();
        const key = normalizeSkillKey(text);
        const known = byAlias.get(key);
        return known ? [...bySlug.get(known.slug)] : [key];
    },

    // Drops later spellings of a skill already in the list: ["React", "React.js", "Node"] -> ["React", "Node"]
    async dedupe(list) {
        const seen = new Set();
        const result = [];
        for (const item of list || []) {
            const { key } = await SkillService.canonicalize(item);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            result.push(item);
        }
        return result;
    },

    // for tests, and for code that changes the alias table
    resetCache() {
        cache = null;
    },
};

module.exports = SkillService;
