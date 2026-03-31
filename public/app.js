const monthLabel = document.getElementById('month');
const calendarBody = document.getElementById('calendar-body');
const googleLoginBtn = document.getElementById('google-login-btn');
const sidebarLoginLink = document.getElementById('sidebar-login-link');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const eventForm = document.getElementById('event-form');
const formMessage = document.getElementById('form-message');

const eventSidebar = document.getElementById('event-sidebar');
const eventSidebarDate = document.getElementById('event-sidebar-date');
const eventSidebarList = document.getElementById('event-sidebar-list');
const closeEventSidebarBtn = document.getElementById('close-event-sidebar');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

let currentDate = new Date();
let googleEvents = [];

document.addEventListener('DOMContentLoaded', async () => {
  bindButtons();
  renderCalendar();
  await updateAuthState();
  await fetchAndRenderEvents();
});

function bindButtons() {
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  }

  if (sidebarLoginLink) {
    sidebarLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/auth/google';
    });
  }

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      renderCalendar();
      renderEventsInCalendar();
      closeEventSidebar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      renderCalendar();
      renderEventsInCalendar();
      closeEventSidebar();
    });
  }

  if (eventForm) {
    eventForm.addEventListener('submit', submitEventForm);
  }

  if (closeEventSidebarBtn) {
    closeEventSidebarBtn.addEventListener('click', closeEventSidebar);
  }
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthLabel.textContent = `${monthNames[month]} ${year}`;
  calendarBody.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = 0; i < firstDayIndex; i++) {
    const prevDay = daysInPrevMonth - firstDayIndex + i + 1;
    const prevDate = new Date(year, month - 1, prevDay);
    cells.push(createDayCell(prevDate, true));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push(createDayCell(date, false));
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstDayIndex + daysInMonth) + 1;
    const nextDate = new Date(year, month + 1, nextDay);
    cells.push(createDayCell(nextDate, true));
  }

  for (let i = 0; i < cells.length; i += 7) {
    const row = document.createElement('tr');
    cells.slice(i, i + 7).forEach(cell => row.appendChild(cell));
    calendarBody.appendChild(row);
  }
}

function createDayCell(date, isMuted) {
  const td = document.createElement('td');
  td.className = 'calendar-day';
  td.dataset.date = formatDateLocal(date);

  if (isMuted) {
    td.classList.add('muted-date');
  }

  td.innerHTML = `
    <span class="day-number">${date.getDate()}</span>
    <div class="day-events"></div>
  `;

  td.addEventListener('click', () => {
    openEventSidebar(td.dataset.date);
  });

  return td;
}

async function updateAuthState() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();

    if (googleLoginBtn) {
      googleLoginBtn.textContent = data.loggedIn ? 'Google Connected' : 'Connect Google';
      googleLoginBtn.disabled = data.loggedIn;
    }

    if (sidebarLoginLink) {
      sidebarLoginLink.textContent = data.loggedIn ? 'Google Connected' : 'Connect Google';
    }
  } catch (error) {
    console.error('Auth status error:', error);
  }
}

async function fetchAndRenderEvents() {
  try {
    const res = await fetch('/events');

    if (!res.ok) {
      googleEvents = [];
      renderEventsInCalendar();
      return;
    }

    googleEvents = await res.json();
    renderEventsInCalendar();
  } catch (error) {
    console.error('Load events error:', error);
  }
}

function renderEventsInCalendar() {
  document.querySelectorAll('.day-events').forEach(container => {
    container.innerHTML = '';
  });

  const groupedEvents = {};

  for (const event of googleEvents) {
    const dateKey = getDateKeyFromEvent(event.start);

    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }

    groupedEvents[dateKey].push(event);
  }

  for (const dateKey in groupedEvents) {
    const dayCell = document.querySelector(`.calendar-day[data-date="${dateKey}"]`);
    if (!dayCell) continue;

    const container = dayCell.querySelector('.day-events');
    if (!container) continue;

    const eventsForDay = groupedEvents[dateKey];
    const visibleEvents = eventsForDay.slice(0, 2);
    const hiddenCount = eventsForDay.length - visibleEvents.length;

    visibleEvents.forEach(event => {
      const eventDiv = document.createElement('div');
      eventDiv.className = 'calendar-event';
      eventDiv.title = event.title;
      eventDiv.textContent = event.allDay
        ? event.title
        : `${formatEventTime(event.start)} ${event.title}`;
      container.appendChild(eventDiv);
    });

    if (hiddenCount > 0) {
      const moreDiv = document.createElement('div');
      moreDiv.className = 'calendar-more';
      moreDiv.textContent = `+${hiddenCount} more`;
      container.appendChild(moreDiv);
    }
  }
}

function openEventSidebar(dateKey) {
  const eventsForDay = googleEvents.filter(event => getDateKeyFromEvent(event.start) === dateKey);

  eventSidebarDate.textContent = formatDisplayDate(dateKey);
  eventSidebarList.innerHTML = '';

  if (eventsForDay.length === 0) {
    eventSidebarList.innerHTML = `<div class="event-sidebar-item"><div class="event-sidebar-item-description">No events for this date.</div></div>`;
  } else {
    eventsForDay
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .forEach(event => {
        const item = document.createElement('div');
        item.className = 'event-sidebar-item';

        item.innerHTML = `
          <div class="event-sidebar-item-title">${escapeHtml(event.title)}</div>
          <div class="event-sidebar-item-time">${event.allDay ? 'All day' : formatEventTimeRange(event.start, event.end)}</div>
          <div class="event-sidebar-item-description">${escapeHtml(event.description || '')}</div>
        `;

        eventSidebarList.appendChild(item);
      });
  }

  eventSidebar.classList.remove('hidden');
}

function closeEventSidebar() {
  if (eventSidebar) {
    eventSidebar.classList.add('hidden');
  }
}

async function submitEventForm(e) {
  e.preventDefault();

  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const startTime = document.getElementById('event-start').value;
  const endTime = document.getElementById('event-end').value;
  const description = document.getElementById('event-description').value.trim();

  formMessage.textContent = '';

  try {
    const res = await fetch('/add-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, startTime, endTime, description })
    });

    const data = await res.json();

    if (!res.ok) {
      formMessage.textContent = data.error || 'Could not add event';
      return;
    }

    formMessage.textContent = 'Event added successfully.';
    eventForm.reset();
    await fetchAndRenderEvents();
  } catch (error) {
    console.error('Add event error:', error);
    formMessage.textContent = 'Something went wrong.';
  }
}

function getDateKeyFromEvent(dateString) {
  const date = new Date(dateString);
  return formatDateLocal(date);
}

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEventTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatEventTimeRange(start, end) {
  if (!start) return '';
  const startText = formatEventTime(start);
  const endText = end ? formatEventTime(end) : '';
  return endText ? `${startText} - ${endText}` : startText;
}

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}