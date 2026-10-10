import { BusinessRuleError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';
import { normalizeName, normalizeOptionalText } from '../shared/text.ts';

/**
 * How the raffle works. The organizer spins a live roulette of prizes (the prize is drawn too) or
 * of participants' names; or, on the interactive roulette, whoever registers spins a prize
 * roulette on their own phone and always wins something while there is stock.
 */
export const DrawMode = {
  Prizes: 'PRIZES',
  Participants: 'PARTICIPANTS',
  Interactive: 'INTERACTIVE',
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

  /** Interactive roulette: participants register themselves and spin their own wheel. */
  get isInteractive(): boolean {
    return this.props.drawMode === DrawMode.Interactive;
  }

  /** On the interactive roulette nobody is drawn by the organizer. */
  ensureOrganizerDraws(): void {
    if (this.isInteractive) throw new BusinessRuleError(ErrorCode.OrganizerDrawNotAllowed);
  }

  /** On the interactive roulette a registration is a spin, so it has to come from the person. */
  ensureOrganizerRegisters(): void {
    if (this.isInteractive) throw new BusinessRuleError(ErrorCode.ManualRegistrationNotAllowed);
  }

  /** On the interactive roulette registering is spinning: one step, with no e-mail code. */
  ensureRegistersByEmailCode(): void {
    if (this.isInteractive) throw new BusinessRuleError(ErrorCode.EmailCodeNotUsed);
  }

  /** Only the interactive roulette gives a prize for registering. */
  ensureSpinsOnRegistration(): void {
    if (!this.isInteractive) throw new BusinessRuleError(ErrorCode.NotInteractiveRoulette);
  }

  ensureRegistrationOpen(): void {
    if (!this.props.registrationOpen) {
      throw new BusinessRuleError(ErrorCode.RegistrationClosed);
    }
  }
}
