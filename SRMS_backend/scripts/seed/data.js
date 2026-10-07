// Static content for the DEV/TEST seed script. Everything here is synthetic:
// names are random first/last combinations, companies are fictional, and every link
// points at example.com (a domain reserved for documentation).

const FIRST_NAMES = [
    "Aditi", "Akash", "Ananya", "Ankit", "Anushka", "Arnav", "Bhavna", "Chirag", "Deepak", "Divya",
    "Farhan", "Gaurav", "Harshita", "Ishaan", "Isha", "Jatin", "Kavya", "Kartik", "Lakshya", "Meera",
    "Manish", "Nandini", "Naveen", "Nidhi", "Om", "Pallavi", "Parth", "Pranav", "Rachit", "Riya",
    "Ritika", "Sahil", "Sandeep", "Sanya", "Shivam", "Sneha", "Tanvi", "Tushar", "Varun", "Yash",
    "Zoya", "Vidhi", "Uday", "Tanmay", "Swati", "Sumit", "Shruti", "Rohit", "Rhea", "Prachi",
];

const LAST_NAMES = [
    "Agarwal", "Bansal", "Bhatt", "Chauhan", "Chopra", "Dubey", "Goel", "Jain", "Joshi", "Khanna",
    "Mehta", "Nair", "Pandey", "Rastogi", "Rawat", "Saxena", "Sethi", "Shukla", "Sinha", "Srivastava",
    "Tiwari", "Tyagi", "Trivedi", "Malhotra", "Bisht",
];

// [course, branch] - weighted towards MCA, which is what the platform is built around
const PROGRAMMES = [
    ["MCA", "Computer Applications"],
    ["MCA", "Computer Applications"],
    ["MCA", "Computer Applications"],
    ["MCA", "Computer Applications"],
    ["MCA", "Computer Applications"],
    ["MCA", "Computer Applications"],
    ["B.Tech", "Computer Science & Engineering"],
    ["B.Tech", "Computer Science & Engineering"],
    ["B.Tech", "Information Technology"],
    ["BCA", "Computer Applications"],
];

// fictional employers
const COMPANIES = [
    { name: "Nimbus Softworks", city: "Noida" },
    { name: "BlueKite Technologies", city: "Bengaluru" },
    { name: "Vertexa Systems", city: "Pune" },
    { name: "Kodeloom Labs", city: "Hyderabad" },
    { name: "Saffron Stack", city: "Gurugram" },
    { name: "Indigrid Software", city: "Chennai" },
    { name: "PixelPeak Digital", city: "Mumbai" },
    { name: "Quantro Analytics", city: "Bengaluru" },
    { name: "Cloudmint Solutions", city: "Pune" },
    { name: "Tarang Infotech", city: "Lucknow" },
    { name: "Orbitly Fintech", city: "Mumbai" },
    { name: "Zentrix Mobility", city: "Noida" },
];

const STUDENT_CITIES = ["Bareilly, Uttar Pradesh", "Lucknow, Uttar Pradesh", "Moradabad, Uttar Pradesh", "Delhi", "Haldwani, Uttarakhand", "Pilibhit, Uttar Pradesh"];

