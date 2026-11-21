import { ConvergenceTestDTO, DomainTypes, GradientAscentParameters, SimSetDTO, States } from "aethon-arion-pipeline";
import { C1, C1ConfiguratorNames } from "../src/constants/c1.model.constants";
import { c1DefaultConfiguratorParamData } from "../src/constants/c1.defaults.constants";
import { pairedDifference } from "../src/classes/optimisers/c1-gradient-ascent.optimiser.class";

const optimiser: any = C1.getDefaultOptimiser();
const simSet = { id: 1, simConfigParams: {} } as unknown as SimSetDTO;
const result = (dp: any, avg: number, extra: any = {}): ConvergenceTestDTO =>
    ({ state: States.COMPLETED, converged: true, avgPerformance: avg, configuratorParams: dp.data.inputs, orgConfigCount: 1, stdDevPerformance: 0, ...extra }) as any;

describe("C1 optimiser v3", () => {
    const continuous = (x0: number, tol = 0.01, lr = 1e-3): GradientAscentParameters => ({
        init: { type: "defined", config: { ...c1DefaultConfiguratorParamData(), actionStateProbability: x0 } },
        parameterSpace: [{ id: "actionStateProbability", domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0.5, max: 1, derivativeStepSize: 0.05 } }],
        iterations: { learningRate: lr, tolerance: tol, maxStepFraction: 1 }
    });
    const f = (x: number) => 100 - 1000 * (x - 0.8) ** 2;

    it("uses central differences: exact slope on a quadratic", () => {
        const p = continuous(0.7);
        const state = optimiser.initialise(p, simSet);
        expect(state.optimiserData.dataPoints.length).toBe(3);
        const updated = optimiser.update(p, state, state.optimiserData.dataPoints.map((dp: any) => result(dp, f(dp.data.inputs.data.actionStateProbability))));
        const slope = updated.optimiserData.dataPoints.find((dp: any) => dp.id !== "x").data.outputs.slope;
        expect(slope).toBeCloseTo(-2000 * (0.7 - 0.8), 8); // f'(0.7) = 200, no delta/2 bias
    });

    it("converges to the optimum without bias", () => {
        // learning rate 2.5e-4: each step halves the distance to the optimum (f'' = -2000)
        let p = continuous(0.6, 1, 2.5e-4);
        let state = optimiser.initialise(p, simSet);
        for (let i = 0; i < 50 && !state.converged; i++) {
            const results = state.optimiserData.dataPoints.map((dp: any) => result(dp, f(dp.data.inputs.data.actionStateProbability)));
            state = optimiser.update(p, state, results);
            if (!state.converged) state = optimiser.step(p, state, results);
        }
        expect(state.converged).toBe(true);
        expect(Math.abs(state.optimiserData.dataPoints.find((dp: any) => dp.id === "x").data.inputs.data.actionStateProbability - 0.8)).toBeLessThan(0.001);
    });

    it("stops a discrete neighbour search at the optimum", () => {
        const p: GradientAscentParameters = {
            init: { type: "defined", config: { ...c1DefaultConfiguratorParamData(), spans: 1 } },
            parameterSpace: [{ id: "spans", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 1, max: 5, derivativeStepSize: 1 } }],
            iterations: { learningRate: 1, tolerance: 0.5 }
        };
        const g = (s: number) => -10 * (s - 3) ** 2;
        let state = optimiser.initialise(p, simSet);
        const path: number[] = [];
        for (let i = 0; i < 10 && !state.converged; i++) {
            const results = state.optimiserData.dataPoints.map((dp: any) => result(dp, g(dp.data.inputs.data.spans)));
            state = optimiser.update(p, state, results);
            path.push(state.optimiserData.dataPoints.find((dp: any) => dp.id === "x").data.inputs.data.spans);
            if (!state.converged) state = optimiser.step(p, state, results);
        }
        expect(state.converged).toBe(true);
        expect(path).toEqual([1, 2, 3]);
    });

    it("pairs differences by replicate and does not move or converge on noise", () => {
        // common scenario noise per replicate: paired difference is exact, unpaired is swamped
        const reps = (base: number) => [1, 2, 3, 4, 5].map((k) => ({ replicate: k, avgPerformance: base + 100 * Math.sin(k), stdDevPerformance: 0, runCount: 1 }));
        const a = { avgPerformance: 10, orgConfigCount: 5, stdDevPerformance: 70, replicates: reps(10) } as any;
        const b = { avgPerformance: 12, orgConfigCount: 5, stdDevPerformance: 70, replicates: reps(12) } as any;
        const paired = pairedDifference(a, b);
        expect(paired.mean).toBeCloseTo(2, 10);
        expect(paired.standardError).toBeCloseTo(0, 10);
        const unpaired = pairedDifference({ ...a, replicates: undefined }, { ...b, replicates: undefined });
        expect(unpaired.standardError).toBeGreaterThan(40);

        // a categorical alternative better by 2 with SE 44 neither moves x nor counts as converged at tol 1
        const p: GradientAscentParameters = {
            init: { type: "defined", config: { ...c1DefaultConfiguratorParamData(), graph: "teams" } },
            parameterSpace: [{ id: "graph", domain: { type: DomainTypes.CATEGORICAL, optimise: true, categories: ["teams", "top-down"] } }],
            iterations: { learningRate: 1, tolerance: 1 }
        };
        const state = optimiser.initialise(p, simSet);
        const results = state.optimiserData.dataPoints.map((dp: any) => result(dp, dp.id === "x" ? 10 : 12, { orgConfigCount: 5, stdDevPerformance: 70 }));
        const updated = optimiser.update(p, state, results);
        expect(updated.converged).toBe(false);
        const next = optimiser.step(p, updated, results);
        expect(next.optimiserData.dataPoints.find((dp: any) => dp.id === "x").data.inputs.data.graph).toBe("teams");
    });

    it("rejects parameter spaces beyond the influence stability limit", () => {
        const errors = optimiser.validateParameters({
            init: { type: "random" },
            parameterSpace: [{ id: "gains.influence", domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0, max: 0.01, derivativeStepSize: 0.001 } }],
            iterations: { learningRate: 1, tolerance: 1 }
        });
        expect(errors.some((e: string) => e.startsWith("gains.influence"))).toBe(true);
    });
});

