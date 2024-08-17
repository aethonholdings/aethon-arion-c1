import { SimulationConfig, Organisation, Logger, RandomStreamFactory, Simulation } from "aethon-arion-pipeline";
import { C1OrgModelConfig } from "../../interfaces/c1.model.interfaces";
import { C1Organisation } from "./class.c1.organisation";

export class C1Simulation extends Simulation {
    constructor(simConfig: SimulationConfig, logger: Logger, randomStreamFactory: RandomStreamFactory) {
        super(simConfig, logger, randomStreamFactory);
    }

    protected initialiseOrg(): Organisation {
        if (this.orgModelConfig.type === "C1") {
            return new C1Organisation(
                this.clockTicks,
                this.orgModelConfig as C1OrgModelConfig,
                this.randomStreamFactory,
                this.logger
            );
        } else {
            throw new Error(`Unsupported organisation model type: ${this.orgModelConfig.type}`);
        }
    }
}
