import { lastValueFrom } from "rxjs";
import {
    ConvergenceTestDTO,
    DomainTypes,
    GradientAscentParameters,
    Logger,
    ObjectHash,
    RandomStreamFactory,
    SimConfigDTO,
    SimSetDTO,
    States
} from "aethon-arion-pipeline";
import {
    C1,
    C1ConfiguratorNames,
    C1ModelVersion,
    C1ReportingVariablesIndex,
    KPIFactoryIndex
} from "../src/constants/c1.model.constants";
import { c1DefaultConfiguratorParamData } from "../src/constants/c1.defaults.constants";

const optimiser: any = C1.getDefaultOptimiser();
const simSet = { id: 1, simConfigParams: {} } as unknown as SimSetDTO;
const iterations = { learningRate: 0.01, tolerance: 0.0001, max: 10 };
const completed = (state: any, perf: (dp: any) => number): ConvergenceTestDTO[] =>
    state.optimiserData.dataPoints.map(
        (dp: any, i: number) =>
            ({
                id: i,
                state: States.COMPLETED,
                avgPerformance: perf(dp),
                configuratorParams: dp.data.inputs,
                converged: true
            }) as unknown as ConvergenceTestDTO
    );

describe("C1 optimiser fixes", () => {
    it("moves a discrete parameter whose capped step would round to zero", () => {
        const parameters: GradientAscentParameters = {
            init: { type: "defined", config: { ...c1DefaultConfiguratorParamData(), spans: 2 } },
            parameterSpace: [
                { id: "spans", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 1, max: 5, derivativeStepSize: 1 } }
            ],
            iterations
        };
        const state = optimiser.initialise(parameters, simSet);
        const updated = optimiser.update(parameters, state, completed(state, (dp) => (dp.id === "x" ? 100 : 101)));
        const next = optimiser.step(parameters, updated, []);
        expect(next.optimiserData.dataPoints.find((dp: any) => dp.id === "x").data.inputs.data.spans).toBe(3);
    });

    it("treats a zero-width numerical domain as fixed instead of producing NaN", () => {
        const parameters: GradientAscentParameters = {
            init: { type: "defined", config: { ...c1DefaultConfiguratorParamData(), actionStateProbability: 0.8 } },
            parameterSpace: [
                {
                    id: "actionStateProbability",
                    domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0.8, max: 0.8, derivativeStepSize: 0.1 }
                }
            ],
            iterations
        };
        const state = optimiser.initialise(parameters, simSet);
        expect(state.optimiserData.dataPoints.length).toBe(1);
        const updated = optimiser.update(parameters, state, completed(state, () => 100));
        expect(Number.isNaN(updated.optimiserData.moduloDel)).toBe(false);
    });

    it("fills fields missing from a sparse parameter space with defaults on random init", () => {
        const parameters: GradientAscentParameters = {
            init: { type: "random" },
            parameterSpace: [
                { id: "spans", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 1, max: 3, derivativeStepSize: 1 } }
            ],
            iterations
        };
        const state = optimiser.initialise(parameters, simSet);
        const x = state.optimiserData.dataPoints.find((dp: any) => dp.id === "x").data.inputs;
        expect(x.data.board.controlStep).toBe(false);
        expect(x.data.matrixInit).toBeDefined();
        expect(() => C1.getConfigurator(C1ConfiguratorNames.BASE).generate(x)).not.toThrow();
        expect(x.modelVersion).toBe(C1ModelVersion);
    });

    it("rejects invalid parameter spaces", () => {
        const bad = (parameterSpace: any[]) => ({ init: { type: "random" }, parameterSpace, iterations }) as any;
        expect(() =>
            optimiser.initialise(
                bad([{ id: "spans", domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 1, max: 3, derivativeStepSize: 1 } }]),
                simSet
            )
        ).toThrow();
        expect(() =>
            optimiser.initialise(
                bad([{ id: "spans", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 0, max: 3, derivativeStepSize: 1 } }]),
                simSet
            )
        ).toThrow();
        expect(() =>
            optimiser.initialise(
                bad([{ id: "gains.judgment", domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 1, max: 0, derivativeStepSize: 0.1 } }]),
                simSet
            )
        ).toThrow();
    });

    it("includes the model version in the configurator params hash", () => {
        const data = c1DefaultConfiguratorParamData();
        const hash = C1.hashConfiguratorParams(C1ConfiguratorNames.BASE, data);
        expect(hash).toBe(C1.hashConfiguratorParams(C1ConfiguratorNames.BASE, JSON.parse(JSON.stringify(data))));
        expect(hash).not.toBe(
            new ObjectHash({ modelName: "C1", modelVersion: "1", configuratorName: C1ConfiguratorNames.BASE, data }).toString()
        );
        expect(C1.version).toBe(C1ModelVersion);
    });
});

