// src/LowMotivationModal.tsx
import { useState, useEffect } from 'react';
import { X, Wind, BookOpen, List, RotateCcw, PenTool, CheckCircle, Plus, Info, Zap, MessageSquare } from 'lucide-react';
import { generateMotivationSuggestion, type MotivationSuggestion } from './gemini';

const reasonLabels: Record<string, string> = {
  tired: 'Mentally tired',
  overwhelmed: 'Overwhelmed',
  unsure: "Don't know what to study",
  other: 'Something else',
};

export function LowMotivationModal({ isOpen, onClose, assignments = [], revisions = [], recentTopic = null, onSuggestionCompleted }: any) {
  const [reason, setReason] = useState<string | null>(null);
  const [lowDayTasks, setLowDayTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');

  // NEW: AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<MotivationSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // NEW: reset everything when the modal closes, so reopening starts fresh
  useEffect(() => {
    if (!isOpen) {
      setReason(null);
      setAiSuggestion(null);
      setAiLoading(false);
    }
  }, [isOpen]);

  // NEW: fetch an AI suggestion whenever a reason is picked
  const fetchSuggestion = async (reasonId: string) => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const today = new Date();
      const context = {
        reason: reasonLabels[reasonId] || 'Something else',
        overdueAssignments: assignments
          .filter((a: any) => !a.completed && new Date(a.dueDate) < today)
          .map((a: any) => ({ title: a.title, dueDate: a.dueDate })),
        upcomingAssignments: assignments
          .filter((a: any) => !a.completed && new Date(a.dueDate) >= today)
          .map((a: any) => ({ title: a.title, dueDate: a.dueDate })),
        revisionTopics: revisions.map((r: any) => ({ topic: r.topic, lastRevised: r.lastRevised })),
        recentTopic: recentTopic?.topic || null,
      };
      const result = await generateMotivationSuggestion(context);
      setAiSuggestion(result);
    } catch (err) {
      console.error('Motivation suggestion failed:', err);
      setAiSuggestion(null); // falls back to the static suggestions below
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (reason) {
      fetchSuggestion(reason);
    }
  }, [reason]);

  if (!isOpen) return null;

  // --- SMART ENGINE LOGIC (fallback suggestions if AI is loading or fails) ---
  const urgentAssignment = assignments.filter((a: any) => !a.completed).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const overdueRevision = [...revisions].sort((a: any, b: any) => new Date(a.lastRevised).getTime() - new Date(b.lastRevised).getTime())[0];

  const handleAddTask = () => {
    if (newTask.trim()) {
      setLowDayTasks([...lowDayTasks, newTask]);
      setNewTask('');
    }
  };

  // NEW: called when the student taps "I completed this"
  const handleSuggestionDone = () => {
    if (aiSuggestion && reason) {
      onSuggestionCompleted?.({
        reason: reasonLabels[reason] || 'Something else',
        recommendedTask: aiSuggestion.recommendedTask,
        minimumWin: aiSuggestion.minimumWin,
      });
    }
    onClose();
  };

  const renderMenu = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', padding: '12px', background: '#f3e8ff', borderRadius: '50%', marginBottom: '12px' }}>
          <Info size={24} color="#9333ea" />
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1e293b' }}>Low motivation mode</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Why don't you feel like studying today?</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[
          { id: 'tired', icon: <Info size={18} />, label: "I'm mentally tired" },
          { id: 'overwhelmed', icon: <Zap size={18} />, label: "I feel overwhelmed" },
          { id: 'unsure', icon: <Info size={18} />, label: "I don't know what to study" },
          { id: 'other', icon: <MessageSquare size={18} />, label: "Something else" }
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setReason(item.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', color: '#334155', fontWeight: '500', fontSize: '15px', transition: 'all 0.2s' }}
          >
            <span style={{ color: '#64748b' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  // NEW: renders the AI-generated suggestion card
  const renderAiSuggestion = () => {
    if (aiLoading) {
      return (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          ✨ Finding something gentle for you...
        </div>
      );
    }

    if (!aiSuggestion) return null;

    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '16px', marginBottom: '16px', color: '#5b21b6', fontSize: '14px', fontWeight: '500' }}>
          💜 {aiSuggestion.encouragement}
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Recommended Focus</div>
          <div style={{ color: '#1e293b', fontSize: '15px', fontWeight: '600' }}>{aiSuggestion.recommendedTask}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {aiSuggestion.tinyTasks.map((task, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ color: '#334155', fontSize: '14px' }}>{task}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#a16207', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Minimum Win</div>
          <div style={{ color: '#1e293b', fontSize: '14px' }}>{aiSuggestion.minimumWin}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => reason && fetchSuggestion(reason)}
            style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: '500', fontSize: '13px' }}
          >
            🔄 Try Another Suggestion
          </button>
          <button
            onClick={handleSuggestionDone}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
          >
            <CheckCircle size={16} /> I completed this
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    let title = "Try one small thing";
    let subtitle = "";
    let options: any[] = [];

    if (reason === 'tired') {
      subtitle = "Go gentle today. Try one tiny reset — that counts.";
      options = [
        { icon: <Wind size={20} color="#8b5cf6"/>, title: "5-min box breathing", desc: "Inhale 4s • hold 4s • exhale 4s • hold 4s. Repeat for 5 minutes." },
        { icon: <BookOpen size={20} color="#8b5cf6"/>, title: recentTopic ? `Read notes: ${recentTopic.topic}` : "Read your notes", desc: "Just skim — no highlighter, no pressure. Re-exposure is enough." },
        { icon: <List size={20} color="#8b5cf6"/>, title: "Organize tomorrow's tasks", desc: "Pick 3 tiny things future-you will thank you for." }
      ];
    } else if (reason === 'overwhelmed') {
      subtitle = "Pick just one small thing. Progress beats perfection.";
      options = [
        ...(urgentAssignment ? [{ icon: <RotateCcw size={20} color="#3b82f6"/>, title: urgentAssignment.title, desc: `Due: ${urgentAssignment.dueDate} - Focus only on this.` }] : []),
        ...(overdueRevision ? [{ icon: <RotateCcw size={20} color="#8b5cf6"/>, title: overdueRevision.topic, desc: "You've studied this before. 10 minutes of re-reading is enough." }] : []),
        { icon: <PenTool size={20} color="#64748b"/>, title: "Write down what's bothering you", desc: "2 minutes — get it on paper so it stops circling in your head." }
      ];
    } else if (reason === 'unsure') {
      subtitle = "Here are some low-effort ways to keep momentum.";
      options = [
        ...(overdueRevision ? [{ icon: <RotateCcw size={20} color="#8b5cf6"/>, title: `Revise: ${overdueRevision.topic}`, desc: `Not reviewed recently. Estimated effort: ~15 min` }] : []),
        ...(urgentAssignment ? [{ icon: <RotateCcw size={20} color="#3b82f6"/>, title: `Task: ${urgentAssignment.title}`, desc: `Closest deadline. Estimated effort: ~20 min` }] : []),
        ...(recentTopic ? [{ icon: <RotateCcw size={20} color="#10b981"/>, title: `Continue: ${recentTopic.topic}`, desc: "Your most recent topic — pick up where you left off." }] : [])
      ];
      if (options.length === 0) {
        options = [{ icon: <BookOpen size={20} color="#8b5cf6"/>, title: "Start a new topic", desc: "Open your planner and choose one easy concept to read." }];
      }
    }

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => setReason(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
             ← Back
          </button>
        </div>
        
        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#1e293b' }}>{title}</h2>
        <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>{subtitle}</p>

        {renderAiSuggestion()}

        {!aiLoading && !aiSuggestion && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
                <div style={{ marginTop: '2px' }}>{opt.icon}</div>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '15px' }}>{opt.title}</div>
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Your Low-Day Plan Section */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1e293b' }}>Your low-day plan</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>Things past-you planned for days like today.</p>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input 
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="e.g. 10 min walk, watch a recap..."
              style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
            />
            <button onClick={handleAddTask} style={{ padding: '0 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#334155' }}>
              <Plus size={20} />
            </button>
          </div>
          
          {lowDayTasks.map((task, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '14px' }}>• {task}</div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: 'none', border: 'none', color: '#64748b', fontWeight: '500', cursor: 'pointer' }}>Maybe later</button>
            <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
              <CheckCircle size={18} /> Done
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: reason ? '0' : '-24px' }}>
          {!reason && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>}
        </div>
        {!reason ? renderMenu() : renderContent()}
      </div>
    </div>
  );
}