// Skill names are the canonical names from the `skills` catalog table.
// `ladder` = designation by seniority (0-1, 2-4, 5-7, 8+ years).
const TRACKS = {
    frontend: {
        label: "frontend development",
        skills: ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Redux", "Next.js", "Tailwind CSS"],
        ladder: ["Frontend Developer", "Senior Frontend Developer", "Lead Frontend Engineer", "Engineering Manager"],
        jobs: [
            { title: "Frontend Developer", skills: ["React", "JavaScript", "HTML", "CSS", "Redux"], exp: [1, 3] },
            { title: "React Developer", skills: ["React", "TypeScript", "Redux", "Tailwind CSS"], exp: [2, 5] },
            { title: "Frontend Engineering Intern", skills: ["JavaScript", "HTML", "CSS", "React"], exp: [0, 1], type: "INTERNSHIP" },
            { title: "Senior UI Engineer", skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "JavaScript"], exp: [4, 8] },
            { title: "Next.js Developer", skills: ["Next.js", "React", "TypeScript"], exp: [1, 4] },
        ],
    },
    backendNode: {
        label: "backend development with Node.js",
        skills: ["Node.js", "Express.js", "MongoDB", "REST API", "JavaScript", "TypeScript", "Redis", "PostgreSQL", "Docker", "Microservices"],
        ladder: ["Backend Developer", "Senior Backend Developer", "Tech Lead", "Engineering Manager"],
        jobs: [
            { title: "Backend Developer (Node.js)", skills: ["Node.js", "Express.js", "MongoDB", "REST API"], exp: [1, 3] },
            { title: "Node.js Engineer", skills: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Docker"], exp: [2, 5] },
            { title: "Backend Engineering Intern", skills: ["Node.js", "JavaScript", "REST API"], exp: [0, 1], type: "INTERNSHIP" },
            { title: "Senior Backend Engineer", skills: ["Node.js", "Microservices", "Redis", "PostgreSQL", "Docker"], exp: [4, 8] },
            { title: "Full Stack Developer", skills: ["Node.js", "React", "MongoDB", "Express.js", "JavaScript"], exp: [1, 4] },
        ],
    },
    backendJava: {
        label: "backend development with Java",
        skills: ["Java", "Spring Boot", "Microservices", "MySQL", "Kafka", "REST API", "Docker", "System Design"],
        ladder: ["Software Engineer", "Senior Software Engineer", "Tech Lead", "Engineering Manager"],
        jobs: [
            { title: "Java Developer", skills: ["Java", "Spring Boot", "MySQL", "REST API"], exp: [1, 3] },
            { title: "Software Engineer (Java)", skills: ["Java", "Spring Boot", "Microservices", "Kafka"], exp: [2, 5] },
            { title: "Graduate Engineer Trainee", skills: ["Java", "SQL", "Data Structures & Algorithms"], exp: [0, 1] },
            { title: "Senior Java Engineer", skills: ["Java", "Microservices", "Kafka", "System Design", "Docker"], exp: [5, 9] },
            { title: "Java Backend Intern", skills: ["Java", "MySQL", "REST API"], exp: [0, 1], type: "INTERNSHIP" },
        ],
    },
    data: {
        label: "data analytics and machine learning",
        skills: ["Python", "SQL", "Pandas", "NumPy", "Machine Learning", "Power BI", "Tableau", "Data Analysis", "TensorFlow"],
        ladder: ["Data Analyst", "Senior Data Analyst", "Data Scientist", "Analytics Manager"],
        jobs: [
            { title: "Data Analyst", skills: ["SQL", "Python", "Power BI", "Data Analysis"], exp: [0, 2] },
            { title: "Business Intelligence Analyst", skills: ["SQL", "Tableau", "Power BI", "Excel"], exp: [1, 4] },
            { title: "Data Analyst Intern", skills: ["SQL", "Python", "Excel"], exp: [0, 1], type: "INTERNSHIP" },
            { title: "Machine Learning Engineer", skills: ["Python", "Machine Learning", "TensorFlow", "Pandas", "NumPy"], exp: [2, 6] },
            { title: "Junior Data Scientist", skills: ["Python", "Pandas", "Machine Learning", "SQL"], exp: [1, 3] },
        ],
    },
    devops: {
        label: "cloud and DevOps",
        skills: ["AWS", "Docker", "Kubernetes", "CI/CD", "Linux", "Jenkins", "Git", "Azure"],
        ladder: ["DevOps Engineer", "Senior DevOps Engineer", "Cloud Architect", "Head of Platform"],
        jobs: [
            { title: "DevOps Engineer", skills: ["AWS", "Docker", "Kubernetes", "CI/CD", "Linux"], exp: [2, 5] },
            { title: "Cloud Support Engineer", skills: ["AWS", "Linux", "Git"], exp: [0, 2] },
            { title: "Site Reliability Engineer", skills: ["Kubernetes", "Docker", "Linux", "CI/CD", "AWS"], exp: [3, 7] },
            { title: "DevOps Intern", skills: ["Linux", "Git", "Docker"], exp: [0, 1], type: "INTERNSHIP" },
            { title: "Azure Cloud Engineer", skills: ["Azure", "Docker", "CI/CD", "Jenkins"], exp: [2, 6], type: "CONTRACT" },
        ],
    },
    mobile: {
        label: "mobile app development",
        skills: ["Flutter", "Android", "Kotlin", "React Native", "Firebase", "Swift"],
        ladder: ["Mobile Developer", "Senior Mobile Developer", "Mobile Lead", "Engineering Manager"],
        jobs: [
            { title: "Android Developer", skills: ["Android", "Kotlin", "Firebase", "REST API"], exp: [1, 4] },
            { title: "Flutter Developer", skills: ["Flutter", "Firebase", "REST API"], exp: [1, 3] },
            { title: "React Native Developer", skills: ["React Native", "JavaScript", "TypeScript", "Firebase"], exp: [2, 5] },
            { title: "Mobile App Development Intern", skills: ["Flutter", "Firebase"], exp: [0, 1], type: "INTERNSHIP" },
            { title: "Freelance Flutter Developer", skills: ["Flutter", "Firebase", "Git"], exp: [1, 4], type: "FREELANCE" },
        ],
    },
    qa: {
        label: "software testing and quality",
        skills: ["Selenium", "Java", "SQL", "Agile", "Git", "REST API"],
        ladder: ["QA Engineer", "Senior QA Engineer", "SDET Lead", "QA Manager"],
        jobs: [
            { title: "QA Engineer", skills: ["Selenium", "SQL", "Agile"], exp: [0, 3] },
            { title: "SDET", skills: ["Selenium", "Java", "REST API", "Git", "CI/CD"], exp: [2, 5] },
            { title: "Manual Tester (Part Time)", skills: ["SQL", "Agile"], exp: [0, 2], type: "PART_TIME" },
            { title: "Automation Test Engineer", skills: ["Selenium", "Java", "Jenkins", "Git"], exp: [1, 4] },
            { title: "QA Intern", skills: ["SQL", "Selenium"], exp: [0, 1], type: "INTERNSHIP" },
        ],
    },
    dotnet: {
        label: ".NET and enterprise applications",
        skills: ["C#", ".NET", "SQL", "Azure", "Angular", "REST API"],
        ladder: ["Software Developer", "Senior Software Developer", "Technical Lead", "Delivery Manager"],
        jobs: [
            { title: ".NET Developer", skills: ["C#", ".NET", "SQL", "REST API"], exp: [1, 4] },
            { title: "Full Stack Developer (.NET + Angular)", skills: ["C#", ".NET", "Angular", "SQL", "Azure"], exp: [2, 6] },
            { title: "Associate Software Developer", skills: ["C#", "SQL", "OOP"], exp: [0, 1] },
            { title: "Angular Developer", skills: ["Angular", "TypeScript", "HTML", "CSS"], exp: [1, 4] },
            { title: ".NET Trainee", skills: ["C#", "SQL"], exp: [0, 1], type: "INTERNSHIP" },
        ],
    },
};
const TRACK_KEYS = Object.keys(TRACKS);

