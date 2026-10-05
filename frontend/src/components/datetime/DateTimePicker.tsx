import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  addDays,
  addMonths,
  dayLabel,
  monthGrid,
  monthOf,
  monthTitle,
  sameDay,
  stepTime,
  summary,
  WEEKDAYS,
  withTime,
  type MonthRef,
} from './calendar';
import './datetime.css';

interface DateTimePickerProps {
  label: string;
  /** ISO string or null when no date is set. */
  value: string | null;
  onChange(value: string | null): void;
  error?: string;
}

const QUICK_TIMES: Array<[number, number]> = [
  [14, 0],
  [16, 0],
  [18, 0],
  [19, 0],
  [20, 0],
  [21, 0],
];
const DEFAULT_TIME: [number, number] = [19, 0];
const MINUTE_STEP = 5;
const pad = (value: number) => String(value).padStart(2, '0');

/** Date and time picker in the OCC style (replaces the browser's datetime-local "agenda"). */
export function DateTimePicker({ label, value, onChange, error }: DateTimePickerProps) {
  const id = useId();
  const current = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);

  return (
    <div
      className="field datetime-field"
      onKeyDown={(event) => {
        // Esc closes only the calendar, never the surrounding modal (which would drop the form).
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <label htmlFor={`${id}-trigger`}>{label}</label>
      <button
        id={`${id}-trigger`}
        type="button"
        className={`datetime-trigger ${open ? 'datetime-trigger-open' : ''}`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-invalid={Boolean(error)}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <CalendarDays size={20} aria-hidden="true" />
        <span className={current ? '' : 'datetime-placeholder'}>{current ? summary(current) : 'Escolher data e hora'}</span>
        <ChevronDown className="datetime-chevron" size={18} aria-hidden="true" />
      </button>
      {error && <small className="field-error">{error}</small>}

      {open && (
        <DateTimePanel
          id={`${id}-panel`}
          initial={current}
          onCancel={() => setOpen(false)}
          onConfirm={(date) => {
            onChange(date ? date.toISOString() : null);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DateTimePanel({
  id,
  initial,
  onCancel,
  onConfirm,
}: {
  id: string;
  initial: Date | null;
  onCancel(): void;
  onConfirm(date: Date | null): void;
}) {
  const today = new Date();
  const [day, setDay] = useState<Date | null>(initial);
  const [hours, setHours] = useState(initial?.getHours() ?? DEFAULT_TIME[0]);
  const [minutes, setMinutes] = useState(initial?.getMinutes() ?? DEFAULT_TIME[1]);
  const [view, setView] = useState<MonthRef>(monthOf(initial ?? today));
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const [focusedDay, setFocusedDay] = useState<Date>(initial ?? today);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusDay = useRef(false);

  // Opening moves the focus to the selected (or today's) day, ready for arrow keys.
  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }, []);

  // Keyboard navigation moves the focus to the newly focused day.
  useEffect(() => {
    if (!shouldFocusDay.current) return;
    shouldFocusDay.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focusedDay, view]);

  function changeMonth(delta: number) {
    setDirection(delta > 0 ? 'next' : 'prev');
    setView((ref) => addMonths(ref, delta));
  }

  function focusDay(next: Date) {
    shouldFocusDay.current = true;
    setFocusedDay(next);
    const nextMonth = monthOf(next);
    if (nextMonth.year !== view.year || nextMonth.month !== view.month) {
      setDirection(next > focusedDay ? 'next' : 'prev');
      setView(nextMonth);
    }
  }

  function handleGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      focusDay(addDays(focusedDay, moves[event.key]!));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const delta = event.key === 'PageDown' ? 1 : -1;
      focusDay(new Date(focusedDay.getFullYear(), focusedDay.getMonth() + delta, focusedDay.getDate()));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusDay(addDays(focusedDay, event.key === 'Home' ? -focusedDay.getDay() : 6 - focusedDay.getDay()));
    }
  }

  function selectDay(date: Date) {
    setDay(date);
    setFocusedDay(date);
    if (date.getMonth() !== view.month) {
      setDirection(date > new Date(view.year, view.month, 1) ? 'next' : 'prev');
      setView(monthOf(date));
    }
  }

  const days = monthGrid(view);

  return (
    <div id={id} className="datetime-panel" role="group" aria-label="Escolher data e hora do sorteio">
      <div className="datetime-month">
        <button type="button" className="datetime-nav" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h3 aria-live="polite">{monthTitle(view)}</h3>
        <button type="button" className="datetime-nav" onClick={() => changeMonth(1)} aria-label="Próximo mês">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="datetime-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <abbr key={weekday.long} title={weekday.long}>
            {weekday.short}
          </abbr>
        ))}
      </div>

      <div
        key={`${view.year}-${view.month}`}
        ref={gridRef}
        className={`datetime-grid ${direction ? `datetime-grid-${direction}` : ''}`}
        onKeyDown={handleGridKey}
      >
        {days.map((date) => {
          const outside = date.getMonth() !== view.month;
          const selected = sameDay(date, day);
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={[
                'datetime-day',
                outside && 'datetime-day-outside',
                sameDay(date, today) && 'datetime-day-today',
                selected && 'datetime-day-selected',
              ]
                .filter(Boolean)
                .join(' ')}
              tabIndex={sameDay(date, focusedDay) ? 0 : -1}
              aria-label={dayLabel(date)}
              aria-pressed={selected}
              onClick={() => selectDay(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="datetime-time">
        <span className="datetime-time-label">Horário</span>
        <div className="datetime-clock">
          <TimeStepper
            value={hours}
            label="hora"
            onStep={(delta) => setHours((value) => stepTime(value, delta, 24))}
          />
          <span className="datetime-colon" aria-hidden="true">
            :
          </span>
          <TimeStepper
            value={minutes}
            label="minutos"
            onStep={(delta) => setMinutes((value) => stepTime(value - (value % MINUTE_STEP), delta * MINUTE_STEP, 60))}
          />
        </div>
        <div className="datetime-quick" role="list" aria-label="Horários comuns">
          {QUICK_TIMES.map(([h, m]) => (
            <button
              key={`${h}:${m}`}
              type="button"
              role="listitem"
              className={`datetime-chip ${h === hours && m === minutes ? 'datetime-chip-active' : ''}`}
              onClick={() => {
                setHours(h);
                setMinutes(m);
              }}
            >
              {pad(h)}:{pad(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="datetime-actions">
        <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={() => onConfirm(null)}>
          Sem data
        </button>
        <div className="datetime-actions-end">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!day}
            onClick={() => day && onConfirm(withTime(day, hours, minutes))}
          >
            {day ? `Confirmar ${pad(day.getDate())}/${pad(day.getMonth() + 1)} às ${pad(hours)}:${pad(minutes)}` : 'Escolha um dia'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeStepper({ value, label, onStep }: { value: number; label: string; onStep(delta: number): void }) {
  return (
    <div className="datetime-stepper">
      <button type="button" className="datetime-step" onClick={() => onStep(1)} aria-label={`Aumentar ${label}`}>
        <Plus size={18} aria-hidden="true" />
      </button>
      <output className="datetime-digits" aria-label={label}>
        {pad(value)}
      </output>
      <button type="button" className="datetime-step" onClick={() => onStep(-1)} aria-label={`Diminuir ${label}`}>
        <Minus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
