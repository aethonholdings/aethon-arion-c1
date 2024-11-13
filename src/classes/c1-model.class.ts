import { Configurator, Logger, Model } from "aethon-arion-pipeline";
import { C1SimulationFactory } from "./c1-simulation-factory.class";
import { C1ModelName, C1ReportingVariablesIndex } from "../constants/c1.model.constants";
import { C1Reporting } from "./c1-reporting.class";

export class C1Model extends Model {
    protected simulationFactory: C1SimulationFactory;
    protected configurators: Configurator<C1Model>[];
    private logger: Logger;

    constructor(configurators: Configurator<C1Model>[], logger: Logger) {
        super(C1ModelName);
        this.configurators = configurators;
        this.simulationFactory = new C1SimulationFactory(this);
        this.logger = logger;
    }

    calculatePerformance(reporting: C1Reporting): number | undefined {
        const reportingTensor = reporting.getReportingTensor();
        const headcount = reportingTensor[C1ReportingVariablesIndex.HEADCOUNT];
        if (headcount === 0) {
            this.logger.error({sourceObject: this.name, message: "Performance estimate attemempted against headcount of zero"})
            return undefined;
        };
        const revenue = reportingTensor[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }
}
