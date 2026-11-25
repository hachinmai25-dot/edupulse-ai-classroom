import React from 'react';
import { Loader2 } from 'lucide-react';
import { LMSProvider, useLMS } from './context/LMSContext';
import { AuthGateway } from './components/AuthGateway';
import { LayoutShell } from './components/LayoutShell';
import { ProfessorOverview } from './components/professor/ProfessorOverview';
import { ProfessorQuizzes } from './components/professor/ProfessorQuizzes';
import { ProfessorAssignments } from './components/professor/ProfessorAssignments';
import { ProfessorNotes } from './components/professor/ProfessorNotes';
import { ProfessorAnalytics } from './components/professor/ProfessorAnalytics';
import { StudentOverview } from './components/student/StudentOverview';
import { StudentQuizzes } from './components/student/StudentQuizzes';
import { StudentAssignments } from './components/student/StudentAssignments';
import { StudentNotes } from './components/student/StudentNotes';
import { StudentGrades } from './components/student/StudentGrades';
import { ForumSection } from './components/shared/ForumSection';

function ProfessorDashboard() {
  const { activeSection } = useLMS();
  switch (activeSection) {
    case 'overview':
      return <ProfessorOverview />;
    case 'quizzes':
      return <ProfessorQuizzes />;
    case 'assignments':
      return <ProfessorAssignments />;
    case 'notes':
      return <ProfessorNotes />;
    case 'forum':
      return <ForumSection />;
    case 'analytics':
      return <ProfessorAnalytics />;
    default:
      return <ProfessorOverview />;
  }
}

function StudentDashboard() {
  const { activeSection } = useLMS();
  switch (activeSection) {
    case 'overview':
      return <StudentOverview />;
    case 'quizzes':
      return <StudentQuizzes />;
    case 'assignments':
      return <StudentAssignments />;
    case 'notes':
      return <StudentNotes />;
    case 'forum':
      return <ForumSection />;
    case 'analytics':
      return <StudentGrades />;
    default:
      return <StudentOverview />;
  }
}

function EduPulseRouter() {
  const { user, stateLoading } = useLMS();

  if (!user) {
    return <AuthGateway />;
  }

  return (
    <LayoutShell>
      {stateLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-700" />
          <span>Loading {user.role === 'professor' ? 'Professor' : 'Student'} Workspace...</span>
        </div>
      ) : user.role === 'professor' ? (
        <ProfessorDashboard />
      ) : (
        <StudentDashboard />
      )}
    </LayoutShell>
  );
}

export default function App() {
  return (
    <LMSProvider>
      <EduPulseRouter />
    </LMSProvider>
  );
}
