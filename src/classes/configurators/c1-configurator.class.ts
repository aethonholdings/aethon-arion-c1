import { AgentSetTensorsDTO, Utils, Configurator, OrgConfigDTO } from "aethon-arion-pipeline";
import {
    C1AgentStateIndex,
    C1AgentStatesArray,
    C1ModelClockTickSeconds,
    C1ModelName,
    C1PlantStateVariablesArray,
    C1ReportingVariablesArray,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData, C1ConfiguratorParamsDTO, C1PlantConfig, C1ReportingConfig } from "../../interfaces/c1.interfaces";
import { C1Model } from "../model/c1-model.class";

export class C1BaseConfigurator extends Configurator {
    stateCount: number = C1AgentStatesArray.length;
    plantDegreesOfFreedom: number = C1PlantStateVariablesArray.length;
    reportingDegreesOfFreedom: number = C1ReportingVariablesArray.length;

    constructor(model: C1Model) {
        super(model, c1BaseConfiguratorName);
    }

    generate(params: C1ConfiguratorParamsDTO): OrgConfigDTO {
        let agentCount: number;
        params.data.spans > 1
            ? (agentCount = (params.data.spans ** params.data.layers - 1) / (params.data.spans - 1))
            : (agentCount = params.data.layers);

        // initialise the org config tensors with zeroes
        const agentSetTensors: AgentSetTensorsDTO = {
            priorityTensor: Utils.tensor([agentCount, this.stateCount, this.stateCount], () => {
                return 0;
            }) as number[][][],
            influenceTensor: Utils.tensor([agentCount, agentCount, this.stateCount, this.stateCount], () => {
                return 0;
            }) as number[][][][],
            judgmentTensor: Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.plantDegreesOfFreedom],
                () => {
                    return 0;
                }
            ) as number[][][][],
            incentiveTensor: Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.reportingDegreesOfFreedom],
                () => {
                    return 0;
                }
            ) as number[][][][]
        };

        // generate the relationship graph matrix
        let parentAlpha: number = 0;
        let layer: number = 1;
        let layerAlphaEnd: number = params.data.spans;
        const graph: number[][] = Utils.tensor([agentCount, agentCount], () => {
            return 0;
        }) as number[][];
        for (let alpha = 1; alpha < agentCount; alpha++) {
            graph[parentAlpha][alpha] = 1;
            graph[alpha][parentAlpha] = 1;
            if (alpha % params.data.spans === 0) parentAlpha++;
            if (params.data.graph === "teams" && params.data.spans !== 1) {
                const startIndex = Math.floor(alpha / params.data.spans) * params.data.spans;
                const endIndex = startIndex + params.data.spans;
                for (let beta = startIndex; beta < endIndex; beta++) {
                    if (beta < agentCount && beta !== alpha) {
                        graph[beta + 1][alpha + 1] = 1;
                        graph[alpha + 1][beta + 1] = 1;
                    }
                }
            }
            if (alpha === layerAlphaEnd) {
                layer++;
                layerAlphaEnd = layerAlphaEnd + params.data.spans ** layer;
            }
        }

        // for random and hybrid initialisation, replace the zeroes in the initialised matrices
        if (params.data.matrixInit.judgment === "random" || params.data.matrixInit.judgment === "hybrid")
            agentSetTensors.judgmentTensor = Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.plantDegreesOfFreedom],
                () => {
                    return (2 * Math.random() - 1) * params.data.gains.judgment;
                }
            ) as number[][][][];
        if (params.data.matrixInit.incentive === "random" || params.data.matrixInit.incentive === "hybrid")
            agentSetTensors.incentiveTensor = Utils.tensor(
                [agentCount, this.stateCount, this.stateCount, this.reportingDegreesOfFreedom],
                () => {
                    return (2 * Math.random() - 1) * params.data.gains.incentive;
                }
            ) as number[][][][];

        // for purposeful and hybrid matrix initialisers, set up the parameters based on gains
        for (let sigma = 0; sigma < this.stateCount; sigma++) {
            for (let tau = 0; tau < this.stateCount; tau++) {
                for (let alpha = 0; alpha < agentCount; alpha++) {
                    for (let beta = 0; beta < agentCount; beta++) {
                        if (
                            params.data.matrixInit.influence === "purposeful" ||
                            params.data.matrixInit.influence === "hybrid"
                        )
                            agentSetTensors.influenceTensor[alpha][beta][sigma][tau] =
                                -params.data.gains.influence * graph[alpha][beta];
                        if (params.data.matrixInit.influence === "random")
                            agentSetTensors.influenceTensor[alpha][beta][sigma][tau] =
                                params.data.gains.influence * graph[alpha][beta] * (2 * Math.random() - 1);
                    }
                    for (let gamma = 0; gamma < this.stateCount; gamma++) {
                        if (
                            params.data.matrixInit.incentive === "purposeful" ||
                            params.data.matrixInit.incentive === "hybrid"
                        ) {
                            if (tau === C1AgentStateIndex.ACTION && gamma === C1ReportingVariablesIndex.REVENUE)
                                agentSetTensors.incentiveTensor[alpha][sigma][tau][gamma] =
                                    -params.data.gains.incentive;
                            if (tau === C1AgentStateIndex.SELF && gamma === C1ReportingVariablesIndex.REVENUE)
                                agentSetTensors.incentiveTensor[alpha][sigma][tau][gamma] = params.data.gains.incentive;
                        }
                    }
                }
            }
        }

        for (let alpha = 0; alpha < agentCount; alpha++) {
            if (params.data.matrixInit.judgment === "purposeful" || params.data.matrixInit.influence === "hybrid") {
                agentSetTensors.judgmentTensor[alpha] = [
                    [[-params.data.gains.judgment], [params.data.gains.judgment]],
                    [[-params.data.gains.judgment], [params.data.gains.judgment]]
                ];
            }
        }

        // set up the priority tensor
        for (let alpha = 0; alpha < agentCount; alpha++) {
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.ACTION][C1AgentStateIndex.ACTION] =
                params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.SELF][C1AgentStateIndex.ACTION] =
                params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.ACTION][C1AgentStateIndex.SELF] =
                1 - params.data.actionStateProbability;
            agentSetTensors.priorityTensor[alpha][C1AgentStateIndex.SELF][C1AgentStateIndex.SELF] =
                1 - params.data.actionStateProbability;
        }

        // package the configuration into the DTO
        const configDTO = {} as OrgConfigDTO;
        configDTO.type = C1ModelName;
        configDTO.clockTickSeconds = C1ModelClockTickSeconds;
        configDTO.board = {
            controlStep: params.data.board.controlStep
        };
        configDTO.plant = {
            initialState: [0],
            graph: graph
        } as C1PlantConfig;
        configDTO.configuratorParams = params;
        configDTO.reporting = {
            unitPrice: 1,
            unitPayroll: 1
        } as C1ReportingConfig;
        configDTO.agentCount = agentCount;
        configDTO.agentSet = agentSetTensors;
        configDTO.priorityIntensity = Utils.modulo(agentSetTensors.priorityTensor);
        configDTO.influenceIntensity = Utils.modulo(agentSetTensors.influenceTensor);
        configDTO.judgmentIntensity = Utils.modulo(agentSetTensors.judgmentTensor);
        configDTO.incentiveIntensity = Utils.modulo(agentSetTensors.incentiveTensor);
        return configDTO;
    }

    getDefaultParams(): C1ConfiguratorParamsDTO {
        return {
            modelName: C1ModelName,
            configuratorName: c1BaseConfiguratorName,
            data: c1BaseConfiguratorDefaultData,
            hash: this.model.hashObject(c1BaseConfiguratorDefaultData)
        };
    }
}

export const c1BaseConfiguratorName: string = "C1Configurator";
export const c1BaseConfiguratorDefaultData: C1ConfiguratorParamData = {
        spans: 1,
        layers: 1,
        gains: {
            influence: 0.00001,
            judgment: 0.00001,
            incentive: 0.00000001
        },
        actionStateProbability: 0.85,
        graph: "teams",
        matrixInit: {
            influence: "random",
            judgment: "random",
            incentive: "random"
        },
        reporting: {
            unitPayroll: 1,
            unitPrice: 1
        },
        board: {
            controlStep: false
        }
    };
    