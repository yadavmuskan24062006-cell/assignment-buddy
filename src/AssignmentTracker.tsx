// src/AssignmentTracker.tsx
import { useState } from 'react';
import { ClipboardList, Trash2, CheckCircle, Circle } from 'lucide-react';

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  difficulty: 'Low' | 'Medium' | 'High';
  completed: boolean;
}

interface TrackerProps {
  assignments: Assignment[];
  onAddAssignment: (assignment: Assignment) => void;
  onToggleComplete: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
}

export function AssignmentTracker({ assignments, onAddAssignment, onToggleComplete, onDeleteAssignment }: TrackerProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <div style={{ padding: '24px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <ClipboardList size={22} style={{ color: '#3b82f6' }} />
        <h2 style={{ margin: 0, fontSize: '22px' }}>Assignment Tracker</h2>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onAddAssignment({ id: crypto.randomUUID(), title, subject, dueDate, difficulty: 'Medium', completed: false }); setTitle(''); }} 
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
        <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
        <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Add Task</button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {assignments.map((task) => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <button onClick={() => onToggleComplete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.completed ? '#4ade80' : '#64748b' }}>
              {task.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{task.subject} • {task.dueDate}</div>
            </div>
            <button onClick={() => onDeleteAssignment(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}