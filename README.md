# 🎓 EduPulse — AI-Powered Dual-Role Learning Management System

**EduPulse** is a full-stack, real-time Learning Management System (LMS) engineered with separate, synchronized dashboards for **Professors** and **Students**. Built with React, Firebase, and the Google Gemini API, it streamlines course creation, AI-assisted quiz generation, timed assessments, assignment grading, and interactive study tools inside a modern dark-mode Bento UI.

🔗 **Live Demo:** `[Insert your .ai.studio or Cloud Run URL here]`

---

## ✨ Key Features

### 👨‍🏫 Professor Dashboard
* **Course & Roster Management:** Create courses with unique join codes and track enrolled students in real time.
* **AI Quiz Generator & Builder:** Build custom multiple-choice quizzes with time limits and due dates—or paste lecture notes to auto-generate questions using the **Gemini API**.
* **Assignment Creator & Live Grader:** Publish assignments, review student text/code/URL submissions in a slide-over drawer, assign grades, and write personalized feedback.
* **Lecture Notes Publisher:** Distribute structured Markdown study notes organized by course and module.
* **Class Analytics:** Monitor class averages, pending grading queues, and assessment performance with interactive Recharts visualizations.

### 👩‍🎓 Student Dashboard
* **Course Enrollment:** Join classes using a professor's course code to unlock course-specific materials.
* **Interactive Quiz Engine:** Take published quizzes with a live countdown timer, question navigation palette, auto-submission on timeout, and instant score breakdowns.
* **Assignment Workspace:** Track upcoming deadlines, submit assignments, and view professor grades and feedback live.
* **Notes Hub & AI Study Buddy:** Read lecture notes in a distraction-free dark reader, bookmark key topics, download notes as `.md` files, and use the **Gemini AI Study Buddy** to summarize notes or generate flashcards.
* **Announcements & Doubt Forum:** Stay updated on course announcements and ask questions directly to professors.

---

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript/JavaScript, Tailwind CSS, Lucide Icons, Recharts
* **Backend & Database:** Firebase Authentication (Google & Email/Password), Cloud Firestore (Real-time `onSnapshot` listeners)
* **AI Integration:** Google Gemini API (`@google/genai`) for automated quiz generation and note summarization
* **Deployment:** Google AI Studio Build Mode / Google Cloud Run

---

## 🗄️ Firestore Data Architecture

```text
├── users/{uid}                     # User profiles & role ("professor" | "student")
├── courses/{courseId}              # Course metadata & unique join codes
├── enrollments/{enrollmentId}      # Student-to-course mappings
├── quizzes/{quizId}                # Quiz configurations & question arrays
├── quizSubmissions/{submissionId}  # Student quiz answers & calculated scores
├── assignments/{assignmentId}      # Assignment prompts, due dates & max points
├── assignmentSubmissions/{subId}   # Student submissions, grades & professor feedback
├── notes/{noteId}                  # Markdown lecture notes by module
└── announcements/{announcementId}  # Course updates & student Q&A threads
