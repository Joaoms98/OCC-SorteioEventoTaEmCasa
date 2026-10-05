import { DrawStatus } from '../../../domain/entities/Draw.ts';
import type { Event } from '../../../domain/entities/Event.ts';
import type { DrawDetails, DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { LiveDrawChannel } from '../../ports/LiveDrawChannel.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import { toPrizeAvailability, type PrizeAvailability } from '../prizes/PrizeAvailability.ts';
import { requireEvent } from '../shared/guards.ts';

const RECENT_WINNERS = 12;
export const ROLL_NAMES = 60;

export interface LiveBoard {
  event: Event;
  prizes: PrizeAvailability[];
  recentWinners: DrawDetails[];
  participants: number;
  eligibleParticipants: number;
  rollNames: string[];
}

/** Public scoreboard of the live draw: what any viewer may see right now. */
export class GetLiveBoard {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
    private readonly live: LiveDrawChannel,
    private readonly random: RandomNumberGenerator,
  ) {}

  async execute(input: { eventId: string }): Promise<LiveBoard> {
    const event = await requireEvent(this.events, input.eventId);
    const [prizes, drawnByPrize, draws, participants, eligibleParticipants, rollNames] = await Promise.all([
      this.prizes.findByEvent(event.id),
      this.draws.countConfirmedByEventGroupedByPrize(event.id),
      this.draws.findDetailsByEvent(event.id),
      this.participants.countByEvent(event.id),
      this.participants.countEligibleForDraw(event.id),
      this.participants.sampleEligibleNames(event.id, ROLL_NAMES),
    ]);

    // Read the stage only after the queries: a draw is claimed before it is committed, so any
    // draw the queries could see whose winner is still a secret is guaranteed to be hidden here.
    const hiddenDrawId = this.live.pending(event.id)?.drawId;
    const recentWinners = draws
      .filter(({ draw }) => draw.status === DrawStatus.Confirmed && draw.id !== hiddenDrawId)
      .slice(0, RECENT_WINNERS);

    // While the roulette spins, counts must not give the result away nor remove its slice:
    // present the board as it was before the hidden draw (when the queries already saw it).
    const hidden = draws.find(({ draw }) => draw.id === hiddenDrawId && draw.status === DrawStatus.Confirmed);
    const drawnUnitsOf = (prizeId: string) =>
      (drawnByPrize.get(prizeId) ?? 0) - (hidden?.draw.prizeId === prizeId ? 1 : 0);

    return {
      event,
      prizes: prizes.map((prize) => toPrizeAvailability(prize, drawnUnitsOf(prize.id))),
      recentWinners,
      participants,
      eligibleParticipants: eligibleParticipants + (hidden ? 1 : 0),
      rollNames: hidden
        ? this.withHiddenContender(rollNames, hidden.participant.name, eligibleParticipants + 1)
        : rollNames,
    };
  }

  /**
   * The winner of the hidden draw is no longer eligible, so the sample never has them: the one name
   * missing from the list would give the winner away. Put them back with the odds of any other
   * contender: always while everybody fits in the list, otherwise ROLL_NAMES chances in `contenders`.
   */
  private withHiddenContender(sample: string[], winnerName: string, contenders: number): string[] {
    if (sample.length < ROLL_NAMES) {
      const index = this.random.nextInt(sample.length + 1);
      return [...sample.slice(0, index), winnerName, ...sample.slice(index)];
    }
    if (this.random.nextInt(contenders) >= ROLL_NAMES) return sample;
    const index = this.random.nextInt(sample.length);
    return sample.map((name, position) => (position === index ? winnerName : name));
  }
}
