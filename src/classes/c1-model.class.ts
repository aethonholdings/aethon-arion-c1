import {
    Configurator,
    Logger,
    Model,
    Organisation,
    RandomStreamFactory,
    ResultDTO,
    SimConfigDTO,
    SimulationConfig
} from "aethon-arion-pipeline";
import { C1ModelName, C1ReportingVariablesIndex } from "../constants/c1.model.constants";
import { C1Configurator } from "./c1-configurator.class";
import { C1Organisation } from "./c1-organisation.class";

export class C1Model extends Model {
    protected configurators: Configurator<C1Model>[] = [];

    constructor() {
        super(C1ModelName);
        this.configurators.push(new C1Configurator(this));
    }

    getPerformance(resultDTO: ResultDTO): number | undefined {
        const reportingTensor = resultDTO.reporting;
        const headcount = reportingTensor[C1ReportingVariablesIndex.HEADCOUNT];
        if (headcount === 0) return undefined;
        const revenue = reportingTensor[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }

    getNewOrganisation(
        simConfigDTO: SimConfigDTO,
        randomStreamFactory: RandomStreamFactory,
        logger: Logger
    ): Organisation {
        if(simConfigDTO.orgConfig) {
            const simConfig = simConfigDTO as SimulationConfig;
            return new C1Organisation(simConfig, randomStreamFactory, logger);
        } else {
            throw new Error(`No orgConfig found for simConfigDTO ${simConfigDTO.id}`);
        }
        
    }
}