// what students typically list: fundamentals, so open jobs leave a visible skill gap
const STUDENT_BASE_SKILLS = ["HTML", "CSS", "JavaScript", "Python", "Java", "C++", "SQL", "Git", "Data Structures & Algorithms", "OOP", "DBMS", "C"];

const STUDENT_PROJECTS = [
    ["Library Management System", "A web app to issue, return and search books with role-based access for librarians and students."],
    ["Online Quiz Portal", "Timed quizzes with question banks, automatic scoring and a leaderboard for each subject."],
    ["Expense Tracker", "Tracks personal income and expenses with monthly charts and category-wise budgets."],
    ["College Event Manager", "Lets clubs publish events, accept registrations and export attendee lists."],
    ["Weather Dashboard", "Shows a five-day forecast for saved cities using a public weather API."],
    ["Chat Application", "Real-time one-to-one chat with typing indicators and message history."],
    ["E-commerce Store", "Product catalogue with cart, checkout flow and an admin panel for inventory."],
    ["Attendance System", "Faculty mark attendance per lecture and students see their percentage per subject."],
    ["Resume Builder", "Generates a clean one-page resume from a form and exports it as PDF."],
    ["Task Manager", "Kanban-style boards with due dates, labels and reminders."],
    ["Blog Platform", "Markdown-based blogging site with tags, comments and search."],
    ["Hostel Mess Feedback App", "Students rate daily meals and the mess committee sees weekly summaries."],
];

