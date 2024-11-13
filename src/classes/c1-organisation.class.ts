import { Organisation, RandomStreamFactory, Logger } from "aethon-arion-pipeline";
import { C1OrgModelConfig } from '../interfaces/c1.model.interfaces';
import { C1Plant } from "./c1-plant.class";
import { C1Reporting } from "./c1-reporting.class";
import { C1Board } from "./c1-board.class";
import { C1AgentSet } from "./c1-agent-set.class";

export class C1Organisation extends Organisation {
    private config: C1OrgModelConfig;

    constructor(
        clockTicks: number,
        config: C1OrgModelConfig,
        randomStreamFactory: RandomStreamFactory,
        logger: Logger
    ) {
        logger.trace({sourceObject: "Organisation", message: "Initialising C1 Organisation model"});
        const agentSet = new C1AgentSet(config, randomStreamFactory.newStream(), logger);
        const plant = new C1Plant(config, randomStreamFactory.newStream(), logger);
        const reporting = new C1Reporting(config, logger);
        const board = new C1Board(config, clockTicks, reporting.getReportingTensor(), logger);
        super(board, agentSet, plant, reporting, logger);
        this.config = config;
        this._log("C1 Organisation model initialised");
    }
}
