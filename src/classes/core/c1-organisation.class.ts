import { Organisation, RandomStreamFactory, Logger, SimulationConfig } from "aethon-arion-pipeline";
import { C1Plant } from "./c1-plant.class";
import { C1Reporting } from "./c1-reporting.class";
import { C1Board } from "./c1-board.class";
import { C1AgentSet } from "./c1-agent-set.class";

export class C1Organisation extends Organisation {
    constructor(simConfig: SimulationConfig, randomStreamFactory: RandomStreamFactory, logger: Logger) {
        logger.trace({ sourceObject: "Organisation", message: "Initialising C1 Organisation model" });
        const orgConfig = simConfig.orgConfig;
        if (orgConfig) {
            const clockTicks = (simConfig.days * 8 * 60 * 60) / orgConfig.clockTickSeconds;
            const agentSet = new C1AgentSet(orgConfig, randomStreamFactory.newStream(), logger);
            const plant = new C1Plant(orgConfig, randomStreamFactory.newStream(), logger);
            const reporting = new C1Reporting(orgConfig, logger);
            const board = new C1Board(orgConfig, clockTicks, reporting.getReportingTensor(), logger);
            super(board, agentSet, plant, reporting, logger);
            this._log("C1 Organisation model initialised");
        } else {
            throw new Error("No OrgConfig found for SimulationConfig");
        }
    }
}