const ALUMNI_PROJECTS = [
    ["Internal Deployment Dashboard", "A dashboard that shows build status and release history for every service in the team."],
    ["Open Source Logging Helper", "A small library that adds structured, searchable logs to web services."],
    ["Interview Prep Notes", "A public collection of notes and practice questions for campus placements."],
    ["Payment Reconciliation Tool", "Matches gateway settlements against orders and flags mismatches for the finance team."],
    ["Mentor Office Hours Scheduler", "A tiny app juniors use to book a slot for career questions."],
];

const STUDENT_GOALS = [
    "Land a software engineering role at a product company after graduation.",
    "Become a strong full-stack developer and contribute to open source.",
    "Start my career in data analytics and grow into a data scientist.",
    "Get an internship this year and convert it into a full-time offer.",
    "Build solid backend fundamentals and learn system design.",
    "Work on cloud infrastructure and earn a cloud certification.",
];

const ALUMNI_GOALS = [
    "Grow into an engineering leadership role while staying hands-on.",
    "Help more SRMS juniors get their first break in the industry.",
    "Build and scale reliable systems that serve millions of users.",
    "Move towards solution architecture over the next few years.",
];

// {company} / {skill} / {track} are replaced by the author's own details
const ALUMNI_POSTS = [
    "We are hiring at {company}! If you are comfortable with {skill} and want a referral, check the Jobs tab and reach out.",
    "Completed another year at {company}. Biggest lesson so far: write code your teammates can read at 2 AM.",
    "To everyone preparing for placements: revise the basics of {skill}. Interviewers care more about fundamentals than fancy frameworks.",
    "Took a session on {track} for the juniors last weekend. Great questions from the batch - keep them coming.",
    "A resume tip: put your strongest project first and say what YOU built, with numbers if you have them.",
    "Our team at {company} just shipped a big release. Proud of how far we have come since the first prototype.",
    "Mock interviews helped me more than any course. Happy to take a few for final-year students this month.",
    "Learning {skill} this quarter. Any recommendations for good hands-on resources?",
    "Remember when we used to debug lab programs an hour before the practical? Some things never change at work either.",
    "If you are a fresher joining a service company, treat your first project as a paid masterclass. Ask questions, own small things.",
    "Three things I wish I knew in final year: Git properly, how to read documentation, and how to ask for help early.",
    "Looking for interns who know {skill}. Remote friendly, stipend included. Details in the Jobs section.",
    "Switched from a service company to a product company this year. Ask me anything about making that move.",
    "System design is not only for seniors. Start by explaining how your own college project would handle 10x users.",
    "Grateful to the faculty at SRMS for pushing us to build real projects. It still pays off in every interview.",
    "Open to mentoring two students this semester on {track}. Send a request from the Mentorship tab.",
    "Attended a great meetup on {skill} in the city today. The community here is growing fast.",
    "Your first job will not define your career. Your learning habits will.",
    "Code reviews are free mentorship. Read every comment, even on other people's pull requests.",
    "Posted a new opening at {company} for freshers. Students with good {skill} basics should apply.",
];

const STUDENT_POSTS = [
    "Finally finished my project using {skill}! Would love feedback from seniors before I add it to my resume.",
    "Placement season is around the corner. Anyone up for a daily DSA practice group?",
    "Can someone suggest a good roadmap for {track}? I know the basics of {skill} already.",
    "Cleared the first round of an internship interview today. Fingers crossed for the next one!",
    "Our team is participating in the college hackathon next week. Looking for one more teammate who knows {skill}.",
    "Just discovered how much easier debugging becomes when you read the error message slowly. Lesson learned.",
    "Which is better to learn first for backend - Java with Spring Boot or Node.js? Asking the alumni here.",
    "Solved 100 problems on arrays and strings this month. Small wins!",
    "Looking for someone to review my resume before I start applying. Any alumni open to it?",
    "Attended the alumni talk today. Very motivating to hear how they started exactly where we are now.",
    "Started learning {skill} this week. The first few days are confusing but it is getting better.",
    "Does anyone have notes for DBMS normalization? The exam is next week.",
    "Got my first open source pull request merged. It was a small documentation fix, but it counts!",
    "Working on my final-year project idea. Thinking of something around campus placements data.",
    "Thank you to the alumnus who took my mock interview yesterday. I now know exactly what to improve.",
];

