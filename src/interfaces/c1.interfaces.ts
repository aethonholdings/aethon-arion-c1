import {
    PlantConfig,
    ReportingConfig,
    ConfiguratorParamData,
    BoardConfig,
    OptimiserData,
    OptimiserParameters,
} from "aethon-arion-pipeline";
import { C1ConfiguratorInitType, C1GraphType } from "../types/c1.types";

// CONFIGURATOR ---------------------------------
export interface C1ConfiguratorParamData extends ConfiguratorParamData {
    spans: number; // org chart spans
    layers: number; // org chart layers
    gains: {
        influence: number; // gain applied to initialised tensor kernel in [0,1] range
        judgment: number; // gain applied to initialised tensor kernel in [0,1] range
        incentive: number; // gain applied to initialised tensor kernel in [0,1] range
    };
    graph: C1GraphType; // top-down is a typical tree org | teams is an org where each team is interconnected in an influence lattive
    actionStateProbability: number; // default is 85% (0.85) based on Johnson (1986)
    matrixInit: {
        influence: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
        judgment: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
        incentive: C1ConfiguratorInitType; // random kernel has random values | purposeful kernel has values that drive the agent to the collaboration state | hybrid blends random and purposeful
    };
    board: C1BoardConfig; // defines whether the Board will change the targets halfway through the simulation to zero to test controllability
    reporting: C1ReportingConfig; // defines the unit payroll and unit price for the reporting
}

export interface C1PlantConfig extends PlantConfig {
    initialState: number[];
    graph: number[][];
}

export interface C1ReportingConfig extends ReportingConfig {
    unitPayroll: number;
    unitPrice: number;
}

export interface C1BoardConfig extends BoardConfig {
    controlStep: boolean;
}

// OPTIMISER ---------------------------------
export interface C1ParamSpaceDefinition {
    spans: number[];
    layers: number[];
    gains: {
        influence: number[];
        judgment: number[];
        incentive: number[];
    };
    graph: string[];
    actionStateProbability: number[];
    matrixInit: {
        influence: C1ConfiguratorInitType[];
        judgment: C1ConfiguratorInitType[];
        incentive: C1ConfiguratorInitType[];
    };
    board: boolean[];
}

export interface C1OptimiserData extends OptimiserData {
    derivativeStepSize: {
        spans: number;
        layers: number;
        gains: {
            influence: number;
            judgment: number;
            incentive: number;
        };
        actionStateProbability: number;
    },
    learningRate: number;
    tolerance: number;
    maxIterations?: number;
}