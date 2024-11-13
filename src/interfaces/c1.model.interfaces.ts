import {
    OrgModelConfig,
    AgentSetTensors,
    PlantConfig,
    ReportingConfig,
    ConfiguratorParamsDTO,
    ConfiguratorParamData
} from "aethon-arion-pipeline";
import { C1ConfiguratorInitType } from "../types/c1.types";

// CONFIG ---------------------------------
export interface C1OrgModelConfig extends OrgModelConfig {
    agentSet: AgentSetTensors;
    plant: C1PlantConfig;
    reporting: C1ReportingConfig;
    board: C1BoardConfig;
}

export interface C1PlantConfig extends PlantConfig {
    initialState: number[];
    graph: number[][];
}

export interface C1ReportingConfig extends ReportingConfig {
    unitPayroll: number;
    unitPrice: number;
}

export interface C1BoardConfig {
    controlStep: boolean;
}

export interface C1ConfiguratorParamData extends ConfiguratorParamData {
    spans: number; // org chart spans
    layers: number; // org chart layers
    gains: {
        influence: number; // gain applied to initialised tensor kernel in [0,1] range
        judgment: number; // gain applied to initialised tensor kernel in [0,1] range
        incentive: number; // gain applied to initialised tensor kernel in [0,1] range
    };
    graph: "top-down" | "teams"; // top-down is a typical tree org | teams is an org where each team is interconnected in an influence lattive
    actionStateProbability: number; // default is 85% (0.85) based on Johnson (1986)
    matrixInit: {
        influence: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
        judgment: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
        incentive: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
    };
    reporting: C1ReportingConfig; // base values of unit price and costs
    board: {
        controlStep: boolean; // defines whether the Board will change the targets halfway through the simulation to zero to test controllability
    };
}

// PIPELINE ---------------------------------
export interface C1ConfiguratorParamsDTO extends ConfiguratorParamsDTO {
    data: C1ConfiguratorParamData;
}
