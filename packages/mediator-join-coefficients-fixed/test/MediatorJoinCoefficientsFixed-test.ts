import type { IActionRdfJoin } from '@comunica/bus-rdf-join';
import { KeysCore, KeysQueryOperation } from '@comunica/context-entries';
import type { IAction, IActorOutput, TestResult } from '@comunica/core';
import { failTest, passTest, ActionContext, Actor, Bus } from '@comunica/core';
import type { IMediatorTypeJoinCoefficients } from '@comunica/mediatortype-join-coefficients';
import type { IActionContext } from '@comunica/types';
import { DataFactory } from 'rdf-data-factory';
import { MediatorJoinCoefficientsFixed } from '../lib/MediatorJoinCoefficientsFixed';

const DF = new DataFactory();

describe('MediatorJoinCoefficientsFixed', () => {
  describe('An MediatorJoinCoefficientsFixed instance', () => {
    let bus: any;
    let context: IActionContext;
    let mediator: MediatorJoinCoefficientsFixed;
    let debugLog: any;
    let action: IActionRdfJoin;

    beforeEach(() => {
      bus = new Bus({ name: 'bus' });
      context = new ActionContext();
      mediator = new MediatorJoinCoefficientsFixed({
        name: 'mediator',
        bus,
        cpuWeight: 1,
        memoryWeight: 1,
        timeWeight: 1,
        ioWeight: 1,
      });
      debugLog = jest.fn();
      action = <any> {
        entries: [
          {
            output: <any> {
              type: 'bindings',
              metadata: () => Promise.resolve({
                cardinality: { type: 'estimate', value: 10 },
                variables: [ DF.variable('V') ],
              }),
            },
            operation: <any> {},
          },
        ],
        context: new ActionContext({
          [KeysCore.log.name]: {
            debug: debugLog,
          },
        }),
      };
    });

    it('should throw if no actors are registered', async() => {
      await expect(mediator.mediate(action))
        .rejects.toThrow('No actors are able to reply to a message in the bus bus');
    });

    it('should throw if all actors reject', async() => {
      new DummyActor(1, <any>{}, bus, true);
      new DummyActor(2, <any>{}, bus, true);
      new DummyActor(3, <any>{}, bus, true);

      await expect(mediator.mediate(action))
        .rejects.toThrow(`BUS FAIL MESSAGE
    Error messages of failing actors:
        Actor 1 fails
        Actor 2 fails
        Actor 3 fails`);
    });

    it('should handle a single actor', async() => {
      new DummyActor(1, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);

      await expect(mediator.mediate(action)).resolves.toEqual({ id: 1 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL1'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 110,
          },
        },
      );
    });

    it('should handle a single actor with includeInLogs set to false', async() => {
      const actor = new DummyActor(1, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      actor.includeInLogs = false;

      await expect(mediator.mediate(action)).resolves.toEqual({ id: 1 });

      expect(debugLog).not.toHaveBeenCalled();
    });

    it('should handle multiple single actors', async() => {
      new DummyActor(1, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      new DummyActor(2, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus);
      new DummyActor(3, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 10,
      }, bus);

      await expect(mediator.mediate(action)).resolves.toEqual({ id: 2 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL2'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
            'LOGICAL-PHYSICAL2': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 20,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 10,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 110,
            'LOGICAL-PHYSICAL2': 80,
            'LOGICAL-PHYSICAL3': 1_060,
          },
        },
      );
    });

    it('should handle multiple single actors with one failing', async() => {
      new DummyActor(1, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      new DummyActor(2, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus, true);
      new DummyActor(3, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 10,
      }, bus);

      await expect(mediator.mediate(action)).resolves.toEqual({ id: 1 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL1'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 10,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 110,
            'LOGICAL-PHYSICAL3': 1_060,
          },
        },
      );
    });

    it('should handle multiple single actors with modified weights', async() => {
      mediator = new MediatorJoinCoefficientsFixed({
        name: 'mediator',
        bus,
        cpuWeight: 1,
        memoryWeight: 1,
        timeWeight: 1,
        ioWeight: 10_000,
      });

      new DummyActor(1, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      new DummyActor(2, {
        iterations: 10,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus);
      new DummyActor(3, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 10,
      }, bus);

      await expect(mediator.mediate(action)).resolves.toEqual({ id: 3 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL3'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
            'LOGICAL-PHYSICAL2': {
              iterations: 10,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 20,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 10,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 500_060,
            'LOGICAL-PHYSICAL2': 200_060,
            'LOGICAL-PHYSICAL3': 101_050,
          },
        },
      );
    });

    it('should prefer actors without blocking items with a limitIndicator', async() => {
      new DummyActor(1, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      new DummyActor(2, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus);
      new DummyActor(3, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 0,
        requestTime: 10,
      }, bus);

      action.context = action.context.set(KeysQueryOperation.limitIndicator, 10);
      await expect(mediator.mediate(action)).resolves.toEqual({ id: 3 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL3'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
            'LOGICAL-PHYSICAL2': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 20,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 0,
              requestTime: 10,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 1230,
            'LOGICAL-PHYSICAL2': 1200,
            'LOGICAL-PHYSICAL3': 1030,
          },
        },
      );
    });

    it('should prefer actors without blocking items with a limitIndicator in reverse order', async() => {
      new DummyActor(1, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 0,
        requestTime: 10,
      }, bus);
      new DummyActor(2, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus);
      new DummyActor(3, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);

      action.context = action.context.set(KeysQueryOperation.limitIndicator, 10);
      await expect(mediator.mediate(action)).resolves.toEqual({ id: 1 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL1'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 0,
              requestTime: 10,
            },
            'LOGICAL-PHYSICAL2': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 20,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 1030,
            'LOGICAL-PHYSICAL2': 1200,
            'LOGICAL-PHYSICAL3': 1230,
          },
        },
      );
    });

    it('should prefer actors without blocking items with a limitIndicator unless limit is high', async() => {
      new DummyActor(1, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 50,
      }, bus);
      new DummyActor(2, {
        iterations: 100,
        persistedItems: 20,
        blockingItems: 30,
        requestTime: 20,
      }, bus);
      new DummyActor(3, {
        iterations: 1_000,
        persistedItems: 20,
        blockingItems: 0,
        requestTime: 10,
      }, bus);

      action.context = action.context.set(KeysQueryOperation.limitIndicator, 200);
      await expect(mediator.mediate(action)).resolves.toEqual({ id: 2 });

      expect(debugLog).toHaveBeenCalledWith(
        `Determined physical join operator 'LOGICAL-PHYSICAL2'`,
        {
          entries: 1,
          variables: [[ 'V' ]],
          coefficients: {
            'LOGICAL-PHYSICAL1': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 50,
            },
            'LOGICAL-PHYSICAL2': {
              iterations: 100,
              persistedItems: 20,
              blockingItems: 30,
              requestTime: 20,
            },
            'LOGICAL-PHYSICAL3': {
              iterations: 1_000,
              persistedItems: 20,
              blockingItems: 0,
              requestTime: 10,
            },
          },
          costs: {
            'LOGICAL-PHYSICAL1': 200,
            'LOGICAL-PHYSICAL2': 170,
            'LOGICAL-PHYSICAL3': 1030,
          },
        },
      );
    });
  });
});

class DummyActor extends Actor<IAction, IMediatorTypeJoinCoefficients, IDummyOutput> {
  public includeInLogs = true;
  public logicalType = 'LOGICAL';
  public readonly physicalName: string;
  public readonly id: number;
  public readonly coeffs: IMediatorTypeJoinCoefficients;
  public readonly reject: boolean;

  public constructor(
    id: number,
    coeffs: IMediatorTypeJoinCoefficients,
    bus: Bus<DummyActor, IAction, IMediatorTypeJoinCoefficients, IDummyOutput>,
    reject = false,
  ) {
    super({ name: `dummy${id}`, bus, busFailMessage: 'BUS FAIL MESSAGE' });
    this.physicalName = `PHYSICAL${id}`;
    this.id = id;
    this.coeffs = coeffs;
    this.reject = reject;
  }

  public async test(action: IAction): Promise<TestResult<IMediatorTypeJoinCoefficients>> {
    if (this.reject) {
      return failTest(`Actor ${this.id} fails`);
    }
    return passTest(this.coeffs);
  }

  public async run(action: IAction): Promise<IDummyOutput> {
    return { id: this.id };
  }
}

interface IDummyOutput extends IActorOutput {
  id: number;
}
