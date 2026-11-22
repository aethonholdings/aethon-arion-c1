import { lastValueFrom, map } from "rxjs";
import { Logger, RandomStreamFactory, LogLine, SimConfigDTO } from "aethon-arion-pipeline";
import { brokenC1SimulationConfig, simpleC1SimulationConfig, simpleC1SimulationConfigResult } from "./init/test.init.simconfig";
import { C1 } from "../src/constants/c1.model.constants";

describe("Simple C1 Simulation", () => {
    const logger: Logger = new Logger();
    let logger$: Promise<LogLine> | undefined;

    beforeAll(() => {
        // Set verbose to true to see logs during test execution
        const verbose = false;
        if (verbose) {
            logger$ = lastValueFrom(
                logger.getObservable$().pipe(
                    map((logLine) => {
                        console.log(logLine);
                        return logLine;
                    })
                )
            );
        }
    });

    it("initialises a simulation", () => {
        const simulation = C1.createSimulation(simpleC1SimulationConfig as SimConfigDTO, logger, RandomStreamFactory.seeded(1, 1));
        expect(simulation).not.toBeNull();
    });

    it("does not initialise a broken simconfig", () => {
        expect(() => C1.createSimulation({} as SimConfigDTO, logger, new RandomStreamFactory())).toThrow();
        expect(() => C1.createSimulation(brokenC1SimulationConfig as SimConfigDTO, logger, new RandomStreamFactory())).toThrow();
    });

    it("runs the simulation without control step", async () => {
        // reproducible streams: the run is deterministic and must match the recorded tensor
        const run = async () => {
            const simulation = C1.createSimulation(
                simpleC1SimulationConfig as SimConfigDTO,
                logger,
                RandomStreamFactory.seeded(1, 1)
            );
            return (await lastValueFrom(simulation.run$())).organisation.getAgents().getTensors().priorityTensor;
        };
        const tensor = await run();
        expect(tensor).toEqual(await run());
        tensor.flat(2).forEach((p: number, i: number) =>
            expect(p).toBeCloseTo(simpleC1SimulationConfigResult.flat(2)[i], 6)
        );
        // with relative incentive gaps the judgment term drives every agent towards the Action state
        for (const agent of tensor) for (const row of agent) expect(row[0]).toBeGreaterThan(0.9);
    });
});
