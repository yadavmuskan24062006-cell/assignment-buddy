import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { type Assignment } from './AssignmentTracker';

interface StudyCalendarProps {
  assignments: Assignment[];
  onToggleComplete: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
}

export default function StudyCalendar({ assignments, onToggleComplete, onDeleteAssignment }: StudyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Navigation handlers
  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  // Calendar core math
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Create an array of calendar cells
  const calendarCells = useMemo(() => {
    const cells = [];
    // Padding days from previous month
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, dateStr: '' });
    }
    // Days of the actual month
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      cells.push({ day, dateStr });
    }
    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayIndex]);

  // Find assignments for a specific date
  const getTasksForDate = (dateStr: string) => {
    if (!dateStr) return [];
    return assignments.filter(a => a.dueDate === dateStr);
  };

  // Check assignment statuses for calendar dot rings
  const getDateStatusFlags = (dateStr: string) => {
    const tasks = getTasksForDate(dateStr);
    const todayStr = new Date().toISOString().split('T')[0];
    
    return {
      hasDue: tasks.some(t => !t.completed && t.dueDate >= todayStr),
      hasOverdue: tasks.some(t => !t.completed && t.dueDate < todayStr),
      hasCompleted: tasks.length > 0 && tasks.every(t => t.completed)
    };
  };

  // Tasks belonging to currently clicked date
  const selectedDayTasks = assignments.filter(a => a.dueDate === selectedDateStr);
  const formattedSelectedDate = new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', width: '100%' }}>
      
      {/* LEFT COLUMN: THE MONTHLY GRID PANEL */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
        
        {/* Month Navigation Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {monthNames[currentMonth]} {currentYear}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={prevMonth} style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextMonth} style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of Week Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontWeight: '600', color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
          {daysOfWeek.map(day => <div key={day} style={{ padding: '6px 0' }}>{day}</div>)}
        </div>

        {/* Calendar Day Grid Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {calendarCells.map((cell, index) => {
            if (!cell.day) {
              return <div key={`empty-${index}`} style={{ paddingBottom: '100%' }} />;
            }

            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
            const flags = getDateStatusFlags(cell.dateStr);

            return (
              <button
                key={cell.dateStr}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '100%', // Keeps cells perfectly square
                  background: isSelected ? '#3b82f6' : isToday ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                  border: isToday && !isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                  borderRadius: '10px',
                  color: isSelected ? '#fff' : '#e2e8f0',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease',
                }}
              >
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: isToday || isSelected ? 'bold' : 'normal' }}>
                  {cell.day}
                  
                  {/* Status Indicator Dots */}
                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', width: 'max-content' }}>
                    {flags.hasOverdue && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />}
                    {flags.hasDue && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#eab308' }} />}
                    {flags.hasCompleted && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Legend Guide */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '12px', justifyContent: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} /> Overdue</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }} /> Pending</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Done</span>
        </div>
      </div>

      {/* RIGHT COLUMN: DETAIL ASSIGNMENT VIEW FOR SELECTED DAY */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarIcon size={14} /> {formattedSelectedDate}
        </h3>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedDayTasks.length === 0 ? (
            <div style={{ border: '2px dashed #334155', borderRadius: '16px', padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#0f172a/30' }}>
              No assignments due on this day. 👍
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedDayTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => onToggleComplete(task.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: task.completed ? '1px solid #10b981' : '1px solid #475569',
                        background: task.completed ? '#10b981' : 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {task.completed && <Check size={12} strokeWidth={3} />}
                    </button>
                    
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: task.completed ? '#64748b' : '#fff',
                        textDecoration: task.completed ? 'line-through' : 'none',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}>
                        {task.title}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteAssignment(task.id)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}