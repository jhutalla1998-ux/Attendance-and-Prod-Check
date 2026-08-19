(function () {
  const STORAGE_KEY = 'ims_shift_config_v1';
  const DEFAULT_SHIFTS = [
    { key: '1st Shift-(6am-2pm)', name: '1st Shift', start: '05:00', end: '17:00' },
    { key: '2nd Shift-(2pm-10pm)', name: '2nd Shift', start: '17:00', end: '05:00' }
  ];

  function normalizeTime(value, fallback) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : fallback;
  }

  function getShifts() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    const source = Array.isArray(saved) && saved.length >= 2 ? saved : DEFAULT_SHIFTS;
    return source.slice(0, 2).map((shift, index) => ({
      key: DEFAULT_SHIFTS[index].key,
      name: `${index + 1}${index === 0 ? 'st' : 'nd'} Shift`,
      start: normalizeTime(shift.start, DEFAULT_SHIFTS[index].start),
      end: normalizeTime(shift.end, DEFAULT_SHIFTS[index].end)
    }));
  }

  function formatTime(value) {
    const [hours, minutes] = value.split(':').map(Number);
    const suffix = hours >= 12 ? 'pm' : 'am';
    const hour = hours % 12 || 12;
    return `${hour}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${suffix}`;
  }

  function label(shift) {
    return `${shift.name}-(${formatTime(shift.start)}-${formatTime(shift.end)})`;
  }

  function minutes(value) {
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
  }

  function isInWindow(value, start, end) {
    if (start === end) return true;
    return start < end ? value >= start && value < end : value >= start || value < end;
  }

  function getShiftFromTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return { date: '', shift: '' };
    const time = date.getHours() * 60 + date.getMinutes();
    const shifts = getShifts();
    let index = shifts.findIndex(shift => isInWindow(time, minutes(shift.start), minutes(shift.end)));
    if (index < 0) index = 0;
    const operationDate = new Date(date);
    if (time < minutes(shifts[index].start)) operationDate.setDate(operationDate.getDate() - 1);
    const year = operationDate.getFullYear();
    const month = String(operationDate.getMonth() + 1).padStart(2, '0');
    const day = String(operationDate.getDate()).padStart(2, '0');
    return { date: `${year}-${month}-${day}`, shift: shifts[index].key };
  }

  function saveShifts(shifts) {
    const normalized = shifts.slice(0, 2).map((shift, index) => ({
      start: normalizeTime(shift.start, DEFAULT_SHIFTS[index].start),
      end: normalizeTime(shift.end, DEFAULT_SHIFTS[index].end)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  function refreshShiftControls() {
    const shifts = getShifts();
    document.querySelectorAll('[data-shift]').forEach(element => {
      const shift = shifts.find(item => item.key === element.dataset.shift);
      if (shift) element.textContent = element.tagName === 'BUTTON' ? shift.name : label(shift);
    });
    document.querySelectorAll('select').forEach(select => {
      const shiftOptions = Array.from(select.options).filter(option => /^(1st|2nd|3rd) Shift/.test(option.value));
      if (!shiftOptions.length) return;
      const selected = select.value;
      shiftOptions.forEach(option => option.remove());
      const anchor = select.options[0] && /All Shifts/.test(select.options[0].textContent) ? select.options[0] : null;
      shifts.forEach(shift => {
        const option = new Option(label(shift), shift.key);
        if (shift.key === selected) option.selected = true;
        select.insertBefore(option, anchor ? anchor.nextSibling : select.firstChild);
      });
    });
    document.querySelectorAll('[data-shift-label]').forEach(element => {
      const shift = shifts.find(item => item.key === element.dataset.shiftLabel);
      if (shift) element.textContent = label(shift);
    });
  }

  window.IMS_SHIFTS = { STORAGE_KEY, DEFAULT_SHIFTS, getShifts, label, saveShifts, getShiftFromTimestamp, refreshShiftControls };
  document.addEventListener('DOMContentLoaded', refreshShiftControls);
})();
