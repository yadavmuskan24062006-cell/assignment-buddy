// src/RevisionHub.tsx
import { useState } from 'react';
import { generateStudyPlan } from './gemini'; 
import { BookOpen, Sparkles, RotateCw, CheckCircle2 } from 'lucide-react';

interface Flashcard {
  front: string;
  back: string;
  flipped: boolean;
}

export function RevisionHub() {
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateCards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setCards([]);

    const structuredPrompt = `
      You are an expert engineering professor. Generate exactly 3 highly important exam study flashcards for the topic: "${topic}".
      Provide your response using this exact structural layout with no markdown formatting or extra conversational remarks:
      
      Front: [Write a clear conceptual question here]
      Back: [Write a concise, high-scoring exam answer here]
      Front: [Write the second conceptual question here]
      Back: [Write the second answer here]
      Front: [Write the third conceptual question here]
      Back: [Write the third answer here]
    `;

    try {
      const responseText = await generateStudyPlan(structuredPrompt);
      
      const fronts = responseText.match(/Front:\s*(.*)/gi)?.map((s: string) => s.replace(/Front:\s*/i, '')) || [];
      const backs = responseText.match(/Back:\s*(.*)/gi)?.map((s: string) => s.replace(/Back:\s*/i, '')) || [];

      if (fronts.length === 0) {
        throw new Error("Gemini returned an unstructured response. Please click regenerate.");
      }

      const parsedCards: Flashcard[] = fronts.map((qText: string, index: number) => ({
        front: qText.trim(),
        back: backs[index] ? backs[index].trim() : "Click regenerate to load details.",
        flipped: false
      }));

      setCards(parsedCards);
    } catch (err: any) {
      setError(err.message || 'Failed to generate revision cards.');
    } finally {
      setLoading(false);
    }
  };

  const handleFlipCard = (index: number) => {
    setCards(cards.map((card, i) => 
      i === index ? { ...card, flipped: !card.flipped } : card
    ));
  };

  return (
    <div style={{ padding: '24px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <BookOpen size={22} style={{ color: '#a855f7' }} />
        <h2 style={{ margin: 0, fontSize: '22px', color: '#f8fafc' }}>AI Revision Hub</h2>
      </div>
      <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px' }}>
        Type an engineering concept to generate instant, interactive active-recall flashcards.
      </p>

      <form onSubmit={handleGenerateCards} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input type="text" placeholder="e.g., Operator Overloading in C++ / KCL Loops" value={topic} onChange={(e) => setTopic(e.target.value)} required
          style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #475569', color: '#fff', fontSize: '14px' }} />
        
        <button type="submit" disabled={loading}
          style={{ padding: '12px 20px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} />
          {loading ? 'Analyzing...' : 'Generate Decks'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#f87171', fontSize: '13px', marginBottom: '15px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {cards.map((card, index) => (
          <div key={index} onClick={() => handleFlipCard(index)}
            style={{ height: '180px', perspective: '1000px', cursor: 'pointer' }}>
            
            {/* Fixed: changed layout spelling typo to standard style configuration */}
            <div style={{ width: '100%', height: '100%', position: 'relative', transition: 'transform 0.4s', transformStyle: 'preserve-3d', background: card.flipped ? '#1e1b4b' : '#0f172a', border: card.flipped ? '2px solid #a855f7' : '1px solid #334155', borderRadius: '12px', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              <div style={{ fontSize: '14px', lineHeight: '1.5', overflowY: 'auto', color: '#f8fafc', height: '110px' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: card.flipped ? '#c084fc' : '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                  {card.flipped ? '💡 Answer Key' : `❓ Core Question #${index + 1}`}
                </span>
                {card.flipped ? card.back : card.front}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RotateCw size={10} /> Click card to flip
                </span>
                {card.flipped && <CheckCircle2 size={12} style={{ color: '#4ade80' }} />}
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}