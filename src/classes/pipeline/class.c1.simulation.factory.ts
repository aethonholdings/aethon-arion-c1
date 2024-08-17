import { C1Simulation } from "../model/class.c1.simulation";
import { Logger, RandomStreamFactory, SimulationConfig, SimulationFactory } from "aethon-arion-pipeline";

export class C1SimulationFactory extends SimulationFactory {
    
    constructor() {
        super("C1");
    }

    newSimulation(config: SimulationConfig, logger: Logger, randomStreamFactory: RandomStreamFactory): C1Simulation {
        return new C1Simulation(config, logger, randomStreamFactory);
    }
}