const COMMENTS = [
    "Congratulations! Well deserved.",
    "This is really helpful, thank you for sharing.",
    "Great advice. Saving this post.",
    "Could you share some resources for this?",
    "All the best for the next round!",
    "Completely agree with this.",
    "Count me in, I am interested.",
    "Thanks, this cleared a lot of doubts.",
    "Very motivating. Thank you!",
    "I had the same question. Following this thread.",
    "Sent you a connection request to discuss this.",
    "Nice work! How long did it take you?",
    "Fundamentals really do matter. Good reminder.",
    "Would love to attend the next session.",
    "Proud to see SRMS people doing so well.",
    "Please share the link when it is live.",
];

// short realistic conversations; lines alternate between the two people, first speaker starts
const CHAT_THREADS = [
    ["Hi! Thanks for accepting my request.", "Happy to connect. How is the semester going?", "Good so far. I wanted to ask about preparing for product companies.", "Start with DSA basics and build one solid project. Consistency matters more than hours.", "That helps a lot, thank you!"],
    ["Hello, I saw the opening you posted. Is it open to freshers?", "Yes, freshers with good fundamentals can apply.", "Great. Should I request a referral from the Jobs page?", "Yes please, and attach your latest resume.", "Done. Thank you so much!", "All the best."],
    ["Hey, are you joining the hackathon this weekend?", "Yes! Still looking for a teammate for the backend part.", "I can help with the APIs.", "Perfect, let us meet in the lab at 4."],
    ["Good evening. Could you take a quick look at my resume sometime?", "Sure, send a request from the Career Help section with the link.", "Sent it just now.", "Got it. I will reply with feedback in a day or two."],
    ["Hi, long time! Where are you working these days?", "Hey! I moved to a new team recently. How about you?", "Same company, new project. We should catch up at the alumni meet.", "Absolutely. See you there."],
    ["Thank you for the mock interview yesterday.", "You did well. Work on explaining your approach before you code.", "Noted. I will practise speaking through problems.", "Good plan. Ping me after a week and we will do another round."],
    ["Hi, is your team using microservices in production?", "Yes, around twenty services at the moment.", "How should a student start learning that?", "Build a monolith first, then split one module out. You will understand the trade-offs quickly."],
    ["Hello! I am from the junior batch. Could you guide me on internships?", "Of course. Which area interests you most?", "Web development for now.", "Then put two deployed projects on your resume and start applying early."],
];

const REFERRAL_MESSAGES = [
    "I have built two projects with the skills this role asks for and would be grateful for a referral.",
    "This role matches my final-year project closely. I would really appreciate it if you could refer me.",
    "I have been preparing for exactly this kind of role and my resume is up to date on my profile. Could you refer me?",
    "I meet the experience range and have hands-on practice with the listed skills. Requesting a referral.",
];
const RESUME_MESSAGES = [
    "Could you please review my resume before I start applying for internships?",
    "I updated my resume after my latest project. Any feedback on the structure would help.",
    "Placement season starts soon. Please tell me what I should change in my resume.",
];
const QUESTIONS = [
    "How did you prepare for your first technical interview, and what would you do differently now?",
    "Is it better to join a startup or a large company as a fresher? What did you learn from your choice?",
    "Which skills should I focus on in my final year to be ready for backend roles?",
    "How important are certifications compared to projects when applying for cloud roles?",
    "What does a normal day look like in your role, and which subject from college do you still use?",
    "How do I decide between a higher degree and a job right after graduation?",
];
const ANSWERS = [
    "Focus on fundamentals first: data structures, SQL and one language you know deeply. Then build one project you can explain end to end. That combination worked for me and for most juniors I have referred.",
    "Both paths work. A large company gives structure and training, a startup gives ownership early. Pick the one where you will have a good mentor in your first year.",
    "Projects matter more than certificates. A certification helps you get shortlisted, but in the interview you will be asked what you actually built and why.",
    "Give yourself a fixed routine: two problems a day, one project feature a week, and one mock interview every fortnight. Small steady effort beats last-minute preparation.",
];
const CAREER_ACCEPT_NOTES = ["Happy to help. I will take it forward this week.", "Sure, share anything else you want me to consider.", "Accepted. Let me go through the details."];
const CAREER_REJECT_NOTES = ["Sorry, I am not able to take this up right now.", "This role is outside my team, so I cannot refer for it.", "I am travelling this month. Please try another alumnus."];
const CAREER_COMPLETE_NOTES = ["Done. I have submitted it from my side - all the best!", "Shared my feedback. Fix the summary section and you are good to go."];

