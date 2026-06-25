import { useState } from 'react';
import { generateStudyPlan } from './gemini';
import { Sparkles, Plus, BookOpen, RotateCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface FlashcardItem {
  question: string;
  answer: string;
  isFlipped: boolean; 
}

interface RevisionHubProps {
  onAddTopic: (topicName: string) => void;
}

export default function RevisionHub({ onAddTopic }: RevisionHubProps) {
  const [topicInput, setTopicInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);

  // Dual Action 1: Add topic back to main core metrics dashboard tracking
  const handleAddToList = () => {
    if (!topicInput.trim()) return;
    
    onAddTopic(topicInput.trim());
    setSuccessMessage(`🎯 Added "${topicInput.trim()}" to your active revision lists!`);
    
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Dual Action 2: Trigger AI Generation and parse into 3 separate card objects
  const handleGenerateFlashcards = async () => {
    if (!topicInput.trim()) return;

    try {
      setIsLoading(true);
      setFlashcards([]);
      
      const specificFlashcardPrompt = `You are an elite engineering tutor. Create exactly 3 high-impact, conceptual/interview flashcards for the topic: "${topicInput.trim()}".
      Return ONLY a valid raw JSON array of objects, with no markdown code blocks, no backticks, and no wrapper text. 
      Each object must have exactly two keys: "question" and "answer". Do not include words like "ANSWER KEY" inside the fields.
      
      Example format:
      [
        {"question": "What is the physical principle behind KCL?", "answer": "KCL is based on the law of conservation of charge..."},
        {"question": "What is a lumped parameter assumption?", "answer": "It assumes that the physical dimensions of the circuit are small compared to..."}
      ]`;
      
      const responseText = await generateStudyPlan(specificFlashcardPrompt);
      
      const cleanJsonString = responseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsedCards = JSON.parse(cleanJsonString);
      
      if (Array.isArray(parsedCards)) {
        const initializedCards = parsedCards.slice(0, 3).map((card: any) => ({
          question: card.question || "No question provided",
          answer: card.answer || "No answer provided",
          isFlipped: false
        }));
        setFlashcards(initializedCards);
      }
    } catch (error) {
      console.error("Parsing error: ", error);
      setFlashcards([
        { question: "Failed to generate clean cards.", answer: "Please try clicking generate again.", isFlipped: false }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle flip state independently per card index
  const toggleCardFlip = (index: number) => {
    setFlashcards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, isFlipped: !card.isFlipped } : card))
    );
  };

  return (
    <div style={{ background: '#0f172a', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
      
      {/* Header section */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <BookOpen size={22} color="#c084fc" /> AI Revision Hub
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
          Track engineering concepts on your dashboard or instantly create a 3-deck interactive recall test.
        </p>
      </div>

      {/* Input Box Row */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="e.g., Operator Overloading in C++ / KCL Loops"
          style={{
            width: '100%',
            padding: '14px',
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: '10px',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      {/* Two Action Buttons Row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          onClick={handleAddToList}
          disabled={!topicInput.trim()}
          style={{
            flex: 1,
            minWidth: '140px',
            padding: '12px',
            background: topicInput.trim() ? '#1e293b' : '#0f172a',
            border: topicInput.trim() ? '1px solid #475569' : '1px solid #1e293b',
            borderRadius: '10px',
            color: topicInput.trim() ? '#fff' : '#475569',
            fontWeight: '600',
            fontSize: '13px',
            cursor: topicInput.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={16} /> + Add to Tracker List
        </button>

        <button
          onClick={handleGenerateFlashcards}
          disabled={isLoading || !topicInput.trim()}
          style={{
            flex: 1,
            minWidth: '140px',
            padding: '12px',
            background: topicInput.trim() ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#0f172a',
            border: 'none',
            borderRadius: '10px',
            color: topicInput.trim() ? '#fff' : '#475569',
            fontWeight: '600',
            fontSize: '13px',
            cursor: isLoading || !topicInput.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: topicInput.trim() ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none'
          }}
        >
          <Sparkles size={16} /> {isLoading ? 'Analyzing...' : '✨ Gen Flashcards'}
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div style={{ background: '#064e3b', border: '1px solid #059669', color: '#34d399', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}

      {/* 3-Card Grid Workspace Display */}
      {flashcards.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
          gap: '16px',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #1e293b'
        }}>
          {flashcards.map((card, index) => (
            <div
              key={index}
              onClick={() => toggleCardFlip(index)}
              style={{
                background: card.isFlipped ? '#020617' : '#1e293b',
                minHeight: '220px',
                borderRadius: '12px',
                border: card.isFlipped ? '1px solid #10b981' : '1px solid #334155',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}
            >
              <div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: card.isFlipped ? '#064e3b' : '#1e3a8a',
                  color: card.isFlipped ? '#34d399' : '#3b82f6',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginBottom: '14px'
                }}>
                  {card.isFlipped ? '💡 ANSWER KEY' : `❓ QUESTION #${index + 1}`}
                </span>

                <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5' }}>
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...rest }) => <p style={{ margin: '4px 0' }} {...rest} />,
                      strong: ({ node, ...rest }) => <strong style={{ color: '#fff', fontWeight: '700' }} {...rest} />,
                      code: ({ node, ...rest }) => <code style={{ background: '#0f172a', padding: '2px 4px', borderRadius: '4px', fontSize: '12px', color: '#f43f5e', fontFamily: 'monospace' }} {...rest} />
                    }}
                  >
                    {card.isFlipped ? card.answer : card.question}
                  </ReactMarkdown>
                </div>
              </div>

              <div style={{ 
                marginTop: '16px', 
                paddingTop: '10px', 
                borderTop: '1px solid rgba(255,255,255,0.05)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#64748b', 
                fontSize: '12px' 
              }}>
                <RotateCw size={12} /> Click card to flip
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}