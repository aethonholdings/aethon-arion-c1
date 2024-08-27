// BASE CONSTANTS --------------------------------
export const C1ModelName: string = "C1";
export const C1ModelClockTickSeconds: number = 300;

// AGENT SET ---------------------------------
export enum C1AgentStateIndex {
    ACTION = 0,
    SELF = 1
}

export enum C1AgentStates {
    ACTION = "Action",
    SELF = "Self"
}

export const C1AgentStatesArray: string[] = [
    C1AgentStates.ACTION,
    C1AgentStates.SELF
]

// PLANT STATE VARIABLES -------------------------------

export enum C1PlantStateVariablesIndex {
    ACTION = 0
}

export enum C1PlantStateVariables {
    ACTION = "Action"
}

export const C1PlantStateVariablesArray: string[] = [
    C1PlantStateVariables.ACTION
];

export const C1PlantStateTarget: number[] = [1];
export const C1PlantStateIdle: number[] = [0];

// REPORTING ---------------------------------
export enum C1ReportingVariablesIndex {
    REVENUE = 0,
    PAYROLL = 1,
    NET_INCOME = 2,
    HEADCOUNT = 3,
    UNIT_PAYROLL = 4,
    UNIT_PRICE = 5,
    CLOCK_TICK_SECONDS = 6,
    CLOCK_TICKS = 7
}

export enum C1ReportingVariables {
    REVENUE = "Revenue",
    PAYROLL = "Payroll costs",
    NET_INCOME = "Net income",
    HEADCOUNT = "Headcount",
    UNIT_PAYROLL = "Unit payroll costs",
    UNIT_PRICE = "Sales price unit price",
    CLOCK_TICK_SECONDS = "Clock tick seconds",
    CLOCK_TICKS = "Clock ticks",
}

export const C1ReportingVariablesArray: string[] = [
    C1ReportingVariables.REVENUE,
    C1ReportingVariables.PAYROLL,
    C1ReportingVariables.NET_INCOME,
    C1ReportingVariables.HEADCOUNT,
    C1ReportingVariables.UNIT_PAYROLL,
    C1ReportingVariables.UNIT_PRICE,
    C1ReportingVariables.CLOCK_TICK_SECONDS,
    C1ReportingVariables.CLOCK_TICKS
];

// Result set
export enum C1RegressionInputVariableColumnIndices {
    AGENT_COUNT = 0,
    INFLUENCE_NULL = 1,
    INFLUENCE_RANDOM = 2,
    INFLUENCE_HYBRID = 3,
    INFLUENCE_PURPOSEFUL = 4,
    JUDGMENT_NULL = 5,
    JUDGMENT_RANDOM = 6,
    JUDGMENT_HUBRID = 7,
    JUDGMENT_PURPOSEFUL = 8,
    INCENTIVE_NULL = 9,
    INCENTIVE_RANDOM = 10,
    INCENTIVE_HYBRID = 11,
    INCENTIVE_PURPOSEFUL = 12,
    INFLUENCE_GAIN = 13,
    JUDGMENT_GAIN = 14,
    INCENTIVE_GAIN = 15,
    CLOCK_TICKS = 16
}