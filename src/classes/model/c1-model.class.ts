import { Logger, Model, Organisation, RandomStreamFactory, ResultDTO, SimulationConfig } from "aethon-arion-pipeline";
import { C1ModelName, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";
import { C1Organisation } from "../core/c1-organisation.class";
import { C1Result } from "../analysis/c1-result.class";
import { C1BaseConfigurator } from "../configurators/c1-configurator.class";

export class C1Model extends Model {
    constructor() {
        super(C1ModelName);
    }

    getPerformance(resultDTO: ResultDTO): number | undefined {
        const reportingTensor = resultDTO.reporting;
        const headcount = reportingTensor[C1ReportingVariablesIndex.HEADCOUNT];
        if (headcount === 0) return undefined;
        const revenue = reportingTensor[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }

    createResult(resultDTO: ResultDTO): C1Result {
        return new C1Result(resultDTO);
    }

    protected createNewOrganisationInstance(
        simConfig: SimulationConfig,
        randomStreamFactory: RandomStreamFactory,
        logger: Logger
    ): Organisation {
        return new C1Organisation(simConfig, randomStreamFactory, logger);
    }

    protected initialiseConfigurators(): void {
        this._configurators = [new C1BaseConfigurator(this)];
    }
}