const MENTOR_BIOS = [
    "I have spent my career in {track} and enjoy helping students turn college projects into interview-ready stories.",
    "Working at {company} in {track}. I like breaking big career questions into small weekly steps.",
    "From campus placements to leading a team in {track} - happy to share what worked and what did not.",
    "I mentor on {track}, interview preparation and choosing a first job that helps you grow.",
];
const MENTOR_AVAILABILITY = ["Weekends, about 2 hours a week", "Weekday evenings after 8 PM IST", "Saturday mornings", "Alternate Sundays, 1 hour"];
const MENTOR_AREAS = ["Computer Applications", "final-year students", "Computer Science & Engineering", "Information Technology", "first-generation graduates"];
const MENTORSHIP_MESSAGES = [
    "I am preparing for placements and would value your guidance on what to focus on over the next three months.",
    "I want to grow in the same area you work in and would like a structured plan from someone who has done it.",
    "I have the basics in place but I am unsure how to prepare for interviews. Could you mentor me for a few weeks?",
    "I am confused between two career paths and would like to talk it through with someone experienced.",
];
const MENTORSHIP_GOALS = [
    "Finish two mock interviews", "Rewrite resume summary and projects", "Solve 60 DSA problems", "Deploy one project publicly",
    "Learn SQL joins and indexing", "Prepare answers for common HR questions", "Read one system design case study a week", "Build a small REST API",
];
const SESSION_NOTES = [
    "Reviewed the resume line by line and agreed on three changes.",
    "Mock interview on arrays and strings. Needs to explain the approach before coding.",
    "Discussed a learning roadmap for the next six weeks.",
    "Walked through the final-year project and how to present it in interviews.",
    "Talked about how to compare two job offers beyond salary.",
];
const MENTOR_ACCEPT_NOTES = ["Glad to help. Let us start with a short call this weekend.", "Accepted. Please add your goals so we can plan the first session."];
const MENTOR_REJECT_NOTES = ["I do not have the time to do this properly right now, sorry.", "This topic is outside what I can guide well. Please try another mentor."];
const MENTOR_CLOSING_NOTES = ["You have made great progress. Keep the routine going and stay in touch.", "We covered everything we planned. All the best for placements!"];

const INTRO_MESSAGES = [
    "I am interested in the kind of work they do and would love to ask a few questions about getting started.",
    "They work in the exact area I want to enter after graduation. An introduction would mean a lot.",
    "I read their post about switching roles and would like to learn how they prepared for it.",
];
const INTRO_NOTES = ["A sincere student from our college - worth a short chat.", "I know them through the alumni network. Good fundamentals and very curious."];
const INTRO_DECLINE_NOTES = ["I do not know them well enough to introduce you, sorry.", "They are very busy this quarter. Please try again later."];

module.exports = {
    FIRST_NAMES, LAST_NAMES, PROGRAMMES, COMPANIES, STUDENT_CITIES, TRACKS, TRACK_KEYS, STUDENT_BASE_SKILLS,
    STUDENT_PROJECTS, ALUMNI_PROJECTS, STUDENT_GOALS, ALUMNI_GOALS, ALUMNI_POSTS, STUDENT_POSTS, COMMENTS, CHAT_THREADS,
    REFERRAL_MESSAGES, RESUME_MESSAGES, QUESTIONS, ANSWERS, CAREER_ACCEPT_NOTES, CAREER_REJECT_NOTES, CAREER_COMPLETE_NOTES,
    MENTOR_BIOS, MENTOR_AVAILABILITY, MENTOR_AREAS, MENTORSHIP_MESSAGES, MENTORSHIP_GOALS, SESSION_NOTES,
    MENTOR_ACCEPT_NOTES, MENTOR_REJECT_NOTES, MENTOR_CLOSING_NOTES, INTRO_MESSAGES, INTRO_NOTES, INTRO_DECLINE_NOTES,
};
