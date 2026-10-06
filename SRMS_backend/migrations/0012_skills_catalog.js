// Skill normalization.
//
//   skills         the canonical skills (display name + slug)
//   skill_aliases  every spelling that means that skill: alias_key -> skill
//
// A key is the skill text lower-cased with spaces . - _ / removed, so "React.js", "react js" and
// "ReactJS" all become "reactjs", which the alias table maps to the canonical "React".
// A skill nobody has mapped simply has no row here and stands for itself.
//
// Nothing in profile_skills / job_skills is changed or removed: what people typed stays exactly as
// they typed it, and the mapping is applied when skills are compared or counted.
//
// The list below is seed data and is frozen with this migration; later additions belong in a new
// migration (or an admin tool), not in an edit here.

const key = (value) => String(value).trim().toLowerCase().replace(/[ ._\-/]/g, "");

// [canonical name, ...other spellings]
const SEED = [
    ["JavaScript", "JS", "ES6", "ECMAScript"],
    ["TypeScript", "TS"],
    ["Python", "Python3", "Py"],
    ["Java"],
    ["C"],
    ["C++", "CPP"],
    ["C#", "CSharp"],
    [".NET", "DotNet"],
    ["Go", "Golang"],
    ["Rust"],
    ["PHP"],
    ["Ruby"],
    ["Ruby on Rails", "Rails", "RoR"],
    ["Kotlin"],
    ["Swift"],
    ["Scala"],
    ["R", "R Programming"],
    ["MATLAB"],
    ["HTML", "HTML5"],
    ["CSS", "CSS3"],
    ["React", "React.js", "ReactJS"],
    ["React Native"],
    ["Next.js", "Next", "NextJS"],
    ["Vue.js", "Vue", "VueJS"],
    ["Angular", "AngularJS"],
    ["Redux"],
    ["jQuery"],
    ["Bootstrap"],
    ["Tailwind CSS", "Tailwind"],
    ["Node.js", "Node", "NodeJS"],
    ["Express.js", "Express", "ExpressJS"],
    ["Django"],
    ["Flask"],
    ["Spring"],
    ["Spring Boot"],
    ["Laravel"],
    ["REST API", "REST", "REST APIs", "RESTful API", "RESTful APIs"],
    ["GraphQL"],
    ["Socket.IO"],
    ["JWT", "JSON Web Token", "JSON Web Tokens"],
    ["MERN", "MERN Stack"],
    ["SQL"],
    ["MySQL"],
    ["PostgreSQL", "Postgres", "psql"],
    ["MongoDB", "Mongo"],
    ["Redis"],
    ["Firebase"],
    ["DBMS", "Database Management System", "Database Management Systems"],
    ["Git"],
    ["GitHub"],
    ["Docker"],
    ["Kubernetes", "K8s"],
    ["Jenkins"],
    ["CI/CD"],
    ["Linux"],
    ["AWS", "Amazon Web Services"],
    ["Azure", "Microsoft Azure"],
    ["GCP", "Google Cloud", "Google Cloud Platform"],
    ["Microservices"],
    ["System Design"],
    ["Data Structures & Algorithms", "DSA", "DS&A", "Data Structures and Algorithms", "Data Structures"],
    ["OOP", "OOPs", "Object Oriented Programming"],
    ["Operating Systems", "Operating System", "OS"],
    ["Computer Networks", "Computer Networking", "CN"],
    ["Machine Learning", "ML"],
    ["Deep Learning", "DL"],
    ["NLP", "Natural Language Processing"],
    ["Data Analysis", "Data Analytics"],
    ["Pandas"],
    ["NumPy"],
    ["TensorFlow"],
    ["PyTorch"],
    ["Hadoop"],
    ["Spark", "Apache Spark"],
    ["Kafka", "Apache Kafka"],
    ["Excel", "MS Excel", "Microsoft Excel"],
    ["Power BI"],
    ["Tableau"],
    ["Android", "Android Development"],
    ["Flutter"],
    ["Selenium"],
    ["Figma"],
    ["UI/UX", "UI UX Design", "UX Design", "UI Design"],
    ["Agile"],
    ["Communication", "Communication Skills"],
];

module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS skills (
                id BIGINT NOT NULL AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_skills_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS skill_aliases (
                alias_key VARCHAR(100) NOT NULL,
                skill_id BIGINT NOT NULL,
                PRIMARY KEY (alias_key),
                KEY idx_skill_aliases_skill (skill_id),
                CONSTRAINT fk_skill_aliases_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        // refuse to seed an ambiguous list (one spelling pointing at two skills)
        const owner = new Map();
        for (const [name, ...others] of SEED) {
            for (const spelling of [name, ...others]) {
                const k = key(spelling);
                if (owner.has(k) && owner.get(k) !== name) {
                    throw new Error(`Skill seed is ambiguous: "${spelling}" maps to both ${owner.get(k)} and ${name}`);
                }
                owner.set(k, name);
            }
        }

        for (const [name, ...others] of SEED) {
            await conn.query("INSERT IGNORE INTO skills (name, slug) VALUES (?, ?)", [name, key(name)]);
            const [[skill]] = await conn.query("SELECT id FROM skills WHERE slug = ?", [key(name)]);
            for (const spelling of [name, ...others]) {
                await conn.query("INSERT IGNORE INTO skill_aliases (alias_key, skill_id) VALUES (?, ?)", [key(spelling), skill.id]);
            }
        }
        console.log(`   seeded ${SEED.length} skills, ${owner.size} spellings`);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS skill_aliases");
        await conn.query("DROP TABLE IF EXISTS skills");
    },
};
