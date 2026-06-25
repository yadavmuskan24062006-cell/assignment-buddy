import React, { useState, useEffect } from 'react';
import { X, Heart, Sparkles, CheckCircle, Plus, Trash2, Info, Zap, MessageSquare } from 'lucide-react';
import { generateMotivationSuggestion, type MotivationSuggestion } from './gemini';

interface LowMotivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: any[];
  revisions: any[];
  recentTopic: { topic: string; date: string } | null;
  onSuggestionCompleted: (suggestion: { reason: string; recommendedTask: string; minimumWin: string }) => void;
}

// Maps each button's display label to the exact phrase gemini.ts's
// reasonGuidance lookup expects (it matches on .toLowerCase()).
// Without this, every mood would silently fall back to generic guidance.
const reasonGuidanceLabel: Record<string, string> = {
  "I'm mentally tired": 'Mentally tired',
  "I feel overwhelmed": 'Overwhelmed',
  "I don't know what to study": "Don't know what to study",
  "Something else": 'Something else',
};

export const LowMotivationModal: React.FC<LowMotivationModalProps> = ({
  isOpen,
  onClose,
  assignments,
  revisions,
  recentTopic,
  onSuggestionCompleted,
}) => {
  // Core state management
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [newActivityInput, setNewActivityInput] = useState<string>('');
  const [showSuccessScreen, setShowSuccessScreen] = useState<boolean>(false);

  // NEW: real Gemini-grounded suggestion state (replaces the old static aiSuggestionSets)
  const [aiSuggestion, setAiSuggestion] = useState<MotivationSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Read user rescue plan items from localStorage
  const [rescuePlanItems, setRescuePlanItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('local_buddy_rescue_plan');
    return saved ? JSON.parse(saved) : [];
  });

  const handleAddActivity = () => {
    if (!newActivityInput.trim()) return;
    const updatedPlan = [...rescuePlanItems, newActivityInput.trim()];
    setRescuePlanItems(updatedPlan);
    localStorage.setItem('local_buddy_rescue_plan', JSON.stringify(updatedPlan));
    setNewActivityInput('');
  };

  const handleDeleteActivity = (indexToDelete: number) => {
    const updatedPlan = rescuePlanItems.filter((_, idx) => idx !== indexToDelete);
    setRescuePlanItems(updatedPlan);
    localStorage.setItem('local_buddy_rescue_plan', JSON.stringify(updatedPlan));
  };

  // Extract actual topic contexts (still used for the "Based on:" tags)
  const activeAssignment = assignments.find((a) => !a.completed)?.title || 'Current Assignment';
  const activeRevision = revisions && revisions[0]?.topic ? revisions[0].topic : 'Revision Topics';
  const lastStudied = recentTopic?.topic || 'Recent Review';

  // NEW: fetches a real, data-grounded suggestion from Gemini
  const fetchSuggestion = async (moodLabel: string, previous?: MotivationSuggestion | null) => {
    if (aiLoading) return; // prevents double-fetches if clicked rapidly
    setAiLoading(true);
    try {
      const today = new Date();
      const context = {
        reason: reasonGuidanceLabel[moodLabel] || 'Something else',
        overdueAssignments: assignments
          .filter((a: any) => !a.completed && new Date(a.dueDate) < today)
          .map((a: any) => ({ title: a.title, dueDate: a.dueDate })),
        upcomingAssignments: assignments
          .filter((a: any) => !a.completed && new Date(a.dueDate) >= today)
          .map((a: any) => ({ title: a.title, dueDate: a.dueDate })),
        revisionTopics: revisions.map((r: any) => ({ topic: r.topic, lastRevised: r.lastRevised })),
        recentTopic: recentTopic?.topic || null,
        previousSuggestion: previous ? `${previous.recommendedTask} — ${previous.tinyTasks.join(', ')}` : undefined,
      };
      // Always show the loading state for at least 700ms, even if the
      // AI responds faster — prevents the "sometimes instant, sometimes
      // 2 seconds" inconsistency from feeling broken.
      const minDelay = new Promise(resolve => setTimeout(resolve, 700));
      const [result] = await Promise.all([
        generateMotivationSuggestion(context),
        minDelay
      ]);
      setAiSuggestion(result);
    } catch (err) {
      console.error('Motivation suggestion failed:', err);
      // leave whatever was previously shown (if anything) rather than wiping the card
    } finally {
      setAiLoading(false);
    }
  };

  // NEW: fetch fresh whenever a NEW mood is selected; clear when going "back"
  useEffect(() => {
    if (selectedMood) {
      fetchSuggestion(selectedMood, null);
    } else {
      setAiSuggestion(null);
    }
  }, [selectedMood]);

  // NEW: reset everything when the modal closes, so reopening starts fresh
  useEffect(() => {
    if (!isOpen) {
      setSelectedMood(null);
      setAiSuggestion(null);
      setAiLoading(false);
      setShowSuccessScreen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTryAnotherSuggestions = () => {
    if (selectedMood) {
      fetchSuggestion(selectedMood, aiSuggestion);
    }
  };

  const handleFinishWin = () => {
    if (!aiSuggestion) return;
    onSuggestionCompleted({
      reason: selectedMood ? (reasonGuidanceLabel[selectedMood] || selectedMood) : 'Low Motivation',
      recommendedTask: aiSuggestion.recommendedTask,
      minimumWin: aiSuggestion.minimumWin,
    });
    setShowSuccessScreen(true);
  };

  const handleFinalClose = () => {
    setShowSuccessScreen(false);
    setSelectedMood(null);
    onClose();
  };

  const moodOptions = [
    { label: "I'm mentally tired", icon: <Info size={18} color="#64748b" /> },
    { label: "I feel overwhelmed", icon: <Zap size={18} color="#64748b" /> },
    { label: "I don't know what to study", icon: <Info size={18} color="#64748b" /> },
    { label: "Something else", icon: <MessageSquare size={18} color="#64748b" /> },
  ];

  // NEW: reused on BOTH the entry screen (pre-planning) and the diagnostic
  // screen (in-the-moment reminder) — same state, same data, one place to edit.
  const renderRescuePlan = () => (
    <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Heart size={16} color="#a855f7" fill="#a855f7" />
          <span>Message from Past You</span>
        </div>
        <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>Your Rescue Plan</span>
      </div>

      {rescuePlanItems.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {rescuePlanItems.map((item, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#cbd5e1' }}>
              <span>{item}</span>
              <button onClick={() => handleDeleteActivity(index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: '1px dashed #334155', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '14px' }}>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Your personalized rescue plan is empty.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Add custom low-energy task..."
          value={newActivityInput}
          onChange={(e) => setNewActivityInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddActivity()}
          style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
        />
        <button onClick={handleAddActivity} style={{ background: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  // NEW: renders the real Gemini-grounded suggestion (encouragement,
  // recommended focus, 3 tiny tasks, minimum win)
  const renderAiSuggestion = () => {
    if (aiLoading && !aiSuggestion) {
      return (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          ✨ Finding something gentle for you...
        </div>
      );
    }

    if (!aiSuggestion) return null;

    return (
      <div style={{ opacity: aiLoading ? 0.5 : 1, transition: 'opacity 0.15s', pointerEvents: aiLoading ? 'none' : 'auto' }}>
        <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '12px', marginBottom: '14px', color: '#e9d5ff', fontSize: '13px', fontWeight: '500' }}>
          💜 {aiSuggestion.encouragement}
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Recommended Focus</div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{aiSuggestion.recommendedTask}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {aiSuggestion.tinyTasks.map((task, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}>
              <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{task}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#facc15', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>🏅 Minimum Win</div>
          <div style={{ color: '#fde68a', fontSize: '13px' }}>{aiSuggestion.minimumWin}</div>
        </div>
      </div>
    );
  };

  const isDarkScreen = !!selectedMood || showSuccessScreen;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{
        backgroundColor: isDarkScreen ? '#090d16' : '#ffffff',
        border: isDarkScreen ? '1px solid #1e293b' : '1px solid #e2e8f0',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>

        {/* CLOSE CONTROL */}
        <button onClick={handleFinalClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        {showSuccessScreen ? (
          <div style={{ padding: '20px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', border: '2px solid rgba(34, 197, 94, 0.2)' }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', margin: '0 0 10px 0' }}>You showed up today.</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', maxWidth: '400px', lineHeight: '1.5' }}>
              You were productive today — even if it wasn't a perfect day. That still counts.
            </p>
            <button onClick={handleFinalClose} style={{ padding: '10px 32px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              Close
            </button>
          </div>
        ) : !selectedMood ? (
          /* Light-themed entry screen — 4 mood options + rescue plan for pre-planning */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: '#f3e8ff', borderRadius: '50%', marginBottom: '12px' }}>
                <Info size={24} color="#9333ea" />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1e293b' }}>Low motivation mode</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Why don't you feel like studying today?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {moodOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMood(option.label)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', color: '#334155', fontWeight: '500', fontSize: '15px', width: '100%', textAlign: 'left' }}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>

            {renderRescuePlan()}
          </div>
        ) : (
          /* Dark diagnostic panel — rescue plan, then real AI suggestions */
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>{selectedMood}</h2>
                <button
                  onClick={() => setSelectedMood(null)}
                  style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '12px', color: '#a855f7', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline', marginLeft: '4px' }}
                >
                  Change
                </button>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>We'll keep it super gentle today.</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              {renderRescuePlan()}
            </div>

            {/* AI SUGGESTIONS — now real Gemini output, grounded in actual data */}
            <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#a855f7" />
                  <span>AI Suggestions for You</span>
                </div>
              </div>

              <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: '500' }}>Based on:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>📁 {activeRevision}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>📝 {activeAssignment}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>🕒 {lastStudied}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>🧠 {selectedMood}</div>
                </div>
              </div>

              {renderAiSuggestion()}
            </div>

            {/* BUTTON CONTROLS */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleTryAnotherSuggestions}
                disabled={aiLoading}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', borderRadius: '10px', cursor: aiLoading ? 'default' : 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                {aiLoading ? '🔄 Finding another idea...' : '🔄 Try Another Suggestion'}
              </button>
              <button
                onClick={handleFinishWin}
                disabled={aiLoading || !aiSuggestion}
                style={{ flex: 1, padding: '12px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: '10px', cursor: (aiLoading || !aiSuggestion) ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (aiLoading || !aiSuggestion) ? 0.6 : 1 }}
              >
                <CheckCircle size={16} /> I Completed My Win
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};