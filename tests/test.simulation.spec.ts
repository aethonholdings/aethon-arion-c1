import { lastValueFrom, map } from "rxjs";
import { Logger, RandomStreamFactory, LogLine, SimulationConfig } from "aethon-arion-pipeline";
import { brokenC1SimulationConfig, simpleC1SimulationConfigResult } from "./init/test.init.simconfig";
import { C1Simulation } from "../src/classes/model/class.c1.simulation";

export function runSimulationTest(description: string, simConfig: SimulationConfig, verbose: boolean = false) {
    const logger: Logger = new Logger();
    let logger$: Promise<LogLine> | undefined;

    describe(description, () => {
        let simulation: C1Simulation;

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
            simulation = new C1Simulation(simConfig, logger, new RandomStreamFactory());
            expect(simulation).not.toBeNull();
        });

        it("does not initialise a broken simconfig", () => {
            expect(() => new C1Simulation({} as SimulationConfig, logger, new RandomStreamFactory())).toThrow();
            expect(() => new C1Simulation(brokenC1SimulationConfig, logger, new RandomStreamFactory())).toThrowError();
        })

        it("runs the simulation without control step", async () => {
            const last = await lastValueFrom(simulation.run$());
            expect(last.organisation.getAgents().getTensors().priorityTensor).toEqual(
                simpleC1SimulationConfigResult
            );
        });
    });
}
