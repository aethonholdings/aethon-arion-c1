import {
    PlantConfig,
    ReportingConfig,
    ConfiguratorParamData,
    BoardConfig
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
    // "edge" (default, original model): gains.influence per connection; "degree": gains.influence per agent, shared
    // over its connections
    influenceNormalisation?: "edge" | "degree";
    // random influence: "attractive" (default) draws strengths g * U(0, 1); "uniform" draws g * U(-1, 1) per entry
    // (the original mixed attraction and repulsion)
    influenceSigns?: "attractive" | "uniform";
    repulsiveFraction?: number; // share of influence edges that repel instead of attract (default 0)
    hybridNoise?: number; // for "hybrid" initialisation: amplitude of the uniform noise added to the purposeful kernel, as a fraction of the gain (default 0.5)
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

