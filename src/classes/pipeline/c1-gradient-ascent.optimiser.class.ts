import { Optimiser } from "aethon-arion-pipeline/src/classes/pipeline/optimiser.class";
import { C1GradientAscentOptimiserName } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";
import { GradientAscentDTO } from "aethon-arion-pipeline";

export class GradientAscentOptimiser extends Optimiser<C1ConfiguratorParamData, GradientAscentDTO> {
    constructor() {
        // learningRate: 0.01, maxIterations: 1000, tolerance: 0.0001
        super(C1GradientAscentOptimiserName);
    }

    next(configuratorParamData: C1ConfiguratorParamData): GradientAscentDTO {
        
        return {} as GradientAscentDTO;
    }

    testConvergence(optimiserData: GradientAscentDTO[]): boolean {
        return false;
    }
}
