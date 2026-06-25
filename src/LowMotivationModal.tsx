import React, { useState } from 'react';
import { X, Heart, Sparkles, CheckCircle, Plus, Trash2,  MessageSquare, Info, Zap } from 'lucide-react';
import { generateMotivationSuggestion } from './gemini';

interface LowMotivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: any[];
  revisions: any[];
  recentTopic: { topic: string; date: string } | null;
  onSuggestionCompleted: (suggestion: { reason: string; recommendedTask: string; minimumWin: string }) => void;
}

export const LowMotivationModal: React.FC<LowMotivationModalProps> = ({
  isOpen,
  onClose,
  assignments,
  revisions,
  recentTopic,
  
}) => {
  // Core state management
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  const [newActivityInput, setNewActivityInput] = useState<string>('');
  const [showSuccessScreen, setShowSuccessScreen] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  React.useEffect(() => {
    console.log("Effect triggered, selectedMood is:", selectedMood);
  if (selectedMood) {
   const fetchAi = async () => {
  setAiLoading(true);
  try {
    const context = {
      reason: selectedMood || 'Low Motivation',
      overdueAssignments: assignments.filter((a) => !a.completed),
      upcomingAssignments: assignments.filter((a) => !a.completed), // <-- ADDED THIS LINE
      revisionTopics: revisions,
      recentTopic: recentTopic?.topic || null,
    };
    const result = await generateMotivationSuggestion(context);
    setAiSuggestion(result);
  } catch (err) {
    console.error("AI Error:", err);
  } finally {
    setAiLoading(false);
  }
};
fetchAi();
  }
}, [selectedMood]);


  // Read user rescue plan items from localStorage
  const [rescuePlanItems, setRescuePlanItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('local_buddy_rescue_plan');
    return saved ? JSON.parse(saved) : [];
  });



  if (!isOpen) return null;

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


  
  // Extract actual topic contexts
 
  

 

  

  const handleFinalClose = () => {
    setShowSuccessScreen(false);
    setSelectedMood(null);
    onClose();
  };

  // Restored original 4-option entry screen, matching the pre-existing reference design
  const moodOptions = [
    { label: "I'm mentally tired", icon: <Info size={18} color="#64748b" /> },
    { label: "I feel overwhelmed", icon: <Zap size={18} color="#64748b" /> },
    { label: "I don't know what to study", icon: <Info size={18} color="#64748b" /> },
    { label: "Something else", icon: <MessageSquare size={18} color="#64748b" /> },
  ];

  // NEW: the entry screen is light-themed; the diagnostic panel and success
  // screen are dark-themed — the outer modal box now switches between the
  // two instead of being permanently dark (that mismatch was the regression).
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
          /* Restored light-themed 4-option entry screen */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: '#f3e8ff', borderRadius: '50%', marginBottom: '12px' }}>
                <Info size={24} color="#9333ea" />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1e293b' }}>Low motivation mode</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Why don't you feel like studying today?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          </div>
        ) : (
          /* MAIN WORKSPACE DIAGNOSTIC VIEWS */
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

            {/* MESSAGE FROM PAST YOU SECTION */}
            <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '16px', marginBottom: '20px' }}>
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

            {/* AI SUGGESTIONS CONTEXT AND LIST VIEW */}
          
{/* AI SUGGESTIONS CONTEXT AND LIST VIEW */}
<div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '16px', marginBottom: '20px', minHeight: '100px' }}>
  <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
    <Sparkles size={16} color="#a855f7" />
    <span>AI Suggestions for You</span>
  </div>

  {/* Force a wrapper so you can see if the div exists even if it's empty */}
  <div style={{ color: '#fff' }}>
    {aiLoading && <div>Thinking...</div>}
    {!aiLoading && aiSuggestion && (
      <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>{aiSuggestion.recommendedTask}</p>
        <div style={{ fontSize: '12px', color: '#a855f7' }}>Win: {aiSuggestion.minimumWin}</div>
      </div>
    )}
    {!aiLoading && !aiSuggestion && <div>No data received yet.</div>}
  </div>
</div>

            {/* MINIMUM WIN CONTENT */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🏅 Minimum Win
              </div>
             {aiSuggestion && (
  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
    Just executing <span style={{ color: '#e9d5ff', fontWeight: '500' }}>"{aiSuggestion.recommendedTask.toLowerCase()}"</span> is a perfect win for today.
  </p>
)}
            </div>

            {/* BUTTON CONTROLS */}
            <div style={{ display: 'flex', gap: '12px' }}>
             
            </div>
          </>
        )}

      </div>
    </div>
  );
};