describe("C1 board and KPI fixes", () => {
    const simConfig = (controlStep: boolean): SimConfigDTO => {
        const params = C1.getConfigurator(C1ConfiguratorNames.BASE).getDefaultParams();
        params.data = { ...params.data, spans: 2, layers: 2, board: { controlStep } };
        const orgConfig = C1.getConfigurator(C1ConfiguratorNames.BASE).generate(params, 1);
        return { id: 1, days: 1, randomStreamType: "random", runCount: 0, orgConfig } as unknown as SimConfigDTO;
    };

    it("targets revenue only over the ticks after the control step", async () => {
        const result = await lastValueFrom(C1.run$(simConfig(true), RandomStreamFactory.seeded(11, 1), new Logger(), "test"));
        const ticks = (1 * 8 * 3600) / 300;
        const headcount = result.reporting[C1ReportingVariablesIndex.HEADCOUNT];
        expect(result.board[C1ReportingVariablesIndex.REVENUE]).toBe(headcount * (ticks - Math.ceil(ticks / 2)));
        expect((result as any).clockTick).toBe(ticks);
    });

    it("reports plant plan versus actual and a payroll build that adds up", async () => {
        const sc = simConfig(false);
        const result = await lastValueFrom(C1.run$(sc, RandomStreamFactory.seeded(11, 1), new Logger(), "test"));
        const kpi: any = C1.getKPIFactory(KPIFactoryIndex.PLAN_VS_ACTUALS).generate({ ...result, simConfig: sc } as any);
        const lines = (name: string) => kpi.data.proFormas.find((p: any) => p.name === name).lineItems;
        const payroll = lines("Payroll build");
        const product = payroll.slice(0, -1).reduce((acc: number, l: any) => acc * l.data.actual, 1);
        expect(product).toBe(payroll[payroll.length - 1].data.actual);
        const plant = lines("Plant state").find((l: any) => l.data.name === "Action").data;
        expect(plant.plan).toBe(1);
        expect(plant.delta).toBe(plant.actual - 1);
    });

    it("returns 0 rather than NaN for sales volume at a zero unit price", async () => {
        const sc = simConfig(false);
        (sc.orgConfig as any).reporting.unitPrice = 0;
        const result = await lastValueFrom(C1.run$(sc, RandomStreamFactory.seeded(11, 1), new Logger(), "test"));
        const kpi: any = C1.getKPIFactory(KPIFactoryIndex.PLAN_VS_ACTUALS).generate({ ...result, simConfig: sc } as any);
        const all = kpi.data.proFormas.flatMap((p: any) => p.lineItems.map((l: any) => l.data));
        expect(all.some((d: any) => d && Number.isNaN(d.actual))).toBe(false);
    });

    it("does not change the input simConfig while running", async () => {
        const sc = simConfig(false);
        const before = JSON.stringify(sc);
        await lastValueFrom(C1.run$(sc, RandomStreamFactory.seeded(11, 1), new Logger(), "test"));
        expect(JSON.stringify(sc)).toBe(before);
    });
});

describe("C1 seeded configurator (common random numbers)", () => {
    const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);
    const params = (data: any) => ({
        modelName: "C1",
        configuratorName: C1ConfiguratorNames.BASE,
        multipleOrgConfigs: true,
        data: { ...c1DefaultConfiguratorParamData(), spans: 2, layers: 2, ...data }
    });

    it("reproduces an org config from its seed", () => {
        expect(configurator.generate(params({}), 42).agentSet).toEqual(configurator.generate(params({}), 42).agentSet);
        expect(configurator.generate(params({}), 42).agentSet).not.toEqual(configurator.generate(params({}), 43).agentSet);
    });

    it("shares the random draws between neighbouring optimiser points", () => {
        // a gain perturbation only rescales the same draws
        const a = configurator.generate(params({ gains: { influence: 1e-5, judgment: 1e-5, incentive: 1e-5 } }), 7);
        const b = configurator.generate(params({ gains: { influence: 1e-5, judgment: 2e-5, incentive: 1e-5 } }), 7);
        const ja = a.agentSet.judgmentTensor.flat(3);
        const jb = b.agentSet.judgmentTensor.flat(3);
        jb.forEach((v: number, i: number) => expect(v).toBeCloseTo(2 * ja[i], 15));
        expect(b.agentSet.incentiveTensor).toEqual(a.agentSet.incentiveTensor);
    });
});
