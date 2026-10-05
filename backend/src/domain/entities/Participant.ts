import { InvalidInputError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';
import { normalizeName } from '../shared/text.ts';
import { Email } from '../value-objects/Email.ts';
import { Phone } from '../value-objects/Phone.ts';

export interface ParticipantProps {
  id: string;
  eventId: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: Date;
}

export interface CreateParticipantProps {
  id: string;
  eventId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  now: Date;
}

export class Participant {
  private constructor(private readonly props: ParticipantProps) {}

  /** The phone is mandatory: with the e-mail, it is what keeps a person from entering twice. */
  static create(input: CreateParticipantProps): Participant {
    const name = normalizeName(input.name, ErrorCode.InvalidParticipantName);
    if (!input.phone?.trim()) throw new InvalidInputError(ErrorCode.PhoneRequired, { field: 'phone' });
    return new Participant({
      id: input.id,
      eventId: input.eventId,
      name,
      phone: Phone.create(input.phone).value,
      email: Email.createOptional(input.email)?.value ?? null,
      createdAt: input.now,
    });
  }

  static restore(props: ParticipantProps): Participant {
    return new Participant({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get name(): string {
    return this.props.name;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get email(): string | null {
    return this.props.email;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  belongsTo(eventId: string): boolean {
    return this.props.eventId === eventId;
  }
}