describe("C1 influence v3", () => {
    const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);
    const make = (influence: string, extra: any = {}, seed = 3) =>
        configurator.generate(
            {
                modelName: "C1",
                configuratorName: C1ConfiguratorNames.BASE,
                multipleOrgConfigs: true,
                data: { ...c1DefaultConfiguratorParamData(), spans: 3, layers: 3, graph: "top-down", gains: { influence: 1e-5, judgment: 1e-5, incentive: 1e-5 }, matrixInit: { influence, judgment: "null", incentive: "null" }, influenceConsensusHours: null, ...extra }
            },
            seed
        );

    it("makes random influence attractive and degree-normalised", () => {
        const oc = make("random");
        const I = oc.agentSet.influenceTensor;
        for (let a = 0; a < oc.agentCount; a++) {
            const sum = I[a].reduce((acc: number, row: any) => acc + row[0][0], 0);
            expect(sum).toBeLessThanOrEqual(0);
            expect(sum).toBeGreaterThanOrEqual(-1e-5 - 1e-18);
            for (const row of I[a]) expect(row[0][0]).toBeLessThanOrEqual(0);
        }
        expect(oc.diagnostics!.stable).toBe(true);
    });

    it("normalises purposeful influence so each agent's couplings sum to -g", () => {
        const oc = make("purposeful");
        for (let a = 0; a < oc.agentCount; a++) {
            expect(oc.agentSet.influenceTensor[a].reduce((acc: number, row: any) => acc + row[1][0], 0)).toBeCloseTo(-1e-5, 15);
        }
        expect(oc.diagnostics!.consensusTimeHours).toBeGreaterThan(0);
        expect(oc.diagnostics!.stepFactor).toBeCloseTo(3e-3, 12);
    });

    it("turns the requested share of edges repulsive and reports instability", () => {
        const oc = make("purposeful", { repulsiveFraction: 1 });
        for (const row of oc.agentSet.influenceTensor.flat()) expect(row[0][0]).toBeGreaterThanOrEqual(0);
        expect(oc.diagnostics!.stable).toBe(false);
        expect(oc.diagnostics!.growthTimeHours).toBeGreaterThan(0);
    });

    it("rejects influence gains beyond the stability limit and invalid fractions", () => {
        expect(() => make("purposeful", { gains: { influence: 0.01, judgment: 1e-5, incentive: 1e-5 } })).toThrow(/stability limit/);
        expect(() => make("purposeful", { repulsiveFraction: 1.5 })).toThrow();
        expect(() => make("hybrid", { hybridNoise: 2 })).toThrow();
    });
});

