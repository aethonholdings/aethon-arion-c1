import { Organisation, RandomStreamFactory, Logger } from "aethon-arion-pipeline";
import { C1OrgModelConfig } from '../../interfaces/c1.model.interfaces';
import { C1Plant } from "./class.c1.plant";
import { C1Reporting } from "./class.c1.reporting";
import { C1Board } from "./class.c1.board";
import { C1AgentSet } from "./class.c1.agent.set";

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
        const board = new C1Board(clockTicks, reporting.getReportingTensor(), logger);
        super(board, agentSet, plant, reporting, logger);
        this.config = config;
        this._log("C1 Organisation model initialised");
    }
}
