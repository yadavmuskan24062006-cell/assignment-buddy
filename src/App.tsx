import { useState, useEffect } from 'react';
import { AssignmentTracker, type Assignment } from './AssignmentTracker';
import  RevisionHub from './RevisionHub';
import { generateStudyPlan } from './gemini';
import { LowMotivationModal } from './LowMotivationModal';
import { Heart, Zap, AlertTriangle, Info, RotateCcw, CheckCircle, BookOpen, Activity, History, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- DATA TYPES ---
interface RevisionTopic {
  id: string;
  topic: string;
  dateAdded: string;
  lastRevised: string;
  everRevised?: boolean; // false = never actually revised, lastRevised is just a sort-priority placeholder
}

interface ProgressState {
  assignmentsCompleted: number;
  topicsRevised: number;
  studySessions: number;
  streak: number;
}
interface CompletedSuggestion {
  id: string;
  reason: string;
  recommendedTask: string;
  minimumWin: string;
  completedAt: string;
}

export default function App() {
  // Navigation & Modal State
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'calendar' | 'revision' | 'planner' | 'history'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Core Data State
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [revisions, setRevisions] = useState<RevisionTopic[]>([]);
  const [recentTopic, setRecentTopic] = useState<{ topic: string, date: string } | null>(null);

  // NEW: tracks every calendar date the app was opened, to power the streak dots
  const [activeDates, setActiveDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('local_buddy_active_dates');
    return saved ? JSON.parse(saved) : [];
  });

  // NEW: tracks WHEN each assignment was completed, keyed by assignment id
  const [completedDates, setCompletedDates] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('local_buddy_completed_dates');
    return saved ? JSON.parse(saved) : {};
  });

  // NEW: remembers what a topic's lastRevised date was *before* marking it
  // revised today, so a mistaken click can be undone
  const [revisionPreviousDates, setRevisionPreviousDates] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('local_buddy_revision_previous');
    return saved ? JSON.parse(saved) : {};
  });

  // NEW: remembers whether a topic had ever been genuinely revised
  // *before* this mark — so Undo can restore that too, not just the date
  const [revisionPreviousEverRevised, setRevisionPreviousEverRevised] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('local_buddy_revision_previous_ever');
    return saved ? JSON.parse(saved) : {};
  });

  // NEW: history of completed Low Motivation Mode suggestions
  const [completedSuggestions, setCompletedSuggestions] = useState<CompletedSuggestion[]>(() => {
    const saved = localStorage.getItem('local_buddy_motivation_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Progress State (loads from localStorage so it survives a refresh)
  const [progress, setProgress] = useState<ProgressState>(() => {
    const saved = localStorage.getItem('local_buddy_progress');
    return saved ? JSON.parse(saved) : { assignmentsCompleted: 0, topicsRevised: 0, studySessions: 0, streak: 1 };
  });

 const [trackedTopics, setTrackedTopics] = useState<string[]>(() => {
    const saved = localStorage.getItem('revision_topics');
    return saved ? JSON.parse(saved) : [];
  });
  // AI Planner State 
  const [prompt, setPrompt] = useState('');
  const [studyPlan, setStudyPlan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleAIRequest = async () => {
    if (!prompt.trim()) return;

    try {
      setIsLoading(true);
      const result = await generateStudyPlan(prompt);
      setStudyPlan(result);
      // NEW: count this as a study session
      setProgress(prev => ({ ...prev, studySessions: prev.studySessions + 1 }));
    } catch (error) {
      console.error(error);
      setStudyPlan("Failed to generate study plan.");
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: mark a revision topic as revised today
  const handleMarkRevised = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const topic = revisions.find(r => r.id === id);
    const alreadyRevisedToday = topic?.lastRevised === today;

    if (!alreadyRevisedToday && topic) {
      setRevisionPreviousDates(prev => ({ ...prev, [id]: topic.lastRevised }));
      setRevisionPreviousEverRevised(prev => ({ ...prev, [id]: topic.everRevised === true }));
    }

   const nextRevisions = revisions.map(r => r.id === id ? { ...r, lastRevised: today, everRevised: true } : r);
    setRevisions(nextRevisions);
    localStorage.setItem('local_buddy_revisions', JSON.stringify(nextRevisions));

    if (!alreadyRevisedToday) {
      setProgress(prev => ({ ...prev, topicsRevised: prev.topicsRevised + 1 }));
    }
  };

  // NEW: reverts a mistaken "mark revised today" click
  const handleUndoRevision = (id: string) => {
    const previousDate = revisionPreviousDates[id];
    if (!previousDate) return;

    const previousEverRevised = revisionPreviousEverRevised[id] ?? true; // safe fallback

    const nextRevisions = revisions.map(r => r.id === id ? { ...r, lastRevised: previousDate, everRevised: previousEverRevised } : r);
    setRevisions(nextRevisions);
    localStorage.setItem('local_buddy_revisions', JSON.stringify(nextRevisions));
    setProgress(prev => ({ ...prev, topicsRevised: Math.max(0, prev.topicsRevised - 1) }));

    setRevisionPreviousDates(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRevisionPreviousEverRevised(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleAddTopic = (newTopic: string) => {
    if (trackedTopics.includes(newTopic)) return;
    const updatedTopics = [newTopic, ...trackedTopics];
    setTrackedTopics(updatedTopics);
    localStorage.setItem('revision_topics', JSON.stringify(updatedTopics));
  };

  const handleClearTrackedTopics = () => {
    setTrackedTopics([]);
    localStorage.setItem('revision_topics', JSON.stringify([]));
  };

  // NEW: called when the student finishes a Low Motivation Mode suggestion
  const handleMotivationSuggestionCompleted = (suggestion: { reason: string; recommendedTask: string; minimumWin: string }) => {
    const entry: CompletedSuggestion = {
      id: Date.now().toString(),
      ...suggestion,
      completedAt: new Date().toISOString(),
    };
    setCompletedSuggestions(prev => [entry, ...prev]);
    setProgress(prev => ({ ...prev, studySessions: prev.studySessions + 1 }));
  };

  // Load Data on Start
  useEffect(() => {
    const savedTasks = localStorage.getItem('local_buddy_tasks');
    const savedRevisions = localStorage.getItem('local_buddy_revisions');
    const savedRecent = localStorage.getItem('local_buddy_recent');

    if (savedTasks) setAssignments(JSON.parse(savedTasks));
    if (savedRevisions) setRevisions(JSON.parse(savedRevisions));
    if (savedRecent) setRecentTopic(JSON.parse(savedRecent));

    if (!savedRevisions) {
      setRevisions([
        { id: '1', topic: 'Polymorphism', dateAdded: '2026-06-10', lastRevised: '2026-06-11', everRevised: true },
        { id: '2', topic: 'Linked Lists', dateAdded: '2026-06-15', lastRevised: '2026-06-18', everRevised: true }
      ]);
    }
    // Removed the hardcoded "Database Normalization" fallback — it was fake
    // placeholder data shown to every user. recentTopic now derives from real
    // revision data below instead.
  }, []);

  // Save progress whenever it changes
  useEffect(() => {
    localStorage.setItem('local_buddy_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('local_buddy_active_dates', JSON.stringify(activeDates));
  }, [activeDates]);

  // NEW: save completion dates whenever they change
  useEffect(() => {
    localStorage.setItem('local_buddy_completed_dates', JSON.stringify(completedDates));
  }, [completedDates]);

  useEffect(() => {
    localStorage.setItem('local_buddy_revision_previous', JSON.stringify(revisionPreviousDates));
  }, [revisionPreviousDates]);

  useEffect(() => {
    localStorage.setItem('local_buddy_revision_previous_ever', JSON.stringify(revisionPreviousEverRevised));
  }, [revisionPreviousEverRevised]);

  useEffect(() => {
    localStorage.setItem('local_buddy_motivation_history', JSON.stringify(completedSuggestions));
  }, [completedSuggestions]);

  // NEW: real day-streak calculation, runs once on app load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('local_buddy_last_active');
    setActiveDates(prev => prev.includes(today) ? prev : [...prev, today]);

    if (lastActive !== today) {
      setProgress(prev => {
        let newStreak = 1;
        if (lastActive) {
          const diffDays = Math.round(
            (new Date(today).getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays === 1) {
            newStreak = prev.streak + 1; // visited yesterday too -> streak grows
          } else if (diffDays <= 0) {
            newStreak = prev.streak; // safety guard
          }
          // diffDays > 1 means a day was missed -> stays reset at 1
        }
        return { ...prev, streak: newStreak };
      });
      localStorage.setItem('local_buddy_last_active', today);
    }
  }, []);

  // Helper to calculate days ago
  const getDaysAgo = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const diffDays = Math.round(
      (new Date(today).getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays;
  };

  // NEW: format an ISO date nicely, e.g. "Jun 20, 2026"
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Find most urgent items for the Recommendation Engine
  const urgentAssignment = assignments.filter(a => !a.completed).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const overdueRevision = [...revisions].sort((a, b) => new Date(a.lastRevised).getTime() - new Date(b.lastRevised).getTime())[0];

  // NEW: overdue assignments — not completed AND past their due date, soonest-overdue first
  const overdueAssignmentsSorted = assignments
    .filter(a => !a.completed && new Date(a.dueDate) < new Date())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // NEW: derive "recent topic" from real revision data instead of fake seed data
  const mostRecentRevision = revisions.length > 0
    ? [...revisions].sort((a, b) => new Date(b.lastRevised).getTime() - new Date(a.lastRevised).getTime())[0]
    : null;
  const effectiveRecentTopic = recentTopic || (mostRecentRevision
    ? { topic: mostRecentRevision.topic, date: mostRecentRevision.lastRevised }
    : null);

  // NEW: real completed count, computed directly from actual data (no drift)
  const completedCount = assignments.filter(a => a.completed).length;
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  // NEW: completed assignments, newest completed first
  const completedAssignmentsSorted = assignments
    .filter(a => a.completed)
    .sort((a, b) => {
      const dateA = completedDates[a.id] ? new Date(completedDates[a.id]).getTime() : 0;
      const dateB = completedDates[b.id] ? new Date(completedDates[b.id]).getTime() : 0;
      return dateB - dateA;
    });

  // NEW: revisions sorted most-recently-revised first
  const revisionsSorted = [...revisions].sort(
    (a, b) => new Date(b.lastRevised).getTime() - new Date(a.lastRevised).getTime()
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#020617', color: '#fff', fontFamily: 'sans-serif', padding: '20px', maxWidth: '900px', margin: '0 auto' }}>

      {/* ========================================== */}
      {/* TOP FIXED PANEL — never scrolls            */}
      {/* ========================================== */}
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Assignment Buddy Workspace 🚀</h1>

        {/* Progress metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{completedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Assignments Done</div>
          </div>
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c084fc' }}>{progress.topicsRevised}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Topics Revised</div>
          </div>
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{progress.studySessions}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Study Sessions</div>
          </div>
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>{progress.streak}🔥</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Day Streak</div>
          </div>
        </div>

        {/* Low Motivation Mode banner */}
        <div style={{ background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)', borderRadius: '20px', padding: '24px', color: '#fff', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            <Info size={14} /> The heart of this app
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ maxWidth: '65%' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Heart size={24} /> Low Motivation Mode
              </h2>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4', opacity: 0.9 }}>
                Made for the days you can't bring yourself to study. Pick how you feel and we'll suggest a gentle next step using your actual data.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              style={{ background: '#fff', color: '#6b21a8', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
            >
              Enter Mode
            </button>
          </div>
        </div>

        {/* Horizontal navigation row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('all')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'all' ? '#3b82f6' : '#1e293b', color: '#fff' }}>📋 All Tasks</button>
          <button onClick={() => setActiveTab('overdue')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'overdue' ? '#3b82f6' : '#1e293b', color: '#fff' }}>⚠️ Overdue</button>
          <button onClick={() => setActiveTab('calendar')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'calendar' ? '#3b82f6' : '#1e293b', color: '#fff' }}>📅 Calendar</button>
          <button onClick={() => setActiveTab('revision')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'revision' ? '#3b82f6' : '#1e293b', color: '#fff' }}>🔮 Revision</button>
          <button onClick={() => setActiveTab('planner')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'planner' ? '#3b82f6' : '#1e293b', color: '#fff' }}>🤖 AI Planner</button>
          <button onClick={() => setActiveTab('history')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'history' ? '#3b82f6' : '#1e293b', color: '#fff' }}>📊 History</button>
        </div>
      </div>

      {/* ========================================== */}
      {/* BOTTOM SCROLLABLE WORKSPACE                 */}
      {/* ========================================== */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: '20px', paddingBottom: '40px' }}>

        {activeTab === 'all' && (
          <>
            {/* Recommended for you today */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#fff', margin: '0 0 16px 0' }}>
                <Zap size={20} color="#eab308" /> Recommended for you today
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {urgentAssignment ? (
                  <div style={{ border: '1px solid #334155', borderRadius: '16px', padding: '20px', background: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <AlertTriangle size={18} color="#ef4444" />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#f87171', background: '#7f1d1d', padding: '2px 8px', borderRadius: '12px' }}>High Priority Task</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fff' }}>{urgentAssignment.title}</h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>Due: {urgentAssignment.dueDate} · Est: 20 min</p>
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Why this recommendation?</strong>
                      • Closest upcoming deadline<br/>• Quick task to complete<br/>• Helps reduce workload early
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #334155', borderRadius: '16px', padding: '20px', background: '#0f172a', display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>✅ No urgent assignments right now.</span>
                  </div>
                )}

                {overdueRevision && (
                  <div style={{ border: '1px solid #334155', borderRadius: '16px', padding: '20px', background: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <RotateCcw size={18} color="#c084fc" />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#e9d5ff', background: '#581c87', padding: '2px 8px', borderRadius: '12px' }}>Smart Revision</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fff' }}>{overdueRevision.topic}</h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>{overdueRevision.everRevised === false ? "You haven't revised this yet" : `Last revised ${getDaysAgo(overdueRevision.lastRevised)} days ago`}</p>
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Why this recommendation?</strong>
                      • Memory fades without review<br/>• Reinforces your foundation
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent & Revision */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#10b981"/> Recent & Revision</h3>

              {effectiveRecentTopic && (
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Last studied {getDaysAgo(effectiveRecentTopic.date)} days ago</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>{effectiveRecentTopic.topic}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setActiveTab('revision')}
                      style={{ flex: 1, padding: '8px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Revise Now
                    </button>
                    <button
                      onClick={() => { setPrompt(effectiveRecentTopic.topic); setActiveTab('planner'); }}
                      style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #334155', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Add to Planner
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Revision Status</div>
                {revisions.map(rev => {
                  const isOverdue = getDaysAgo(rev.lastRevised) > 7;
                  return (
                    <div key={rev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: '#fff' }}>{rev.topic}</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px' }}>{rev.everRevised === false ? 'Not revised yet' : `Last revised: ${getDaysAgo(rev.lastRevised)}d ago`}</div>
                      </div>
                      {isOverdue ? (
                        <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14}/> Recommended</span>
                      ) : (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14}/> Good</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assignment Tracker — full list */}
            <AssignmentTracker
              assignments={assignments}
              onAddAssignment={(task: any) => {
                const nextList = [task, ...assignments];
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));
              }}
              onToggleComplete={(id: string) => {
                const nextList = assignments.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));

                const toggledItem = nextList.find(t => t.id === id);
                if (toggledItem?.completed) {
                  setCompletedDates(prev => ({ ...prev, [id]: new Date().toISOString() }));
                } else {
                  setCompletedDates(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                }
              }}
              onDeleteAssignment={(id: string) => {
                const nextList = assignments.filter(t => t.id !== id);
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));
              }}
            />
          </>
        )}

        {activeTab === 'overdue' && (
          overdueAssignmentsSorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>🎉 Awesome job! You have no overdue assignments.</div>
          ) : (
            <AssignmentTracker
              assignments={overdueAssignmentsSorted}
              onAddAssignment={(task: any) => {
                const nextList = [task, ...assignments];
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));
              }}
              onToggleComplete={(id: string) => {
                const nextList = assignments.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));

                const toggledItem = nextList.find(t => t.id === id);
                if (toggledItem?.completed) {
                  setCompletedDates(prev => ({ ...prev, [id]: new Date().toISOString() }));
                } else {
                  setCompletedDates(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                }
              }}
              onDeleteAssignment={(id: string) => {
                const nextList = assignments.filter(t => t.id !== id);
                setAssignments(nextList);
                localStorage.setItem('local_buddy_tasks', JSON.stringify(nextList));
              }}
            />
          )
        )}

        {activeTab === 'calendar' && (
          <div>Calendar view placeholder</div>
        )}

      {activeTab === 'revision' && (
          <>
            <RevisionHub
              onAddTopic={(topicName: string) => {
                const trimmedName = topicName.trim();
                if (!trimmedName) return;

                // Only create a new entry if this topic isn't already tracked
                // (case-insensitive, so "circular LL" and "Circular LL" don't duplicate)
                const alreadyExists = revisions.some(
                  r => r.topic.toLowerCase() === trimmedName.toLowerCase()
                );

                if (!alreadyExists) {
                  const newTopic = {
                    id: Date.now().toString(),
                    topic: trimmedName,
                    dateAdded: new Date().toISOString().split('T')[0],
                    lastRevised: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    everRevised: false
                  };
                  const nextRevisions = [newTopic, ...revisions];
                  setRevisions(nextRevisions);
                  localStorage.setItem('local_buddy_revisions', JSON.stringify(nextRevisions));
                  // topicsRevised is intentionally NOT touched here —
                  // only handleMarkRevised should increment it.
                }

                handleAddTopic(trimmedName);
              }}
            />

            {/* NEW: Tracked Topics dashboard box */}
            <div style={{ marginTop: '20px', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>📌 Tracked Topics</div>
                {trackedTopics.length > 0 && (
                  <button
                    onClick={handleClearTrackedTopics}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              {trackedTopics.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>No topics tracked yet. Add one above.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {trackedTopics.map((topic, i) => (
                    <span key={i} style={{ background: '#1e293b', color: '#e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', border: '1px solid #334155' }}>
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {activeTab === 'planner' && (
          <div style={{ padding: '24px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your study topic..."
              style={{ width: '100%', padding: '12px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', marginBottom: '10px', height: '100px' }}
            />
            <button onClick={handleAIRequest} disabled={isLoading} style={{ width: '100%', padding: '12px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              {isLoading ? 'Generating...' : 'Generate Study Plan'}
            </button>

            {studyPlan && (
              <div style={{ marginTop: '20px', color: '#e2e8f0', lineHeight: '1.6' }}>
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...rest }: any) => <h1 style={{ fontSize: '22px', margin: '16px 0 8px', color: '#fff' }} {...rest} />,
                    h2: ({ node, ...rest }: any) => <h2 style={{ fontSize: '19px', margin: '16px 0 8px', color: '#fff' }} {...rest} />,
                    h3: ({ node, ...rest }: any) => <h3 style={{ fontSize: '16px', margin: '14px 0 6px', color: '#fff' }} {...rest} />,
                    p: ({ node, ...rest }: any) => <p style={{ margin: '8px 0' }} {...rest} />,
                    strong: ({ node, ...rest }: any) => <strong style={{ color: '#fff' }} {...rest} />,
                    ul: ({ node, ...rest }: any) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }} {...rest} />,
                    ol: ({ node, ...rest }: any) => <ol style={{ paddingLeft: '20px', margin: '8px 0' }} {...rest} />,
                    li: ({ node, ...rest }: any) => <li style={{ marginBottom: '4px' }} {...rest} />,
                    code: ({ node, ...rest }: any) => <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }} {...rest} />,
                  }}
                >
                  {studyPlan}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {/* Progress Insights */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#3b82f6" /> Progress Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div
                  onClick={() => document.getElementById('assignment-history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  title="Click to view Assignment History"
                  style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#3b82f6' }}>{completedCount}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Assignments Completed ↓</div>
                </div>
                <div
                  onClick={() => document.getElementById('revision-history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  title="Click to view Revision History"
                  style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#c084fc' }}>{progress.topicsRevised}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Topics Revised ↓</div>
                </div>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#eab308' }}>{progress.streak}🔥</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Current Streak</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {last7Days.map(d => (
                      <div key={d} title={d} style={{ width: '10px', height: '10px', borderRadius: '3px', background: activeDates.includes(d) ? '#eab308' : '#1e293b' }} />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', padding: '16px', borderRadius: '12px', border: '1px solid #334155', fontSize: '14px', color: '#cbd5e1' }}>
                🔥 You're on a <strong style={{ color: '#fff' }}>{progress.streak}-day streak</strong>. So far you've completed <strong style={{ color: '#fff' }}>{completedCount} assignment{completedCount === 1 ? '' : 's'}</strong> and revised <strong style={{ color: '#fff' }}>{progress.topicsRevised} topic{progress.topicsRevised === 1 ? '' : 's'}</strong>. Keep it going!
              </div>
            </div>

            {/* Assignment History */}
            <div id="assignment-history-section" style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} color="#10b981" /> Assignment History
              </h3>
              {completedAssignmentsSorted.length === 0 ? (
                <div style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', color: '#94a3b8', fontSize: '14px' }}>
                  No assignments completed yet. Finish your first one in the All Tasks tab to see it show up here.
                </div>
              ) : (
                <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  {completedAssignmentsSorted.map((a, index) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderBottom: index === completedAssignmentsSorted.length - 1 ? 'none' : '1px solid #1e293b'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle size={16} color="#10b981" />
                        <div>
                          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{a.title}</div>
                          {(a as any).subject && (
                            <div style={{ color: '#94a3b8', fontSize: '12px' }}>{(a as any).subject}</div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {completedDates[a.id] ? formatDate(completedDates[a.id]) : 'Completed'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revision History (Timeline) */}
            <div id="revision-history-section">
              <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} color="#c084fc" /> Revision History
              </h3>
              {revisionsSorted.length === 0 ? (
                <div style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', color: '#94a3b8', fontSize: '14px' }}>
                  No revision activity yet.
                </div>
              ) : (
                <div style={{ borderLeft: '2px solid #334155', paddingLeft: '20px', marginLeft: '8px' }}>
                  {revisionsSorted.map(rev => (
                    <div key={rev.id} style={{ position: 'relative', marginBottom: '20px' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-26px',
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: getDaysAgo(rev.lastRevised) > 7 ? '#eab308' : '#10b981'
                      }} />
                      <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{rev.topic}</div>
                          <div style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Clock size={12} /> {rev.everRevised === false ? 'Not revised yet' : `Last revised ${getDaysAgo(rev.lastRevised)} day${getDaysAgo(rev.lastRevised) === 1 ? '' : 's'} ago`}
                          </div>
                        </div>
                        {(() => {
                          const revisedToday = getDaysAgo(rev.lastRevised) === 0;
                          const canUndo = revisedToday && revisionPreviousDates[rev.id];

                          if (canUndo) {
                            return (
                              <button
                                onClick={() => handleUndoRevision(rev.id)}
                                style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', color: '#fbbf24', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                              >
                                ✓ Revised today — Undo
                              </button>
                            );
                          }

                          if (revisedToday) {
                            return (
                              <span style={{ padding: '6px 14px', color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
                                ✓ Already up to date
                              </span>
                            );
                          }

                          return (
                            <button
                              onClick={() => handleMarkRevised(rev.id)}
                              style={{ padding: '6px 14px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                              Mark revised today
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low-Motivation Wins */}
            {completedSuggestions.length > 0 && (
              <div style={{ marginTop: '28px' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Heart size={20} color="#f472b6" /> Low-Motivation Wins
                </h3>
                <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  {completedSuggestions.slice(0, 10).map((s, index) => (
                    <div key={s.id} style={{ padding: '14px 16px', borderBottom: index === Math.min(completedSuggestions.length, 10) - 1 ? 'none' : '1px solid #1e293b' }}>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{s.minimumWin}</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                        Reason: {s.reason} · {formatDate(s.completedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The Hidden Low Motivation Engine */}
      <LowMotivationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignments={assignments}
        revisions={revisions}
        recentTopic={effectiveRecentTopic}
        onSuggestionCompleted={handleMotivationSuggestionCompleted}
      />
    </div>
  );
}