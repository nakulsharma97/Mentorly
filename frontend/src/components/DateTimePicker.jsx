import { useState } from 'react';
import './DateTimePicker.css';

export default function DateTimePicker({ onSelect, minDate, maxDate, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(minDate || new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  const handleTimeChange = (e) => {
    setSelectedTime(e.target.value);
  };

  const handleConfirm = () => {
    const [hours, minutes] = selectedTime.split(':');
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes));
    onSelect?.(dateTime);
    setIsOpen(false);
  };

  const formatDate = (date) => {
    if (!date) return 'Select date & time';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isDateDisabled = (date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = [];
  const firstDay = firstDayOfMonth(currentMonth);

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth(currentMonth); day++) {
    days.push(day);
  }

  return (
    <div className="datetime-picker-wrapper">
      {label && <label className="datetime-picker-label">{label}</label>}
      
      <button
        className="datetime-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="material-symbols-outlined">event</span>
        {formatDate(selectedDate && selectedTime ? 
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), ...selectedTime.split(':'))
          : null
        )}
      </button>

      {isOpen && (
        <div className="datetime-picker-popover" role="dialog" aria-label="Select date and time" aria-modal="true">
          {/* Calendar */}
          <div className="datetime-calendar">
            <div className="calendar-header">
              <button onClick={handlePrevMonth} aria-label={`Previous month: ${monthName}`}>
                <span aria-hidden="true">‹</span>
              </button>
              <h3 id="calendar-month-heading">{monthName}</h3>
              <button onClick={handleNextMonth} aria-label={`Next month: ${monthName}`}>
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <div className="calendar-weekdays" role="row">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday" role="columnheader" aria-label={day}>
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-days">
              {days.map((day, idx) => (
                <button
                  key={idx}
                  className={`calendar-day ${
                    day === null ? 'empty' : ''
                  } ${
                    day === selectedDate.getDate() && 
                    currentMonth.getMonth() === selectedDate.getMonth() &&
                    currentMonth.getFullYear() === selectedDate.getFullYear()
                      ? 'selected'
                      : ''
                  } ${
                    day && isDateDisabled(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
                      ? 'disabled'
                      : ''
                  }`}
                  onClick={() => day && !isDateDisabled(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)) && handleDateClick(day)}
                  disabled={day === null || (day && isDateDisabled(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)))}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time Picker */}
          <div className="datetime-time">
            <label htmlFor="time-input">Time</label>
            <input
              id="time-input"
              type="time"
              value={selectedTime}
              onChange={handleTimeChange}
            />
          </div>

          {/* Actions */}
          <div className="datetime-actions">
            <button 
              className="btn-cancel"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button 
              className="btn-confirm"
              onClick={handleConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