describe("C1 influence consensus time target", () => {
    const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);
    const make = (spans: number, layers: number, graph: string, influence: string, hours: number | null, seed = 5) =>
        configurator.generate(
            {
                modelName: "C1",
                configuratorName: C1ConfiguratorNames.BASE,
                multipleOrgConfigs: true,
                data: { ...c1DefaultConfiguratorParamData(), spans, layers, graph, matrixInit: { influence, judgment: "null", incentive: "null" }, influenceConsensusHours: hours }
            },
            seed
        );

    for (const [spans, layers, graph] of [[3, 2, "teams"], [3, 3, "top-down"], [4, 3, "teams"], [2, 5, "top-down"]] as const) {
        for (const influence of ["purposeful", "random", "hybrid"]) {
            it(`meets a 24 h target for spans=${spans}, layers=${layers}, ${graph}, ${influence}`, () => {
                const d = make(spans, layers, graph, influence, 24).diagnostics!;
                expect(d.influenceGain).toBeLessThanOrEqual(1 / 300 + 1e-15);
                if (d.consensusTargetMet) {
                    expect(d.consensusTimeHours).toBeCloseTo(24, 6);
                } else {
                    // unreachable within the stability limit: gain capped at the limit, consensus slower than the target
                    expect(d.influenceGain).toBeCloseTo(1 / 300, 12);
                    expect(d.consensusTimeHours).toBeGreaterThan(24);
                }
                // purposeful influence reaches the default target for every hierarchy tested
                if (influence === "purposeful") expect(d.consensusTargetMet).toBe(true);
            });
        }
    }

    it("caps the gain at the stability limit and reports an unreachable target", () => {
        const d = make(2, 5, "top-down", "purposeful", 1).diagnostics!;
        expect(d.consensusTargetMet).toBe(false);
        expect(d.influenceGain).toBeCloseTo(1 / 300, 12);
        expect(d.consensusTimeHours).toBeGreaterThan(1);
        expect(d.stable).toBe(true);
    });

    it("uses gains.influence when the target is null", () => {
        expect(make(3, 2, "teams", "purposeful", null).diagnostics!.influenceGain).toBe(c1DefaultConfiguratorParamData().gains.influence);
    });

    it("requires the target to be off when gains.influence is optimised", () => {
        const space = (extra: any[]) => ({
            init: { type: "random" },
            parameterSpace: [{ id: "gains.influence", domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 1e-6, max: 1e-3, derivativeStepSize: 1e-5 } }, ...extra],
            iterations: { learningRate: 1, tolerance: 1 }
        });
        expect(optimiser.validateParameters(space([])).some((e: string) => e.startsWith("gains.influence is ignored"))).toBe(true);
        expect(
            optimiser.validateParameters(space([{ id: "influenceConsensusHours", domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: null } }]))
        ).toEqual([]);
    });
});
