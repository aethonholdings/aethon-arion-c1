import { C1Model } from "./c1-model.class";
import { C1Simulation } from "./c1-simulation.class";
import { Logger, RandomStreamFactory, SimulationConfig, SimulationFactory } from "aethon-arion-pipeline";

export class C1SimulationFactory extends SimulationFactory<C1Model> {
    
    constructor(c1Model: C1Model) {
        super(c1Model);
    }

    newSimulation(config: SimulationConfig, logger: Logger, randomStreamFactory: RandomStreamFactory): C1Simulation {
        return new C1Simulation(config, logger, randomStreamFactory);
    }
}