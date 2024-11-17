import { C1Model } from "../classes/model/c1-model.class";

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

export const C1AgentStatesArray: string[] = [C1AgentStates.ACTION, C1AgentStates.SELF];

// PLANT STATE VARIABLES -------------------------------

export enum C1PlantStateVariablesIndex {
    ACTION = 0
}

export enum C1PlantStateVariables {
    ACTION = "Action"
}

export const C1PlantStateVariablesArray: string[] = [C1PlantStateVariables.ACTION];

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
    CLOCK_TICKS = "Clock ticks"
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

// The C1 model
export const C1: C1Model = new C1Model();
