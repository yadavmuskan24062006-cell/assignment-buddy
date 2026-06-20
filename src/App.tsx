import { useState, useEffect } from 'react';
import { AssignmentTracker, type Assignment } from './AssignmentTracker';
import { RevisionHub } from './RevisionHub';
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
}

interface ProgressState {
  assignmentsCompleted: number;
  topicsRevised: number;
  studySessions: number;
  streak: number;
}

export default function App() {
  // Navigation & Modal State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'tracker' | 'revision' | 'history'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Core Data State
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [revisions, setRevisions] = useState<RevisionTopic[]>([]);
  const [recentTopic, setRecentTopic] = useState<{ topic: string, date: string } | null>(null);

  // NEW: tracks WHEN each assignment was completed, keyed by assignment id
  const [completedDates, setCompletedDates] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('local_buddy_completed_dates');
    return saved ? JSON.parse(saved) : {};
  });

  // Progress State (loads from localStorage so it survives a refresh)
  const [progress, setProgress] = useState<ProgressState>(() => {
    const saved = localStorage.getItem('local_buddy_progress');
    return saved ? JSON.parse(saved) : { assignmentsCompleted: 0, topicsRevised: 0, studySessions: 0, streak: 1 };
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
    const nextRevisions = revisions.map(r => r.id === id ? { ...r, lastRevised: today } : r);
    setRevisions(nextRevisions);
    localStorage.setItem('local_buddy_revisions', JSON.stringify(nextRevisions));
    setProgress(prev => ({ ...prev, topicsRevised: prev.topicsRevised + 1 }));
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
        { id: '1', topic: 'Polymorphism', dateAdded: '2026-06-10', lastRevised: '2026-06-11' },
        { id: '2', topic: 'Linked Lists', dateAdded: '2026-06-15', lastRevised: new Date().toISOString().split('T')[0] }
      ]);
    }
    if (!savedRecent) {
      setRecentTopic({ topic: 'Database Normalization', date: new Date().toISOString().split('T')[0] });
    }
  }, []);

  // Save progress whenever it changes
  useEffect(() => {
    localStorage.setItem('local_buddy_progress', JSON.stringify(progress));
  }, [progress]);

  // NEW: save completion dates whenever they change
  useEffect(() => {
    localStorage.setItem('local_buddy_completed_dates', JSON.stringify(completedDates));
  }, [completedDates]);

  // NEW: real day-streak calculation, runs once on app load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('local_buddy_last_active');

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
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // NEW: format an ISO date nicely, e.g. "Jun 20, 2026"
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Find most urgent items for the Recommendation Engine
  const urgentAssignment = assignments.filter(a => !a.completed).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const overdueRevision = [...revisions].sort((a, b) => new Date(a.lastRevised).getTime() - new Date(b.lastRevised).getTime())[0];

  // NEW: real completed count, computed directly from actual data (no drift)
  const completedCount = assignments.filter(a => a.completed).length;

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
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif', background: '#020617', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Assignment Buddy Workspace 🚀</h1>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'dashboard' ? '#3b82f6' : '#1e293b', color: '#fff' }}>🏠 Dashboard</button>
        <button onClick={() => setActiveTab('planner')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'planner' ? '#3b82f6' : '#1e293b', color: '#fff' }}>🤖 AI Planner</button>
        <button onClick={() => setActiveTab('tracker')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'tracker' ? '#3b82f6' : '#1e293b', color: '#fff' }}>📝 Tracker</button>
        <button onClick={() => setActiveTab('revision')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'revision' ? '#3b82f6' : '#1e293b', color: '#fff' }}>🔮 Revision</button>
        <button onClick={() => setActiveTab('history')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'history' ? '#3b82f6' : '#1e293b', color: '#fff' }}>📊 History</button>
      </div>

      {/* ========================================== */}
      {/* DASHBOARD TAB (The Student Companion View) */}
      {/* ========================================== */}
      {activeTab === 'dashboard' && (
        <>
          {/* 1. Low Motivation Mode Hero Banner */}
          <div style={{ background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)', borderRadius: '20px', padding: '32px', color: '#fff', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', marginBottom: '16px' }}>
              <Info size={14} /> The heart of this app
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ maxWidth: '65%' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Heart size={28} /> Low Motivation Mode
                </h2>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', opacity: 0.9 }}>
                  Made for the days you can't bring yourself to study. Pick how you feel and we'll suggest a gentle next step using your actual data.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{ background: '#fff', color: '#6b21a8', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              >
                Enter Mode
              </button>
            </div>
          </div>

          {/* 2. Recommended For You Today */}
          <div style={{ marginBottom: '32px' }}>
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
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>Last revised {getDaysAgo(overdueRevision.lastRevised)} days ago</p>
                  <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Why this recommendation?</strong>
                    • Memory fades without review<br/>• Reinforces your foundation
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* 3. Your Progress This Week */}
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} color="#3b82f6"/> Your progress this week</h3>
                 <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>View Full History →</button>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
            </div>

            {/* 4. Recent Study Topic & Smart Revision List */}
            <div>
               <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#10b981"/> Recent & Revision</h3>

               {recentTopic && (
                 <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '16px' }}>
                   <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Last studied {getDaysAgo(recentTopic.date)} days ago</div>
                   <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>{recentTopic.topic}</div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                     <button
                       onClick={() => setActiveTab('revision')}
                       style={{ flex: 1, padding: '8px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                     >
                       Revise Now
                     </button>
                     <button
                       onClick={() => { setPrompt(recentTopic.topic); setActiveTab('planner'); }}
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
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>Last revised: {getDaysAgo(rev.lastRevised)}d ago</div>
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
          </div>
        </>
      )}

      {/* ========================================== */}
      {/* AI PLANNER TAB                              */}
      {/* ========================================== */}
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

      {activeTab === 'tracker' && (
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
              // Just marked complete -> record today as the completion date
              setCompletedDates(prev => ({ ...prev, [id]: new Date().toISOString() }));
            } else {
              // Un-marked -> remove its completion date
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
      )}

      {activeTab === 'revision' && (
        <RevisionHub />
      )}

      {/* ========================================== */}
      {/* HISTORY TAB (NEW)                           */}
      {/* ========================================== */}
      {activeTab === 'history' && (
        <div>
          {/* Progress Insights */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#3b82f6" /> Progress Insights
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#3b82f6' }}>{completedCount}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Assignments Completed</div>
              </div>
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#c084fc' }}>{progress.topicsRevised}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Topics Revised</div>
              </div>
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#eab308' }}>{progress.streak}🔥</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Current Streak</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', padding: '16px', borderRadius: '12px', border: '1px solid #334155', fontSize: '14px', color: '#cbd5e1' }}>
              🔥 You're on a <strong style={{ color: '#fff' }}>{progress.streak}-day streak</strong>. So far you've completed <strong style={{ color: '#fff' }}>{completedCount} assignment{completedCount === 1 ? '' : 's'}</strong> and revised <strong style={{ color: '#fff' }}>{progress.topicsRevised} topic{progress.topicsRevised === 1 ? '' : 's'}</strong>. Keep it going!
            </div>
          </div>

          {/* Assignment History */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} color="#10b981" /> Assignment History
            </h3>
            {completedAssignmentsSorted.length === 0 ? (
              <div style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', color: '#94a3b8', fontSize: '14px' }}>
                No assignments completed yet. Finish your first one in the Tracker tab to see it show up here.
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
          <div>
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
                          <Clock size={12} /> Last revised {getDaysAgo(rev.lastRevised)} day{getDaysAgo(rev.lastRevised) === 1 ? '' : 's'} ago
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkRevised(rev.id)}
                        style={{ padding: '6px 14px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        Mark revised today
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The Hidden Low Motivation Engine */}
      <LowMotivationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignments={assignments}
        revisions={revisions}
        recentTopic={recentTopic}
      />
    </div>
  );
}