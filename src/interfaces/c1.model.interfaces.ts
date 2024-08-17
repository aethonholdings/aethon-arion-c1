import { OrgModelConfig, AgentSetTensors, PlantConfig, ReportingConfig, ConfiguratorParamsDTO } from "aethon-arion-pipeline";
import { C1ConfiguratorInitType } from "../types/c1.types";

// CONFIG ---------------------------------
export interface C1OrgModelConfig extends OrgModelConfig {
    agentSet: AgentSetTensors;
    plant: C1PlantConfig;
    reporting: C1ReportingConfig;
}

export interface C1PlantConfig extends PlantConfig {
    initialState: number[];
    graph: number[][];
}

export interface C1ReportingConfig extends ReportingConfig {
    unitPayroll: number;
    unitPrice: number;
}

// PIPELINE ---------------------------------
export interface C1ConfiguratorParamsDTO extends ConfiguratorParamsDTO {
    data: {
        spans: number;
        layers: number;
        gains: {
            influence: number;
            judgment: number;
            incentive: number;
        };
        graph: "top-down" | "teams";
        actionStateProbability: number;
        matrixInit: {
            influence: C1ConfiguratorInitType;
            judgment: C1ConfiguratorInitType;
            incentive: C1ConfiguratorInitType;
        };
        reporting: C1ReportingConfig;
    };
}

export interface C1ConfiguratorParamSegment {
    spans?: number | null;
    layers?: number | null;
    gains?: {
        influence?: number | null;
        judgment?: number | null;
        incentive?: number | null;
    };
    graph?: "top-down" | "teams" | null;
    actionStateProbability?: number | null;
    matrixInit?: {
        influence?: C1ConfiguratorInitType | null;
        judgment?: C1ConfiguratorInitType | null;
        incentive?: C1ConfiguratorInitType | null;
    };
    reporting?: C1ReportingConfig | null;
    clockTicks?: number | null;
    agentCount?: number | null;
}
