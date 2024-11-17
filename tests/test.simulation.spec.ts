import { lastValueFrom, map } from "rxjs";
import { Logger, RandomStreamFactory, LogLine, SimulationConfig, SimConfigDTO } from "aethon-arion-pipeline";
import { brokenC1SimulationConfig, simpleC1SimulationConfigResult } from "./init/test.init.simconfig";
import { C1 } from "../src/constants/c1.model.constants";

export function runSimulationTest(description: string, simConfig: SimulationConfig, verbose: boolean = false) {
    const logger: Logger = new Logger();
    let logger$: Promise<LogLine> | undefined;

    describe(description, () => {
        beforeAll(() => {
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
            const simulation = C1.createSimulation(simConfig as SimConfigDTO, logger, new RandomStreamFactory());
            expect(simulation).not.toBeNull();
        });

        it("does not initialise a broken simconfig", () => {
            expect(() => C1.createSimulation({} as SimConfigDTO, logger, new RandomStreamFactory())).toThrowError();
            expect(() => C1.createSimulation(brokenC1SimulationConfig as SimConfigDTO, logger, new RandomStreamFactory())).toThrowError();
        })

        it("runs the simulation without control step", async () => {
            const simulation = C1.createSimulation(simConfig as SimConfigDTO, logger, new RandomStreamFactory());
            const last = await lastValueFrom(simulation.run$());
            expect(last.organisation.getAgents().getTensors().priorityTensor).toEqual(
                simpleC1SimulationConfigResult
            );
        });
    });
}
