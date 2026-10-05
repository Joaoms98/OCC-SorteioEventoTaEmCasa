import { BusinessRuleError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';
import { normalizeName, normalizeOptionalText } from '../shared/text.ts';

/** What the live roulette spins: the prizes (the prize is drawn) or the participants' names. */
export const DrawMode = {
  Prizes: 'PRIZES',
  Participants: 'PARTICIPANTS',
} as const;

export type DrawMode = (typeof DrawMode)[keyof typeof DrawMode];

export interface EventProps {
  id: string;
  name: string;
  description: string | null;
  eventDate: Date | null;
  registrationOpen: boolean;
  drawMode: DrawMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventProps {
  id: string;
  name: string;
  description?: string | null;
  eventDate?: Date | null;
  registrationOpen?: boolean;
  drawMode?: DrawMode;
  now: Date;
}

export type EventChanges = Partial<
  Pick<EventProps, 'name' | 'description' | 'eventDate' | 'registrationOpen' | 'drawMode'>
>;

export class Event {
  private constructor(private readonly props: EventProps) {}

  static create(input: CreateEventProps): Event {
    return new Event({
      id: input.id,
      name: normalizeName(input.name, ErrorCode.InvalidEventName),
      description: normalizeOptionalText(input.description),
      eventDate: input.eventDate ?? null,
      registrationOpen: input.registrationOpen ?? false,
      drawMode: input.drawMode ?? DrawMode.Prizes,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: EventProps): Event {
    return new Event({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get eventDate(): Date | null {
    return this.props.eventDate;
  }

  get registrationOpen(): boolean {
    return this.props.registrationOpen;
  }

  get drawMode(): DrawMode {
    return this.props.drawMode;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(changes: EventChanges, now: Date): void {
    if (changes.name !== undefined) this.props.name = normalizeName(changes.name, ErrorCode.InvalidEventName);
    if (changes.description !== undefined) this.props.description = normalizeOptionalText(changes.description);
    if (changes.eventDate !== undefined) this.props.eventDate = changes.eventDate;
    if (changes.registrationOpen !== undefined) this.props.registrationOpen = changes.registrationOpen;
    if (changes.drawMode !== undefined) this.props.drawMode = changes.drawMode;
    this.props.updatedAt = now;
  }

  ensureRegistrationOpen(): void {
    if (!this.props.registrationOpen) {
      throw new BusinessRuleError(ErrorCode.RegistrationClosed);
    }
  }
}
