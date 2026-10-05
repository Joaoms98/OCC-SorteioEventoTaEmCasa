import { BusinessRuleError, InvalidInputError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';
import { normalizeName, normalizeOptionalText } from '../shared/text.ts';

export const PRIZE_MAX_QUANTITY = 10_000;

export interface PrizeProps {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  quantity: number;
  /** When the current photo was set (also used to bust caches); null when the prize has no photo. */
  imageUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrizeProps {
  id: string;
  eventId: string;
  name: string;
  description?: string | null;
  quantity: number;
  now: Date;
}

export type PrizeChanges = Partial<Pick<PrizeProps, 'name' | 'description' | 'quantity'>>;

export class Prize {
  private constructor(private readonly props: PrizeProps) {}

  static create(input: CreatePrizeProps): Prize {
    return new Prize({
      id: input.id,
      eventId: input.eventId,
      name: normalizeName(input.name, ErrorCode.InvalidPrizeName),
      description: normalizeOptionalText(input.description),
      quantity: Prize.validateQuantity(input.quantity),
      imageUpdatedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: PrizeProps): Prize {
    return new Prize({ ...props });
  }

  private static validateQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > PRIZE_MAX_QUANTITY) {
      throw new InvalidInputError(ErrorCode.InvalidPrizeQuantity);
    }
    return quantity;
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

  get description(): string | null {
    return this.props.description;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get imageUpdatedAt(): Date | null {
    return this.props.imageUpdatedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  belongsTo(eventId: string): boolean {
    return this.props.eventId === eventId;
  }

  imageChanged(now: Date): void {
    this.props.imageUpdatedAt = now;
    this.props.updatedAt = now;
  }

  imageRemoved(now: Date): void {
    this.props.imageUpdatedAt = null;
    this.props.updatedAt = now;
  }

  remainingUnits(drawnUnits: number): number {
    return Math.max(this.props.quantity - drawnUnits, 0);
  }

  ensureAvailable(drawnUnits: number): void {
    if (this.remainingUnits(drawnUnits) === 0) {
      throw new BusinessRuleError(ErrorCode.PrizeOutOfStock);
    }
  }

  update(changes: PrizeChanges, drawnUnits: number, now: Date): void {
    const name = changes.name !== undefined ? normalizeName(changes.name, ErrorCode.InvalidPrizeName) : this.props.name;
    const quantity = changes.quantity !== undefined ? Prize.validateQuantity(changes.quantity) : this.props.quantity;
    if (quantity < drawnUnits) {
      throw new BusinessRuleError(ErrorCode.PrizeQuantityBelowDrawn, { drawnUnits });
    }
    this.props.name = name;
    this.props.quantity = quantity;
    if (changes.description !== undefined) this.props.description = normalizeOptionalText(changes.description);
    this.props.updatedAt = now;
  }
}
