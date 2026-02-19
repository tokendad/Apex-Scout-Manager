/**
 * Calendar and Events Module
 */
import { apiFetch, API_BASE_URL } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback } from '../../utils.js';

let currentCalendarDate = new Date();

/**
 * Load events for the current user's troop
 */
export async function loadEvents() {
    const { currentUser } = store.getState();
    try {
        let endpoint = '/events';
        if (currentUser && currentUser.troopId) {
            endpoint = `/troop/${currentUser.troopId}/events`;
        }

        const events = await apiFetch(endpoint);
        store.setState({ events });
        renderCalendar();
    } catch (error) {
        console.error('Error loading events:', error);
        store.setState({ events: [] });
        renderCalendar();
    }
}

/**
 * Render the calendar UI
 */
export function renderCalendar() {
    const { events } = store.getState();
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('calendarMonthYear');
    
    if (!calendarGrid || !monthYearLabel) return;

    calendarGrid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthYearLabel.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayIndex = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Prev Month
    for (let i = startDayIndex - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="calendar-date-num">${prevMonthLastDay - i}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
    
    const today = new Date();
    // Get active filters
    const activeFiltersEl = document.querySelectorAll('.event-filter:checked');
    const activeFilters = activeFiltersEl.length > 0 ? Array.from(activeFiltersEl).map(cb => cb.value) : ['Troop', 'Pack', 'Lion', 'Tiger', 'Wolf', 'Bear', 'Webelos', 'AOL', 'Daisy', 'Brownie', 'Junior', 'Cadette', 'Senior', 'Ambassador', 'GS'];

    // Current Month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayDiv.classList.add('today');
        }
        
        dayDiv.innerHTML = `<div class="calendar-date-num">${i}</div>`;
        
        const dayEvents = events.filter(e => {
            if (!e.eventDate) return false;
            // Parse date string directly to avoid timezone shifts
            const [eYear, eMonth, eDay] = e.eventDate.split('T')[0].split('-').map(Number);
            return eDay === i && (eMonth - 1) === month && eYear === year;
        });
        
        dayEvents.forEach(event => {
            const group = event.targetGroup || 'Troop';
            if (activeFilters.length > 0 && !activeFilters.includes(group)) {
                return;
            }

            const eventPill = document.createElement('div');
            eventPill.className = `calendar-event event-${group}`;
            
            let timeStr = '';
            if (event.startTime) {
                timeStr = event.startTime;
            }
            
            eventPill.textContent = (timeStr ? timeStr + ' ' : '') + event.eventName;
            eventPill.title = `${event.eventName}\n${event.startTime || ''} - ${event.endTime || ''}\n${event.location || ''}\n${event.description || ''}`;
            
            eventPill.onclick = (e) => {
                e.stopPropagation();
                alert(`${event.eventName}\nTime: ${event.startTime || 'N/A'}\nLocation: ${event.location || 'N/A'}\nGroup: ${group}\n\n${event.description || ''}`);
            };
            
            dayDiv.appendChild(eventPill);
        });
        
        calendarGrid.appendChild(dayDiv);
    }
    
    // Next Month
    const totalCells = startDayIndex + lastDay.getDate();
    const rows = Math.ceil(totalCells / 7);
    const nextMonthPadding = (rows * 7) - totalCells;
    
    for (let i = 1; i <= nextMonthPadding; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="calendar-date-num">${i}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

/**
 * Calendar Helpers
 */
export function changeMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderCalendar();
}

export function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

export function toggleAddEventForm() {
    const form = document.getElementById('addEventSection');
    if (form) form.classList.toggle('hidden');
}

export async function exportCalendar() {
    const { currentUser } = store.getState();
    if (!currentUser || !currentUser.troopId) {
        alert('No troop selected or not a member of a troop.');
        return;
    }
    window.location.href = `${API_BASE_URL}/troop/${currentUser.troopId}/calendar/export`;
}

/**
 * Handle adding a new event
 */
export async function handleAddEvent(event) {
    event.preventDefault();
    const { currentUser } = store.getState();
    if (!currentUser || !currentUser.troopId) return;

    const data = {
        eventName: document.getElementById('eventName').value,
        eventDate: document.getElementById('eventDate').value,
        eventType: document.getElementById('eventType').value,
        startTime: document.getElementById('eventStartTime').value,
        endTime: document.getElementById('eventEndTime').value,
        location: document.getElementById('eventLocation').value,
        targetGroup: document.getElementById('targetGroup').value,
        eventDescription: document.getElementById('eventDescription').value,
    };

    try {
        await apiFetch(`/troop/${currentUser.troopId}/events`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showFeedback('Event added successfully');
        loadEvents();
        toggleAddEventForm();
    } catch (error) {
        showFeedback('Error adding event: ' + error.message, true);
    }
}
